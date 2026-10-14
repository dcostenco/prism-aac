import { describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';
import forms from './fixtures/present-being-word-forms.json';
const shared = forms.sharedMeanings as Record<string, Record<string, string>>;
describe('present being and spelling-aware context remain available across locales', () => {
  it.each(SUPPORTED_SEED_LANGS)('%s resolves its declared forms while retaining reviewed shared meanings', lang => {
    for (const word of forms.languages[lang]) {
      expect(resolveVocabularyPicture(word, lang).url, word)
        .toBe('/prism-aac/symbols/' + (shared[lang]?.[word] ?? forms.file));
    }
  });
  it('does not turn past being or unrelated Romanian estimate words into present being', () => {
    expect(resolveVocabularyPicture('был', 'ru').url).toBe('/prism-aac/symbols/w-past-being.png');
    for (const word of ['estimat', 'estic', 'estimările']) {
      expect(resolveVocabularyPicture(word, 'ro').url ?? '').not.toContain('cw-is');
    }
  });
});
