import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordFreqEntry } from '@/types';
import { getPredictions, recordWord, recordBigram, recordTrigram, decayPredictions, buildNgramsFromPhrases, mergePredictionBaselines, mergePredictionContextBaselines, mergeUserNgramsWithBoost } from '@/engine/predictionEngine';
import { getPredictionsForLanguage } from '@/constants/keyboardLayouts';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { SupportedLanguage } from '@/engine/i18n';
import { getClinicalVocabulary } from '@/constants/clinicalVocabulary';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getPredictionSessionScope } from '@/services/predictionMemoryService';
import {
  loadPredictionSeed,
  getCachedPredictionSeed,
  PredictionSeed,
} from '@/constants/predictionSeeds';

const MAX_ENTRIES = 2000;
const SEED_LAST_USED = 0;
const LEGACY_STORAGE_KEY = 'prism-aac-predictions';
const SCOPED_STORAGE_VERSION = 5;
const MAX_NGRAM_ENTRIES = 50_000;
const MAX_NGRAM_KEY_LENGTH = 200;

interface PersistedPredictionSlice {
  personalizationScope?: string;
  personalizationLanguage?: SupportedLanguage;
  wordFreq?: Record<string, WordFreqEntry>;
  bigrams?: Record<string, WordFreqEntry>;
  trigrams?: Record<string, WordFreqEntry>;
}

interface PredictionMaps {
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
  trigrams: Record<string, WordFreqEntry>;
}

interface PendingPredictionWrite {
  key: string;
  generation: number;
  value: unknown;
}

function currentPredictionIdentity(): string {
  return getPredictionSessionScope(useAuthStore.getState().profile?.email);
}

let activeStorageScope = currentPredictionIdentity();
let activeStorageLanguage = useSettingsStore.getState().language || 'en';
let storageGeneration = 0;
let pendingPredictionWrite: PendingPredictionWrite | null = null;
let predictionWriteTimer: ReturnType<typeof setTimeout> | null = null;

function scopedStorageKey(
  scope = activeStorageScope,
  language: SupportedLanguage = activeStorageLanguage,
): string | null {
  // Anonymous learning stays inside the current tab. Persisting it would let
  // the next person on a shared AAC device inherit the previous user's names
  // and routines without any account boundary to separate them.
  if (!scope.startsWith('user:')) return null;
  return `${LEGACY_STORAGE_KEY}:v${SCOPED_STORAGE_VERSION}:${encodeURIComponent(scope)}:${encodeURIComponent(language)}`;
}

function cleanNgrams(raw: unknown): Record<string, WordFreqEntry> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, WordFreqEntry> = {};
  let count = 0;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_NGRAM_ENTRIES) break;
    if (!key || key.length > MAX_NGRAM_KEY_LENGTH) continue;
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const entry = val as Record<string, unknown>;
    if (
      typeof entry.count !== 'number'
      || !Number.isFinite(entry.count)
      || entry.count < 0
    ) {
      continue;
    }
    if (
      entry.lastUsed !== undefined
      && (
        typeof entry.lastUsed !== 'number'
        || !Number.isFinite(entry.lastUsed)
      )
    ) {
      continue;
    }
    out[key] = {
      count: Math.min(entry.count, 100_000),
      lastUsed: typeof entry.lastUsed === 'number' ? entry.lastUsed : 0,
    };
    count += 1;
  }
  return out;
}

