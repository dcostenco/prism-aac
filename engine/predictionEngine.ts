import { getTopBigrams, getTopWords, getRecentWords, recordWord, recordBigram, decayPredictions } from '../db/repository';
import { PredictionCandidate, PredictionConfig, DEFAULT_PREDICTION_CONFIG, DEFAULT_PREDICTIONS } from './predictionTypes';

let hasRunDecay = false;

export async function runStartupDecay(): Promise<void> {
  if (hasRunDecay) return;
  hasRunDecay = true;
  await decayPredictions();
}

export async function getPredictions(
  currentText: string,
  config: PredictionConfig = DEFAULT_PREDICTION_CONFIG
): Promise<string[]> {
  const words = currentText.trim().split(/\s+/).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1] : '';

  // Gather candidates from all three tiers
  const candidateMap = new Map<string, PredictionCandidate>();

  // Tier 1: Bigram context (if we have a last word)
  if (lastWord) {
    const bigrams = await getTopBigrams(lastWord, 20);
    const maxBigramCount = bigrams.length > 0 ? bigrams[0].count : 1;
    for (const b of bigrams) {
      const normalized = normalize(b.word2);
      const existing = candidateMap.get(normalized) ?? emptyCandidate(normalized);
      existing.bigramScore = b.count / maxBigramCount;
      candidateMap.set(normalized, existing);
    }
  }

  // Tier 2: Global frequency
  const topWords = await getTopWords(30);
  const maxFreqCount = topWords.length > 0 ? topWords[0].count : 1;
  for (const w of topWords) {
    const normalized = normalize(w.word);
    const existing = candidateMap.get(normalized) ?? emptyCandidate(normalized);
    existing.frequencyScore = w.count / maxFreqCount;
    candidateMap.set(normalized, existing);
  }

  // Tier 3: Recency boost
  const recentWords = await getRecentWords(config.recencyWindowMinutes, 20);
  const maxRecentCount = recentWords.length > 0 ? recentWords[0].count : 1;
  for (const w of recentWords) {
    const normalized = normalize(w.word);
    const existing = candidateMap.get(normalized) ?? emptyCandidate(normalized);
    existing.recencyScore = w.count / maxRecentCount;
    candidateMap.set(normalized, existing);
  }

  // Calculate total scores
  const candidates: PredictionCandidate[] = [];
  for (const c of candidateMap.values()) {
    c.totalScore =
      c.bigramScore * config.bigramWeight +
      c.frequencyScore * config.frequencyWeight +
      c.recencyScore * config.recencyWeight;
    candidates.push(c);
  }

  // Sort by total score descending
  candidates.sort((a, b) => b.totalScore - a.totalScore);

  // Filter out the last word itself
  const filtered = candidates
    .filter(c => c.word.toLowerCase() !== lastWord.toLowerCase())
    .slice(0, config.maxResults)
    .map(c => capitalize(c.word));

  // Fall back to defaults if insufficient data
  if (filtered.length < config.maxResults) {
    const existing = new Set(filtered.map(f => f.toLowerCase()));
    for (const d of DEFAULT_PREDICTIONS) {
      if (!existing.has(d.toLowerCase()) && filtered.length < config.maxResults) {
        filtered.push(d);
        existing.add(d.toLowerCase());
      }
    }
  }

  return filtered;
}

export async function learnFromInput(text: string): Promise<void> {
  const words = text.trim().split(/\s+/).filter(Boolean);

  for (const word of words) {
    await recordWord(word);
  }

  for (let i = 0; i < words.length - 1; i++) {
    await recordBigram(words[i], words[i + 1]);
  }
}

export async function learnWord(word: string, previousWord?: string): Promise<void> {
  await recordWord(word);
  if (previousWord) {
    await recordBigram(previousWord, word);
  }
}

function normalize(word: string): string {
  return word.toLowerCase().trim();
}

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function emptyCandidate(word: string): PredictionCandidate {
  return { word, bigramScore: 0, frequencyScore: 0, recencyScore: 0, totalScore: 0 };
}
