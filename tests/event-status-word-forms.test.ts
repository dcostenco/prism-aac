import { beforeAll, describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import { loadPictureWords } from '@/constants/pictureWords';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import forms from './fixtures/event-status-word-forms.json';

beforeAll(() => Promise.all(forms.predictionCases.map(({ lang }) => ensureLangCorpusLoaded(lang))));

describe('former status and ordinary occurrence have separate pictures', () => {
  for (const family of [forms.former, forms.happens]) {
    it(`declares ${family.file} in every supported locale`, () => {
      expect(Object.keys(family.languages).sort()).toEqual([...SUPPORTED_SEED_LANGS].sort());
    });
    it.each(SUPPORTED_SEED_LANGS)(`%s resolves the ${family.file} forms without waiting for lazy tables`, async lang => {
      for (const word of family.languages[lang]) {
        expect(resolveVocabularyPicture(word, lang).url, word).toBe(`/prism-aac/symbols/${family.file}`);
      }
      await loadPictureWords(lang);
      for (const word of family.languages[lang]) {
        expect(resolveVocabularyPicture(word, lang).url, word).toBe(`/prism-aac/symbols/${family.file}`);
      }
    });
  }

  it.each(forms.predictionCases)('offers $lang $word from $text with its intended picture', ({ lang, text, word, file }) => {
    usePredictionStore.getState().updatePredictions(text, lang as typeof SUPPORTED_SEED_LANGS[number]);
    expect(usePredictionStore.getState().predictions.filter(value => isAllowedInLang(value, lang)))
      .toContain(word);
    expect(resolveVocabularyPicture(word, lang as typeof SUPPORTED_SEED_LANGS[number]).url)
      .toBe(`/prism-aac/symbols/${file}`);
  });

  it('preserves past being, unrelated spelling neighbors, and question meanings', async () => {
    await loadPictureWords('ru');
    expect(resolveVocabularyPicture('бывал', 'ru').url).toBe('/prism-aac/symbols/w-past-being.png');
    expect(resolveVocabularyPicture('бывает', 'ru').url).toBe('/prism-aac/symbols/w-happen.png');
    expect(resolveVocabularyPicture('бывший', 'ru').url).toBe('/prism-aac/symbols/w-former.png');
    expect(resolveVocabularyPicture('what happened', 'en').url).not.toBe('/prism-aac/symbols/w-happen.png');
    for (const word of ['formation', 'formula', 'happiness', 'wasted', 'washington']) {
      expect(resolveVocabularyPicture(word, 'en').url ?? '').not.toMatch(/w-(former|happen)\.png/);
    }
    expect(resolveVocabularyPicture('бывший', 'en').url).toBeNull();
  });
});
