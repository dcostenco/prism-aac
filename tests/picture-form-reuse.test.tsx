import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { loadPictureWords } from '@/constants/pictureWords';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { getReviewedBasicWords } from '@/constants/reviewedBasicWords';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import type { SupportedLanguage } from '@/engine/i18n';
import fixture from './fixtures/picture-form-reuse.json';

const { generate } = vi.hoisted(() => ({ generate: vi.fn(async () => null) }));
vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: generate,
  typedWordPicturesEnabled: () => true,
}));

afterEach(() => { cleanup(); generate.mockClear(); });

describe('reviewed equivalent noun forms reuse pictures without paid generation', () => {
  it('includes regression controls for every supported locale', () => {
    expect([...new Set(fixture.cases.map(row => row.lang))].sort()).toEqual([...SUPPORTED_SEED_LANGS].sort());
  });

  it.each(fixture.newAliases)('$lang $word uses the known picture without any generation request', async ({ lang, word, file }) => {
    await loadPictureWords(lang);
    const { result } = renderHook(() => usePredictionPicture(word, lang as SupportedLanguage, 'symbols-ai'));
    await waitFor(() => expect(result.current).toMatchObject({ picture: 'symbol', pictureUrl: `/prism-aac/symbols/${file}` }));
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(fixture.newAliases)('$lang $word remains eligible in its own language without adding confidence weight', async ({ lang, word }) => {
    await ensureLangCorpusLoaded(lang);
    expect(getReviewedBasicWords(lang).has(word)).toBe(false);
    expect(isAllowedInLang(word, lang)).toBe(true);
  });

  it('keeps unreviewed English words out of the French and Romanian rows', async () => {
    await ensureLangCorpusLoaded('fr');
    await ensureLangCorpusLoaded('ro');
    expect(isAllowedInLang('cupcakes', 'fr')).toBe(false);
    expect(isAllowedInLang('main', 'ro')).toBe(false);
  });

  it.each(SUPPORTED_SEED_LANGS)('%s keeps all recorded ordinary noun forms on the no-generation path', async lang => {
    await loadPictureWords(lang);
    for (const { word, file } of fixture.cases.filter(row => row.lang === lang)) {
      const { result, unmount } = renderHook(() => usePredictionPicture(word, lang as SupportedLanguage, 'symbols-ai'));
      expect(result.current, `${lang}:${word}`).toMatchObject({ picture: 'symbol', pictureUrl: `/prism-aac/symbols/${file}` });
      unmount();
    }
    expect(generate).not.toHaveBeenCalled();
  });
});
