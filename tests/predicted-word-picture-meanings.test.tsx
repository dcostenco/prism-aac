import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol, resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import { getPictogramUrl } from '@/services/pictogramService';
import type { SupportedLanguage } from '@/engine/i18n';
import fixture from './fixtures/predicted-word-picture-meanings.json';

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(),
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));

describe('reported picture gaps use the translated meaning without hiding an existing sense', () => {
  it.each(fixture.cases)('$lang $word preserves its reviewed meaning', async ({ lang, word, files }) => {
    const language = lang as SupportedLanguage;
    await loadPictureWords(language);
    if (files.length === 1) {
      expect(resolveVocabularyPicture(word, language)).toEqual({ kind: 'symbol', url: `/prism-aac/symbols/${files[0]}` });
    } else {
      expect(resolveVocabularyPicture(word, language)).toEqual({ kind: 'ambiguous', url: null });
      expect(builtInVocabularySymbol(word, language)).toEqual({ url: null });
      expect(reviewedVocabularyPictureChoices(word, language)).toEqual(files);
    }
  });

  it.each(fixture.cases.filter(row => row.files.length > 1))(
    '$lang $word shows both approved senses without requesting paid generation', async ({ lang, word, files }) => {
      vi.mocked(getPictogramUrl).mockClear();
      const language = lang as SupportedLanguage;
      await loadPictureWords(language);
      const { result, unmount } = renderHook(() => usePredictionPicture(word, language, 'symbols-ai', ''));
      await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(files));
      expect(result.current.pictureUrl).toBeNull();
      expect(result.current.reason).toBe('alternative-meanings');
      expect(getPictogramUrl).not.toHaveBeenCalled();
      unmount();
    },
  );

  it('keeps the vowelled Arabic property and medicine spellings distinct', () => {
    expect(resolveVocabularyPicture('عَقَار', 'ar').url).toBe('/prism-aac/symbols/w-estate.png');
    expect(resolveVocabularyPicture('عَقَّار', 'ar').url).toBe('/prism-aac/symbols/hb-medicine.png');
  });
});
