/**
 * The language gate (lib/langAllowlist.ts) compared a word's raw count in the target language's seed with its raw count in
 * every other Latin-script seed and dropped the word when another language counted more. Those counts are not comparable
 * across languages (the seeds differ in size and in how their head was built), so the gate removed the most frequent
 * words of a language from its prediction bar: Spanish que, con, para, un, en, tu, como, del (about 20 of the top 200 in
 * every Latin-script language, English included (is, in, on, we, me, so), and 30% of Italian's and Dutch's top 1000). A word
 * of the app's own authored vocabulary for that language now belongs to it; a word nobody authored is still judged by the
 * dominance comparison. Found in review.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { isAllowedInLang } from '@/lib/langAllowlist';

const LATIN = ['en', 'ro', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'nl', 'tr', 'vi'] as const;

beforeAll(async () => {
  for (const lang of LATIN) await loadPredictionSeed(lang);
});

describe('frequent words of the language, authored in its phrases, pass the gate', () => {
  it.each([
    ['en', ['is', 'in', 'on', 'we', 'me', 'so', 'as', 'am', 'was', 'will', 'doctor', 'hospital']],
    ['es', ['que', 'con', 'para', 'un', 'en', 'tu', 'como', 'del', 'mi', 'hora', 'casa']],
    ['fr', ['de', 'la', 'il', 'me', 'ne', 'du', 'mais', 'non']],
    ['pt', ['de', 'a', 'por', 'que', 'do', 'vamos', 'em']],
    ['it', ['la', 'un', 'una', 'al', 'le', 'con', 'quando', 'mio']],
    ['ro', ['de', 'o', 'la', 'un', 'nu', 'ce', 'ai', 'meu']],
    ['nl', ['je', 'de', 'me', 'te', 'in', 'dan', 'over', 'dit']],
    ['pl', ['to', 'mi', 'do', 'po', 'tu', 'ci']],
    ['tr', ['en', 'bu', 'son', 've', 'su']],
    ['de', ['es', 'in', 'wie', 'da', 'er', 'nie']],
  ] as const)('%s', (lang, words) => {
    for (const word of words) expect(isAllowedInLang(word, lang), word).toBe(true);
  });
});

describe('what the gate exists to stop is still stopped', () => {
  it('English words in other languages stay out', () => {
    for (const lang of ['ro', 'es', 'fr', 'de', 'it'] as const) {
      for (const word of ['the', 'and', 'hello']) expect(isAllowedInLang(word, lang), `${lang} ${word}`).toBe(false);
    }
    // "main" is also a French word (hand): it is only a leak in the others
    for (const lang of ['ro', 'es', 'de', 'it'] as const) expect(isAllowedInLang('main', lang), lang).toBe(false);
  });

  it('other languages words in English stay out', () => {
    for (const word of ['eu', 'ce', 'nu', 'main']) expect(isAllowedInLang(word, 'en'), word).toBe(false);
    expect(isAllowedInLang('noise', 'en')).toBe(true);
  });

  it('a fragment of a contraction is not a word of the language', () => {
    // Italian phrases spell "l'acqua", "c'è", "com'è": the whole word is authored, the one-letter fragments are not
    for (const word of ['l', 'c', 'd']) expect(isAllowedInLang(word, 'it'), `it ${word}`).toBe(false);
    for (const word of ['c', 'd']) expect(isAllowedInLang(word, 'es'), `es ${word}`).toBe(false);
  });

  it('a Romanian word that is English elsewhere is judged by the corpora, not trusted by spelling', () => {
    expect(isAllowedInLang('noise', 'ro')).toBe(false);
  });
});

describe('how many of the top 200 seed words the gate still drops', () => {
  // Before: en 10, es 20, fr 12, de 14, pt 17, ro 20, it 49, pl 13, nl 45, tr 14, vi 3. Single letters (apostrophe fragments)
  // and words nobody authored remain; the bounds only catch a return to the old behaviour.
  it.each([['en', 4], ['es', 10], ['fr', 5], ['de', 10], ['pt', 8], ['ro', 8], ['it', 20], ['pl', 6], ['nl', 14], ['tr', 6], ['vi', 3]] as const)(
    '%s drops at most %i', async (lang, bound) => {
      const seed = await loadPredictionSeed(lang);
      const top = Object.entries(seed.wordFreq).sort((a, b) => b[1].count - a[1].count).slice(0, 200).map(([w]) => w);
      expect(top.filter((w) => !isAllowedInLang(w, lang)).length).toBeLessThanOrEqual(bound);
    },
  );
});
