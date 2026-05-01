import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordFreqEntry } from '@/types';
import { getPredictions, recordWord, recordBigram, decayPredictions, buildNgramsFromPhrases } from '@/engine/predictionEngine';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { SupportedLanguage } from '@/engine/i18n';
import { getClinicalVocabulary } from '@/constants/clinicalVocabulary';
import { useAuthStore } from '@/store/authStore';

const MAX_ENTRIES = 2000;
const SEED_LAST_USED = 0;

function buildSeedForLanguage(lang: SupportedLanguage): {
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
} {
  const wordFreq: Record<string, WordFreqEntry> = {};
  const phrases: string[] = DEFAULT_PHRASES.map(p => getPhraseText(p.id, lang, p.text));
  for (const phrase of phrases) {
    for (const raw of phrase.split(/\s+/)) {
      const word = raw.toLowerCase().replace(/[^\p{L}'-]/gu, '');
      if (word.length < 1) continue;
      wordFreq[word] = { count: (wordFreq[word]?.count ?? 0) + 1, lastUsed: SEED_LAST_USED };
    }
  }
  const { bigrams } = buildNgramsFromPhrases(phrases);
  for (const k of Object.keys(bigrams)) bigrams[k] = { ...bigrams[k], lastUsed: SEED_LAST_USED };
  return { wordFreq, bigrams };
}

const seedCache = new Map<string, { wordFreq: Record<string, WordFreqEntry>; bigrams: Record<string, WordFreqEntry> }>();
function getSeed(lang: SupportedLanguage) {
  if (!seedCache.has(lang)) seedCache.set(lang, buildSeedForLanguage(lang));
  return seedCache.get(lang)!;
}

const SEED_EN = getSeed('en');

const PAID_PLANS = new Set(['standard', 'advanced', 'enterprise']);
const clinicalCache = new Map<string, Record<string, WordFreqEntry>>();

function getClinicalWordFreq(lang: SupportedLanguage): Record<string, WordFreqEntry> {
  if (clinicalCache.has(lang)) return clinicalCache.get(lang)!;
  const wf: Record<string, WordFreqEntry> = {};
  for (const word of getClinicalVocabulary(lang)) {
    const key = word.toLowerCase();
    wf[key] = { count: 1, lastUsed: 0 };
  }
  clinicalCache.set(lang, wf);
  return wf;
}

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
  updatePredictions: (text: string, lang?: SupportedLanguage) => void;
  learnWord: (word: string, previousWord?: string) => void;
  runDecay: () => void;
  ensureSeed: () => void;
}

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set, get) => ({
      predictions: DEFAULT_PREDICTIONS,
      wordFreq: { ...SEED_EN.wordFreq },
      bigrams: { ...SEED_EN.bigrams },

      updatePredictions: (text, lang = 'en') => {
        const seed = getSeed(lang);
        const userWf = get().wordFreq;
        const userBg = get().bigrams;
        const plan = useAuthStore.getState().profile?.plan;
        const clinical = plan && PAID_PLANS.has(plan) ? getClinicalWordFreq(lang) : {};
        const mergedWf = { ...seed.wordFreq, ...clinical, ...userWf };
        const mergedBg = { ...seed.bigrams, ...userBg };
        const predictions = getPredictions(text, mergedWf, mergedBg);
        set({ predictions });
      },

      learnWord: (word, previousWord) => {
        const state = get();
        const wf = recordWord(state.wordFreq, word);
        let bg = state.bigrams;
        if (previousWord) bg = recordBigram(bg, previousWord, word);
        set({ wordFreq: wf, bigrams: bg });
      },

      runDecay: () => {
        const { wordFreq, bigrams } = get();
        set({
          wordFreq: pruneIfNeeded(decayPredictions(wordFreq)),
          bigrams: pruneIfNeeded(decayPredictions(bigrams)),
        });
      },

      ensureSeed: () => {
        const { wordFreq, bigrams } = get();
        const wfMerged = { ...SEED_EN.wordFreq, ...wordFreq };
        const bgMerged = { ...SEED_EN.bigrams, ...bigrams };
        if (Object.keys(wfMerged).length === Object.keys(wordFreq).length &&
            Object.keys(bgMerged).length === Object.keys(bigrams).length) return;
        set({ wordFreq: wfMerged, bigrams: bgMerged });
      },
    }),
    {
      name: 'prism-aac-predictions',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState ?? {}) as Partial<PredictionState>;
        if (version < 3) {
          const wf = { ...SEED_EN.wordFreq, ...(s.wordFreq ?? {}) };
          const bg = { ...SEED_EN.bigrams, ...(s.bigrams ?? {}) };
          return { ...s, wordFreq: wf, bigrams: bg };
        }
        return s as PredictionState;
      },
      partialize: (s) => ({ wordFreq: s.wordFreq, bigrams: s.bigrams }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<PredictionState>;
        return {
          ...currentState,
          ...p,
          wordFreq: { ...SEED_EN.wordFreq, ...(p.wordFreq ?? {}) },
          bigrams: { ...SEED_EN.bigrams, ...(p.bigrams ?? {}) },
        };
      },
      storage: {
        getItem: (name) => { try { const v = localStorage.getItem(name); return v ? JSON.parse(v) : null; } catch { return null; } },
        setItem: (name, value) => { try { localStorage.setItem(name, JSON.stringify(value)); } catch {} },
        removeItem: (name) => { try { localStorage.removeItem(name); } catch {} },
      },
    },
  ),
);
