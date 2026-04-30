import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordFreqEntry } from '@/types';
import { getPredictions, recordWord, recordBigram, decayPredictions, buildNgramsFromPhrases } from '@/engine/predictionEngine';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';
import { DEFAULT_PHRASES } from '@/constants/phrases';

const MAX_ENTRIES = 2000;

// Seed prefix-completion vocabulary from the bundled phrase corpus so a
// brand-new user typing "goo" gets useful suggestions ("good", "Goodbye",
// "Going") immediately — instead of seeing the static fallback predictions
// because their personal wordFreq is still empty. Each unique word is
// inserted with count=1 + a far-past lastUsed timestamp so live user typing
// quickly outranks the seeds (recency + frequency take over).
const SEED_LAST_USED = 0;
function buildSeedVocabulary(): {
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
} {
  const wordFreq: Record<string, WordFreqEntry> = {};
  const phrases: string[] = DEFAULT_PHRASES.map(p => p.text);
  for (const phrase of phrases) {
    for (const raw of phrase.split(/\s+/)) {
      const word = raw.toLowerCase().replace(/[^\p{L}'-]/gu, '');
      if (word.length < 2) continue;
      wordFreq[word] = { count: (wordFreq[word]?.count ?? 0) + 1, lastUsed: SEED_LAST_USED };
    }
  }
  const { bigrams } = buildNgramsFromPhrases(phrases);
  // Mark the seed bigrams with the same far-past timestamp so user-learned
  // pairs always win on recency.
  for (const k of Object.keys(bigrams)) bigrams[k] = { ...bigrams[k], lastUsed: SEED_LAST_USED };
  return { wordFreq, bigrams };
}

const SEED = buildSeedVocabulary();

function pruneIfNeeded(data: Record<string, WordFreqEntry>): Record<string, WordFreqEntry> {
  const entries = Object.entries(data);
  if (entries.length <= MAX_ENTRIES) return data;
  entries.sort((a, b) => b[1].count - a[1].count);
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

interface PredictionState {
  predictions: string[];
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
  updatePredictions: (text: string) => void;
  learnWord: (word: string, previousWord?: string) => void;
  runDecay: () => void;
}

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set, get) => ({
      predictions: DEFAULT_PREDICTIONS,
      wordFreq: { ...SEED.wordFreq },
      bigrams: { ...SEED.bigrams },

      updatePredictions: (text) => {
        const { wordFreq, bigrams } = get();
        const predictions = getPredictions(text, wordFreq, bigrams);
        set({ predictions });
      },

      learnWord: (word, previousWord) => {
        const state = get();
        const wf = recordWord(state.wordFreq, word);
        let bg = state.bigrams;
        if (previousWord) {
          bg = recordBigram(bg, previousWord, word);
        }
        set({ wordFreq: wf, bigrams: bg });
      },

      runDecay: () => {
        const { wordFreq, bigrams } = get();
        set({
          wordFreq: pruneIfNeeded(decayPredictions(wordFreq)),
          bigrams: pruneIfNeeded(decayPredictions(bigrams)),
        });
      },
    }),
    {
      name: 'prism-aac-predictions',
      // version bump triggers migrate() — every existing user's localStorage
      // had an empty wordFreq, so without this migration the seeding above
      // would not reach already-loaded clients (zustand persist wipes the
      // initial state with the rehydrated empty object).
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState ?? {}) as Partial<PredictionState>;
        if (version < 2) {
          // Merge seeds with whatever the user has already learned. Seeds
          // never overwrite — user counts win because we only fill missing
          // keys.
          const wf = { ...SEED.wordFreq, ...(s.wordFreq ?? {}) };
          const bg = { ...SEED.bigrams,  ...(s.bigrams ?? {}) };
          return { ...s, wordFreq: wf, bigrams: bg };
        }
        return s as PredictionState;
      },
      partialize: (s) => ({ wordFreq: s.wordFreq, bigrams: s.bigrams }),
      // merge() runs every load. Even after the version bump, ensure the
      // SEED keys are present (covers freshly-cleared storage and any path
      // that bypasses migrate). User-typed entries always take precedence.
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<PredictionState>;
        return {
          ...currentState,
          ...p,
          wordFreq: { ...SEED.wordFreq, ...(p.wordFreq ?? {}) },
          bigrams: { ...SEED.bigrams,  ...(p.bigrams ?? {}) },
        };
      },
      storage: {
        getItem: (name) => {
          try { const v = localStorage.getItem(name); return v ? JSON.parse(v) : null; }
          catch { return null; }
        },
        setItem: (name, value) => {
          try { localStorage.setItem(name, JSON.stringify(value)); }
          catch { /* quota exceeded — silently drop write */ }
        },
        removeItem: (name) => { try { localStorage.removeItem(name); } catch {} },
      },
    },
  ),
);
