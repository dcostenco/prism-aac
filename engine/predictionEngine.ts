import { WordFreqEntry, PredictionConfig } from '@/types';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';
import { getStemmer, type Stemmer } from '@/engine/stemmers';
import { isPluralTwin, normalizePredictionSpelling, predictionWordKey, preferredPredictionSpelling, matchesPredictionPrefix, matchesPredictionContext, predictionTokenParts } from '@/engine/predictionSpellings';
import { getReviewedBasicWords } from '@/constants/reviewedBasicWords';

const DEFAULT_CONFIG: PredictionConfig = {
  bigramWeight: 0.5,
  frequencyWeight: 0.3,
  recencyWeight: 0.2,
  maxResults: 5,
  recencyWindowMs: 600_000,
};

// All algorithm-internal tuning lives here so it can be audited in one place.
// Every value carries a justification — no arbitrary magic numbers scattered
// through the code. Anything derived from CONTEXT (e.g. stem-grouping length)
// is computed inline at call site, not stored here.
const TUNING = {
  // Candidate pool caps — how many top-N entries we consider from each
  // dictionary before merging into the candidate map. Sized to maxResults*N
  // so we have ~3-6× headroom for filters (script, prefix, dedup) without
  // pulling the whole dictionary on every keystroke.
  trigramPoolSize: 15,
  bigramPoolSize: 20,
  prefixPoolSize: 30,
  freqPoolSize: 30,
  recencyPoolSize: 20,

  // Internal score weights — applied AFTER the user-facing weights in
  // PredictionConfig. Trigrams override bigram/freq when present (they
  // encode 3-word context). Prefix matches dominate when the user is
  // mid-typing because completing-the-word is more useful than predicting
  // the next word from a half-typed fragment.
  trigramOverrideWeight: 0.35,
  prefixOverrideWeight: 0.3,

  // User-typed n-grams get a multiplier when merged with corpus so a
  // count=2 personal bigram outranks a count=10 generic corpus bigram.
  // Without this, the user's own typing patterns can never overtake the
  // seed because the corpus baseline is ~5-50× larger.
  userNgramBoost: 10,

  // LRU caps for persisted dicts — chosen to keep localStorage well under
  // the 5MB browser quota. Bigger words dict than n-grams because users
  // type many more unique words than unique 2/3-word collocations.
  maxWords: 5000,
  maxBigrams: 3000,
  maxTrigrams: 2000,
  // Eviction watermark: when over cap, evict down to 90% so the O(N log N)
  // sort runs once per ~500 keystrokes instead of every keystroke.
  evictionWatermark: 0.9,

  // Decay parameters — entries untouched for 7 days get their count
  // multiplied by 0.95; single-use entries older than 30 days are dropped
  // entirely (typo cleanup). 7/30 day windows match the natural cadence
  // of vocabulary rotation in AAC users (weekly = active vocab, monthly
  // = forgotten typos).
  decayAfterMs: 7 * 24 * 60 * 60 * 1000,
  pruneAfterMs: 30 * 24 * 60 * 60 * 1000,
  decayFactor: 0.95,

  // A partial with at least this many corpus occurrences is common enough to
  // treat as a complete word during a typing pause. The threshold is shared
  // with auto-speech so prediction and speech cannot disagree about whether
  // short utterances such as English "I" are words or unfinished letters.
  completeWordCount: 100,
} as const;

import { isAgeBlocked } from '@/engine/ageBlocklist';


type Scores = { bigram: number; trigram: number; freq: number; recency: number; prefix: number };

// Words that should ALWAYS be capitalized when emitted as a prediction.
// Only English needs this rule (the first-person pronoun "I"). Other
// languages must NOT receive this set, otherwise loanword pollution
// (e.g. wordfreq RU corpus contains English "i" at low count) would leak
// "I" into non-English suggestions.
const ALWAYS_CAPITALIZED_EN = new Set(['i']);

// Tokenizer artifacts that leak into corpora from contractions (e.g. I'm, it's, don't, l'arbre).
// We filter these out so they never surface as standalone word predictions.
const ARTIFACTS_BY_LANG: Record<string, Set<string>> = {
  en: new Set(['m', 's', 't', 'll', 'd', 're', 've']),
  fr: new Set(['l', 'n', 'j', 'qu', 'c', 'm', 's', 't', 'd', 'y']),
  de: new Set(['s', 'm']),
  ro: new Set(['m', 's', 't', 'ț', 'v', 'n', 'c', 'd', 'l']),
  es: new Set(['d']),
  pt: new Set(['d']),
};

