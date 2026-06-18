import { WordFreqEntry, PredictionConfig } from '@/types';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';
import { getStemmer, type Stemmer } from '@/engine/stemmers';

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
} as const;

import { AGE_BLOCKED_WORDS } from '@/engine/ageBlocklist';


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
): string[] {
  const words = currentText.trim().split(/\s+/).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1].toLowerCase() : '';

  // Mid-word vs end-of-word matters for which words count as "context".
  // If the user is mid-typing ("my ma"), lastWord is the partial fragment
  // and the COMPLETE history is words[..-2]. If they just hit space ("my "),
  // lastWord is the most recent complete word and history is words[..-1].
  const partialWord = currentText.endsWith(' ') ? '' : lastWord;
  const isMidWord = !!partialWord;
  const ctxLastIdx = isMidWord ? words.length - 2 : words.length - 1;
  const ctxLast = ctxLastIdx >= 0 ? words[ctxLastIdx].toLowerCase() : '';
  const ctxPrev = ctxLastIdx - 1 >= 0 ? words[ctxLastIdx - 1].toLowerCase() : '';
  // Legacy alias kept for the (now narrower) "next-word after lastWord" lookups
  // used when NOT mid-typing.
  const prevWord = words.length > 1 ? words[words.length - 2].toLowerCase() : '';

  // Sentence-start detection: capitalize the next prediction if we're at the
  // start of the message OR right after sentence-ending punctuation.
  const trimmed = currentText.trimEnd();
  const isSentenceStart = trimmed === '' || /[.!?]$/.test(trimmed);

  const candidateMap = new Map<string, Scores>();
  const getOrCreate = (w: string) =>
    candidateMap.get(w) ?? (() => { const s: Scores = { bigram: 0, trigram: 0, freq: 0, recency: 0, prefix: 0 }; candidateMap.set(w, s); return s; })();

  // (1) Predict NEXT WORD — works whether the user is mid-word or just hit
  // space. When mid-word the partial is treated optimistically as "almost a
  // complete word" (predictable.app style: "I wan" still surfaces what comes
  // after "want").
  if (trigrams && prevWord && lastWord) {
    const triKey = prevWord + '|' + lastWord + '|';
    const triEntries = Object.entries(trigrams)
      .filter(([k]) => k.startsWith(triKey))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.trigramPoolSize);
    const maxTri = triEntries.length > 0 ? triEntries[0][1].count : 1;
    for (const [key, val] of triEntries) {
      const word3 = key.split('|')[2];
      getOrCreate(word3).trigram = val.count / maxTri;
    }
  }
  if (lastWord) {
    const bigramEntries = Object.entries(bigrams)
      .filter(([k]) => k.startsWith(lastWord + '|'))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.bigramPoolSize);
    const maxBigram = bigramEntries.length > 0 ? bigramEntries[0][1].count : 1;
    for (const [key, val] of bigramEntries) {
      getOrCreate(key.split('|')[1]).bigram = val.count / maxBigram;
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
      .filter(([k]) => k.startsWith(partialPrefix))
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
      .filter(([k]) => k.startsWith(partialPrefix))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TUNING.trigramPoolSize);
    const maxTri = triEntries.length > 0 ? triEntries[0][1].count : 1;
    for (const [key, val] of triEntries) {
      const completion = key.split('|')[2];
      const existing = getOrCreate(completion);
      existing.trigram = Math.max(existing.trigram, val.count / maxTri);
    }
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
  if (partialWord && partialWord.length >= 1) {
    const prefixCands: Array<{ word: string; count: number }> = [];
    for (const word of Object.keys(wordFreq)) {
      if (word.startsWith(partialWord) && word !== partialWord) {
        prefixCands.push({ word, count: wordFreq[word].count });
      }
    }
    prefixCands.sort((a, b) => b.count - a.count);
    const poolSize =
      partialWord.length === 1 ? 300 :
      partialWord.length === 2 ? 150 :
      TUNING.prefixPoolSize;
    const topPrefix = prefixCands.slice(0, poolSize);
    const maxPrefix = topPrefix.length > 0 ? topPrefix[0].count : 1;
    for (const { word, count } of topPrefix) {
      getOrCreate(word).prefix = count / maxPrefix;
    }
  }

  // Frequency
  const freqEntries = Object.entries(wordFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TUNING.freqPoolSize);
  const maxFreq = freqEntries.length > 0 ? freqEntries[0][1].count : 1;
  for (const [word, val] of freqEntries) {
    getOrCreate(word).freq = val.count / maxFreq;
  }

  // Recency
  const now = Date.now();
  const recentEntries = Object.entries(wordFreq)
    .filter(([, v]) => now - v.lastUsed < config.recencyWindowMs)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TUNING.recencyPoolSize);
  const maxRecent = recentEntries.length > 0 ? recentEntries[0][1].count : 1;
  for (const [word, val] of recentEntries) {
    getOrCreate(word).recency = val.count / maxRecent;
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
  const partialIsCompleteWord = !!partialWord && (wordFreq[partialWord]?.count ?? 0) >= 100;
  // Halve prefix weight when the partial is a complete word, so bigram
  // continuations ("to|listen", "to|be", "I|want") outweigh prefix
  // self-extensions ("to" → "today"). For fragments, prefix still
  // dominates so "re" → "really" works as expected.
  const effectivePrefixWeight = partialIsCompleteWord ? prefixWeight * 0.5 : prefixWeight;

  const artifacts = ARTIFACTS_BY_LANG[lang ?? 'en'] ?? new Set<string>();

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
      const lc = c.word.toLowerCase();
      if (AGE_BLOCKED_WORDS.has(lc)) return false;
      if (artifacts.has(lc)) return false;
      if (lc === lastWord || lc === partialWord) return false;
      // Mid-typing rule: surface candidates that complete the partial word.
      // EXCEPTION — if (a) the partial is itself a confidently complete
      // word AND (b) the candidate carries bigram/trigram score, it's a
      // contextually relevant next-word. E.g. user types "to" → "be"
      // surfaces via "to|be" bigram alongside "together"/"top". Without
      // this exception, AAC users typing common short words only see
      // prefix completions, never useful next-word continuations.
      if (partialWord && !lc.startsWith(partialWord) && !(c.hasContext && partialIsCompleteWord)) return false;
      // Drop wrong-script words. Necessary because the store's initial
      // wordFreq state seeds with English DEFAULT_PHRASES, which leak into
      // non-English sessions (e.g. "I" appearing for a Russian user).
      if (scriptFilter && !scriptFilter.test(lc)) return false;
      return true;
    })
    .sort((a, b) => b.total - a.total);

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
      const stem = stemmer(w.toLowerCase());
      // Never produce a key shorter than the user-typed prefix — otherwise
      // a stem like "ду" would collapse all ду* words into one bucket and
      // the user couldn't see alternative continuations they're aiming at.
      return stem.length >= partialWord.length ? stem : w.toLowerCase().slice(0, partialWord.length + 1);
    }
    return w.toLowerCase().slice(0, partialWord.length + 1);
  };
  // Cap forms per stem at MAX_PER_STEM. Strict 1-per-stem was too
  // aggressive for noun declensions where different forms ARE different
  // communicative content: ro "timp" (time, indef.) and "timpul" (the
  // time, def.) both belong on the bar. 2 strikes a balance — Russian
  // conjugation families (думать/думал/думают/думаю/думающий) still
  // collapse to 2 representatives instead of 5; Romanian/English noun
  // declensions surface bare + definite forms together.
  const MAX_PER_STEM = 2;
  const taken: typeof filtered = [];
  if (partialWord) {
    const stemCounts = new Map<string, number>();
    for (const c of filtered) {
      if (taken.length >= config.maxResults) break;
      const key = groupKey(c.word);
      if (key === null) { taken.push(c); continue; }
      const count = stemCounts.get(key) ?? 0;
      if (count >= MAX_PER_STEM) continue;
      stemCounts.set(key, count + 1);
      taken.push(c);
    }
  }
  // Backfill — second pass without diversity constraint when we couldn't
  // reach maxResults using unique stems (or when stemLen is 0). Never
  // under-fill the prediction bar.
  if (taken.length < config.maxResults) {
    const takenWords = new Set(taken.map(c => c.word));
    for (const c of filtered) {
      if (taken.length >= config.maxResults) break;
      if (takenWords.has(c.word)) continue;
      taken.push(c);
    }
  }

  const scored = taken
    .map((c) => {
      const lower = c.word.toLowerCase();
      // Always-capitalized words (e.g. English "I") win regardless of position.
      if (alwaysCapitalized.has(lower)) return lower.charAt(0).toUpperCase() + lower.slice(1);
      // Capitalize first word of sentence; otherwise keep the user-typed lowercase.
      if (isSentenceStart) return c.word.charAt(0).toUpperCase() + c.word.slice(1);
      return c.word;
    });

  if (scored.length < config.maxResults) {
    const existing = new Set(scored.map((s) => s.toLowerCase()));
    for (const d of fallback) {
      if (!existing.has(d.toLowerCase()) && scored.length < config.maxResults) {
        scored.push(d);
        existing.add(d.toLowerCase());
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
): Record<string, WordFreqEntry> {
  if (!word || word.length > 200) return wordFreq;
  const key = word.toLowerCase();
  const existing = wordFreq[key];
  const updated = { ...wordFreq, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, TUNING.maxWords);
}

export function recordBigram(
  bigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
): Record<string, WordFreqEntry> {
  const key = `${word1.toLowerCase()}|${word2.toLowerCase()}`;
  const existing = bigrams[key];
  const updated = { ...bigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, TUNING.maxBigrams);
}

export function recordTrigram(
  trigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
  word3: string,
): Record<string, WordFreqEntry> {
  const key = `${word1.toLowerCase()}|${word2.toLowerCase()}|${word3.toLowerCase()}`;
  const existing = trigrams[key];
  const updated = { ...trigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, TUNING.maxTrigrams);
}

export function buildNgramsFromPhrases(
  phrases: string[],
): { bigrams: Record<string, WordFreqEntry>; trigrams: Record<string, WordFreqEntry> } {
  const bigrams: Record<string, WordFreqEntry> = {};
  const trigrams: Record<string, WordFreqEntry> = {};
  const now = Date.now();
  for (const phrase of phrases) {
    const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
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
