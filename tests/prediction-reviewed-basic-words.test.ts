import { beforeAll, describe, expect, it } from 'vitest';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import basicWords from './fixtures/basic-vocabulary-words.json';

beforeAll(() => ensureLangCorpusLoaded('fr'));

describe('reviewed basic spellings participate in local prediction', () => {
  it('accepts exact reviewed aliases only in their declared language', () => {
    for (const word of basicWords.girl.fr) {
      expect(isAllowedInLang(word, 'fr'), word).toBe(true);
      expect(isAllowedInLang(word, 'en'), word).toBe(false);
      expect(isAllowedInLang(word, 'ro'), word).toBe(false);
    }
  });

  it('offers an approved plural absent from the general corpus while typing its prefix', () => {
    usePredictionStore.getState().updatePredictions(basicWords.girl.fr[0].slice(0, -2), 'fr');
    const suggestions = usePredictionStore.getState().predictions
      .filter(word => isAllowedInLang(word, 'fr')).map(word => word.toLowerCase());
    expect(suggestions).toContain(basicWords.girl.fr[1]);
  });

  it('does not carry the reviewed foreign alias into the next language', () => {
    usePredictionStore.getState().updatePredictions(basicWords.girl.fr[0].slice(0, -2), 'fr');
    usePredictionStore.getState().updatePredictions(basicWords.girl.fr[0].slice(0, -2), 'en');
    const suggestions = usePredictionStore.getState().predictions.map(word => word.toLowerCase());
    for (const word of basicWords.girl.fr) expect(suggestions).not.toContain(word);
  });
});
