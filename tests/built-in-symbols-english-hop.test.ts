/**
 * A foreign word that is its own built-in phrase keeps its own picture.
 *
 * builtInVocabularySymbol added to a word's own phrases every phrase of its English source word, so Spanish "marzo" (its own
 * phrase, the month) also inherited the English "March" (to walk), "otoño" the verb "Fall", "caliente" the weather "Hot":
 * the sets pointed at different pictures, the word fell back to text, and "caliente" was the most-shown unpictured tile of
 * the Spanish bar. The English source is now consulted only for a word the language's own table does not spell, or for
 * a word with a reviewed picture choice (the choice was made from that wider set).
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

const file = (word: string, lang: Parameters<typeof builtInVocabularySymbol>[1]) =>
  builtInVocabularySymbol(word, lang)?.url?.split('/').pop() ?? null;

describe('a word that is its own phrase keeps its own picture', () => {
  it.each([
    ['marzo', 'es', 'tm-mar.png'], ['otoño', 'es', 'ts-fall.png'], ['caliente', 'es', 'dw-hot.png'], ['calor', 'es', 'ts-hot.png'],
    ['abierto', 'es', 'cw-open-2.png'], ['espalda', 'es', 'hb-back.png'], ['caer', 'es', 'cw-fall.png'], ['cortar', 'es', 'cw-cut.png'],
    ['열려있어요', 'ko', 'cw-open-2.png'], ['せなか', 'ja', 'hb-back.png'], ['割伤', 'zh-Hans', 'hb-cut.png'],
    ['柳橙', 'zh-Hant', 'fd-orange.png'],
  ] as const)('%s (%s) shows %s', async (word, lang, expected) => {
    await loadPictureWords(lang);
    expect(file(word, lang)).toBe(expected);
  });

  it('a reviewed choice keeps the set it was made from', async () => {
    await loadPictureWords('ru');
    expect(file('открыть', 'ru')).toBe('cw-open.png');
    expect(file('пусто', 'ru')).toBe('cw-empty.png');
    await loadPictureWords('ar');
    expect(file('الملعب', 'ar')).toBe('pl-playground.png');
    await loadPictureWords('ja');
    expect(file('開ける', 'ja')).toBe('cw-open.png');
  });

  it('a two-meaning word the language lists as such stays a word', async () => {
    // Arabic ظهر = back or noon, Chinese 空 = empty or sky and 背 = back or carry, Korean 등 = back or lamp, Swahili moto = fire or
    // hot, Spanish atrás = behind or ago: the picture would show one of two meanings (the review of the words this fix pictured)
    for (const [lang, word] of [['ar', 'ظهر'], ['zh-Hans', '空'], ['zh-Hans', '背'], ['ko', '등'], ['sw', 'moto'], ['es', 'atrás'], ['tl', 'puno']] as const) {
      await loadPictureWords(lang);
      expect(builtInVocabularySymbol(word, lang), `${lang} ${word}`).toEqual({ url: null });
    }
  });

  it('a word the language does not spell still reaches its English source', async () => {
    // not a phrase of its own in Spanish, but the AAC core list names its English source
    await loadPictureWords('es');
    expect(builtInVocabularySymbol('yo', 'es')?.url).toBeTruthy();
  });
});
