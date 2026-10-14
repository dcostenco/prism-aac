/**
 * Phase 2b of the picture-coverage work: the next 61 everyday meanings by cross-language
 * demand (vegetable, meal, towel, fan, laboratory, autumn, relax, skate ...), each checked before shipping, after one redraw for the first 15 rejections. The words whose drawing still read as something
 * else (rinse as a sink, entrance as an exit, chase as a race, whistle as a mouse ...) stay words. The other languages
 * reach these pictures through their word tables (tests/picture-words.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

const url = (word: string) => builtInVocabularySymbol(word, 'en')?.url ?? null;

describe('new everyday word pictures', () => {
  it.each([
    'approximately', 'athlete', 'autumn', 'bake', 'bark', 'basil', 'bowling', 'brush', 'cabbage', 'cable', 'captain', 'cheer',
    'cleaning', 'countryside', 'cracker', 'craft', 'crayon', 'dressing', 'euro', 'everywhere', 'expensive', 'experiment', 'fair',
    'fan', 'forever', 'fry', 'gallery', 'gas', 'geography', 'insulin', 'iron', 'laboratory', 'lung', 'meal', 'meatball', 'melon',
    'mineral', 'neighborhood', 'net', 'package', 'port', 'pretzel', 'relax', 'ribbon', 'rise', 'sausage', 'skate', 'slice',
    'somersault', 'spaghetti', 'spray', 'station', 'thread', 'toaster', 'tooth', 'towel', 'treasure', 'vegetable', 'whipped',
    'wing', 'worm',
  ])('shows its own drawing for "%s"', (word) => {
    expect(url(word)).toBe(`/prism-aac/symbols/w-${word}.png`);
  });
});

describe('words that reuse an existing picture', () => {
  it.each([['asthma', 'inhaler'], ['baked', 'bake'], ['fried', 'fry'], ['chore', 'cleaning'], ['dishwashing', 'dishwasher']])(
    '"%s" shows the picture of "%s"',
    (word, base) => {
      expect(url(base)).not.toBeNull();
      expect(url(word)).toBe(url(base));
    },
  );
});

describe('drawings the judge rejected', () => {
  // rinse (read as a sink), whistle (a mouse), insert (an ATM), entrance (an exit), chase (a race), descend (climbing),
  // somewhere (a book), suddenly (a danger sign), recently (the past or the future), total (savings)
  it.each(['rinse', 'whistle', 'insert', 'entrance', 'chase', 'descend', 'somewhere', 'suddenly', 'recently', 'total'])(
    '"%s" has no picture',
    (word) => {
      expect(url(word)).toBeNull();
    },
  );
});
