/**
 * Vietnamese words with a stacked diacritic reach the prediction bar.
 *
 * The store's per-language script filter for Vietnamese listed the base vowels and the single-mark letters but not
 * U+1EA0-U+1EF9 (ạ ả ấ ầ ế ệ ố ộ ớ ợ ụ ứ ự ỳ ỷ ỹ ...), so được, bạn, muốn, một, nước, mẹ and cần were dropped as "wrong
 * script": typing "mu" offered mua, muffin and muesli, and "b" never offered bạn. 509 of the 1,000 most frequent Vietnamese
 * words could never be predicted.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';

beforeEach(async () => {
  await loadPredictionSeed('vi');
  useSettingsStore.setState({ language: 'vi', outputLanguage: 'vi' } as never);
  usePredictionStore.setState({ wordFreq: {}, bigrams: {}, trigrams: {}, aiCompletion: null, predictions: [] });
  usePredictionStore.getState().ensureSeed();
});

describe('Vietnamese prediction', () => {
  it.each([
    ['mu', 'muốn'], ['đư', 'được'], ['nư', 'nước'], ['mộ', 'một'], ['cầ', 'cần'], ['bạ', 'bạn'],
  ])('typing "%s" offers "%s"', (prefix, word) => {
    usePredictionStore.getState().updatePredictions(prefix, 'vi');
    expect(usePredictionStore.getState().predictions.map((w) => w.toLowerCase())).toContain(word);
  });

  it('still drops a word in another script', () => {
    usePredictionStore.getState().updatePredictions('', 'vi');
    expect(usePredictionStore.getState().predictions.join('')).not.toMatch(/[Ѐ-ӿ一-鿿]/u);
  });
});
