/**
 * i18n Engine — Lazy-loaded translation system
 *
 * Only English is bundled statically (always needed as fallback).
 * Other languages load dynamically when the user switches settings.
 */

import en from '@/i18n/en.json';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'pt' | 'ro' | 'uk' | 'ru' | 'de' | 'ja' | 'ko' | 'zh' | 'ar';

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
  zh: () => import('@/i18n/zh.json'),
  ar: () => import('@/i18n/ar.json'),
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

const LANG_META: Array<{ code: SupportedLanguage; name: string; nativeName: string; rtl: boolean; ttsCode: string }> = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false, ttsCode: 'en-US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, ttsCode: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, ttsCode: 'fr-FR' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false, ttsCode: 'pt-BR' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', rtl: false, ttsCode: 'ro-RO' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', rtl: false, ttsCode: 'uk-UA' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false, ttsCode: 'ru-RU' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, ttsCode: 'de-DE' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, ttsCode: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false, ttsCode: 'ko-KR' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false, ttsCode: 'zh-CN' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, ttsCode: 'ar-SA' },
];

export { LANG_META };

export function t(key: string, lang: SupportedLanguage = 'en'): string {
  return loaded[lang]?.[key] ?? loaded.en?.[key] ?? key;
}

export function getTTSCode(lang: SupportedLanguage): string {
  return LANG_META.find(l => l.code === lang)?.ttsCode ?? 'en-US';
}

export function isRTL(lang: SupportedLanguage): boolean {
  return LANG_META.find(l => l.code === lang)?.rtl ?? false;
}

export function isLanguageLoaded(lang: SupportedLanguage): boolean {
  return !!loaded[lang];
}
