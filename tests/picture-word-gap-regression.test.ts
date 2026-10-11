// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { getPhraseText } from '@/constants/phraseTranslations';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInVocabularySymbol, resolveVocabularyPicture } from '@/lib/builtInSymbols';
import spatialGrammarPictures from '@/constants/generated/spatialGrammarPictures.json';
import positive from './fixtures/pictogram-positive.json';

const grammar = Object.entries(spatialGrammarPictures.aliases).flatMap(([lang, words]) =>
 Object.entries(words).map(([word, id]) => ({ lang: lang as any, word, id, file: `${id}.png` })));

it.each(grammar)('$lang $word uses the approved common spatial grammar picture', async ({ lang, word, file }) => {
 await loadPictureWords(lang);
 expect(resolveVocabularyPicture(word, lang)).toEqual({ kind: 'symbol', url: `/prism-aac/symbols/${file}` });
});

it('ordinary third-person motion does not disappear when ё is written as е', async () => {
 await loadPictureWords('ru');
 expect(builtInVocabularySymbol('идет', 'ru')).toEqual(builtInVocabularySymbol('идёт', 'ru'));
 expect(resolveVocabularyPicture('идет', 'ru').kind).toBe('symbol');
});

it.each(positive)('$lang canonical keyboard spelling retains the approved $word picture', async ({ lang, word, file }) => {
 await loadPictureWords(lang);
 expect(builtInVocabularySymbol(word.normalize('NFD'), lang as any)?.url).toBe(`/prism-aac/symbols/${file}`);
});

it('spelling repair does not turn comparison чем into the question чём', async () => {
 await loadPictureWords('ru');
 const table = JSON.parse(readFileSync('constants/generated/pictureWords/ru.json', 'utf8'));
 expect(table.words['чем']).toBeUndefined();
});

it('the spatial On labels do not describe switching power on', () => {
 for (const [lang, label] of Object.entries(spatialGrammarPictures.translationOverrides['cw-on'])) {
  expect(getPhraseText('cw-on', lang as any, 'On')).toBe(label);
 }
});

it('web offline and Watch dictionaries retain the same spatial meanings as the board', () => {
 for (const file of ['constants/aacTranslations.json', 'ios-native/PrismAACWatch/Sources/AI/aacTranslations.json']) {
  const dictionary = JSON.parse(readFileSync(file, 'utf8'));
  for (const id of ['cw-in', 'cw-on']) {
   const phrase = dictionary.phrases.find((p: {id: string}) => p.id === id);
   for (const lang of SUPPORTED_SEED_LANGS) {
    expect(phrase.translations[lang], `${file} ${id} ${lang}`).toBe(getPhraseText(id, lang, phrase.en));
   }
  }
 }
});

it('canonical spelling does not bypass a keep-text decision for Hindi thing/cheese', async () => {
 await loadPictureWords('hi');
 for (const word of ['चीज़', 'चीज़']) expect(resolveVocabularyPicture(word, 'hi')).toEqual({kind:'ambiguous',url:null});
});

it('Korean negation is not substituted with the spatial In picture', async () => {
 await loadPictureWords('ko');
 expect(resolveVocabularyPicture('안', 'ko').url).toBeNull();
 expect(resolveVocabularyPicture('안에', 'ko').url).toBe('/prism-aac/symbols/cw-in.png');
});
