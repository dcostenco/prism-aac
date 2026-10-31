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
import { getPredictions } from '@/engine/predictionEngine';
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
    expect(words).toHaveLength(5);
    expect(new Set(words).size).toBe(words.length);
    // The plain spelling is the typed word itself, so it is not offered.
    expect(words).not.toContain('мед');
    // The surname медведев ranks last (owner report), so медаль keeps its slot.
    expect(words).toContain('медаль');
    expect(words).not.toContain('медведев');
  });

  it('an explicitly typed мёд is not offered again on the bar', () => {
    expect(shown('мёд')).not.toContain('мёд');
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

  it('the surname медведев ranks last but still shows when it is what matches, and the bear stays', () => {
    expect(shown('медведе')).toContain('медведев');
    expect(shown('медв')).toContain('медведь');
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

describe('the ё word in the engine itself', () => {
  const dictionary = {
    мёд: { count: 3, lastUsed: 0 },
    мед: { count: 30, lastUsed: 0 },
    медаль: { count: 42, lastUsed: 0 },
    медленно: { count: 44, lastUsed: 0 },
    медведь: { count: 34, lastUsed: 0 },
    медали: { count: 43, lastUsed: 0 },
    медведи: { count: 4, lastUsed: 0 },
  };
  const config = (maxResults: number) => ({ bigramWeight: 0.5, frequencyWeight: 0.3, recencyWeight: 0.2, maxResults, recencyWindowMs: 600_000 });
  const predict = (text: string, maxResults = 5, scriptFilter?: RegExp, lang = 'ru') =>
    getPredictions(text, dictionary, {}, config(maxResults), {}, ['я', 'ты'], new Set<string>(), scriptFilter, lang);

  it('puts the ё word first, once, within the result budget', () => {
    const words = predict('мед');
    expect(words[0]).toBe('мёд');
    expect(words.filter(word => word === 'мёд')).toHaveLength(1);
    expect(words.length).toBeLessThanOrEqual(5);
  });

  it.each([0, 1])('respects a result budget of %i', (budget) => {
    const words = predict('мед', budget);
    expect(words).toHaveLength(budget);
    if (budget) expect(words[0]).toBe('мёд');
  });

  it('never offers the ё word a script filter rejects', () => {
    expect(predict('мед', 5, /^[а-я'-]+$/)).not.toContain('мёд');
  });

  it('does not re-offer a word typed with its ё', () => {
    expect(predict('мёд')).not.toContain('мёд');
  });

  it('applies to Russian only', () => {
    expect(predict('мед', 5, undefined, 'uk')[0]).not.toBe('мёд');
  });

  it('offers the ё word in the case the bar uses for every completion', () => {
    expect(predict('Мед')[0]).toBe('мёд');
    expect(predict('мед')[0]).toBe('мёд');
  });
});
