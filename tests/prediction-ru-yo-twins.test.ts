/**
 * Owner report 2026-10-31: in Russian, "мед" showed медали / медведев /
 * медаль / медленно / медведь and never honey (мёд), and the keyboard had no
 * Ё. Russian is usually typed without the dots on ё, so the reviewed ё word a
 * typed word spells ("мед" → "мёд") now takes the first slot.
 *
 * An adversarial review rejected a spelling alias мед → мёд: it hid мёд (the
 * typed word is never offered) and stopped "мед" completing to медаль. These
 * tests run through the real store, seed and language gate.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { RU_YO_TWINS, ruYoTwinOf, matchesPredictionPrefix } from '@/engine/predictionSpellings';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';

function shown(text: string): string[] {
  usePredictionStore.getState().updatePredictions(text, 'ru');
  return usePredictionStore.getState().predictions
    .filter(word => isAllowedInLang(word, 'ru', { allowUnknown: true }))
    .map(word => word.toLowerCase());
}

describe('Russian ё words typed without the dots', () => {
  beforeAll(async () => {
    useSettingsStore.setState({ language: 'ru' });
    await ensureLangCorpusLoaded('ru');
    usePredictionStore.getState().updatePredictions('', 'ru');
    await loadPredictionSeed('ru');
    await Promise.resolve();
  });

  it('"мед" offers мёд first and still completes to other мед- words', () => {
    const words = shown('мед');
    expect(words[0]).toBe('мёд');
    expect(words).toEqual(expect.arrayContaining(['медленно', 'медведь']));
    // The plain spelling is the typed word itself, so it is not offered.
    expect(words).not.toContain('мед');
    // мёд took one slot; медаль is still a completion one letter later.
    expect(shown('меда')).toContain('медаль');
  });

  it.each([['еще', 'ещё'], ['ее', 'её'], ['лед', 'лёд'], ['черный', 'чёрный'], ['пойдем', 'пойдём']])(
    '"%s" offers %s first', (typed, twin) => {
      expect(shown(typed)[0]).toBe(twin);
    });

  it('works when the typed word starts with a capital', () => {
    expect(shown('Мед')[0]).toBe('мёд');
  });

  it('never forces a different word: все (all) and всё (everything) are not a reviewed pair', () => {
    expect(ruYoTwinOf('все')).toBeNull();
    expect(ruYoTwinOf('небо')).toBeNull();
  });

  it('an explicitly typed ё stays exact', () => {
    expect(ruYoTwinOf('мёд')).toBeNull();
    expect(matchesPredictionPrefix('мёд', 'мед', 'ru')).toBe(true);
    expect(matchesPredictionPrefix('мед', 'мёд', 'ru')).toBe(false);
  });

  it('applies to Russian only', () => {
    usePredictionStore.getState().updatePredictions('мед', 'uk');
    expect(usePredictionStore.getState().predictions.map(word => word.toLowerCase())[0]).not.toBe('мёд');
  });

  it('every reviewed word is in the Russian seed, so the rule has something to show', async () => {
    const { wordFreq } = await loadPredictionSeed('ru');
    for (const word of RU_YO_TWINS) expect(wordFreq[word], word).toBeDefined();
  });

  it('every reviewed word is the same length as its plain spelling and contains ё', () => {
    for (const word of RU_YO_TWINS) {
      expect(word).toContain('ё');
      expect(ruYoTwinOf(word.replace(/ё/g, 'е'))).toBe(word);
    }
  });
});
