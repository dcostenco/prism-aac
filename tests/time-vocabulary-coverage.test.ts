import { describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { loadPictureWords } from '@/constants/pictureWords';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import time from './fixtures/time-vocabulary-words.json';
describe('time is basic vocabulary in every supported locale',()=>{
 it('declares every locale',()=>expect(Object.keys(time.languages).sort()).toEqual([...SUPPORTED_SEED_LANGS].sort()));
 it.each(SUPPORTED_SEED_LANGS)('%s shows the reviewed time meaning in every declared form',async lang=>{
  await loadPictureWords(lang);
  for(const word of time.languages[lang])expect(resolveVocabularyPicture(word,lang).url,word).toBe('/prism-aac/symbols/'+time.file);
 });
 it('keeps Romanian weather, wanting, and partial indefinite forms separate',async()=>{
  await loadPictureWords('ro');
  expect(resolveVocabularyPicture('vremea','ro').url).toBe('/prism-aac/symbols/cat-weather.png');
  expect(resolveVocabularyPicture('vreau','ro').url).toBe('/prism-aac/symbols/cw-want.png');
  expect(resolveVocabularyPicture('vreo','ro').url??'').not.toContain('w-time');
 });
});
