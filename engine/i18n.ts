/**
 * i18n Engine — Lazy-loaded translation system
 *
 * Only English is bundled statically (always needed as fallback).
 * Other languages load dynamically when the user switches settings.
 *
 * Chinese is split into THREE locales (BCP-47 compliant):
 *   - zh-Hans  Simplified Chinese / Mainland (Mandarin pronunciation)
 *   - zh-Hant  Traditional Chinese / Taiwan (Taiwanese Mandarin)
 *   - zh-HK    Traditional Chinese / Hong Kong (Cantonese)
 *
 * Legacy code 'zh' is retained as an alias for 'zh-Hans' for back-compat —
 * the synalux portal accepts both shapes. New code paths should use the
 * BCP-47 form. See docs/TTS-ARCHITECTURE.md for routing details.
 */

import en from '@/i18n/en.json';

export type SupportedLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'pt'
  | 'ro'
  | 'uk'
  | 'ru'
  | 'de'
  | 'ja'
  | 'ko'
  | 'zh'        // alias of zh-Hans for back-compat
  | 'zh-Hans'   // Simplified, Mainland — Mandarin
  | 'zh-Hant'   // Traditional, Taiwan — Taiwanese Mandarin
  | 'zh-HK'     // Traditional, Hong Kong — Cantonese
  | 'ar'
  // Sprint 1 expansion — voice infra already wired in synalux portal voice-catalog
  | 'hi'        // Hindi — Aanya (Inworld)
  | 'it'        // Italian — Giulia (Inworld)
  | 'pl'        // Polish — Zofia (Inworld)
  | 'he'        // Hebrew — Noa (Inworld), RTL
  | 'nl'        // Dutch — Lotte (Inworld)
  // Sprint 2/3 expansion — Azure neural voices added in synalux portal voice-catalog
  | 'vi'        // Vietnamese — Hoài Mỹ / Nam Minh (Azure)
  | 'tl'        // Filipino/Tagalog — Blessica / Angelo (Azure, fil-PH)
  | 'tr'        // Turkish — Emel / Ahmet (Azure)
  | 'id'        // Bahasa Indonesia — Gadis / Ardi (Azure)
  | 'bg'        // Bulgarian — Borislav / Kalina (Azure)
  // Sprint 4 expansion — Azure neural voices; see portal shared/voice-catalog.ts
  | 'am'        // Amharic — Mekdes / Ameha (Azure), Ge'ez script
  | 'sw'        // Swahili — Rehema / Daudi (Azure)
  | 'bn';       // Bengali — Nabanita / Pradeep (Azure), Bengali script

const loaded: Partial<Record<SupportedLanguage, Record<string, string>>> = { en };

const loaders: Record<SupportedLanguage, () => Promise<{ default: Record<string, string> }>> = {
  en: () => Promise.resolve({ default: en }),
  es: () => import('@/i18n/es.json'),
  fr: () => import('@/i18n/fr.json'),
  pt: () => import('@/i18n/pt.json'),
  ro: () => import('@/i18n/ro.json'),
  uk: () => import('@/i18n/uk.json'),
  ru: () => import('@/i18n/ru.json'),
  de: () => import('@/i18n/de.json'),
  ja: () => import('@/i18n/ja.json'),
  ko: () => import('@/i18n/ko.json'),
  zh: () => import('@/i18n/zh-Hans.json'),
  'zh-Hans': () => import('@/i18n/zh-Hans.json'),
  'zh-Hant': () => import('@/i18n/zh-Hant.json'),
  'zh-HK': () => import('@/i18n/zh-HK.json'),
  ar: () => import('@/i18n/ar.json'),
  hi: () => import('@/i18n/hi.json'),
  it: () => import('@/i18n/it.json'),
  pl: () => import('@/i18n/pl.json'),
  he: () => import('@/i18n/he.json'),
  nl: () => import('@/i18n/nl.json'),
  vi: () => import('@/i18n/vi.json'),
  tl: () => import('@/i18n/tl.json'),
  tr: () => import('@/i18n/tr.json'),
  id: () => import('@/i18n/id.json'),
  bg: () => import('@/i18n/bg.json'),
  am: () => import('@/i18n/am.json'),
  sw: () => import('@/i18n/sw.json'),
  bn: () => import('@/i18n/bn.json'),
};

export async function loadLanguage(lang: SupportedLanguage): Promise<void> {
  if (loaded[lang]) return;
  try {
    const mod = await loaders[lang]();
    loaded[lang] = mod.default;
  } catch {
    // Failed to load — will fall back to English
  }
}

