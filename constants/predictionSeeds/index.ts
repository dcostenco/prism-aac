// Auto-generated on 2026-07-27 21:43:17. DO NOT edit by hand.
// regenerate via training/build_prediction_seeds.py
import { WordFreqEntry } from '@/types';

export interface PredictionSeed {
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
  trigrams: Record<string, WordFreqEntry>;
}

export const SUPPORTED_SEED_LANGS = ["am", "ar", "bg", "bn", "de", "en", "es", "fr", "he", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ro", "ru", "sw", "tl", "tr", "uk", "vi", "zh-HK", "zh-Hans", "zh-Hant"] as const;
export type SeedLang = (typeof SUPPORTED_SEED_LANGS)[number];

const cache = new Map<string, PredictionSeed>();
const inflight = new Map<string, Promise<PredictionSeed>>();

export function getCachedPredictionSeed(lang: string): PredictionSeed | null {
  return cache.get(lang) ?? null;
}

export async function loadPredictionSeed(lang: string): Promise<PredictionSeed> {
  const cached = cache.get(lang);
  if (cached) return cached;
  const pending = inflight.get(lang);
  if (pending) return pending;
  const p = (async () => {
    try {
      const mod = await loadByLang(lang);
      cache.set(lang, mod);
      return mod;
    } catch {
      const empty: PredictionSeed = { wordFreq: {}, bigrams: {}, trigrams: {} };
      cache.set(lang, empty);
      return empty;
    } finally {
      inflight.delete(lang);
    }
  })();
  inflight.set(lang, p);
  return p;
}

async function loadByLang(lang: string): Promise<PredictionSeed> {
  switch (lang) {
    case "am": return (await import("./am")).default;
    case "ar": return (await import("./ar")).default;
    case "bg": return (await import("./bg")).default;
    case "bn": return (await import("./bn")).default;
    case "de": return (await import("./de")).default;
    case "en": return (await import("./en")).default;
    case "es": return (await import("./es")).default;
    case "fr": return (await import("./fr")).default;
    case "he": return (await import("./he")).default;
    case "hi": return (await import("./hi")).default;
    case "id": return (await import("./id")).default;
    case "it": return (await import("./it")).default;
    case "ja": return (await import("./ja")).default;
    case "ko": return (await import("./ko")).default;
    case "nl": return (await import("./nl")).default;
    case "pl": return (await import("./pl")).default;
    case "pt": return (await import("./pt")).default;
    case "ro": return (await import("./ro")).default;
    case "ru": return (await import("./ru")).default;
    case "sw": return (await import("./sw")).default;
    case "tl": return (await import("./tl")).default;
    case "tr": return (await import("./tr")).default;
    case "uk": return (await import("./uk")).default;
    case "vi": return (await import("./vi")).default;
    case "zh-HK": return (await import("./zh-HK")).default;
    case "zh-Hans": return (await import("./zh-Hans")).default;
    case "zh-Hant": return (await import("./zh-Hant")).default;
    default: return { wordFreq: {}, bigrams: {}, trigrams: {} };
  }
}
