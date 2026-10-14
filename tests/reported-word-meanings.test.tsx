import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { loadPictureWords } from '@/constants/pictureWords';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import files from '@/constants/generated/phraseSymbolFiles.json';
import meanings from './fixtures/reported-word-meanings.json';

const getPictogramUrl = vi.fn();
vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: (...args: unknown[]) => getPictogramUrl(...args),
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));
const CONCEPTS = Object.values(meanings);
const COUNTER_SENSES = [
  { lang: 'en', word: 'qualities', file: 'w-quality.png' },
  { lang: 'en', word: 'living quarters', file: 'w-quarter.png' },
  { lang: 'en', word: 'quarter dollar', file: 'w-quarter.png' },
  { lang: 'es', word: 'cualidad', file: 'w-quality.png' },
  { lang: 'ru', word: 'квартал', file: 'w-quarter.png' },
  { lang: 'ja', word: '四半期', file: 'w-quarter.png' },
  { lang: 'zh-Hans', word: '季度', file: 'w-quarter.png' },
  { lang: 'ar', word: 'صفة', file: 'w-quality.png' },
] as const;

describe('reported common words retain a specific primary meaning across languages', () => {
  it('includes both concepts in every supported locale and in the approved pack', () => {
    for (const concept of CONCEPTS) {
      expect(Object.keys(concept.languages).sort()).toEqual([...SUPPORTED_SEED_LANGS].sort());
      expect(files.files).toHaveProperty(concept.file);
    }
  });

  it.each(SUPPORTED_SEED_LANGS)('%s primary spellings show a picture before and after lazy loading', async lang => {
    const checks = () => {
      for (const concept of CONCEPTS) {
        for (const word of concept.languages[lang]) {
          expect(resolveVocabularyPicture(word.normalize('NFD'), lang)).toEqual({
            kind: 'symbol', url: `/prism-aac/symbols/${concept.file}`,
          });
        }
      }
    };
    checks();
    await loadPictureWords(lang);
    checks();
  });

  it.each(SUPPORTED_SEED_LANGS)('%s free predictions use the approved pictures without generating', lang => {
    getPictogramUrl.mockClear();
    for (const concept of CONCEPTS) {
      const { result, unmount } = renderHook(() => usePredictionPicture(concept.languages[lang][0], lang, 'symbols'));
      expect(result.current).toMatchObject({ picture: 'symbol', pictureUrl: `/prism-aac/symbols/${concept.file}` });
      unmount();
    }
    expect(getPictogramUrl).not.toHaveBeenCalled();
  });

  it.each(COUNTER_SENSES)('$lang $word does not borrow a different meaning', async ({ lang, word, file }) => {
    await loadPictureWords(lang);
    expect(resolveVocabularyPicture(word, lang).url).not.toBe(`/prism-aac/symbols/${file}`);
  });
});
