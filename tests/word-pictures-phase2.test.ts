/**
 * Phase 2 of the picture-coverage work: about 100 new drawings for frequent meanings that had no English
 * picture (blanket, grass, swim, toy, picnic, lemon ... and the function words really, without, most, finally ...), each
 * checked before shipping, plus words that reuse an existing picture. The other
 * languages reach these pictures through their word tables (tests/picture-words.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

const url = (word: string) => builtInVocabularySymbol(word, 'en')?.url ?? null;

describe('new English word pictures', () => {
  it.each([
    'blanket', 'grass', 'swim', 'toy', 'picnic', 'lemon', 'oxygen', 'robot', 'honey', 'sand', 'cane', 'walker', 'universe',
    'calendar', 'theater', 'castle', 'garlic', 'president', 'breathe', 'faint', 'sweat', 'stretch', 'repeat', 'vacation',
  ])('shows its own drawing for "%s"', (word) => {
    expect(url(word)).toBe(`/prism-aac/symbols/w-${word}.png`);
  });

  it.each([
    'really', 'without', 'most', 'even', 'finally', 'especially', 'except', 'directly', 'each', 'actually', 'than',
    'instead', 'meanwhile', 'usually', 'within', 'oh', 'completely',
  ])('draws the function word "%s" as a symbol', (word) => {
    expect(url(word)).toBe(`/prism-aac/symbols/w-${word}.png`);
  });
});

describe('words that reuse an existing picture', () => {
  it.each([
    ['latte', 'cappuccino'], ['beef', 'meat'], ['indeed', 'really'], ['surely', 'really'], ['football', 'soccer'],
    ['breath', 'breathe'], ['journal', 'diary'], ['mister', 'sir'], ['minister', 'president'], ['timeline', 'diagram'],
    ['shop', 'store'], ['planner', 'calendar'], ['photograph', 'picture'], ['nauseous', 'nausea'],
  ])('"%s" shows the picture of "%s"', (word, base) => {
    expect(url(base)).not.toBeNull();
    expect(url(word)).toBe(url(base));
  });
});

describe('drawings that needed a third attempt', () => {
  // The first two attempts of each were rejected (a pump read as a fire extinguisher, a dryer as a
  // washing machine, nausea as a stomach ache, the two degree words as a glass of water). The retried drawings add the
  // part the model dropped (the tyre), heat cues, a green stomach and a slider, and passed the same blind judging.
  it.each(['pump', 'dryer', 'nausea', 'quite', 'somewhat'])('"%s" has its own picture file', (word) => {
    expect(url(word)).toBe(`/prism-aac/symbols/w-${word}.png`);
  });

  it('keeps the two degree words apart', () => {
    expect(url('quite')).not.toBe(url('somewhat'));
  });
});