function readScopedPredictionSlice(
  scope: string,
  language: SupportedLanguage,
): PersistedPredictionSlice | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // v4 and earlier had no owner or language. It cannot be assigned safely
    // after an account switch, so discard it once instead of guessing.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const key = scopedStorageKey(scope, language);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: PersistedPredictionSlice;
      version?: number;
    };
    if (
      parsed.version !== SCOPED_STORAGE_VERSION
      || parsed.state?.personalizationScope !== scope
      || parsed.state?.personalizationLanguage !== language
    ) {
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

function flushPredictionWrite(): void {
  if (predictionWriteTimer) {
    clearTimeout(predictionWriteTimer);
    predictionWriteTimer = null;
  }
  const pending = pendingPredictionWrite;
  pendingPredictionWrite = null;
  if (!pending || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(pending.key, JSON.stringify(pending.value));
  } catch { /* Local learning remains usable in memory. */ }
}

function schedulePredictionWrite(value: unknown): void {
  const key = scopedStorageKey();
  if (!key) return;
  pendingPredictionWrite = {
    key,
    generation: storageGeneration,
    value,
  };
  if (predictionWriteTimer) clearTimeout(predictionWriteTimer);
  const scheduledGeneration = storageGeneration;
  predictionWriteTimer = setTimeout(() => {
    predictionWriteTimer = null;
    if (
      !pendingPredictionWrite
      || pendingPredictionWrite.generation !== scheduledGeneration
    ) {
      return;
    }
    flushPredictionWrite();
  }, 1_000);
}

function predictionMapsForIdentity(
  scope: string,
  language: SupportedLanguage,
): PredictionMaps {
  const seed = getSeed(language);
  const persisted = readScopedPredictionSlice(scope, language);
  return {
    wordFreq: { ...seed.wordFreq, ...cleanNgrams(persisted?.wordFreq) },
    bigrams: { ...seed.bigrams, ...cleanNgrams(persisted?.bigrams) },
    trigrams: { ...seed.trigrams, ...cleanNgrams(persisted?.trigrams) },
  };
}

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
    // A prior language's import may resolve after the user switches locales.
    // Never let that stale completion reactivate the old personalization key.
    if (useSettingsStore.getState().language !== lang) return;
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
  personalizationScope: string;
  personalizationLanguage: SupportedLanguage;
  activatePredictionIdentity: (
    scope: string,
    language: SupportedLanguage,
  ) => void;
  updatePredictions: (text: string, lang?: SupportedLanguage) => void;
  setAiCompletion: (word: string | null) => void;
  learnWord: (word: string, previousWord?: string, prevPrevWord?: string) => void;
  runDecay: () => void;
  ensureSeed: () => void;
}

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set, get) => ({
      predictions: getPredictionsForLanguage(activeStorageLanguage),
      aiCompletion: null,
      ...predictionMapsForIdentity(activeStorageScope, activeStorageLanguage),
      personalizationScope: activeStorageScope,
      personalizationLanguage: activeStorageLanguage,

      activatePredictionIdentity: (scope, language) => {
        const normalizedScope = scope.trim().toLowerCase();
        if (!normalizedScope) return;
        const state = get();
        if (
          state.personalizationScope === normalizedScope
          && state.personalizationLanguage === language
        ) {
          return;
        }

        // Commit the old owner's queued write to the old owner's key before
        // changing the routing generation. It can never land in the new key.
        flushPredictionWrite();
        storageGeneration += 1;
        activeStorageScope = normalizedScope;
        activeStorageLanguage = language;

        set({
          ...predictionMapsForIdentity(normalizedScope, language),
          personalizationScope: normalizedScope,
          personalizationLanguage: language,
          predictions: getPredictionsForLanguage(language),
          aiCompletion: null,
        });
      },

      updatePredictions: (text, lang = 'en') => {
        const scope = currentPredictionIdentity();
        get().activatePredictionIdentity(scope, lang);
        const seed = getSeed(lang);
        const corpus = syncCorpusSeed(lang);
        const active = get();
        const userWf = active.wordFreq;
        const userBg = active.bigrams;
        const userTg = active.trigrams;
        const plan = useAuthStore.getState().profile?.plan;
        const clinical = plan && PAID_PLANS.has(plan) ? getClinicalWordFreq(lang) : {};
        // Corpus + phrase seed + clinical = baseline. User counts get a boost
        // multiplier on TOP of the baseline so personal typing patterns can
        // outrank generic suggestions instead of being normalized to ~0.2.
        const baselineWf = mergePredictionBaselines(
          corpus?.wordFreq ?? {},
          seed.wordFreq,
          clinical,
        );
        const baselineBg = mergePredictionContextBaselines(
          corpus?.bigrams ?? {},
          seed.bigrams,
        );
        const baselineTg = mergePredictionContextBaselines(
          corpus?.trigrams ?? {},
          seed.trigrams,
        );
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
        const language = useSettingsStore.getState().language || 'en';
        get().activatePredictionIdentity(currentPredictionIdentity(), language);
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
        const lang = useSettingsStore.getState().language || 'en';
        get().activatePredictionIdentity(currentPredictionIdentity(), lang);
        const { wordFreq, bigrams, trigrams } = get();
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
      // The adapter routes this logical store to an account+language key.
      // The fixed name is never used as a physical v5 localStorage key.
      name: LEGACY_STORAGE_KEY,
      version: SCOPED_STORAGE_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        // v4 and earlier have no owner/language and are deliberately not
        // assigned to the currently visible user.
        return version === SCOPED_STORAGE_VERSION
          ? persistedState as PredictionState
          : {};
      },
      partialize: (s) => ({
        personalizationScope: s.personalizationScope,
        personalizationLanguage: s.personalizationLanguage,
        wordFreq: s.wordFreq,
        bigrams: s.bigrams,
        trigrams: s.trigrams,
      }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<PredictionState>;
        if (
          p.personalizationScope !== activeStorageScope
          || p.personalizationLanguage !== activeStorageLanguage
        ) {
          return currentState;
        }
        const seed = getSeed(activeStorageLanguage);
        return {
          ...currentState,
          personalizationScope: activeStorageScope,
          personalizationLanguage: activeStorageLanguage,
          wordFreq: { ...seed.wordFreq, ...cleanNgrams(p.wordFreq) },
          bigrams: { ...seed.bigrams, ...cleanNgrams(p.bigrams) },
          trigrams: { ...seed.trigrams, ...cleanNgrams(p.trigrams) },
        };
      },
      // Persist signed-in personalization only. The adapter captures the
      // physical key and routing generation at schedule time, so a delayed
      // User A write can never be redirected into User B's store.
      storage: {
        getItem: () => {
          const state = readScopedPredictionSlice(
            activeStorageScope,
            activeStorageLanguage,
          );
          return state
            ? { state, version: SCOPED_STORAGE_VERSION }
            : null;
        },
        setItem: (_name: string, value: unknown) => {
          schedulePredictionWrite(value);
        },
        removeItem: () => {
          flushPredictionWrite();
          const key = scopedStorageKey();
          if (!key || typeof localStorage === 'undefined') return;
          try { localStorage.removeItem(key); } catch {}
        },
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPredictionWrite);
  window.addEventListener('beforeunload', flushPredictionWrite);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPredictionWrite();
  });
}

// Keep the active deterministic personalization boundary synchronized without
// importing predictionStore back into authStore (which would form a cycle).
useAuthStore.subscribe((state, previous) => {
  const email = state.profile?.email.toLowerCase() ?? null;
  const previousEmail = previous.profile?.email.toLowerCase() ?? null;
  if (email === previousEmail) return;
  usePredictionStore.getState().activatePredictionIdentity(
    getPredictionSessionScope(state.profile?.email),
    useSettingsStore.getState().language || 'en',
  );
});

useSettingsStore.subscribe((state, previous) => {
  if (state.language === previous.language) return;
  usePredictionStore.getState().activatePredictionIdentity(
    currentPredictionIdentity(),
    state.language,
  );
});
