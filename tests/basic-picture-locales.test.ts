import { describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { loadPictureWords } from '@/constants/pictureWords';
import { getPhraseText, hasPhraseTranslation } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import type { SupportedLanguage } from '@/engine/i18n';
import fixture from './fixtures/basic-picture-locales.json';

describe('localized everyday concepts preserve their stable pictured meaning', () => {
  it('covers every supported locale and keeps competing meanings in the review inventory', () => {
    expect([...new Set(fixture.cases.map(row => row.locale))].sort()).toEqual([...SUPPORTED_SEED_LANGS].sort());
    expect(fixture.pendingMeaningReview.length).toBeGreaterThan(0);
    expect(fixture.pendingMeaningReview.every(row => row.locale && row.word && row.phraseId && row.file)).toBe(true);
  });

  it.each(fixture.cases)('$locale $word preserves its reviewed $concept picture', async ({ locale, word, phraseId, file }) => {
    const language = locale as SupportedLanguage;
    await loadPictureWords(language);
    const phrase = DEFAULT_PHRASES.find(row => row.id === phraseId);
    expect(phrase).toBeDefined();
    if (language !== 'en') expect(hasPhraseTranslation(phraseId, language)).toBe(true);
    expect(getPhraseText(phraseId, language, phrase!.text)).toBe(word);
    expect(resolveVocabularyPicture(word, language)).toEqual({ kind: 'symbol', url: `/prism-aac/symbols/${file}` });
  });
});
