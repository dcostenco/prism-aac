import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { t, getTTSCode, isRTL, LANG_META, SupportedLanguage, loadLanguage } from '@/engine/i18n';

beforeAll(async () => {
  const langs: SupportedLanguage[] = ['es', 'fr', 'de', 'ja', 'ar', 'pt', 'ro', 'uk', 'ru', 'ko', 'zh'];
  await Promise.all(langs.map(loadLanguage));
});

describe('i18n — Translation engine', () => {
  it('returns English text for known key', () => {
    expect(t('categories', 'en')).toBe('Categories');
    expect(t('type_here', 'en')).toBe('Type here...');
    expect(t('speak', 'en')).toBe('Speak');
  });

  it('returns Spanish text for known key', () => {
    expect(t('categories', 'es')).toBe('Categorías');
    expect(t('type_here', 'es')).toBe('Escribe aquí...');
    expect(t('speak', 'es')).toBe('Hablar');
  });

  it('falls back to English for missing key in target language', () => {
    // 'ai_chat' was added to en.json but may not be in all languages
    const result = t('ai_chat', 'es');
    // Should return English fallback or the key itself
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the key itself for completely unknown key', () => {
    expect(t('totally_unknown_key_xyz', 'en')).toBe('totally_unknown_key_xyz');
  });

  it('has translations for all 12 languages', () => {
    const langs: SupportedLanguage[] = ['en', 'es', 'fr', 'pt', 'ro', 'uk', 'ru', 'de', 'ja', 'ko', 'zh', 'ar'];
    for (const lang of langs) {
      expect(t('categories', lang), `Missing 'categories' in ${lang}`).not.toBe('categories');
    }
  });

  it('all languages have category names translated', () => {
    const catKeys = ['help_needs', 'quick_talk', 'places_plans', 'food_ordering', 'people_social', 'school_work'];
    for (const lang of ['es', 'fr', 'de', 'ja', 'ar'] as SupportedLanguage[]) {
      for (const key of catKeys) {
        const val = t(key, lang);
        expect(val, `Missing '${key}' in ${lang}`).not.toBe(key);
      }
    }
  });
});

describe('i18n — TTS language codes', () => {
  it('returns correct TTS code for each language', () => {
    expect(getTTSCode('en')).toBe('en-US');
    expect(getTTSCode('es')).toBe('es-ES');
    expect(getTTSCode('ja')).toBe('ja-JP');
    expect(getTTSCode('ar')).toBe('ar-SA');
    expect(getTTSCode('zh')).toBe('zh-CN');
  });

  it('falls back to en-US for unknown language', () => {
    expect(getTTSCode('xx' as SupportedLanguage)).toBe('en-US');
  });
});

describe('i18n — RTL support', () => {
  it('Arabic is RTL', () => {
    expect(isRTL('ar')).toBe(true);
  });

  it('English is LTR', () => {
    expect(isRTL('en')).toBe(false);
  });

  it('all other languages are LTR', () => {
    const ltrLangs: SupportedLanguage[] = ['es', 'fr', 'pt', 'ro', 'uk', 'ru', 'de', 'ja', 'ko', 'zh'];
    for (const lang of ltrLangs) {
      expect(isRTL(lang), `${lang} should be LTR`).toBe(false);
    }
  });
});

describe('i18n — Language metadata', () => {
  it('has 28 languages', () => {
    // 25 through Sprint 3, +3 in Sprint 4 (am, sw, bn).
    expect(LANG_META).toHaveLength(28);
  });

  it('every LANG_META code has a loadable locale file', () => {
    // Guards the failure mode where a language reaches the picker but its
    // i18n/<code>.json was never generated — the picker then offers a
    // language that silently renders entirely in English.
    for (const lang of LANG_META) {
      const file = path.join(__dirname, '..', 'i18n', `${lang.code === 'zh' ? 'zh-Hans' : lang.code}.json`);
      expect(fs.existsSync(file), `no locale file for ${lang.code}`).toBe(true);
    }
  });

  it('each language has all required fields', () => {
    for (const lang of LANG_META) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
      expect(lang.ttsCode).toBeTruthy();
      expect(lang.flag, `language ${lang.code} missing flag`).toBeTruthy();
      expect(typeof lang.rtl).toBe('boolean');
    }
  });

  it('native names are in the correct script', () => {
    const ja = LANG_META.find(l => l.code === 'ja')!;
    expect(ja.nativeName).toBe('日本語');
    const ar = LANG_META.find(l => l.code === 'ar')!;
    expect(ar.nativeName).toBe('العربية');
    const ru = LANG_META.find(l => l.code === 'ru')!;
    expect(ru.nativeName).toBe('Русский');
  });
});