/** What getPredictions completed: the typed word and the prefix it used. */
export interface PredictionCompletionInfo {
  partialWord?: string;
  completionPrefix?: string;
}

// Languages written without spaces: the "partial word" is the whole run of
// text, so dropping letters would offer words the user already typed.
const UNSEGMENTED_LANGS = new Set(['zh', 'ja']);
// A backed-off prefix keeps at least this many letters and drops at most
// BACKOFF_MAX_DROP: typo tolerance, not a dictionary dump for names.
const BACKOFF_MIN_PREFIX = 3;
const BACKOFF_MAX_DROP = 2;

/**
 * The prefix to complete for a typed partial word (already normalized, as
 * getPredictions derives it). Returns the partial itself unless nothing in
 * the dictionary completes it and it is not a word itself; then the longest
 * prefix, at most BACKOFF_MAX_DROP letters shorter and at least
 * BACKOFF_MIN_PREFIX long, that something does complete.
 */
export function predictionCompletionPrefix(
  partialWord: string,
  wordFreq: Record<string, WordFreqEntry>,
  lang = 'en',
): string {
  const letters = [...partialWord];
  if (letters.length <= BACKOFF_MIN_PREFIX || UNSEGMENTED_LANGS.has(lang.split('-')[0])) return partialWord;
  const typedKey = predictionWordKey(partialWord, lang);
  if (wordFreq[typedKey] || getReviewedBasicWords(lang).has(typedKey)) return partialWord;
  // Longest first. A word whose key IS the typed word also matches it as a
  // prefix (ro "esti" = ești), so one match on the full word means "no
  // back-off" whether it is a completion or the word itself. One pass: most
  // words fail the shortest prefix and cost a single check.
  const prefixes = [partialWord];
  for (let drop = 1; drop <= BACKOFF_MAX_DROP && letters.length - drop >= BACKOFF_MIN_PREFIX; drop++) {
    prefixes.push(letters.slice(0, letters.length - drop).join(''));
  }
  const shortest = prefixes[prefixes.length - 1];
  // The gate assumes a word matching a longer prefix matches the shortest.
  // A shortest prefix that is a spelling alias (ro "esti" = ești, de "weiss"
  // = weiß) only matches its standard form, so it cannot gate "estimat".
  const normalizedShortest = normalizePredictionSpelling(shortest, lang);
  const gated = predictionWordKey(normalizedShortest, lang) === normalizedShortest;
  let best = prefixes.length;
  for (const word of Object.keys(wordFreq)) {
    if (gated && !matchesPredictionPrefix(word, shortest, lang)) continue;
    for (let i = 0; i < best; i++) {
      if (matchesPredictionPrefix(word, prefixes[i], lang)) {
        if (i === 0) return partialWord;
        best = i;
        break;
      }
    }
  }
  return best === prefixes.length ? partialWord : prefixes[best];
}

export function isConfidentCompleteWord(
  value: string,
  wordFreq: Record<string, WordFreqEntry>,
  lang = 'en',
): boolean {
  const word = predictionWordKey(value.trim(), lang);
  if (!word) return false;
  const artifacts = ARTIFACTS_BY_LANG[lang] ?? new Set<string>();
  if (artifacts.has(word)) return false;
  // Locale corpora have different count scales. Exact reviewed vocabulary is
  // a real complete word even below the English-derived frequency threshold.
  if (getReviewedBasicWords(lang).has(word)) return true;
  if ((wordFreq[word]?.count ?? 0) >= TUNING.completeWordCount) return true;
  return Object.entries(wordFreq).some(([key, entry]) =>
    entry.count >= TUNING.completeWordCount && predictionWordKey(key, lang) === word);
}

export function mergeUserNgramsWithBoost(
  corpus: Record<string, WordFreqEntry>,
  user: Record<string, WordFreqEntry>,
): Record<string, WordFreqEntry> {
  const out = { ...corpus };
  for (const [k, v] of Object.entries(user)) {
    const existing = out[k];
    out[k] = {
      count: (existing?.count ?? 0) + v.count * TUNING.userNgramBoost,
      lastUsed: v.lastUsed ?? existing?.lastUsed ?? 0,
    };
  }
  return out;
}

/**
 * Give words the bar should rank last (constants/predictionRankLast) a count
 * below every seed word (whose minimum is 1), so they never outrank or tie
 * other completions but still show when they are what matches. A word the user has used keeps its count, so a
 * learned name ranks as before. Mutates and returns `merged`, which must be a
 * fresh copy (mergeUserNgramsWithBoost returns one); the seed itself is never
 * touched because the language gate reads its counts.
 */
