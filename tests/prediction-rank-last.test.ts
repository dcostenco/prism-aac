/**
 * Owner report 2026-10-31: "ger" and "geri" showed german / germany / gerald /
 * gerry / gerard, read as duplicates. First names from the seed's web word list
 * now rank last in the store's merged table (constants/predictionRankLast).
 *
 * An adversarial review caught that lowering their counts IN THE SEED made the
 * language gate (lib/langAllowlist) reject 240 names outright, because it
 * compares seed counts across languages. So the seed stays untouched and
 * these tests run through the real store and the real display gate.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { PREDICTION_RANK_LAST } from '@/constants/predictionRankLast';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';

function shown(text: string): string[] {
  usePredictionStore.getState().updatePredictions(text, 'en');
  return usePredictionStore.getState().predictions
    .filter(word => isAllowedInLang(word, 'en', { allowUnknown: true }))
    .map(word => word.toLowerCase());
}

describe('first names rank last on the English bar', () => {
  beforeAll(async () => {
    useSettingsStore.setState({ language: 'en' });
    await ensureLangCorpusLoaded('en');
    usePredictionStore.getState().updatePredictions('', 'en');
    await loadPredictionSeed('en');
    await Promise.resolve();
  });

  it.each(['ger', 'geri'])('"%s" offers words, not look-alike first names', (typed) => {
    const words = shown(typed);
    for (const name of ['gerald', 'gerard', 'gerry']) expect(words).not.toContain(name);
    expect(words).toEqual(expect.arrayContaining(['german', 'germany', 'germs']));
  });

  it('a name ranked last never ties an ordinary rare word ("cath": catheter before cathy)', () => {
    const words = shown('cath');
    expect(words).toContain('catheter');
    if (words.includes('cathy')) expect(words.indexOf('catheter')).toBeLessThan(words.indexOf('cathy'));
  });

  it('a name ranked last still shows, past the language gate, when it is what matches', () => {
    expect(shown('gera')).toContain('gerald');
    expect(isAllowedInLang('gerald', 'en')).toBe(true);
  });

  it('the seed and the language gate are untouched', async () => {
    const { wordFreq } = await loadPredictionSeed('en');
    expect(wordFreq.gerald.count).toBeGreaterThan(1);
    for (const name of PREDICTION_RANK_LAST.en) {
      if (wordFreq[name]) expect(wordFreq[name].count, name).toBeGreaterThanOrEqual(1);
    }
  });

  it('a name the user has used ranks as before (first for "ger")', () => {
    for (let i = 0; i < 3; i++) usePredictionStore.getState().learnWord('gerald');
    expect(shown('ger')[0]).toBe('gerald');
  });
});
