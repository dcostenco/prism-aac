import { WordFreqEntry, PredictionConfig } from '@/types';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';

const DEFAULT_CONFIG: PredictionConfig = {
  bigramWeight: 0.5,
  frequencyWeight: 0.3,
  recencyWeight: 0.2,
  maxResults: 5,
  recencyWindowMs: 600_000,
};

export function getPredictions(
  currentText: string,
  wordFreq: Record<string, WordFreqEntry>,
  bigrams: Record<string, WordFreqEntry>,
  config = DEFAULT_CONFIG,
): string[] {
  const words = currentText.trim().split(/\s+/).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1].toLowerCase() : '';

  const candidateMap = new Map<string, { bigram: number; freq: number; recency: number }>();

  if (lastWord) {
    const bigramEntries = Object.entries(bigrams)
      .filter(([k]) => k.startsWith(lastWord + '|'))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);
    const maxBigram = bigramEntries.length > 0 ? bigramEntries[0][1].count : 1;
    for (const [key, val] of bigramEntries) {
      const word2 = key.split('|')[1];
      const c = candidateMap.get(word2) ?? { bigram: 0, freq: 0, recency: 0 };
      c.bigram = val.count / maxBigram;
      candidateMap.set(word2, c);
    }
  }

  const freqEntries = Object.entries(wordFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);
  const maxFreq = freqEntries.length > 0 ? freqEntries[0][1].count : 1;
  for (const [word, val] of freqEntries) {
    const c = candidateMap.get(word) ?? { bigram: 0, freq: 0, recency: 0 };
    c.freq = val.count / maxFreq;
    candidateMap.set(word, c);
  }

  const now = Date.now();
  const recentEntries = Object.entries(wordFreq)
    .filter(([, v]) => now - v.lastUsed < config.recencyWindowMs)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);
  const maxRecent = recentEntries.length > 0 ? recentEntries[0][1].count : 1;
  for (const [word, val] of recentEntries) {
    const c = candidateMap.get(word) ?? { bigram: 0, freq: 0, recency: 0 };
    c.recency = val.count / maxRecent;
    candidateMap.set(word, c);
  }

  const scored = [...candidateMap.entries()]
    .map(([word, s]) => ({
      word,
      total: s.bigram * config.bigramWeight + s.freq * config.frequencyWeight + s.recency * config.recencyWeight,
    }))
    .filter((c) => c.word.toLowerCase() !== lastWord)
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
