import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPhraseText } from '@/constants/phraseTranslations';
import { loadPictureWords } from '@/constants/pictureWords';
import { resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import type { SupportedLanguage } from '@/engine/i18n';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import { getPictogramUrl } from '@/services/pictogramService';
import meanings from './fixtures/basic-picture-meanings.json';

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(),
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));

describe('everyday multilingual words retain their reviewed meanings', () => {
  it.each(meanings.alternatives)('$locale $word offers the declared meanings without selecting one', async ({ locale, word, files }) => {
    const language = locale as SupportedLanguage;
    await loadPictureWords(language);
    expect(resolveVocabularyPicture(word, language)).toEqual({ kind: 'ambiguous', url: null });
    expect(reviewedVocabularyPictureChoices(word, language)).toEqual(files);
    expect(reviewedVocabularyPictureChoices(word, language, 'unrelated prefix ')).toEqual(files);
  });

  it.each(meanings.labels)('$locale $phraseId has a specific label and the correct noun picture', async ({ locale, phraseId, word, file }) => {
    const language = locale as SupportedLanguage;
    await loadPictureWords(language);
    expect(getPhraseText(phraseId, language, '')).toBe(word);
    expect(resolveVocabularyPicture(word, language).url).toBe(`/prism-aac/symbols/${file}`);
    for (const dictionary of ['constants/aacTranslations.json', 'ios-native/PrismAACWatch/Sources/AI/aacTranslations.json']) {
      const data = JSON.parse(readFileSync(dictionary, 'utf8'));
      expect(data.phrases.find((row: { id: string }) => row.id === phraseId).translations[locale]).toBe(word);
    }
  });

  it.each(meanings.alternatives)('$locale $word displays all reviewed meanings without generation', async ({ locale, word, files }) => {
    const language = locale as SupportedLanguage;
    vi.mocked(getPictogramUrl).mockClear();
    const { result, unmount } = renderHook(() => usePredictionPicture(word, language, 'symbols-ai', ''));
    await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(files));
    expect(result.current.pictureUrl).toBeNull();
    expect(getPictogramUrl).not.toHaveBeenCalled();
    unmount();
  });

  it('replaces a previous picture immediately when the word or language changes', async () => {
    const { result, rerender, unmount } = renderHook(({ word, language }) => usePredictionPicture(word, language, 'symbols-ai', ''),
      { initialProps: { word: 'book', language: 'en' as SupportedLanguage } });
    await waitFor(() => expect(result.current.pictureUrl).toContain('sw-book.png'));
    rerender({ word: 'bij', language: 'nl' });
    expect(result.current.pictureUrl).toBeNull();
    await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(['an-bee.png', 'cw-at.png', 'cw-by.png']));
    rerender({ word: '벌', language: 'ko' });
    expect(result.current.pictureUrl).toBeNull();
    expect(result.current.alternativeImages).toEqual([]);
    unmount();
  });

  it('keeps generic clothing and unresolved homographs explicit', async () => {
    await loadPictureWords('tl');
    expect(resolveVocabularyPicture('damit', 'tl').url).toBe('/prism-aac/symbols/cat-clothes.png');
    for (const { locale, word } of meanings.held) {
      await loadPictureWords(locale as SupportedLanguage);
      expect(resolveVocabularyPicture(word, locale as SupportedLanguage).url).toBeNull();
    }
    expect(resolveVocabularyPicture('beer', 'nl').url).toBe('/prism-aac/symbols/an-bear.png');
    expect(reviewedVocabularyPictureChoices('bijen', 'nl')).toEqual([]);
  });
});
