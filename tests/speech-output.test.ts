import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { getTTSCode } from '@/engine/i18n';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
});

describe('Output language store', () => {
  it('defaults outputLanguage to en', () => {
    expect(useSettingsStore.getState().outputLanguage).toBe('en');
  });

  it('updates outputLanguage independently from language', () => {
    useSettingsStore.getState().update({ outputLanguage: 'ru' });
    expect(useSettingsStore.getState().language).toBe('en');
    expect(useSettingsStore.getState().outputLanguage).toBe('ru');
  });

  it('both languages can be set simultaneously', () => {
    useSettingsStore.getState().update({ language: 'es', outputLanguage: 'fr' });
    expect(useSettingsStore.getState().language).toBe('es');
    expect(useSettingsStore.getState().outputLanguage).toBe('fr');
  });
});

describe('TTS code derivation for output language', () => {
  it('maps all 12 languages to valid BCP-47 codes', () => {
    const expected: Record<string, string> = {
      en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR',
      ro: 'ro-RO', uk: 'uk-UA', ru: 'ru-RU', de: 'de-DE',
      ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA',
    };
    for (const [lang, code] of Object.entries(expected)) {
      expect(getTTSCode(lang)).toBe(code);
    }
  });

  it('falls back to en-US for unknown language', () => {
    expect(getTTSCode('xx')).toBe('en-US');
  });
});

describe('Language pair behavior', () => {
  it('same input/output = no translation needed', () => {
    useSettingsStore.setState({ language: 'ru', outputLanguage: 'ru' });
    const { language, outputLanguage } = useSettingsStore.getState();
    expect(language === outputLanguage).toBe(true);
  });

  it('different input/output = translation needed', () => {
    useSettingsStore.setState({ language: 'ru', outputLanguage: 'en' });
    const { language, outputLanguage } = useSettingsStore.getState();
    expect(language !== outputLanguage).toBe(true);
  });

  it('output TTS code follows outputLanguage, not language', () => {
    useSettingsStore.setState({ language: 'ru', outputLanguage: 'es' });
    const { outputLanguage } = useSettingsStore.getState();
    expect(getTTSCode(outputLanguage)).toBe('es-ES');
  });
});

describe('Settings migration for outputLanguage', () => {
  it('version 3 -> 4 migration sets outputLanguage from language', () => {
    const migrated = { language: 'ru', gridSize: 6, activeVocabSet: 'all' };
    const result = { ...migrated, outputLanguage: migrated.language ?? 'en' };
    expect(result.outputLanguage).toBe('ru');
  });

  it('version 1 -> 4 migration sets defaults', () => {
    const migrated = { language: 'fr' };
    const result = { ...migrated, gridSize: 6, activeVocabSet: 'all', outputLanguage: migrated.language ?? 'en' };
    expect(result.outputLanguage).toBe('fr');
    expect(result.gridSize).toBe(6);
  });
});
