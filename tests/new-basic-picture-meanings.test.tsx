import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import { getPictogramUrl } from '@/services/pictogramService';
import approved from '@/constants/generated/phraseSymbolFiles.json';
import fixture from './fixtures/new-basic-picture-meanings.json';

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(),
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));

describe('new basic noun artwork resolves by meaning without paid generation', () => {
  it.each(fixture.cases)('$word has every declared approved picture', async ({ word, files }) => {
    vi.mocked(getPictogramUrl).mockClear();
    for (const file of files) expect(Object.hasOwn(approved.files, file)).toBe(true);
    const { result, unmount } = renderHook(() => usePredictionPicture(word, 'en', 'symbols-ai', ''));
    if (files.length === 1) {
      expect(resolveVocabularyPicture(word, 'en').url).toBe(`/prism-aac/symbols/${files[0]}`);
      await waitFor(() => expect(result.current.pictureUrl).toContain(files[0]));
    } else {
      expect(resolveVocabularyPicture(word, 'en').url).toBeNull();
      expect(reviewedVocabularyPictureChoices(word, 'en')).toEqual(files);
      await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(files));
      expect(result.current.pictureUrl).toBeNull();
    }
    expect(getPictogramUrl).not.toHaveBeenCalled();
    unmount();
  });

  it('preserves the Dutch bear meaning and unrelated English spellings', () => {
    expect(resolveVocabularyPicture('beer', 'nl').url).toBe('/prism-aac/symbols/an-bear.png');
    expect(resolveVocabularyPicture('beet', 'en').url ?? '').not.toContain('w-beer.png');
    expect(reviewedVocabularyPictureChoices('mice', 'nl')).toEqual([]);
  });
});
