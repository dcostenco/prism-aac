import { describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { getPhraseText, hasPhraseTranslation } from '@/constants/phraseTranslations';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInPhraseSymbolUrl, resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import approved from '@/constants/generated/phraseSymbolFiles.json';
import symbols from '@/constants/generated/phraseSymbols.json';
import concepts from './fixtures/everyday-basic-concepts.json';
import defaults from './fixtures/everyday-primary-meanings.json';
const primary = defaults.languages as Record<string, Record<string, { file: string }>>;
describe('everyday pictures are a release gate independent of aggregate coverage', () => {
  it('covers 93 distinct concepts, not only the earlier word families', () => {
    expect(new Set(concepts.map(c => c.phraseId)).size).toBe(93);
  });
  it.each(SUPPORTED_SEED_LANGS)('%s has a picture for every declared everyday label', async lang => {
    await loadPictureWords(lang);
    const gaps = concepts.flatMap(c => {
      const label = getPhraseText(c.phraseId, lang, c.english);
      const result = resolveVocabularyPicture(label, lang);
      const file = result.url?.split('/').pop();
      const choices = reviewedVocabularyPictureChoices(label, lang);
      const pictured = file && Object.prototype.hasOwnProperty.call(approved.files, file)
        || choices.length > 0 && choices.every(name => Object.prototype.hasOwnProperty.call(approved.files, name));
      return hasPhraseTranslation(c.phraseId, lang) && pictured ? [] : [{ ...c, label, kind: result.kind }];
    });
    expect(gaps).toEqual([]);
    for (const [word, choice] of Object.entries(primary[lang] ?? {})) {
      const url = resolveVocabularyPicture(word, lang).url;
      expect(url === '/prism-aac/symbols/' + choice.file || reviewedVocabularyPictureChoices(word, lang).includes(choice.file), word).toBe(true);
    }
  });
  it('retains distinct phrase meanings when a bare temporal word has a general time cue', () => {
    for (const id of ['ti-morning', 'ti-tomorrow', 'ti-yesterday']) {
      expect(builtInPhraseSymbolUrl(id)).toBe('/prism-aac/symbols/' + (symbols.phrases as Record<string, string>)[id]);
    }
    expect(resolveVocabularyPicture('morgen', 'de').url).toBe('/prism-aac/symbols/w-time.png');
    expect(resolveVocabularyPicture('mañana', 'es').url).toBe('/prism-aac/symbols/w-time.png');
    expect(resolveVocabularyPicture('कल', 'hi').url).toBe('/prism-aac/symbols/w-time.png');
    expect(resolveVocabularyPicture('morgenstern', 'de').url ?? '').not.toContain('w-time');
  });
});
