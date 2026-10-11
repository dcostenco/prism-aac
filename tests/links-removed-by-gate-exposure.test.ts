/**
 * The language gate used to hide the most frequent words of every Latin-script language from the prediction bar, which also
 * hid whatever picture they had. Fixing the gate (lib/langAllowlist.ts) made them visible, so 129 links on newly visible
 * words were checked again. That removed 20: Spanish "que" (that) had the picture of "qué" (what) from an
 * accent-blind match, French "a" the picture of "à", Italian "male" (mostly "mi fa male", it hurts) an angry face, Romanian
 * "dor" and "au" the hurt / ouch words, Italian "dog" (only ever "hot dog"), Vietnamese "la" ("sô cô la") and "mai" ("phô mai"),
 * and so on. Six Vietnamese syllables whose dominant compound has another meaning went too (cảm of "cảm ơn" = thank you,
 * lỗi of "xin lỗi" = sorry, bác of "bác sĩ" = doctor, tiếp of "tiếp theo" = next, khoác of "áo khoác" = jacket, cây of
 * "trái cây" = fruit).
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { isAllowedInLang } from '@/lib/langAllowlist';

type Lang = Parameters<typeof builtInVocabularySymbol>[1];
interface Table { words: Record<string, string> }
const TABLES = Object.fromEntries(
  Object.entries(import.meta.glob('../constants/generated/pictureWords/*.json', { eager: true, import: 'default' }))
    .map(([path, t]) => [path.split('/').pop()!.replace('.json', ''), t as Table]),
) as Record<string, Table>;

const REMOVED: [Lang, string, string][] = [
  ['ro', 'a', 'to / the letter a'], ['ro', 'au', 'have / ouch'], ['ro', 'ei', 'they (f) / interjection'], ['ro', 'dor', 'longing / they hurt'],
  ['es', 'que', 'that, not qué (what)'], ['es', 'del', 'of the, not from'], ['fr', 'a', 'has, not à (to)'],
  ['pt', 'na', 'in the'], ['pt', 'cartas', 'letters / cards'],
  ['it', 'lo', 'clitic'], ['it', 'fa', 'does / ago'], ['it', 'centro', 'centre / downtown'], ['it', 'male', 'bad / hurt'],
  ['it', 'ne', 'of it'], ['it', 'dog', 'only in hot dog'],
  ['nl', 'beste', 'best'], ['nl', 'mis', 'wrong'], ['nl', 'even', 'just / even'], ['nl', 'af', 'off / finished'],
  ['tr', 'et', 'do / meat'],
  ['vi', 'la', 'chocolate syllable'], ['vi', 'mai', 'cheese syllable'], ['vi', 'cảm', 'thank you'], ['vi', 'lỗi', 'sorry'],
  ['vi', 'bác', 'doctor'], ['vi', 'tiếp', 'next'], ['vi', 'khoác', 'jacket'], ['vi', 'cây', 'fruit'],
];

describe.each(REMOVED)('%s "%s" (%s)', (lang, word) => {
  it('is not in the table and shows no picture', async () => {
    expect(TABLES[lang].words[word]).toBeUndefined();
    await loadPictureWords(lang);
    expect(builtInVocabularySymbol(word, lang)?.url ?? null).toBeNull();
  });
});

describe('the gate and the pictures together', () => {
  it('Spanish "que", "con" and "para" reach the bar, "que" without the "what" picture', async () => {
    for (const l of ['en', 'ro', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'nl', 'tr', 'vi'] as const) await loadPredictionSeed(l);
    await loadPictureWords('es');
    for (const word of ['que', 'con', 'para']) expect(isAllowedInLang(word, 'es'), word).toBe(true);
    expect(builtInVocabularySymbol('que', 'es')?.url ?? null).toBeNull();
    expect(builtInVocabularySymbol('con', 'es')?.url).toBe('/prism-aac/symbols/cw-with.png');
    expect(builtInVocabularySymbol('para', 'es')?.url).toBe('/prism-aac/symbols/cw-for.png');
  });
});

describe('Whether-tile spellings with another common job stay words', () => {
  // German ob (also "als ob"), Vietnamese liệu ("tài liệu" = document), Hebrew האם (also "the mother"), Bulgarian дали
  // (also "given"), Hindi चाहे (concessive "whether ... or"), Korean ~인지 (the tile's spelling of the ending that was
  // removed as 인지): each reached the question symbol only through the Whether tile's own text, never through a link review.
  it.each([['de', 'ob'], ['vi', 'liệu'], ['he', 'האם'], ['bg', 'дали'], ['hi', 'चाहे'], ['ko', '~인지']] as [Lang, string][])(
    '%s "%s"', async (lang, word) => {
      await loadPictureWords(lang);
      expect(builtInVocabularySymbol(word, lang)).toEqual({ url: null });
    },
  );

  it('the polar-question particles keep the picture', async () => {
    for (const [lang, word] of [['ru', 'ли'], ['pl', 'czy'], ['uk', 'чи'], ['zh-Hans', '是否']] as [Lang, string][]) {
      await loadPictureWords(lang);
      expect(builtInVocabularySymbol(word, lang)?.url, `${lang} ${word}`).toBe('/prism-aac/symbols/cw-whether.png');
    }
  });
});
