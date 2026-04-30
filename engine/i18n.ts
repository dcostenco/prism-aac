/**
 * i18n Engine — Lightweight translation system
 *
 * No external dependencies. Loads JSON translation files,
 * returns translated strings by key with English fallback.
 */

import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import fr from '@/i18n/fr.json';
import pt from '@/i18n/pt.json';
import ro from '@/i18n/ro.json';
import uk from '@/i18n/uk.json';
import ru from '@/i18n/ru.json';
import de from '@/i18n/de.json';
import ja from '@/i18n/ja.json';
import ko from '@/i18n/ko.json';
import zh from '@/i18n/zh.json';
import ar from '@/i18n/ar.json';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'pt' | 'ro' | 'uk' | 'ru' | 'de' | 'ja' | 'ko' | 'zh' | 'ar';

const translations: Record<SupportedLanguage, Record<string, string>> = {
  en, es, fr, pt, ro, uk, ru, de, ja, ko, zh, ar,
};

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
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export function getTTSCode(lang: SupportedLanguage): string {
  return LANG_META.find(l => l.code === lang)?.ttsCode ?? 'en-US';
}

export function isRTL(lang: SupportedLanguage): boolean {
  return LANG_META.find(l => l.code === lang)?.rtl ?? false;
}