// `flag` is the canonical country/region emoji shown in pickers. For
// languages spoken across many countries (e.g. English, Arabic, Spanish),
// we pick the most populous canonical region. Hong Kong gets HK, Chinese
// Traditional gets TW, Simplified gets CN. Filipino gets PH, Hindi IN.
const LANG_META: Array<{ code: SupportedLanguage; name: string; nativeName: string; rtl: boolean; ttsCode: string; flag: string }> = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false, ttsCode: 'en-US', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, ttsCode: 'es-ES', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, ttsCode: 'fr-FR', flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false, ttsCode: 'pt-BR', flag: '🇧🇷' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', rtl: false, ttsCode: 'ro-RO', flag: '🇷🇴' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', rtl: false, ttsCode: 'uk-UA', flag: '🇺🇦' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false, ttsCode: 'ru-RU', flag: '🇷🇺' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, ttsCode: 'de-DE', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, ttsCode: 'ja-JP', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false, ttsCode: 'ko-KR', flag: '🇰🇷' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', nativeName: '简体中文', rtl: false, ttsCode: 'zh-CN', flag: '🇨🇳' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', nativeName: '繁體中文', rtl: false, ttsCode: 'zh-TW', flag: '🇹🇼' },
  { code: 'zh-HK', name: 'Cantonese (Hong Kong)', nativeName: '廣東話', rtl: false, ttsCode: 'zh-HK', flag: '🇭🇰' },
  // 'zh' (back-compat alias) is intentionally not in the visible language picker —
  // it's resolved to 'zh-Hans' by canonicalizeLang() below.
  { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false, ttsCode: 'zh-CN', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, ttsCode: 'ar-SA', flag: '🇸🇦' },
  // Sprint 1 — Inworld voices (already wired in synalux portal voice-catalog)
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false, ttsCode: 'hi-IN', flag: '🇮🇳' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false, ttsCode: 'it-IT', flag: '🇮🇹' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false, ttsCode: 'pl-PL', flag: '🇵🇱' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true, ttsCode: 'he-IL', flag: '🇮🇱' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false, ttsCode: 'nl-NL', flag: '🇳🇱' },
  // Sprint 2/3 — Azure neural voices (added in synalux portal voice-catalog)
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', rtl: false, ttsCode: 'vi-VN', flag: '🇻🇳' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', rtl: false, ttsCode: 'fil-PH', flag: '🇵🇭' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false, ttsCode: 'tr-TR', flag: '🇹🇷' },
  { code: 'id', name: 'Indonesian', nativeName: 'B. Indonesia', rtl: false, ttsCode: 'id-ID', flag: '🇮🇩' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', rtl: false, ttsCode: 'bg-BG', flag: '🇧🇬' },
  // Sprint 4 — Azure neural voices. Region choices follow the "most populous
  // canonical region" rule above: Tanzania (~67M) over Kenya for Swahili and
  // it is where Standard Swahili (Kiswahili sanifu) originates; Bangladesh
  // (~170M) over West Bengal for Bengali. Azure also publishes sw-KE-* and
  // bn-IN-* voices if a deployment needs the other region.
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', rtl: false, ttsCode: 'am-ET', flag: '🇪🇹' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', rtl: false, ttsCode: 'sw-TZ', flag: '🇹🇿' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', rtl: false, ttsCode: 'bn-BD', flag: '🇧🇩' },
];

/** Public helper — gets the flag for a language code, '' if unknown. */
export function getLanguageFlag(lang: string): string {
  const canonical = canonicalizeLang(lang);
  return LANG_META.find((l) => l.code === canonical)?.flag ?? '';
}

/** Returns the canonical BCP-47 form of any input language code. */
export function canonicalizeLang(lang: string): SupportedLanguage {
  if (!lang) return 'en';
  // Direct match (already canonical)
  const direct = LANG_META.find((l) => l.code === lang);
  if (direct) return direct.code;
  // Lowercase BCP-47 normalization: zh-cn -> zh-Hans, zh-tw -> zh-Hant, etc.
  const norm = lang.toLowerCase();
  if (norm === 'zh-cn' || norm === 'zh_cn' || norm === 'zh-hans' || norm === 'zh_hans') return 'zh-Hans';
  if (norm === 'zh-tw' || norm === 'zh_tw' || norm === 'zh-hant' || norm === 'zh_hant') return 'zh-Hant';
  if (norm === 'zh-hk' || norm === 'zh_hk' || norm === 'yue-hk' || norm === 'yue_hk') return 'zh-HK';
  // Strip region: 'en-GB' -> 'en'
  const base = norm.split(/[-_]/)[0] as SupportedLanguage;
  return LANG_META.find((l) => l.code === base)?.code ?? 'en';
}

export { LANG_META };

export function t(key: string, lang: SupportedLanguage = 'en'): string {
  return loaded[lang]?.[key] ?? loaded.en?.[key] ?? key;
}

export function getTTSCode(lang: string): string {
  // Accepts SupportedLanguage AND any string — falls back to en-US for
  // unknown codes. Widened from `lang: SupportedLanguage` so callers
  // (locale-tagged user input, settings store, tests) don't need to
  // narrow before calling. The lookup is already safe.
  return LANG_META.find(l => l.code === lang)?.ttsCode ?? 'en-US';
}

export function getLanguageName(lang: string): string {
  const canonical = canonicalizeLang(lang);
  return LANG_META.find(l => l.code === canonical)?.name ?? 'English';
}

export function isRTL(lang: SupportedLanguage): boolean {
  return LANG_META.find(l => l.code === lang)?.rtl ?? false;
}

export function isLanguageLoaded(lang: SupportedLanguage): boolean {
  return !!loaded[lang];
}
