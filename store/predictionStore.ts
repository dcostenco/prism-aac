import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordFreqEntry } from '@/types';
import { getPredictions, recordWord, recordBigram, recordTrigram, decayPredictions, buildNgramsFromPhrases, mergeUserNgramsWithBoost } from '@/engine/predictionEngine';
import { DEFAULT_PREDICTIONS, getPredictionsForLanguage } from '@/constants/keyboardLayouts';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { SupportedLanguage } from '@/engine/i18n';
import { getClinicalVocabulary } from '@/constants/clinicalVocabulary';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  loadPredictionSeed,
  getCachedPredictionSeed,
  PredictionSeed,
} from '@/constants/predictionSeeds';

const MAX_ENTRIES = 2000;
const SEED_LAST_USED = 0;

// When DEFAULT_PHRASES has no translation for a non-English locale,
// getPhraseText falls back to the English text. Without filtering, this
// pollutes the Russian/Arabic/etc. seed with English words like "I", "we",
// "help" — which then leak as "I" / capitalized predictions in non-English
// sessions. The per-script regex matches words made entirely of letters
// valid for that language. English is a no-op (matches everything Latin).
const SCRIPT_FILTER: Partial<Record<SupportedLanguage, RegExp>> = {
  ru: /^[а-яё'\-]+$/,
  uk: /^[а-яєіїґ'\-]+$/,
  ar: /^[؀-ۿݐ-ݿ'\-]+$/,
  ja: /^[぀-ゟ゠-ヿ一-鿿]+$/,
  ko: /^[가-힯ᄀ-ᇿ㄰-㆏]+$/,
  zh: /^[一-鿿]+$/,
  'zh-Hans': /^[一-鿿]+$/,
  'zh-Hant': /^[一-鿿]+$/,
  'zh-HK': /^[一-鿿]+$/,
  hi: /^[ऀ-ॿ'\-]+$/,
  he: /^[א-ת'\-]+$/,
  // Latin-script European and other langs
  en: /^[a-z'\-]+$/,
  es: /^[a-zñáéíóúü'\-]+$/,
  fr: /^[a-zàâäçéèêëîïôœùûüÿ'\-]+$/,
  de: /^[a-zäöüß'\-]+$/,
  pt: /^[a-záàâãçéêíóôõú'\-]+$/,
  ro: /^[a-zăâîșțşţ'\-]+$/,
  it: /^[a-zàèéìíîòóùú'\-]+$/,
  pl: /^[a-ząćęłńóśźż'\-]+$/,
  nl: /^[a-zàáâäèéêëìíîïòóôöùúûü'\-]+$/,
  vi: /^[a-zàáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯ'\-]+$/,
  tl: /^[a-zñ'\-]+$/,
  tr: /^[a-zçğıöşü'\-]+$/,
  id: /^[a-z'\-]+$/,
};

function buildSeedForLanguage(lang: SupportedLanguage): {
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
  trigrams: Record<string, WordFreqEntry>;
} {
  const wordFreq: Record<string, WordFreqEntry> = {};
  const script = SCRIPT_FILTER[lang];
  // Phase 1 dict expansion (1220 phrases) added many entries without per-lang
  // translations yet. When `getPhraseText` falls back to English text on a
  // non-EN locale, those English words leak into the seed because the Latin
  // SCRIPT_FILTER for RO/ES/FR/etc. accepts any [a-z] word. Skip fallbacks.
  const phrases: string[] = DEFAULT_PHRASES.flatMap(p => {
    const text = getPhraseText(p.id, lang, p.text);
    return lang !== 'en' && text === p.text ? [] : [text];
  });
  for (const phrase of phrases) {
    for (const raw of phrase.split(/\s+/)) {
      const word = raw.toLowerCase().replace(/[^\p{L}'-]/gu, '');
      if (word.length < 1) continue;
      // Drop words that don't fit the language's script (English fallback
      // pollution when no translation exists for a phrase).
      if (script && !script.test(word)) continue;
      wordFreq[word] = { count: (wordFreq[word]?.count ?? 0) + 1, lastUsed: SEED_LAST_USED };
    }
  }
  const { bigrams, trigrams } = buildNgramsFromPhrases(phrases);
  // Same script filter for n-grams — drop if any constituent word is wrong-script.
  if (script) {
    for (const k of Object.keys(bigrams)) {
      if (k.split('|').some(w => !script.test(w))) delete bigrams[k];
    }
    for (const k of Object.keys(trigrams)) {
      if (k.split('|').some(w => !script.test(w))) delete trigrams[k];
    }
  }
  for (const k of Object.keys(bigrams)) bigrams[k] = { ...bigrams[k], lastUsed: SEED_LAST_USED };
  for (const k of Object.keys(trigrams)) trigrams[k] = { ...trigrams[k], lastUsed: SEED_LAST_USED };
  return { wordFreq, bigrams, trigrams };
}

const seedCache = new Map<string, { wordFreq: Record<string, WordFreqEntry>; bigrams: Record<string, WordFreqEntry>; trigrams: Record<string, WordFreqEntry> }>();
function getSeed(lang: SupportedLanguage) {
  if (!seedCache.has(lang)) seedCache.set(lang, buildSeedForLanguage(lang));
  return seedCache.get(lang)!;
}

let _seedEN: ReturnType<typeof getSeed> | null = null;
function getSeedEN() {
  if (!_seedEN) _seedEN = getSeed('en');
  return _seedEN;
}

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

// Lazy-loaded per-locale seed pulled from constants/predictionSeeds/<lang>.ts.
// Not persisted: re-imported on each session so we don't bloat localStorage
// with the ~7000 n-gram entries per locale (these come from the read-only
// corpus, not user typing).
const corpusSeedCache = new Map<string, PredictionSeed>();
function syncCorpusSeed(lang: string): PredictionSeed | null {
  const cached = corpusSeedCache.get(lang) ?? getCachedPredictionSeed(lang);
  if (cached) {
    if (!corpusSeedCache.has(lang)) corpusSeedCache.set(lang, cached);
    return cached;
  }
  // Trigger lazy import; the next updatePredictions call after load will see it.
  loadPredictionSeed(lang).then((seed) => {
    corpusSeedCache.set(lang, seed);
    // Re-run predictions for the current text once the corpus seed is ready
    // so the user gets richer suggestions without waiting for a keystroke.
    try {
      const store = usePredictionStore.getState();
      // Touch a no-op set so subscribers re-render with the warmed cache.
      store.updatePredictions('', lang as SupportedLanguage);
    } catch {}
  }).catch(() => {});
  return null;
}

interface PredictionState {
  predictions: string[];
  // AI-driven word completion for the user's current partial. When set,
  // PredictionBar prepends this as the leftmost tile so a contextually
  // strong but corpus-rare word (e.g. "дуб" in "у лукоморья д…", which
  // ranks ~17K in Russian wordfreq and would never crack top-5 by raw
  // frequency) can still surface. Computed externally by MessageBar from
  // the autocorrect/completion suggestion and pushed in via setAiCompletion.
  aiCompletion: string | null;
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
  trigrams: Record<string, WordFreqEntry>;
  updatePredictions: (text: string, lang?: SupportedLanguage) => void;
  setAiCompletion: (word: string | null) => void;
  learnWord: (word: string, previousWord?: string, prevPrevWord?: string) => void;
  runDecay: () => void;
  ensureSeed: () => void;
}

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set, get) => ({
      predictions: DEFAULT_PREDICTIONS,
      aiCompletion: null,
      wordFreq: { ...getSeedEN().wordFreq },
      bigrams: { ...getSeedEN().bigrams },
      trigrams: { ...getSeedEN().trigrams },

      updatePredictions: (text, lang = 'en') => {
        const seed = getSeed(lang);
        const corpus = syncCorpusSeed(lang);
        const userWf = get().wordFreq;
        const userBg = get().bigrams;
        const userTg = get().trigrams;
        const plan = useAuthStore.getState().profile?.plan;
        const clinical = plan && PAID_PLANS.has(plan) ? getClinicalWordFreq(lang) : {};
        // Corpus + phrase seed + clinical = baseline. User counts get a boost
        // multiplier on TOP of the baseline so personal typing patterns can
        // outrank generic suggestions instead of being normalized to ~0.2.
        const baselineWf = { ...(corpus?.wordFreq ?? {}), ...seed.wordFreq, ...clinical };
        const baselineBg = { ...(corpus?.bigrams ?? {}), ...seed.bigrams };
        const baselineTg = { ...(corpus?.trigrams ?? {}), ...seed.trigrams };
        // Cross-language gate is enforced at the render layer
        // (PredictionBar via lib/langAllowlist.isAllowedInLang) so the
        // store's merge stays neutral. Doing it both places would be
        // redundant AND has subtle ranking side-effects when the
        // baseline filter creates new object identities that change
        // mergeUserNgramsWithBoost's tie-breaking. Single source of
        // truth: the render layer.
        const mergedWf = mergeUserNgramsWithBoost(baselineWf, userWf);
        const mergedBg = mergeUserNgramsWithBoost(baselineBg, userBg);
        const mergedTg = mergeUserNgramsWithBoost(baselineTg, userTg);
        // Pass language-specific fallback, no always-capitalized for non-EN,
        // and a script filter that drops any wrong-script candidates that
        // leak in from the English-seeded initial state.
        const fallback = getPredictionsForLanguage(lang);
        const alwaysCapitalized = lang === 'en' ? undefined : new Set<string>();
        const scriptFilter = SCRIPT_FILTER[lang];
        const predictions = getPredictions(text, mergedWf, mergedBg, undefined, mergedTg, fallback, alwaysCapitalized, scriptFilter, lang);
        set({ predictions });
      },

      setAiCompletion: (word) => {
        // Trim and reject empty / whitespace-only inputs.
        const v = word ? word.trim() : null;
        set({ aiCompletion: v && v.length > 0 ? v : null });
      },

      learnWord: (word, previousWord, prevPrevWord) => {
        const state = get();
        const wf = recordWord(state.wordFreq, word);
        let bg = state.bigrams;
        let tg = state.trigrams;
        if (previousWord) bg = recordBigram(bg, previousWord, word);
        if (previousWord && prevPrevWord) tg = recordTrigram(tg, prevPrevWord, previousWord, word);
        set({ wordFreq: wf, bigrams: bg, trigrams: tg });
      },

      runDecay: () => {
        const { wordFreq, bigrams, trigrams } = get();
        set({
          wordFreq: pruneIfNeeded(decayPredictions(wordFreq)),
          bigrams: pruneIfNeeded(decayPredictions(bigrams)),
          trigrams: pruneIfNeeded(decayPredictions(trigrams)),
        });
      },

      ensureSeed: () => {
        const { wordFreq, bigrams, trigrams } = get();
        const lang = useSettingsStore.getState().language || 'en';
        const seed = getSeed(lang);
        const wfMerged = { ...seed.wordFreq, ...wordFreq };
        const bgMerged = { ...seed.bigrams, ...bigrams };
        const tgMerged = { ...seed.trigrams, ...(trigrams ?? {}) };
        if (Object.keys(wfMerged).length === Object.keys(wordFreq).length &&
            Object.keys(bgMerged).length === Object.keys(bigrams).length &&
            Object.keys(tgMerged).length === Object.keys(trigrams ?? {}).length) return;
        set({ wordFreq: wfMerged, bigrams: bgMerged, trigrams: tgMerged });
      },
    }),
    {
      name: 'prism-aac-predictions',
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState ?? {}) as Partial<PredictionState>;
        // Safety fallback: ensure trigrams always exists regardless of migration path.
        if (!s.trigrams) s.trigrams = {};
        if (version < 3) {
          const wf = { ...getSeedEN().wordFreq, ...(s.wordFreq ?? {}) };
          const bg = { ...getSeedEN().bigrams, ...(s.bigrams ?? {}) };
          return { ...s, wordFreq: wf, bigrams: bg, trigrams: { ...getSeedEN().trigrams } };
        }
        if (version < 4) {
          // v4 adds user trigram tracking. Earlier versions never recorded
          // user trigrams; seed-only trigrams are added here.
          return { ...s, trigrams: { ...getSeedEN().trigrams, ...((s as Partial<PredictionState>).trigrams ?? {}) } };
        }
        return s as PredictionState;
      },
      partialize: (s) => ({ wordFreq: s.wordFreq, bigrams: s.bigrams, trigrams: s.trigrams }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<PredictionState>;
        // Sanitize each n-gram map. Without this, a tampered localStorage
        // entry (browser ext / sibling tab on shared device) could inject
        // an arbitrary phrase like "click here for free" with a huge
        // count, dominating the prediction bar and influencing what the
        // AAC user is led to tap. The shape gate also defends the
        // prediction engine's sort path from non-numeric counts which
        // would NaN-poison the comparison.
        const cleanNgrams = (raw: unknown): Record<string, WordFreqEntry> => {
          if (!raw || typeof raw !== 'object') return {};
          const out: Record<string, WordFreqEntry> = {};
          let count = 0;
          // Cap at MAX_NGRAM_ENTRIES — defends against runaway storage.
          // 50k is generous; legitimate corpus rarely exceeds 20k.
          const MAX_NGRAM_ENTRIES = 50_000;
          // Cap on individual key length — n-grams are at most ~3 words
          // separated by spaces; 200 chars is paranoid headroom.
          const MAX_KEY_LEN = 200;
          for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
            if (count >= MAX_NGRAM_ENTRIES) break;
            if (typeof key !== 'string' || !key || key.length > MAX_KEY_LEN) continue;
            if (!val || typeof val !== 'object') continue;
            const v = val as Record<string, unknown>;
            if (typeof v.count !== 'number' || !Number.isFinite(v.count) || v.count < 0) continue;
            if (v.lastUsed !== undefined && (typeof v.lastUsed !== 'number' || !Number.isFinite(v.lastUsed))) continue;
            // Cap individual count at a sane upper bound — a tampered
            // entry with count: 1e9 would dominate sorting forever.
            const cappedCount = Math.min(v.count, 100_000);
            out[key] = { count: cappedCount, lastUsed: typeof v.lastUsed === 'number' ? v.lastUsed : 0 };
            count++;
          }
          return out;
        };
        return {
          ...currentState,
          ...p,
          wordFreq: { ...getSeedEN().wordFreq, ...cleanNgrams(p.wordFreq) },
          bigrams: { ...getSeedEN().bigrams, ...cleanNgrams(p.bigrams) },
          trigrams: { ...getSeedEN().trigrams, ...cleanNgrams(p.trigrams) },
        };
      },
      // Debounced localStorage: writes at most once per 3 seconds.
      // Prevents synchronous 500KB+ JSON.stringify on every keystroke
      // from causing typing lag and battery drain on mobile devices.
      storage: (() => {
        let writeTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingName: string | null = null;
        let pendingValue: unknown = null;
        const flushNow = () => {
          if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
          if (pendingName != null) {
            try { localStorage.setItem(pendingName, JSON.stringify(pendingValue)); } catch {}
            pendingName = null; pendingValue = null;
          }
        };
        if (typeof window !== 'undefined') {
          window.addEventListener('pagehide', flushNow);
          document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
          window.addEventListener('beforeunload', () => {
            if (writeTimer !== null) {
              clearTimeout(writeTimer);
              writeTimer = null;
              // Flush immediately
              try {
                const s = usePredictionStore.getState();
                const partial = { wordFreq: s.wordFreq, bigrams: s.bigrams, trigrams: s.trigrams };
                localStorage.setItem(pendingName ?? 'prism-aac-predictions', JSON.stringify({ state: partial, version: 4 }));
              } catch { /* quota exceeded — best effort */ }
              pendingName = null; pendingValue = null;
            }
          });
        }
        return {
          getItem: (name: string) => { try { const v = localStorage.getItem(name); return v ? JSON.parse(v) : null; } catch { return null; } },
          setItem: (name: string, value: unknown) => {
            pendingName = name; pendingValue = value;
            if (writeTimer) clearTimeout(writeTimer);
            writeTimer = setTimeout(() => {
              try {
                localStorage.setItem(name, JSON.stringify(value));
              } catch (e) {
                if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                  // Shed old prediction data to free space, then retry with only partialized (non-PHI) state
                  usePredictionStore.getState().runDecay();
                  try {
                    const s = usePredictionStore.getState();
                    const partialized = { wordFreq: s.wordFreq, bigrams: s.bigrams, trigrams: s.trigrams };
                    localStorage.setItem(name, JSON.stringify({ state: partialized, version: 4 }));
                  } catch { /* still too large */ }
                }
              }
              pendingName = null; pendingValue = null; writeTimer = null;
            }, 1_000); // was 3000 — reduced to minimize data loss window
          },
          removeItem: (name: string) => { try { localStorage.removeItem(name); } catch {} },
        };
      })(),
    },
  ),
);
