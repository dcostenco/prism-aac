import { WordFreqEntry, PredictionConfig } from '@/types';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';

const DEFAULT_CONFIG: PredictionConfig = {
  bigramWeight: 0.5,
  frequencyWeight: 0.3,
  recencyWeight: 0.2,
  maxResults: 5,
  recencyWindowMs: 600_000,
};

type Scores = { bigram: number; trigram: number; freq: number; recency: number; prefix: number };

// Words that should ALWAYS be capitalized when emitted as a prediction.
// English-only — other languages don't have a capitalized first-person pronoun.
const ALWAYS_CAPITALIZED = new Set(['i']);

// User-typed n-grams get a multiplier when merged with corpus, so a count=2
// personal bigram outranks a count=10 generic corpus bigram. Without this,
// the user's own typing patterns can never overtake the seed.
const USER_NGRAM_BOOST = 10;

export function mergeUserNgramsWithBoost(
  corpus: Record<string, WordFreqEntry>,
  user: Record<string, WordFreqEntry>,
): Record<string, WordFreqEntry> {
  const out = { ...corpus };
  for (const [k, v] of Object.entries(user)) {
    const existing = out[k];
    out[k] = {
      count: (existing?.count ?? 0) + v.count * USER_NGRAM_BOOST,
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
      .slice(0, 15);
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
      .slice(0, 20);
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
      .slice(0, 20);
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
      .slice(0, 15);
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
  if (partialWord && partialWord.length >= 1) {
    const prefixCands: Array<{ word: string; count: number }> = [];
    for (const word of Object.keys(wordFreq)) {
      if (word.startsWith(partialWord) && word !== partialWord) {
        prefixCands.push({ word, count: wordFreq[word].count });
      }
    }
    prefixCands.sort((a, b) => b.count - a.count);
    const topPrefix = prefixCands.slice(0, 30);
    const maxPrefix = topPrefix.length > 0 ? topPrefix[0].count : 1;
    for (const { word, count } of topPrefix) {
      getOrCreate(word).prefix = count / maxPrefix;
    }
  }

  // Frequency
  const freqEntries = Object.entries(wordFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);
  const maxFreq = freqEntries.length > 0 ? freqEntries[0][1].count : 1;
  for (const [word, val] of freqEntries) {
    getOrCreate(word).freq = val.count / maxFreq;
  }

  // Recency
  const now = Date.now();
  const recentEntries = Object.entries(wordFreq)
    .filter(([, v]) => now - v.lastUsed < config.recencyWindowMs)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);
  const maxRecent = recentEntries.length > 0 ? recentEntries[0][1].count : 1;
  for (const [word, val] of recentEntries) {
    getOrCreate(word).recency = val.count / maxRecent;
  }

  // Weighted scoring — trigram > prefix > bigram > freq > recency
  const trigramWeight = trigrams ? 0.35 : 0;
  const prefixWeight = partialWord ? 0.3 : 0;
  const bigramW = config.bigramWeight * (1 - trigramWeight - prefixWeight / 2);
  const freqW = config.frequencyWeight * (1 - trigramWeight / 2);
  const recencyW = config.recencyWeight;

  const scored = [...candidateMap.entries()]
    .map(([word, s]) => ({
      word,
      total: s.trigram * trigramWeight + s.prefix * prefixWeight + s.bigram * bigramW + s.freq * freqW + s.recency * recencyW,
    }))
    .filter((c) => c.word.toLowerCase() !== lastWord && c.word.toLowerCase() !== partialWord)
    .sort((a, b) => b.total - a.total)
    .slice(0, config.maxResults)
    .map((c) => {
      const lower = c.word.toLowerCase();
      // Always-capitalized words (e.g. English "I") win regardless of position.
      if (ALWAYS_CAPITALIZED.has(lower)) return lower.charAt(0).toUpperCase() + lower.slice(1);
      // Capitalize first word of sentence; otherwise keep the user-typed lowercase.
      if (isSentenceStart) return c.word.charAt(0).toUpperCase() + c.word.slice(1);
      return c.word;
    });

  if (scored.length < config.maxResults) {
    const existing = new Set(scored.map((s) => s.toLowerCase()));
    for (const d of DEFAULT_PREDICTIONS) {
      if (!existing.has(d.toLowerCase()) && scored.length < config.maxResults) {
        scored.push(d);
        existing.add(d.toLowerCase());
      }
    }
  }

  return scored;
}

// LRU ceiling: evict oldest entries when dictionary exceeds max size.
// Prevents localStorage exhaustion from unbounded n-gram growth.
const MAX_WORDS = 5000;
const MAX_BIGRAMS = 3000;
const MAX_TRIGRAMS = 2000;

function evictLRU(dict: Record<string, WordFreqEntry>, maxSize: number): Record<string, WordFreqEntry> {
  const keys = Object.keys(dict);
  if (keys.length <= maxSize) return dict;
  // Evict to 90% of maxSize in one batch so the O(N log N) sort only
  // runs once every ~500 keystrokes instead of on every single keystroke.
  const targetSize = Math.floor(maxSize * 0.9);
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
  const key = word.toLowerCase();
  const existing = wordFreq[key];
  const updated = { ...wordFreq, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, MAX_WORDS);
}

export function recordBigram(
  bigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
): Record<string, WordFreqEntry> {
  const key = `${word1.toLowerCase()}|${word2.toLowerCase()}`;
  const existing = bigrams[key];
  const updated = { ...bigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
  return evictLRU(updated, MAX_BIGRAMS);
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
  return evictLRU(updated, MAX_TRIGRAMS);
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
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const result: Record<string, WordFreqEntry> = {};
  for (const [key, val] of Object.entries(data)) {
    // Hard cutoff: drop single-use entries older than 30 days (typo cleanup)
    if (val.count <= 1 && val.lastUsed < thirtyDaysAgo) continue;
    if (val.lastUsed < sevenDaysAgo && (!val.lastDecayedAt || val.lastDecayedAt < sevenDaysAgo)) {
      const newCount = Math.max(1, Math.floor(val.count * 0.95));
      result[key] = { count: newCount, lastUsed: val.lastUsed, lastDecayedAt: Date.now() };
    } else {
      result[key] = val;
    }
  }
  return result;
}
