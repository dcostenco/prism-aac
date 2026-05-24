/**
 * predictionStore — setAiCompletion, runDecay, and ensureSeed.
 *
 * These three actions aren't exercised by prediction-store.integration.test.ts
 * or prediction-engine.test.ts:
 *
 *   setAiCompletion — PredictionBar prepends the AI-suggested word as the
 *   leftmost tile. A broken set (null not cleared, whitespace stored as
 *   non-null) would show a stale completion tile from a prior query.
 *
 *   runDecay — ages down word-frequency counts so recently typed words
 *   outrank old ones. Broken decay either crashes (TypeError on undefined
 *   field) or skips — leaving frequency counts grow monotonically and
 *   eventually dominating the seed words completely.
 *
 *   ensureSeed — merges the language seed into the user corpus on first
 *   boot or after a language switch. A broken ensureSeed means the newly
 *   installed AAC keyboard starts with 0 predictions until the user types
 *   enough words to build their own frequency map.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { WordFreqEntry } from '@/types';

const EIGHT_DAYS_AGO = Date.now() - 8 * 24 * 60 * 60 * 1000;

function makeEntry(count = 5, old = false): WordFreqEntry {
  return { count, lastUsed: old ? EIGHT_DAYS_AGO : Date.now(), lastDecayedAt: undefined };
}

beforeEach(() => {
  usePredictionStore.setState({
    wordFreq: {},
    bigrams: {},
    trigrams: {},
    aiCompletion: null,
    predictions: [],
  });
  useSettingsStore.setState({ language: 'en' });
});

// ── setAiCompletion ───────────────────────────────────────────────────────────

describe('predictionStore — setAiCompletion', () => {
  it('stores a non-empty word', () => {
    usePredictionStore.getState().setAiCompletion('дуб');
    expect(usePredictionStore.getState().aiCompletion).toBe('дуб');
  });

  it('trims whitespace before storing', () => {
    usePredictionStore.getState().setAiCompletion('  hello  ');
    expect(usePredictionStore.getState().aiCompletion).toBe('hello');
  });

  it('stores null when passed null', () => {
    usePredictionStore.getState().setAiCompletion('hello');
    usePredictionStore.getState().setAiCompletion(null);
    expect(usePredictionStore.getState().aiCompletion).toBeNull();
  });

  it('stores null for whitespace-only input', () => {
    usePredictionStore.getState().setAiCompletion('   ');
    expect(usePredictionStore.getState().aiCompletion).toBeNull();
  });

  it('stores null for empty string', () => {
    usePredictionStore.getState().setAiCompletion('');
    expect(usePredictionStore.getState().aiCompletion).toBeNull();
  });

  it('overwrites a previous completion', () => {
    usePredictionStore.getState().setAiCompletion('first');
    usePredictionStore.getState().setAiCompletion('second');
    expect(usePredictionStore.getState().aiCompletion).toBe('second');
  });
});

// ── runDecay ──────────────────────────────────────────────────────────────────

describe('predictionStore — runDecay', () => {
  it('does not throw on empty maps', () => {
    expect(() => usePredictionStore.getState().runDecay()).not.toThrow();
  });

  it('preserves entry keys after decay', () => {
    usePredictionStore.setState({
      wordFreq: { hello: makeEntry(10), world: makeEntry(5) },
    });
    usePredictionStore.getState().runDecay();
    const { wordFreq } = usePredictionStore.getState();
    expect(Object.keys(wordFreq)).toContain('hello');
    expect(Object.keys(wordFreq)).toContain('world');
  });

  it('reduces count values after decay', () => {
    usePredictionStore.setState({
      wordFreq: { test: makeEntry(100, true) },
    });
    usePredictionStore.getState().runDecay();
    const afterCount = usePredictionStore.getState().wordFreq.test?.count;
    // Decay must reduce count below 100 (it multiplies by a factor < 1)
    expect(afterCount).toBeLessThan(100);
  });

  it('also decays bigrams and trigrams', () => {
    usePredictionStore.setState({
      wordFreq: {},
      bigrams: { 'i want': makeEntry(20, true) },
      trigrams: { 'i want to': makeEntry(15, true) },
    });
    usePredictionStore.getState().runDecay();
    const bg = usePredictionStore.getState().bigrams['i want']?.count;
    const tg = usePredictionStore.getState().trigrams['i want to']?.count;
    expect(bg).toBeLessThan(20);
    expect(tg).toBeLessThan(15);
  });

  it('is idempotent — can be called multiple times without crash', () => {
    usePredictionStore.setState({ wordFreq: { hi: makeEntry(50, true) } });
    expect(() => {
      usePredictionStore.getState().runDecay();
      usePredictionStore.getState().runDecay();
      usePredictionStore.getState().runDecay();
    }).not.toThrow();
  });
});

// ── ensureSeed ────────────────────────────────────────────────────────────────

describe('predictionStore — ensureSeed', () => {
  it('does not throw when called on an empty corpus', () => {
    expect(() => usePredictionStore.getState().ensureSeed()).not.toThrow();
  });

  it('populates wordFreq with seed words when corpus is empty', () => {
    usePredictionStore.setState({ wordFreq: {}, bigrams: {}, trigrams: {} });
    usePredictionStore.getState().ensureSeed();
    const { wordFreq } = usePredictionStore.getState();
    expect(Object.keys(wordFreq).length).toBeGreaterThan(0);
  });

  it('is a no-op when seed words are already present', () => {
    usePredictionStore.getState().ensureSeed(); // first call seeds
    const before = Object.keys(usePredictionStore.getState().wordFreq).length;
    usePredictionStore.getState().ensureSeed(); // second call is no-op
    const after = Object.keys(usePredictionStore.getState().wordFreq).length;
    expect(after).toBe(before);
  });

  it('uses the current settingsStore language', () => {
    useSettingsStore.setState({ language: 'ru' });
    usePredictionStore.setState({ wordFreq: {}, bigrams: {}, trigrams: {} });
    usePredictionStore.getState().ensureSeed();
    const { wordFreq } = usePredictionStore.getState();
    // Russian seed should contain Cyrillic words
    const hasCyrillic = Object.keys(wordFreq).some(w => /[Ѐ-ӿ]/.test(w));
    expect(hasCyrillic).toBe(true);
  });

  it('does not lose user-typed words when re-seeding', () => {
    usePredictionStore.setState({ wordFreq: { xyzuser: makeEntry(99, false) }, bigrams: {}, trigrams: {} });
    usePredictionStore.getState().ensureSeed();
    const { wordFreq } = usePredictionStore.getState();
    // User word is preserved; seed words are merged in alongside it
    expect(wordFreq.xyzuser?.count).toBe(99);
    expect(Object.keys(wordFreq).length).toBeGreaterThan(1);
  });
});
