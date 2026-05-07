/**
 * Boot-race regression — when EN corpus is loaded but the target
 * lang's corpus hasn't arrived yet, isAllowedInLang must fail-OPEN.
 *
 * The bug (May 2026): the prediction bar in RO mode rendered EMPTY
 * tiles immediately after a language switch, until the user typed
 * enough to give the corpus time to load. Root cause:
 *
 *   ensureLangCorpusLoaded fires `loadPredictionSeed('en')` AND
 *   `loadPredictionSeed('ro')` in parallel. EN happens to be the
 *   smallest seed → resolves first. During the short window where
 *   EN is cached but RO isn't, isAllowedInLang ran the cross-corpus
 *   comparison with langFreq=0 (target absent) vs enFreq>0 (any RO
 *   word that also appears in EN). dominatedByOther → drop. Every
 *   Romanian word filtered → empty PredictionBar.
 *
 * The previous "anyCorpusLoaded" guard didn't help because EN was
 * always loaded → guard never fired.
 *
 * Fix: fail-open when the TARGET lang's corpus is missing — that is
 * the only state where the cross-corpus comparison is undefined.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCachedSpy = vi.fn();
vi.mock('@/constants/predictionSeeds', () => ({
  getCachedPredictionSeed: (lang: string) => getCachedSpy(lang),
  loadPredictionSeed: () => Promise.resolve({ wordFreq: {}, bigrams: {}, trigrams: {} }),
  SUPPORTED_SEED_LANGS: ['en', 'ro', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'nl', 'tr', 'vi'],
}));

import { isAllowedInLang } from '@/lib/langAllowlist';

beforeEach(() => {
  getCachedSpy.mockReset();
});

const enWithEu = {
  wordFreq: { eu: { count: 2, lastUsed: 0 }, want: { count: 100, lastUsed: 0 } },
  bigrams: {}, trigrams: {},
};
const roWithEu = {
  wordFreq: { eu: { count: 50, lastUsed: 0 }, vreau: { count: 30, lastUsed: 0 } },
  bigrams: {}, trigrams: {},
};

describe('isAllowedInLang — boot-race fail-open', () => {
  it('keeps RO words when RO corpus is missing but EN is loaded (the broken state)', () => {
    getCachedSpy.mockImplementation((lang: string) => {
      if (lang === 'en') return enWithEu;
      return null; // RO not loaded yet
    });
    // Without the target-lang fail-open these all returned false →
    // empty PredictionBar.
    expect(isAllowedInLang('eu', 'ro')).toBe(true);
    expect(isAllowedInLang('vreau', 'ro')).toBe(true);
    expect(isAllowedInLang('want', 'ro')).toBe(true);
  });

  it('resumes strict comparison once RO corpus lands', () => {
    getCachedSpy.mockImplementation((lang: string) => {
      if (lang === 'en') return enWithEu;
      if (lang === 'ro') return roWithEu;
      return null;
    });
    // RO has eu @ 50 vs EN eu @ 2 → keep
    expect(isAllowedInLang('eu', 'ro')).toBe(true);
    // EN has want @ 100 vs RO want @ 0 → drop
    expect(isAllowedInLang('want', 'ro')).toBe(false);
  });

  it('still fails-open when no corpora at all are loaded', () => {
    getCachedSpy.mockReturnValue(null);
    expect(isAllowedInLang('whatever', 'ro')).toBe(true);
  });

  it('diacritic carve-out works even before any corpus loads', () => {
    getCachedSpy.mockReturnValue(null);
    expect(isAllowedInLang('să', 'ro')).toBe(true);
    expect(isAllowedInLang('Mihăilescu', 'ro')).toBe(true);
  });
});
