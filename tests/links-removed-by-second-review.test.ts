/**
 * Links removed in a later review. Each was a hand link whose picture shows
 * a different person or one sense of a word with another common sense:
 *  - person-neutral "self" words linked to the first- or second-person picture: "he did it himself" cannot show "Myself"
 *    (the same reasoning that removed English "own" and the Hindi possessives);
 *  - German waren (also "Waren", goods) and druck (pressure, but also print);
 *  - Japanese 等 (etc., but also grade and equal), which the earlier review kept as a close call.
 * Picture policy: no picture when a common other meaning would need a different one.
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

type Lang = Parameters<typeof builtInVocabularySymbol>[1];
interface Table { words: Record<string, string> }
const TABLES = Object.fromEntries(
  Object.entries(import.meta.glob('../constants/generated/pictureWords/*.json', { eager: true, import: 'default' }))
    .map(([path, t]) => [path.split('/').pop()!.replace('.json', ''), t as Table]),
) as Record<string, Table>;
const file = (word: string, lang: Lang) => builtInVocabularySymbol(word, lang)?.url?.split('/').pop() ?? null;

const REMOVED: [Lang, string, string][] = [
  ['bn', 'নিজেকে', 'oneself'], ['de', 'selber', 'oneself'], ['ja', '自身', 'oneself'], ['ko', '스스로', 'by oneself'],
  ['tl', 'sarili', 'oneself'], ['vi', 'tự', 'oneself'], ['zh-Hans', '自己', 'oneself'], ['zh-Hant', '自己', 'oneself'],
  ['zh-HK', '自己', 'oneself'], ['tr', 'kendine', 'to oneself'], ['tr', 'kendini', 'oneself'],
  ['de', 'waren', 'were / goods'], ['de', 'druck', 'pressure / print'], ['ja', '等', 'etc. / grade'],
];

describe.each(REMOVED)('%s "%s" (%s)', (lang, word) => {
  it('is not in the table', () => {
    expect(TABLES[lang].words[word]).toBeUndefined();
  });

  it('shows no person picture, no sense picture and no grammar symbol', async () => {
    await loadPictureWords(lang);
    expect(file(word, lang)).toBeNull();
  });
});

describe('the explicitly first- or second-person words keep their pictures', () => {
  // Arabic بنفسي / لنفسي say "by / for myself", Dutch uzelf is "yourself" (polite): the person is in the word.
  it.each([['ar', 'بنفسي', 'cw-myself.png'], ['ar', 'لنفسي', 'cw-myself.png'], ['nl', 'uzelf', 'cw-yourself.png'], ['tr', 'kendinize', 'cw-yourself.png']] as [Lang, string, string][])(
    '%s "%s" shows %s', async (lang, word, expected) => {
      await loadPictureWords(lang);
      expect(file(word, lang)).toBe(expected);
    },
  );
});