/** Below the seed's minimum count of 1, so a ranked-last word never ties an ordinary rare word. */
const RANK_LAST_COUNT = 0.5;

export function rankLastUnlessUsed(
  merged: Record<string, WordFreqEntry>,
  rankLast: ReadonlySet<string>,
  user: Record<string, WordFreqEntry>,
): Record<string, WordFreqEntry> {
  for (const word of rankLast) {
    const entry = merged[word];
    if (entry && entry.count > RANK_LAST_COUNT && !user[word]) merged[word] = { ...entry, count: RANK_LAST_COUNT };
  }
  return merged;
}

/**
 * Merge read-only prediction sources without allowing a weaker source to
 * erase stronger evidence from an earlier one.
 *
 * Object spread is unsafe here: the curated AAC phrase seed often contains
 * the same n-gram as the larger language corpus with a much smaller count.
 * A later spread used to replace corpus evidence such as `i|need` instead of
 * supplementing it, which made generic or unrelated continuations outrank a
 * critical phrase. Counts are not summed because the sources can overlap;
 * keeping the strongest count avoids double-counting duplicated material.
 */
export function mergePredictionBaselines(
  ...sources: Array<Record<string, WordFreqEntry>>
): Record<string, WordFreqEntry> {
  const merged: Record<string, WordFreqEntry> = {};
  for (const source of sources) {
    for (const [key, entry] of Object.entries(source)) {
      const current = merged[key];
      if (!current) {
        merged[key] = { ...entry };
        continue;
      }
      merged[key] = {
        ...(entry.count > current.count ? entry : current),
        count: Math.max(current.count, entry.count),
        lastUsed: Math.max(current.lastUsed, entry.lastUsed),
        lastDecayedAt: Math.max(
          current.lastDecayedAt ?? 0,
          entry.lastDecayedAt ?? 0,
        ) || undefined,
      };
    }
  }
  return merged;
}

/**
 * Merge a broad language corpus with clinician-curated AAC n-grams.
 *
 * The broad corpus supplies coverage, while the curated source supplies
 * communicative relevance. For each shared context prefix, curated
 * continuations are placed just above the strongest generic continuation and
 * retain their own relative counts. This is data-driven source precedence:
 * no phrase or language is special-cased. The personalized user boost remains
 * additive afterward, so selecting one curated continuation raises it above
 * otherwise-equal curated peers on the next pass.
 */
export function mergePredictionContextBaselines(
  corpus: Record<string, WordFreqEntry>,
  curated: Record<string, WordFreqEntry>,
): Record<string, WordFreqEntry> {
  const merged: Record<string, WordFreqEntry> = {};
  const strongestByContext = new Map<string, number>();

  for (const [key, entry] of Object.entries(corpus)) {
    merged[key] = { ...entry };
    const separator = key.lastIndexOf('|');
    if (separator < 0) continue;
    const context = key.slice(0, separator);
    strongestByContext.set(
      context,
      Math.max(strongestByContext.get(context) ?? 0, entry.count),
    );
  }

  for (const [key, entry] of Object.entries(curated)) {
    const separator = key.lastIndexOf('|');
    if (separator < 0) {
      const current = merged[key];
      merged[key] = current
        ? {
            ...(entry.count > current.count ? entry : current),
            count: Math.max(current.count, entry.count),
            lastUsed: Math.max(current.lastUsed, entry.lastUsed),
          }
        : { ...entry };
      continue;
    }
    const context = key.slice(0, separator);
    const genericCeiling = strongestByContext.get(context) ?? 0;
    const current = merged[key] ?? entry;
    merged[key] = {
      ...(entry.count > current.count ? entry : current),
      count: Math.max(current.count, genericCeiling + entry.count),
      lastUsed: Math.max(current.lastUsed, entry.lastUsed),
      lastDecayedAt: Math.max(
        current.lastDecayedAt ?? 0,
        entry.lastDecayedAt ?? 0,
      ) || undefined,
    };
  }

  return merged;
}

