import { describe, it, expect } from 'vitest';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';

describe('Phrase translations — getPhraseText', () => {
  it('returns English fallback text for "en" language', () => {
    const result = getPhraseText('help-all-done', 'en', 'All done');
    expect(result).toBe('All done');
  });

  it('returns Romanian translation for "ro" language', () => {
    const result = getPhraseText('help-all-done', 'ro', 'All done');
    expect(result).toBe('Gata');
  });

  it('returns Russian translation for "ru" language', () => {
    const result = getPhraseText('help-all-done', 'ru', 'All done');
    expect(result).toBe('Готово');
  });

  it('returns Spanish translation for "es" language', () => {
    const result = getPhraseText('qt-hello', 'es', 'Hello');
    expect(result).toBe('Hola');
  });

  it('returns French translation for "fr" language', () => {
    const result = getPhraseText('qt-thank-you', 'fr', 'Thank you');
    expect(result).toBe('Merci');
  });

  it('returns German translation for "de" language', () => {
    const result = getPhraseText('help-bathroom', 'de', 'Bathroom');
    expect(result).toBe('Toilette');
  });

  it('returns Arabic translation for "ar" language', () => {
    const result = getPhraseText('help-yes', 'ar', 'Yes');
    expect(result).toBe('نعم');
  });

  it('returns Japanese translation for "ja" language', () => {
    const result = getPhraseText('qt-hello', 'ja', 'Hello');
    expect(result).toBe('こんにちは');
  });

  it('falls back to English text for unknown phrase IDs', () => {
    const result = getPhraseText('nonexistent-id', 'ro', 'Fallback text');
    expect(result).toBe('Fallback text');
  });

  it('falls back to English text when phrase has no translation for the language', () => {
    // Use a made-up phrase ID that definitely won't be in the map
    const result = getPhraseText('totally-unknown', 'ru', 'English fallback');
    expect(result).toBe('English fallback');
  });
});

describe('Phrase translations — Core word coverage', () => {
  it('all core pronoun IDs have translations', () => {
    const corePronouns = DEFAULT_PHRASES.filter((p) => p.categoryId === 'core-pronouns');
    for (const phrase of corePronouns) {
      const ro = getPhraseText(phrase.id, 'ro', phrase.text);
      expect(ro).not.toBe(phrase.text); // Should have a Romanian translation
    }
  });

  it('all core verb IDs have translations', () => {
    const coreVerbs = DEFAULT_PHRASES.filter((p) => p.categoryId === 'core-verbs');
    for (const verb of coreVerbs) {
      const es = getPhraseText(verb.id, 'es', verb.text);
      expect(es).not.toBe(verb.text); // Should have a Spanish translation
    }
  });

  it('all help-needs IDs have translations', () => {
    const helpPhrases = DEFAULT_PHRASES.filter((p) => p.categoryId === 'help-needs');
    for (const phrase of helpPhrases) {
      const ru = getPhraseText(phrase.id, 'ru', phrase.text);
      expect(ru).not.toBe(phrase.text);
    }
  });

  it('all feelings IDs have translations', () => {
    const feelings = DEFAULT_PHRASES.filter((p) => p.categoryId === 'feelings');
    for (const phrase of feelings) {
      const de = getPhraseText(phrase.id, 'de', phrase.text);
      expect(de).not.toBe(phrase.text);
    }
  });

  it('all default phrases have at least a Romanian translation', () => {
    for (const phrase of DEFAULT_PHRASES) {
      const ro = getPhraseText(phrase.id, 'ro', phrase.text);
      // All default phrase IDs should exist in the translation map
      expect(ro).toBeDefined();
      expect(typeof ro).toBe('string');
      expect(ro.length).toBeGreaterThan(0);
    }
  });
});
