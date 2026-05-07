/**
 * EN-leak regression — when both RO and EN corpora are loaded and a
 * RO word like `eu` somehow lands in the EN prediction list, the
 * cross-corpus check on isAllowedInLang must drop it.
 *
 * The bug (user report May 2026, screenshot showed `eu / I / a / need
 * / to` in EN mode): dropForeignTiles short-circuited
 * `if (language === 'en') return displayed;` on the assumption that
 * the EN corpus was authoritative. That assumption breaks when the
 * user's outputLanguage is 'ro' and the upstream pipeline carries a
 * RO-leaning word into the displayed list. The early-return prevented
 * the final defense-in-depth filter from running.
 *
 * Fix: drop the language === 'en' early-return so the filter runs
 * for every language. isAllowedInLang's en_freq vs ro_freq comparison
 * does the right thing — RO-dominant words are dropped from EN, and
 * vice versa.
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

// Fixture corpora reflect real-world frequencies: `eu` is a high-freq
// Romanian word ("I"); in English it appears rarely (financial-text
// abbreviation, occasional brand name). Cross-corpus comparison has
// to spot which side dominates.
const enCorpus = {
  wordFreq: {
    i: { count: 5000, lastUsed: 0 },
    a: { count: 4800, lastUsed: 0 },
    need: { count: 1200, lastUsed: 0 },
    to: { count: 8000, lastUsed: 0 },
    eu: { count: 3, lastUsed: 0 }, // rare in EN
    want: { count: 950, lastUsed: 0 },
  },
  bigrams: {}, trigrams: {},
};
const roCorpus = {
  wordFreq: {
    eu: { count: 400, lastUsed: 0 }, // very common in RO
    vreau: { count: 60, lastUsed: 0 },
    a: { count: 4000, lastUsed: 0 }, // RO infinitive marker — too short to anchor
  },
  bigrams: {}, trigrams: {},
};

describe('isAllowedInLang — EN/RO leak gate', () => {
  it('drops `eu` from EN when RO corpus is loaded and dominates', () => {
    getCachedSpy.mockImplementation((lang: string) => {
      if (lang === 'en') return enCorpus;
      if (lang === 'ro') return roCorpus;
      return null;
    });
    // `eu` ends up in the EN bar somehow (corpus carry-over or AI
    // completion). The defense-in-depth filter must drop it.
    expect(isAllowedInLang('eu', 'en')).toBe(false);
  });

  it('keeps unambiguously-EN words like `want`, `need`, `to`, `I`', () => {
    getCachedSpy.mockImplementation((lang: string) => {
      if (lang === 'en') return enCorpus;
      if (lang === 'ro') return roCorpus;
      return null;
    });
    expect(isAllowedInLang('want', 'en')).toBe(true);
    expect(isAllowedInLang('need', 'en')).toBe(true);
    expect(isAllowedInLang('to', 'en')).toBe(true);
  });

  it('symmetric — drops `want` from RO when EN dominates', () => {
    getCachedSpy.mockImplementation((lang: string) => {
      if (lang === 'en') return enCorpus;
      if (lang === 'ro') return roCorpus;
      return null;
    });
    expect(isAllowedInLang('want', 'ro')).toBe(false);
  });

  it('keeps RO words like `vreau` in RO mode', () => {
    getCachedSpy.mockImplementation((lang: string) => {
      if (lang === 'en') return enCorpus;
      if (lang === 'ro') return roCorpus;
      return null;
    });
    expect(isAllowedInLang('vreau', 'ro')).toBe(true);
  });
});