export function getPredictions(
  currentText: string,
  wordFreq: Record<string, WordFreqEntry>,
  bigrams: Record<string, WordFreqEntry>,
  config = DEFAULT_CONFIG,
  trigrams?: Record<string, WordFreqEntry>,
  fallback: readonly string[] = DEFAULT_PREDICTIONS,
  alwaysCapitalized: Set<string> = ALWAYS_CAPITALIZED_EN,
  scriptFilter?: RegExp,
  lang?: string,
  out?: PredictionCompletionInfo,
): string[] {
  // Strip punctuation from context tokens before any n-gram lookup.
  //
  // The dictionaries are keyed on bare words ("you|are"), but a tokenizer that
  // only splits on whitespace leaves punctuation glued to the word ("you?").
  // Measured against the en seed: 151 bigram keys start with "you|" and ZERO
  // start with "you?|". So every word carrying a comma or a sentence-ender
  // silently zeroed the context for the next one or two predictions, and the
  // bar fell back to raw corpus frequency ("I / To / A / You / The"). AAC
  // utterances are short and punctuated, so this fired constantly.
  //
  // Matching normalizes keyboard spelling; candidate text and stored dictionaries
  // retain their words. Combining marks are part of a word, including its end.
  const rawWords = currentText.trim().split(/\s+/).filter(Boolean);
  const bare = (w: string) => normalizePredictionSpelling(predictionTokenParts(w).word, lang);
  const words = rawWords.map(bare).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1] : '';

  // Mid-word vs end-of-word matters for which words count as "context".
  // If the user is mid-typing ("my ma"), lastWord is the partial fragment
  // and the COMPLETE history is words[..-2]. If they just hit space ("my "),
  // lastWord is the most recent complete word and history is words[..-1].
  //
  // Trailing punctuation also ends a word: after "you?" the user has finished
  // "you", so we must predict the NEXT word rather than offer prefix
  // completions of a word they already closed ("your", "young").
  const rawLast = rawWords.length > 0 ? rawWords[rawWords.length - 1] : '';
  const closedByPunctuation = /[^\p{L}\p{M}\p{N}'-]$/u.test(rawLast);
  const partialWord = currentText.endsWith(' ') || closedByPunctuation ? '' : lastWord;
  const isMidWord = !!partialWord;
  const ctxLastIdx = isMidWord ? words.length - 2 : words.length - 1;
  const ctxLast = ctxLastIdx >= 0 ? words[ctxLastIdx] : '';
  const ctxPrev = ctxLastIdx - 1 >= 0 ? words[ctxLastIdx - 1] : '';
  // Legacy alias kept for the (now narrower) "next-word after lastWord" lookups
  // used when NOT mid-typing.
  const prevWord = words.length > 1 ? words[words.length - 2] : '';

  // Sentence-start detection: capitalize the next prediction if we're at the
  // start of the message OR right after sentence-ending punctuation.
  const trimmed = currentText.trimEnd();
  const isSentenceStart = trimmed === '' || /[.!?]$/.test(trimmed);

  const candidateMap = new Map<string, Scores>();
  // Equivalent reviewed spellings share evidence before ranking, rather than
  // discarding a duplicate after one spelling has lost its context score.
  const getOrCreate = (w: string) => {
    const key = predictionWordKey(w, lang);
    return candidateMap.get(key) ?? (() => { const s: Scores = { bigram: 0, trigram: 0, freq: 0, recency: 0, prefix: 0 }; candidateMap.set(key, s); return s; })();
  };
  const boost = (word: string, part: keyof Scores, value: number) => {
    const scores = getOrCreate(word);
    scores[part] = Math.max(scores[part], value);
  };

  // (1) Predict NEXT WORD — works whether the user is mid-word or just hit
  // space. When mid-word the partial is treated optimistically as "almost a
  // complete word" (predictable.app style: "I wan" still surfaces what comes
  // after "want").
  if (trigrams && prevWord && lastWord) {
    const triKey = prevWord + '|' + lastWord + '|';
    const triEntries = Object.entries(trigrams)
      .filter(([k]) => matchesPredictionContext(k, triKey, lang))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.trigramPoolSize);
    const maxTri = triEntries.length > 0 ? triEntries[0][1].count : 1;
    for (const [key, val] of triEntries) {
      const word3 = key.split('|')[2];
      boost(word3, 'trigram', val.count / maxTri);
    }
  }
  if (lastWord) {
    const bigramEntries = Object.entries(bigrams)
      .filter(([k]) => matchesPredictionContext(k, lastWord + '|', lang))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.bigramPoolSize);
    const maxBigram = bigramEntries.length > 0 ? bigramEntries[0][1].count : 1;
    for (const [key, val] of bigramEntries) {
      boost(key.split('|')[1], 'bigram', val.count / maxBigram);
    }
  }

  // (2) MID-WORD CONTEXT — when the user is mid-typing AND there's a
  // previous complete word, look up bigrams/trigrams that would COMPLETE
  // the partial in the context of that prev word. This is what makes
  // "my ma" → "main" work: bigram "my|main" boosts "main" over generic
  // ma- corpus neighbors. Trigrams handle "my main re" → "reason" once
  // "my|main|reason" has been seen.
  if (isMidWord && ctxLast) {
    const partialPrefix = ctxLast + '|' + partialWord;
    const bigramEntries = Object.entries(bigrams)
      .filter(([k]) => matchesPredictionContext(k, partialPrefix, lang))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.bigramPoolSize);
    const maxBigram = bigramEntries.length > 0 ? bigramEntries[0][1].count : 1;
    for (const [key, val] of bigramEntries) {
      const completion = key.split('|')[1];
      // Stack on top of any existing bigram score from the next-word lookup.
      const existing = getOrCreate(completion);
      existing.bigram = Math.max(existing.bigram, val.count / maxBigram);
    }
  }
  if (isMidWord && trigrams && ctxPrev && ctxLast) {
    const partialPrefix = ctxPrev + '|' + ctxLast + '|' + partialWord;
    const triEntries = Object.entries(trigrams)
      .filter(([k]) => matchesPredictionContext(k, partialPrefix, lang))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.trigramPoolSize);
    const maxTri = triEntries.length > 0 ? triEntries[0][1].count : 1;
    for (const [key, val] of triEntries) {
      const completion = key.split('|')[2];
      const existing = getOrCreate(completion);
      existing.trigram = Math.max(existing.trigram, val.count / maxTri);
    }
  }

  // An incomplete word must not drop the bar to unrelated core words. When no
  // dictionary word starts with what was typed (ru "рыби": the seed has рыба,
  // рыбы, рыбу but nothing in "рыби"), complete a slightly shorter prefix
  // instead ("рыб" -> рыба, рыбы, рыбу). The typed word itself still drives
  // context, the complete-word check and the "never suggest what was typed"
  // rule. Backed-off candidates are never shorter than what was typed.
  const completionPrefix = predictionCompletionPrefix(partialWord, wordFreq, lang);
  const backedOff = completionPrefix !== partialWord;
  const typedLength = [...partialWord].length;
  if (out) {
    out.partialWord = partialWord;
    out.completionPrefix = completionPrefix;
  }

  // Prefix matching — if user is mid-word, surface completions, weighted by
  // each candidate's overall frequency so common words like "main"/"make"
  // outrank obscure prefix neighbors.
  //
  // Pool size scales with partial length: short partials (1-2 chars) need
  // a much larger pool because thousands of words match and the top-30 by
  // raw web-text frequency is dominated by function words ("для", "до",
  // "the", "of"). Concrete AAC-essential nouns ("дуб" at wordfreq rank
  // ~17K) only enter the pool when we look further down the frequency
  // curve. Longer partials (3+ chars) naturally narrow the candidate
  // count, so a smaller pool is fine.
  if (completionPrefix) {
    const prefixCands: Array<{ word: string; count: number }> = [];
    for (const word of Object.keys(wordFreq)) {
      if (matchesPredictionPrefix(word, completionPrefix, lang) && predictionWordKey(word, lang) !== predictionWordKey(partialWord, lang)) {
        prefixCands.push({ word, count: wordFreq[word].count });
      }
    }
    prefixCands.sort((a, b) => b.count - a.count);
    const poolSize =
      completionPrefix.length === 1 ? 300 :
      completionPrefix.length === 2 ? 150 :
      TUNING.prefixPoolSize;
    const topPrefix = prefixCands.slice(0, poolSize);
    const maxPrefix = topPrefix.length > 0 ? topPrefix[0].count : 1;
    for (const { word, count } of topPrefix) {
      boost(word, 'prefix', count / maxPrefix);
    }
  }

  // Frequency
  const freqEntries = Object.entries(wordFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TUNING.freqPoolSize);
  const maxFreq = freqEntries.length > 0 ? freqEntries[0][1].count : 1;
  for (const [word, val] of freqEntries) {
    boost(word, 'freq', val.count / maxFreq);
  }

  // Recency
  const now = Date.now();
  const recentEntries = Object.entries(wordFreq)
    .filter(([, v]) => now - v.lastUsed < config.recencyWindowMs)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TUNING.recencyPoolSize);
  const maxRecent = recentEntries.length > 0 ? recentEntries[0][1].count : 1;
  for (const [word, val] of recentEntries) {
    boost(word, 'recency', val.count / maxRecent);
  }

  // Weighted scoring — trigram > prefix > bigram > freq > recency
  const trigramWeight = trigrams ? TUNING.trigramOverrideWeight : 0;
  const prefixWeight = partialWord ? TUNING.prefixOverrideWeight : 0;
  const bigramW = config.bigramWeight * (1 - trigramWeight - prefixWeight / 2);
  const freqW = config.frequencyWeight * (1 - trigramWeight / 2);
  const recencyW = config.recencyWeight;

  // The "partial-is-complete-word" check decides whether to allow non-prefix
  // candidates through the filter. A confidently common standalone word
  // (English "to" count 963, "I" 1732, "you" 867) means the user might be
  // done typing it and ready for next-word predictions like "to|be".
  // A low-count fragment ("re" 49, "act" 49) is almost certainly the start
  // of a longer word (really, action) and we should only surface
  // prefix-completing candidates. Threshold of 100 was chosen by inspecting
  // the en seed: it cleanly separates common AAC standalone words from
  // mid-word fragments, given seed counts run 1-2000.
  const partialIsCompleteWord = isConfidentCompleteWord(partialWord, wordFreq, lang);
  // Halve prefix weight when the partial is a complete word, so bigram
  // continuations ("to|listen", "to|be", "I|want") outweigh prefix
  // self-extensions ("to" → "today"). For fragments, prefix still
  // dominates so "re" → "really" works as expected.
  const effectivePrefixWeight = partialIsCompleteWord ? prefixWeight * 0.5 : prefixWeight;

  const artifacts = ARTIFACTS_BY_LANG[lang ?? 'en'] ?? new Set<string>();
  const seenSpellings = new Set<string>();

  // Build the score-ranked candidate list. Each candidate carries its raw
  // score components so the filter can distinguish "this matches because
  // we predicted the next word" (bigram/trigram score) from "this matches
  // because letters happen to overlap" (freq/recency only).
  const filtered = [...candidateMap.entries()]
    .map(([word, s]) => ({
      word,
      total: s.trigram * trigramWeight + s.prefix * effectivePrefixWeight + s.bigram * bigramW + s.freq * freqW + s.recency * recencyW,
      hasContext: s.bigram > 0 || s.trigram > 0,
    }))
    .filter((c) => {
      const lc = normalizePredictionSpelling(c.word, lang);
      if (isAgeBlocked(lc, lang)) return false;
      if (artifacts.has(lc)) return false;
      if (predictionWordKey(lc, lang) === predictionWordKey(lastWord, lang) || predictionWordKey(lc, lang) === predictionWordKey(partialWord, lang)) return false;
      // Mid-typing rule: surface candidates that complete the partial word.
      // EXCEPTION — if (a) the partial is itself a confidently complete
      // word AND (b) the candidate carries bigram/trigram score, it's a
      // contextually relevant next-word. E.g. user types "to" → "be"
      // surfaces via "to|be" bigram alongside "together"/"top". Without
      // this exception, AAC users typing common short words only see
      // prefix completions, never useful next-word continuations.
      if (partialWord && !matchesPredictionPrefix(lc, completionPrefix, lang) && !(c.hasContext && partialIsCompleteWord)) return false;
      if (backedOff && [...lc].length < typedLength) return false;
      // Drop wrong-script words. Necessary because the store's initial
      // wordFreq state seeds with English DEFAULT_PHRASES, which leak into
      // non-English sessions (e.g. "I" appearing for a Russian user).
      if (scriptFilter && !scriptFilter.test(lc)) return false;
      return true;
    })
    .sort((a, b) => b.total - a.total)
    .filter(candidate => {
      const key = predictionWordKey(candidate.word, lang);
      if (seenSpellings.has(key)) return false;
      seenSpellings.add(key);
      return true;
    })
    .map(candidate => ({ ...candidate, word: preferredPredictionSpelling(candidate.word, lang) }));

  // Stem-diversity filter — when many prefix matches are inflected forms of
  // the same lemma (e.g. ru "думать/думал/думала/думают" stem to "дума";
  // en "running/runs" stem to "run"), they crowd out alternative lemmas
  // sharing the user-typed prefix (e.g. ru "дуб", en "real" vs "really").
  //
  // We use a real per-language morphological stemmer when available
  // (Snowball for en/es/fr/pt/de/ro/ru/ar; custom heuristics for uk/ja/ko;
  // see engine/stemmers/). When no stemmer is registered for the language
  // (zh-*, or unknown lang), fall back to char-prefix grouping with the
  // partial-word-length-plus-one strategy — this still groups words that
  // share their next character into one bucket.
  //
  // Either way, the greedy pass is followed by a backfill so the prediction
  // bar is never under-filled. When there's no partial word (text ends
  // with space), we predict the next word — no shared root to cluster.
  const stemmer: Stemmer | null = lang ? getStemmer(lang) : null;
  const groupKey = (w: string): string | null => {
    if (!partialWord) return null;
    if (stemmer) {
      const normalized = normalizePredictionSpelling(w, lang);
      const stem = stemmer(normalized);
      // Never produce a key shorter than the user-typed prefix — otherwise
      // a stem like "ду" would collapse all ду* words into one bucket and
      // the user couldn't see alternative continuations they're aiming at.
      return stem.length >= completionPrefix.length ? stem : normalized.slice(0, completionPrefix.length + 1);
    }
    return normalizePredictionSpelling(w, lang).slice(0, completionPrefix.length + 1);
  };
  // Cap forms per stem at MAX_PER_STEM. Strict 1-per-stem was too
  // aggressive for noun declensions where different forms ARE different
  // communicative content: ro "timp" (time, indef.) and "timpul" (the
  // time, def.) both belong on the bar; ru "вод" must keep "вода" next to
  // "воды". 2 strikes a balance — Russian conjugation families still
  // collapse to 2 representatives instead of 5.
  const MAX_PER_STEM = 2;
  // The second form is not worth a slot when it is only an already-shown
  // word plus a plural or possessive ending: "german / germans",
  // "beer / beers", "germany / germany's" read as the same tile twice
  // (owner, 2026-10-30, after "geri" gave german / germany / germans /
  // gerald / gerard). Inflections that change the word ("вода / воды",
  // "timp / timpul", "play / playing") still get their second slot.
  const isSuffixedTwin = (word: string, shown: string): boolean => isPluralTwin(word, shown, lang);
  // When the partial is ALREADY a complete word ("can", count 785), the user
  // has most likely finished it and wants to know what comes next. Words that
  // merely share its letters ("can't", "cannot", "candy") are still worth one
  // slot in case they were mid-typing, but they must not take the bar: a
  // personal-dictionary word gets a 10x boost from mergeUserNgramsWithBoost, so
  // a single previously-used "candy" can outrank every contextual continuation.
  // That is what the 2026-08-15 screenshot showed — "can't / candy / a" where
  // "go / see / do" belonged.
  const MAX_BARE_PREFIX_WHEN_COMPLETE = 1;
  const taken: typeof filtered = [];
  if (partialWord) {
    const stemForms = new Map<string, string[]>();
    let barePrefixTaken = 0;
    for (const c of filtered) {
      if (taken.length >= config.maxResults) break;
      if (
        partialIsCompleteWord
        && !c.hasContext
        && matchesPredictionPrefix(c.word, partialWord, lang)
      ) {
        if (barePrefixTaken >= MAX_BARE_PREFIX_WHEN_COMPLETE) continue;
        barePrefixTaken++;
      }
      const key = groupKey(c.word);
      if (key === null) { taken.push(c); continue; }
      const forms = stemForms.get(key) ?? [];
      if (forms.length >= MAX_PER_STEM) continue;
      if (forms.some(shown => isSuffixedTwin(c.word, shown))) continue;
      stemForms.set(key, [...forms, c.word]);
      taken.push(c);
    }
  }
  // Backfill — second pass without the stem-diversity constraint when we
  // couldn't reach maxResults using unique stems. Never under-fill the bar.
  //
  // The bare-prefix cap above is NOT relaxed here. Relaxing it would undo the
  // cap entirely: the same look-alikes we just skipped are the highest-scoring
  // remaining candidates, so they would all flow straight back in. Any slots
  // still empty after this pass are filled from the language's curated AAC core
  // words by the `fallback` loop below, which is the better thing to show.
  //
  // Two passes: plural twins of a shown word ("love / loves") come last, so
  // they appear only when nothing else matches ("germ" → germs, germans).
  for (const allowTwins of [false, true]) {
    if (taken.length >= config.maxResults) break;
    const takenWords = new Set(taken.map(c => c.word));
    for (const c of filtered) {
      if (taken.length >= config.maxResults) break;
      if (takenWords.has(c.word)) continue;
      if (
        partialWord
        && partialIsCompleteWord
        && !c.hasContext
        && matchesPredictionPrefix(c.word, partialWord, lang)
      ) continue;
      if (!allowTwins && taken.some(t => isSuffixedTwin(c.word, t.word))) continue;
      takenWords.add(c.word);
      taken.push(c);
    }
  }

  const scored = taken
    .map((c) => {
      const lower = c.word.toLowerCase();
      // Always-capitalized words (e.g. English "I") win regardless of position.
      if (alwaysCapitalized.has(lower)) return lower.charAt(0).toUpperCase() + lower.slice(1);
      // Capitalize first word of sentence; otherwise keep the user-typed lowercase.
      if (isSentenceStart) {
        const initial = lang === 'tr' ? c.word.charAt(0).toLocaleUpperCase('tr') : c.word.charAt(0).toUpperCase();
        return initial + c.word.slice(1);
      }
      return c.word;
    });

  if (scored.length < config.maxResults) {
    const existing = new Set(scored.map((s) => predictionWordKey(s, lang)));
    for (const d of fallback) {
      if (!existing.has(predictionWordKey(d, lang)) && scored.length < config.maxResults) {
        scored.push(preferredPredictionSpelling(d, lang));
        existing.add(predictionWordKey(d, lang));
      }
    }
  }

  return scored;
}

