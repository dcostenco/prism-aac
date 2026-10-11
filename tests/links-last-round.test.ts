/**
 * The last batch of links, aimed at the heaviest words still without a picture in Ukrainian, Romanian, Russian, French and
 * Arabic. Most of the remaining words had already been rejected for a real sense problem (Ukrainian "може" is also
 * "maybe", "крім" / Russian "кроме" is also "besides" and "moreover", "навіть" / "даже" is not the equal-bars "even",
 * "оскільки" is causal, French "enfin" is also a discourse marker, Arabic "إلا" is also "only", Romanian "chiar" is
 * also "even"), so they stay words. Three new links shipped: Ukrainian грн (hryvnia) = money, Ukrainian зокрема = especially,
 * French "ah" = oh.
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

type Lang = Parameters<typeof builtInVocabularySymbol>[1];
const file = (word: string, lang: Lang) => builtInVocabularySymbol(word, lang)?.url?.split('/').pop() ?? null;

describe('new links', () => {
  it.each([
    ['uk', 'грн', 'w-money.png'], ['uk', 'зокрема', 'w-especially.png'], ['fr', 'ah', 'w-oh.png'],
  ] as [Lang, string, string][])('%s "%s" shows %s', async (lang, word, expected) => {
    await loadPictureWords(lang);
    expect(file(word, lang)).toBe(expected);
  });
});

describe('words an earlier review rejected stay words', () => {
  it.each([
    ['uk', 'може'], ['uk', 'навіть'], ['uk', 'крім'], ['uk', 'оскільки'], ['ru', 'даже'], ['ru', 'кроме'], ['ru', 'вполне'],
    ['fr', 'enfin'], ['ar', 'هاي'], ['ar', 'إلا'], ['ro', 'chiar'], ['ro', 'decât'], ['ro', 'către'],
  ] as [Lang, string][])('%s "%s"', async (lang, word) => {
    await loadPictureWords(lang);
    expect(file(word, lang)).toBeNull();
  });
});
