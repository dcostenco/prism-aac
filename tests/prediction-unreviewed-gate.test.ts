/**
 * The vocabulary gate for languages with no native-speaker review (constants/translationReviewStatus.ts) hid the
 * unreviewed tiles from the board and search, but their machine translations still fed the prediction bar: the
 * phrase seed was built from every tile. Swahili "shoroba" (a corridor, the text of the Sparrow tile) and "medu" (not
 * a word, the text of the Socks tile) were offered while typing. A hidden tile's text now stays out of predictions
 * until a caregiver turns on "show unreviewed words".
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { usePredictionStore } from '@/store/predictionStore';
import { isPhraseVisibleForLanguage } from '@/constants/translationReviewStatus';

const predict = (text: string, lang = 'sw') => {
  usePredictionStore.getState().updatePredictions(text, lang as never);
  return usePredictionStore.getState().predictions.map((p) => p.toLowerCase());
};

afterEach(() => useSettingsStore.setState({ showUnreviewedVocabulary: false }));

describe('hidden tiles do not reach the prediction bar', () => {
  it('the words come only from tiles the board hides by default', () => {
    expect(isPhraseVisibleForLanguage('ab-sparrow', 'sw', false)).toBe(false);
    expect(isPhraseVisibleForLanguage('cl-socks', 'sw', false)).toBe(false);
  });

  it.each([['shor', 'shoroba'], ['med', 'medu']])('Swahili "%s" does not offer "%s" by default', (prefix, word) => {
    useSettingsStore.setState({ showUnreviewedVocabulary: false });
    expect(predict(prefix)).not.toContain(word);
  });

  it.each([['shor', 'shoroba'], ['med', 'medu']])('with "show unreviewed words" on, "%s" offers "%s" again', (prefix, word) => {
    useSettingsStore.setState({ showUnreviewedVocabulary: true });
    expect(predict(prefix)).toContain(word);
  });

  it('a tile the board shows still feeds predictions', () => {
    // cw-help is core vocabulary, shown in every language
    useSettingsStore.setState({ showUnreviewedVocabulary: false });
    expect(isPhraseVisibleForLanguage('cw-help', 'sw', false)).toBe(true);
    expect(predict('said')).toContain('saidia');
  });
});