function evictLRU(dict: Record<string, WordFreqEntry>, maxSize: number): Record<string, WordFreqEntry> {
  const keys = Object.keys(dict);
  if (keys.length <= maxSize) return dict;
  const targetSize = Math.floor(maxSize * TUNING.evictionWatermark);
  const sorted = keys
    .map(k => ({ k, lastUsed: dict[k].lastUsed }))
    .sort((a, b) => a.lastUsed - b.lastUsed);
  const toRemove = sorted.slice(0, keys.length - targetSize);
  const result = { ...dict };
  for (const { k } of toRemove) delete result[k];
  return result;
}

export function recordWord(
  wordFreq: Record<string, WordFreqEntry>,
  word: string,
  lang = 'en',
): Record<string, WordFreqEntry> {
  if (!word || word.length > 200) return wordFreq;
  const key = predictionWordKey(predictionTokenParts(word).word, lang);
  if (!key) return wordFreq;
  const existing = wordFreq[key];
  const updated = { ...wordFreq, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, TUNING.maxWords);
}

export function recordBigram(
  bigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
  lang = 'en',
): Record<string, WordFreqEntry> {
  const parts = [word1, word2].map(word => predictionWordKey(predictionTokenParts(word).word, lang));
  if (parts.some(word => !word)) return bigrams;
  const key = parts.join('|');
  const existing = bigrams[key];
  const updated = { ...bigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, TUNING.maxBigrams);
}

