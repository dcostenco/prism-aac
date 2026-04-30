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

export function getPredictions(
  currentText: string,
  wordFreq: Record<string, WordFreqEntry>,
  bigrams: Record<string, WordFreqEntry>,
  config = DEFAULT_CONFIG,
  trigrams?: Record<string, WordFreqEntry>,
): string[] {
  const words = currentText.trim().split(/\s+/).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1].toLowerCase() : '';
  const prevWord = words.length > 1 ? words[words.length - 2].toLowerCase() : '';

  const candidateMap = new Map<string, Scores>();
  const getOrCreate = (w: string) =>
    candidateMap.get(w) ?? (() => { const s: Scores = { bigram: 0, trigram: 0, freq: 0, recency: 0, prefix: 0 }; candidateMap.set(w, s); return s; })();

  // Trigram context (strongest signal — two-word history predicts next word)
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

  // Bigram context
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

  // Prefix matching — if user is mid-word, boost completions
  const partialWord = currentText.endsWith(' ') ? '' : lastWord;
  if (partialWord && partialWord.length >= 1) {
    for (const word of Object.keys(wordFreq)) {
      if (word.startsWith(partialWord) && word !== partialWord) {
        getOrCreate(word).prefix = 1.0;
      }
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
    .map((c) => c.word.charAt(0).toUpperCase() + c.word.slice(1));

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

export function recordWord(
  wordFreq: Record<string, WordFreqEntry>,
  word: string,
): Record<string, WordFreqEntry> {
  const key = word.toLowerCase();
  const existing = wordFreq[key];
  return { ...wordFreq, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
}

export function recordBigram(
  bigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
): Record<string, WordFreqEntry> {
  const key = `${word1.toLowerCase()}|${word2.toLowerCase()}`;
  const existing = bigrams[key];
  return { ...bigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
}

export function recordTrigram(
  trigrams: Record<string, WordFreqEntry>,
  word1: string,
  word2: string,
  word3: string,
): Record<string, WordFreqEntry> {
  const key = `${word1.toLowerCase()}|${word2.toLowerCase()}|${word3.toLowerCase()}`;
  const existing = trigrams[key];
  return { ...trigrams, [key]: { count: (existing?.count ?? 0) + 1, lastUsed: Date.now() } };
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
      if (newCount > 1) result[key] = { count: newCount, lastUsed: val.lastUsed, lastDecayedAt: Date.now() };
    } else {
      result[key] = val;
    }
  }
  return result;
}
