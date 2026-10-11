/**
 * The prediction bar pads empty slots from the AAC core list, whose wording
 * has drifted from the phrase table before: Amharic "Help" was እርዳታ in the
 * core matrix and ርዳኝ in the phrase table. Today the two agree, so this test
 * restores that divergence. A core form the phrase table does not spell must
 * still count as built-in vocabulary — its symbol, or the word for a word tile
 * such as "unless" — rather than as a typed word that may ask for a generated picture.
 */
import { describe, expect, it, vi } from 'vitest';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

vi.mock('@/constants/aacCore', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/constants/aacCore')>();
  return {
    ...real,
    getAacCorePairs: (lang: Parameters<typeof real.getAacCorePairs>[0]) => (
      lang === 'am'
        ? [...real.getAacCorePairs(lang), ['እርዳታ', 'Help'], ['ተጨማሪነት', 'More'], ['ይህኛውቃል', 'Unless']]
        : real.getAacCorePairs(lang)
    ),
  };
});

describe('core-list wording the phrase table does not spell', () => {
  it('still resolves to the built-in phrase: a word tile shows the word', () => {
    expect(builtInVocabularySymbol('ይህኛውቃል', 'am')).toEqual({ url: null });
  });

  it('still resolves to the built-in phrase: its symbol', () => {
    expect(builtInVocabularySymbol('ተጨማሪነት', 'am')).toEqual({ url: '/prism-aac/symbols/cw-more.png' });
    expect(builtInVocabularySymbol('እርዳታ', 'am')).toEqual({ url: '/prism-aac/symbols/cw-help.png' });
  });
});
