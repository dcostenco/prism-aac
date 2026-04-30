import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordFreqEntry } from '@/types';
import { getPredictions, recordWord, recordBigram, decayPredictions } from '@/engine/predictionEngine';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';

const MAX_ENTRIES = 2000;

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
      wordFreq: {},
      bigrams: {},

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
      partialize: (s) => ({ wordFreq: s.wordFreq, bigrams: s.bigrams }),
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
