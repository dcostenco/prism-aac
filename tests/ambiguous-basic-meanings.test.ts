import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import type { SupportedLanguage } from '@/engine/i18n';
import meanings from './fixtures/ambiguous-basic-meanings.json';
const rows = Object.entries(meanings).flatMap(([lang, words]) =>
  Object.entries(words).map(([word, entry]) => ({ lang: lang as SupportedLanguage, word, ...entry })));
describe('ambiguous basic words retain every reviewed meaning without borrowing a single sense', () => {
  it.each(rows)('$lang $word keeps the single-picture lookup conservative', async ({ lang, word, files }) => {
    await loadPictureWords(lang);
    expect(resolveVocabularyPicture(word, lang).url).toBeNull();
    expect(reviewedVocabularyPictureChoices(word, lang)).toEqual(files);
  });
  it('uses clear grammatical context without changing bare-word meanings', () => {
    expect(reviewedVocabularyPictureChoices('weiß', 'de', 'ich wei')).toEqual(['cw-know.png']);
    expect(reviewedVocabularyPictureChoices('weiß', 'de', 'es ist wei')).toEqual(['co-white.png']);
    expect(reviewedVocabularyPictureChoices('sein', 'de', 'ich will se')).toEqual(['cw-is.png']);
    expect(reviewedVocabularyPictureChoices('waren', 'de', 'wir ware')).toEqual(['w-past-being.png']);
    expect(reviewedVocabularyPictureChoices('mai', 'ro', 'tu esti ')).toEqual(['cw-more.png']);
  });
  it('does not invent sense alternatives for spelling neighbors or a foreign locale', () => {
    expect(reviewedVocabularyPictureChoices('weißbrot', 'de')).toEqual([]);
    expect(reviewedVocabularyPictureChoices('weiß', 'en')).toEqual([]);
    expect(reviewedVocabularyPictureChoices('constructor', 'ro')).toEqual([]);
  });
});
