import { describe, expect, it } from 'vitest';
import { AAC_CORE_CONCEPTS } from '@/constants/aacCore';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { getPhraseText, hasPhraseTranslation } from '@/constants/phraseTranslations';
import { loadPictureWords } from '@/constants/pictureWords';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import reviewed from '@/constants/generated/phraseSymbolFiles.json';
import basicWords from './fixtures/basic-vocabulary-words.json';
import additionalBasicConcepts from './fixtures/basic-vocabulary-concepts.json';

const BASIC_CONCEPTS = [...AAC_CORE_CONCEPTS, ...additionalBasicConcepts];

function gaps(lang: typeof SUPPORTED_SEED_LANGS[number]) {
  return BASIC_CONCEPTS.flatMap(({ phraseId, english }) => {
    const label = getPhraseText(phraseId, lang, english);
    const result = resolveVocabularyPicture(label, lang);
    const filename = result.url?.split('/').pop();
    return hasPhraseTranslation(phraseId, lang) && filename &&
      Object.prototype.hasOwnProperty.call(reviewed.files, filename)
      ? [] : [{ concept: english, label, resolution: result.kind }];
  });
}

describe('basic vocabulary is a release gate independent of weighted coverage', () => {
  it('covers fifty distinct basic concepts across all twenty-seven supported locales', () => {
    expect(new Set(BASIC_CONCEPTS.map(concept => concept.phraseId)).size).toBe(50);
    expect(SUPPORTED_SEED_LANGS).toHaveLength(27);
  });
  it('does not permanently suppress basic words while lazy tables are loading', () => {
    expect(SUPPORTED_SEED_LANGS.flatMap(lang => gaps(lang)
      .filter(gap => gap.resolution !== 'loading').map(gap => ({ lang, ...gap })))).toEqual([]);
  });

  it.each(SUPPORTED_SEED_LANGS)('%s has no basic gaps after its table is ready', async lang => {
    await loadPictureWords(lang);
    expect(gaps(lang)).toEqual([]);
  });

  it.each(SUPPORTED_SEED_LANGS)('%s distinguishes the bottle noun and bother action', lang => {
    for (const word of basicWords.bottle[lang]) {
      expect(resolveVocabularyPicture(word, lang)).toEqual({ kind: 'symbol', url: '/prism-aac/symbols/w-bottle.png' });
    }
    for (const word of basicWords.bother[lang]) {
      expect(resolveVocabularyPicture(word, lang)).toEqual({ kind: 'symbol', url: '/prism-aac/symbols/w-bother.png' });
    }
  });

  it('distinguishes past being, daylight, and present action in the reported Russian words', () => {
    for (const word of ['был', 'была', 'было', 'были']) {
      expect(resolveVocabularyPicture(word, 'ru').url).toBe('/prism-aac/symbols/w-past-being.png');
    }
    expect(resolveVocabularyPicture('день', 'ru').url).toBe('/prism-aac/symbols/w-day.png');
    expect(resolveVocabularyPicture('делать', 'ru').url).toBe('/prism-aac/symbols/cw-do.png');
    expect(resolveVocabularyPicture('ŞİŞELER', 'tr').url).toBe('/prism-aac/symbols/w-bottle.png');
    expect(resolveVocabularyPicture('من', 'ar').url).toBe('/prism-aac/symbols/cw-from.png');
    for (const word of ['من؟', 'من?', 'من؟؟', 'من??', 'من؟?', 'من؟!', 'من?…']) {
      expect(resolveVocabularyPicture(word, 'ar').url).toBe('/prism-aac/symbols/qu-who.png');
    }
  });

  it('preserves unrelated homographs and distinct words', async () => {
    await loadPictureWords('ru');
    expect(resolveVocabularyPicture('могилы', 'ru').url ?? '').not.toContain('can');
    expect(resolveVocabularyPicture('boyd', 'en').url ?? '').not.toContain('pp-boy');
    expect(resolveVocabularyPicture('boycott', 'en').url ?? '').not.toContain('pp-boy');
    expect(resolveVocabularyPicture('fall', 'en').kind).toBe('ambiguous');
  });

  it('pictures reviewed French child synonyms without borrowing their spelling for unrelated names', () => {
    for (const word of basicWords.girl.fr) {
      expect(resolveVocabularyPicture(word, 'fr').url).toBe('/prism-aac/symbols/pp-girl.png');
    }
    expect(resolveVocabularyPicture('fillon', 'fr').url ?? '').not.toContain('pp-girl');
  });
});
