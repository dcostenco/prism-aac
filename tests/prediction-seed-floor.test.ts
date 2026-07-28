/**
 * Prediction seeds must not silently shrink.
 *
 * This has now happened twice in this codebase. `build_prediction_seeds.py`
 * derives a seed from the AAC phrase corpus alone (~1.5K unigrams), but the
 * seed that actually ships was then passed through
 * `augment_prediction_seeds.py`, which prepends wordfreq's top-20K so a user
 * typing "because" or "however" gets prefix matches.
 *
 * So a plain rebuild LOSES ~18K words, and the failure is invisible: the file
 * regenerates cleanly, tsc passes, every existing test stays green, and the
 * only symptom is that a user's typing stops predicting. The first occurrence
 * silently downgraded 14 mature locales from ~20K unigrams to ~1.5K.
 *
 * These floors are set below current values, not at them, so ordinary corpus
 * churn does not trip them — this catches the order-of-magnitude collapse that
 * a rebuild-without-augment produces, not a handful of words moving.
 */
import { describe, it, expect } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';

/** Locales whose shipped seed includes the wordfreq augmentation. */
const AUGMENTED_FLOOR = 10_000;
/** Locales built from the AAC corpus only. */
const CORPUS_FLOOR = 500;

describe('prediction seed floors', () => {
  it('keeps English well above the augmented floor', async () => {
    const seed = (await import('@/constants/predictionSeeds/en')).default;
    const n = Object.keys(seed.wordFreq).length;
    expect(
      n,
      `en has ${n} unigrams — a rebuild without augment_prediction_seeds.py drops it to ~1.5K`,
    ).toBeGreaterThan(AUGMENTED_FLOOR);
  });

  // 27 seed modules, ~4 MB of object literals in total. Imported concurrently
  // rather than in a sequential await loop: the loop measured 4.6s in
  // isolation, which passed alone and then timed out against the 5s default
  // once the full suite was competing for the same workers.
  it('gives every supported locale a usable seed', async () => {
    const counts = await Promise.all(
      SUPPORTED_SEED_LANGS.map(async (lang) => {
        const seed = (await import(`@/constants/predictionSeeds/${lang}`)).default;
        return [lang, Object.keys(seed.wordFreq ?? {}).length] as const;
      }),
    );
    const thin = counts.filter(([, n]) => n < CORPUS_FLOOR).map(([l, n]) => `${l}=${n}`);
    expect(thin, `locales below ${CORPUS_FLOOR} unigrams: ${thin.join(', ')}`).toEqual([]);
  }, 30_000);

  it('carries the safety and self-advocacy vocabulary added to the corpus', async () => {
    // Spot-check that authored sections reached the shipped artefact. If the
    // seed is rebuilt from a corpus missing these sections, they vanish.
    const seed = (await import('@/constants/predictionSeeds/en')).default;
    const grams = { ...seed.wordFreq, ...seed.bigrams, ...seed.trigrams };
    const expected = ['need|a|break', 'too|loud', 'i|need|privacy', 'my|chest|hurts'];
    const missing = expected.filter((g) => !(g in grams));
    expect(missing, `n-grams dropped out of the en seed: ${missing.join(', ')}`).toEqual([]);
  });
});
