/**
 * Cross-language leak — RO predictions must not contain English.
 *
 * Reproduces user-reported screenshot bugs across multiple sessions:
 *   - `I / Eu / Un / Want / să`     (May 7, first report)
 *   - `eu / I / to / a / noise`     (May 7, second report)
 *   - `I / Main / eu / Want / to`   (May 7, third report)
 *
 * Structural fix: lib/langAllowlist.ts compares the candidate word's
 * frequency in the lang corpus vs the EN corpus. Allowed iff lang
 * frequency dominates EN OR the word contains a lang-specific
 * diacritic. The gate is applied at the render layer (PredictionBar
 * — see prediction-bar-cross-lang-render.test.tsx) where it has
 * full visibility into corpusPreds + aiCompletion + stale tiles.
 *
 * The store layer stays neutral — render-time filtering is the
 * single source of truth for which tiles the user sees.
 */
import { describe, it, expect } from 'vitest';
import { isAllowedInLang } from '@/lib/langAllowlist';
import { loadPredictionSeed } from '@/constants/predictionSeeds';

describe('langAllowlist.isAllowedInLang — cross-lang frequency gate', () => {
  it('drops English-only words in RO mode', async () => {
    await loadPredictionSeed('ro');
    await loadPredictionSeed('en');
    // ALL of these have appeared in user screenshots over multiple
    // sessions. The cross-lang frequency gate drops every one.
    expect(isAllowedInLang('I', 'ro')).toBe(false);
    expect(isAllowedInLang('want', 'ro')).toBe(false);
    expect(isAllowedInLang('hello', 'ro')).toBe(false);
    expect(isAllowedInLang('noise', 'ro')).toBe(false);
    expect(isAllowedInLang('to', 'ro')).toBe(false);
    expect(isAllowedInLang('main', 'ro')).toBe(false);
  });

  it('keeps real Romanian words even when pure-ASCII', async () => {
    await loadPredictionSeed('ro');
    await loadPredictionSeed('en');
    // Common RO words without diacritics — must NOT be filtered.
    expect(isAllowedInLang('eu', 'ro')).toBe(true);
    expect(isAllowedInLang('nu', 'ro')).toBe(true);
    expect(isAllowedInLang('am', 'ro')).toBe(true);
    expect(isAllowedInLang('de', 'ro')).toBe(true);
    expect(isAllowedInLang('la', 'ro')).toBe(true);
    expect(isAllowedInLang('mai', 'ro')).toBe(true);
  });

  it('keeps RO words with diacritics via the carve-out', async () => {
    await loadPredictionSeed('ro');
    await loadPredictionSeed('en');
    expect(isAllowedInLang('să', 'ro')).toBe(true);
    expect(isAllowedInLang('vă', 'ro')).toBe(true);
    expect(isAllowedInLang('mulțumesc', 'ro')).toBe(true);
    // Even unknown proper nouns with diacritics pass (Mihăilescu etc.)
    expect(isAllowedInLang('Mihăilescu', 'ro')).toBe(true);
  });

  it('EN passthrough — every word allowed when lang=en', () => {
    expect(isAllowedInLang('I', 'en')).toBe(true);
    expect(isAllowedInLang('eu', 'en')).toBe(true);
    expect(isAllowedInLang('să', 'en')).toBe(true);
  });

  it('non-Latin scripts use strict character regex', () => {
    expect(isAllowedInLang('hello', 'ru')).toBe(false);
    expect(isAllowedInLang('привет', 'ru')).toBe(true);
    expect(isAllowedInLang('hello', 'ja')).toBe(false);
    expect(isAllowedInLang('こんにちは', 'ja')).toBe(true);
  });

  it('n-gram path: every component must be allowed', async () => {
    await loadPredictionSeed('ro');
    await loadPredictionSeed('en');
    expect(isAllowedInLang('eu|sunt', 'ro')).toBe(true);
    expect(isAllowedInLang('i|want', 'ro')).toBe(false);
    expect(isAllowedInLang('eu|want', 'ro')).toBe(false); // mixed → drop
  });
});
