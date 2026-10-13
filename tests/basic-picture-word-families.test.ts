import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import approved from '@/constants/generated/phraseSymbolFiles.json';
import families from './fixtures/basic-picture-word-families.json';

const rows = families.families.flatMap(family => family.forms
  .filter(({ word }) => !('preserveAmbiguous' in family) || !family.preserveAmbiguous?.includes(word))
  .map(form => ({ ...form, concept: family.concept })));

describe('ordinary noun forms keep their approved meaning beyond the core vocabulary gate', () => {
  it.each(rows)('$word resolves to the reviewed $concept picture', async ({ word, file }) => {
    await loadPictureWords('en');
    expect(Object.prototype.hasOwnProperty.call(approved.files, file)).toBe(true);
    expect(resolveVocabularyPicture(word, 'en')).toEqual({ kind: 'symbol', url: `/prism-aac/symbols/${file}` });
  });

  it('retains the reviewed artwork inventory and its exact noun forms', () => {
    expect(families.pendingArtwork).toEqual([]);
    expect(families.reviewedArtwork.map(family => family.concept)).toEqual(['beer', 'mouse']);
    expect(families.reviewedArtwork.flatMap(family => family.words)).toEqual(['beer', 'beers', 'mouse', 'mice']);
    expect(families.reviewedArtwork.every(family => family.files.every(file => Object.hasOwn(approved.files, file)))).toBe(true);
  });

  it('does not borrow a noun picture for an unrelated spelling or foreign-language homograph', async () => {
    await loadPictureWords('nl');
    expect(resolveVocabularyPicture('beer', 'nl').url).toBe('/prism-aac/symbols/an-bear.png');
    expect(resolveVocabularyPicture('applesauce', 'en').url).not.toBe('/prism-aac/symbols/fd-apple.png');
    expect(resolveVocabularyPicture('hatch', 'en').url).not.toBe('/prism-aac/symbols/cl-hat.png');
    expect(resolveVocabularyPicture('bushel', 'en').url).not.toBe('/prism-aac/symbols/tr-bus.png');
    expect(resolveVocabularyPicture('chairman', 'en').url).not.toBe('/prism-aac/symbols/sw-chair.png');
  });
});