export function recordTrigram(
  trigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
  word3: string,
  lang = 'en',
): Record<string, WordFreqEntry> {
  const parts = [word1, word2, word3].map(word => predictionWordKey(predictionTokenParts(word).word, lang));
  if (parts.some(word => !word)) return trigrams;
  const key = parts.join('|');
  const existing = trigrams[key];
  const updated = { ...trigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, TUNING.maxTrigrams);
}

export function buildNgramsFromPhrases(
  phrases: string[],
  lang = 'en',
): { bigrams: Record<string, WordFreqEntry>; trigrams: Record<string, WordFreqEntry> } {
  const bigrams: Record<string, WordFreqEntry> = {};
  const trigrams: Record<string, WordFreqEntry> = {};
  const now = Date.now();
  for (const phrase of phrases) {
    const words = phrase.split(/\s+/).map(word => predictionWordKey(predictionTokenParts(word).word, lang)).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
      const biKey = `${words[i]}|${words[i + 1]}`;
      bigrams[biKey] = { count: (bigrams[biKey]?.count ?? 0) + 1, lastUsed: now };
      if (i < words.length - 2) {
        const triKey = `${words[i]}|${words[i + 1]}|${words[i + 2]}`;
        trigrams[triKey] = { count: (trigrams[triKey]?.count ?? 0) + 1, lastUsed: now };
      }
    }
  }
  return { bigrams, trigrams };
}

export function decayPredictions(
  data: Record<string, WordFreqEntry>,
): Record<string, WordFreqEntry> {
  const now = Date.now();
  const decayCutoff = now - TUNING.decayAfterMs;
  const pruneCutoff = now - TUNING.pruneAfterMs;
  const result: Record<string, WordFreqEntry> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val.count <= 1 && val.lastUsed < pruneCutoff) continue;
    if (val.lastUsed < decayCutoff && (!val.lastDecayedAt || val.lastDecayedAt < decayCutoff)) {
      const newCount = Math.max(1, Math.floor(val.count * TUNING.decayFactor));
      result[key] = { count: newCount, lastUsed: val.lastUsed, lastDecayedAt: now };
    } else {
      result[key] = val;
    }
  }
  return result;
}
