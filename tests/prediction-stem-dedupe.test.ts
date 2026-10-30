/**
 * A second same-stem tile is a duplicate when it is only the first tile plus
 * a plural or possessive ending; inflections that change the word keep their
 * slot.
 *
 * Owner report 2026-10-30, production: typing "geri" showed
 * german / germany / germans / gerald / gerard — "german" and "germans" read
 * as the same tile twice. A strict one-form-per-stem rule was tried first and
 * hid base forms behind inflections in other languages (ru "вод" lost "вода",
 * es "com" lost "comer"), so those cases are pinned here too. Uses the
 * shipped seeds, so the assertions hold for what users actually see.
 */
import { describe, expect, it } from 'vitest';
import { getPredictions } from '@/engine/predictionEngine';
import { loadPredictionSeed } from '@/constants/predictionSeeds';

async function predict(lang: string, text: string): Promise<string[]> {
  const seed = await loadPredictionSeed(lang);
  return getPredictions(text, seed.wordFreq, seed.bigrams, undefined, seed.trigrams, [], new Set(), undefined, lang);
}

describe('prediction bar: plural twins', () => {
  it.each(['geri', 'ger'])('en "%s" does not list both german and germans', async (typed) => {
    const words = (await predict('en', typed)).map(w => w.toLowerCase());
    expect(words).toHaveLength(5);
    expect(words).toContain('german');
    expect(words).not.toContain('germans');
  });

  it('en "were bee": beers yields its slot to a distinct word next to beer', async () => {
    const words = (await predict('en', 'were bee')).map(w => w.toLowerCase());
    expect(words).toContain('beer');
    expect(words).not.toContain('beers');
  });

  it('en "tha": contractions and standalone words are not plural twins', async () => {
    const words = (await predict('en', 'tha')).map(w => w.toLowerCase());
    expect(words).toContain("that's");
    expect(words).toContain('thanks');
  });

  it('en "gla": glasses (spectacles) is not a plural twin of glass', async () => {
    const words = (await predict('en', 'gla')).map(w => w.toLowerCase());
    expect(words).toContain('glass');
    expect(words).toContain('glasses');
  });

  it('en "lov": the backfill keeps loves out while other words match', async () => {
    const words = (await predict('en', 'lov')).map(w => w.toLowerCase());
    expect(words).toHaveLength(5);
    expect(words).toContain('love');
    expect(words).not.toContain('loves');
  });

  it('fr "enf": French plurals are not twins (enfant stays next to enfants)', async () => {
    const words = await predict('fr', 'enf');
    expect(words).toContain('enfant');
    expect(words).toContain('enfants');
  });

  it('en "germ": a plural still fills the bar when few distinct words match', async () => {
    const words = (await predict('en', 'germ')).map(w => w.toLowerCase());
    expect(words).toHaveLength(5);
    expect(words).toContain('germs');
  });
});

describe('prediction bar: real inflections keep their second slot', () => {
  it('ru "вод" keeps вода next to воды', async () => {
    const words = await predict('ru', 'вод');
    expect(words).toContain('вода');
    expect(words).toContain('воды');
  });

  it('es "com" keeps comer next to como', async () => {
    const words = await predict('es', 'com');
    expect(words).toContain('comer');
  });

  it('de "kin" keeps kind next to kinder', async () => {
    const words = await predict('de', 'kin');
    expect(words).toContain('kind');
  });

  it('ro "tim" keeps timp next to timpul', async () => {
    const words = await predict('ro', 'tim');
    expect(words).toContain('timp');
    expect(words).toContain('timpul');
  });
});
