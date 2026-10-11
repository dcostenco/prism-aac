/**
 * A day-of-the-month tile is a text tile, but its word may also be a number or "first".
 *
 * Romanian writes dates with cardinals ("5th" is "cinci"), Spanish, German, Dutch and Bulgarian with the ordinal "first". The
 * tdate-N phrase claimed the spelling, so the word showed as text although the number's drawing exists ("five") and the
 * language's reviewed table names it. A date tile now lets the table decide, and only a date tile does: other text tiles keep
 * showing their word.
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

const file = async (word: string, lang: Parameters<typeof builtInVocabularySymbol>[1]) => {
  await loadPictureWords(lang);
  return builtInVocabularySymbol(word, lang)?.url?.split('/').pop() ?? null;
};

describe('date tiles that are also numbers', () => {
  it.each([
    ['cinci', 'ro', 'w-five.png'], ['doi', 'ro', 'w-two.png'], ['trei', 'ro', 'w-three.png'], ['patru', 'ro', 'w-four.png'],
    ['zece', 'ro', 'w-ten.png'], ['douăzeci', 'ro', 'w-twenty.png'], ['întâi', 'ro', 'ti-first.png'],
    ['primero', 'es', 'ti-first.png'], ['erster', 'de', 'ti-first.png'], ['eerste', 'nl', 'ti-first.png'],
    ['първи', 'bg', 'ti-first.png'], ['перше', 'uk', 'ti-first.png'],
  ] as const)('%s (%s) shows %s', async (word, lang, expected) => {
    expect(await file(word, lang)).toBe(expected);
  });

  it('a date tile whose spelling the review rejected keeps its text', async () => {
    // Romanian "nouă" is the number nine on a date tile but also "new" (feminine plural): no table link, so a word
    expect(await file('nouă', 'ro')).toBeNull();
  });

  it('English date tiles stay text tiles', async () => {
    expect(await file('5th', 'en')).toBeNull();
  });
});
