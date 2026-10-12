import { beforeAll, describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { getReviewedBasicWords } from '@/constants/reviewedBasicWords';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import { loadPictureWords } from '@/constants/pictureWords';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import forms from './fixtures/past-being-word-forms.json';

const EXPECTED = `/prism-aac/symbols/${forms.file}`;
const PREFIX_CASES = [
  { lang: 'de', prefix: 'gewes', word: 'gewesen' },
  { lang: 'fr', prefix: 'étai', word: 'était' },
  { lang: 'uk', prefix: 'бул', word: 'була' },
  { lang: 'ar', prefix: 'كان', word: 'كانت' },
] as const;

beforeAll(() => Promise.all(PREFIX_CASES.map(({ lang }) => ensureLangCorpusLoaded(lang))));

describe('past being retains its earlier-time meaning in every locale', () => {
  it('covers every supported locale explicitly', () => {
    expect(Object.keys(forms.languages).sort()).toEqual([...SUPPORTED_SEED_LANGS].sort());
  });

  it.each(SUPPORTED_SEED_LANGS)('%s resolves every declared form before and after lazy loading', async lang => {
    for (const word of forms.languages[lang]) {
      expect(resolveVocabularyPicture(word, lang).url, word).toBe(EXPECTED);
    }
    await loadPictureWords(lang);
    for (const word of forms.languages[lang]) {
      expect(resolveVocabularyPicture(word, lang).url, word).toBe(EXPECTED);
    }
  });

  it.each(PREFIX_CASES)('offers $lang $word while its prefix is being typed', ({ lang, prefix, word }) => {
    usePredictionStore.getState().updatePredictions(prefix, lang);
    expect(usePredictionStore.getState().predictions.filter(value => isAllowedInLang(value, lang)))
      .toContain(word);
    expect(resolveVocabularyPicture(word, lang).url).toBe(EXPECTED);
  });

  it('does not borrow tense from homographs or split qualified expressions into words', async () => {
    for (const [lang, word] of [['fr', 'été'], ['nl', 'was'], ['es', 'fue'], ['pt', 'foi']] as const) {
      await loadPictureWords(lang);
      expect(resolveVocabularyPicture(word, lang).url).not.toBe(EXPECTED);
    }
    for (const lang of ['id', 'tl', 'vi'] as const) {
      for (const phrase of forms.languages[lang]) {
        expect(getReviewedBasicWords(lang).has(phrase)).toBe(false);
      }
    }
    expect(resolveVocabularyPicture('war', 'en').url).not.toBe(EXPECTED);
    expect(resolveVocabularyPicture('warum', 'de').url).not.toBe(EXPECTED);
    expect(resolveVocabularyPicture('бытовой', 'ru').url).not.toBe(EXPECTED);
  });
});
