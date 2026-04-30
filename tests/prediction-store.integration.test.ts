/**
 * Integration tests — predictionStore + bundled vocab
 *
 * These tests cover the user-facing flow that pure prediction-engine
 * tests miss: a fresh user opens the app (empty localStorage), starts
 * typing a prefix on the keyboard, and expects useful suggestions.
 *
 * The pure engine tests in prediction-engine.test.ts use hand-crafted
 * wordFreq fixtures, so they never exercised the "empty wordFreq" case.
 * That gap is what produced the in-the-wild bug where typing "goo"
 * returned the static default predictions because the personal vocab
 * had nothing to match.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Reset localStorage so each test starts from "fresh user" state.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

async function freshStore() {
  // Re-import after clear so persist's hydration uses an empty store.
  const mod = await import('../store/predictionStore');
  if (mod.usePredictionStore.persist?.rehydrate) {
    await mod.usePredictionStore.persist.rehydrate();
  }
  return mod.usePredictionStore;
}

describe('predictionStore — fresh user prefix completion', () => {
  it('seeds wordFreq with bundled phrase vocabulary on first load', async () => {
    const store = await freshStore();
    const { wordFreq } = store.getState();
    // Sanity: at least the words from DEFAULT_PHRASES should be present.
    expect(Object.keys(wordFreq).length).toBeGreaterThan(40);
    // Specific words the user should see when typing common prefixes.
    expect(wordFreq).toHaveProperty('hello');
    expect(wordFreq).toHaveProperty('goodbye');
    expect(wordFreq).toHaveProperty('help');
    expect(wordFreq).toHaveProperty('please');
  });

  it('typing "goo" returns word completions, NOT the static fallbacks', async () => {
    const store = await freshStore();
    store.getState().updatePredictions('goo');
    const { predictions } = store.getState();
    const lower = predictions.map(p => p.toLowerCase());
    // The original bug surfaced static defaults (i, we, can, help, all done).
    // After the seed, at least one prefix-matching word must appear.
    const prefixHits = lower.filter(p => p.startsWith('goo'));
    expect(prefixHits.length).toBeGreaterThan(0);
  });

  it('typing "hel" surfaces "hello" / "help" / "helping"-style completions', async () => {
    const store = await freshStore();
    store.getState().updatePredictions('hel');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower.some(p => p.startsWith('hel'))).toBe(true);
  });

  it('typing "tha" surfaces "thank" / "thanks" completions', async () => {
    const store = await freshStore();
    store.getState().updatePredictions('tha');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower.some(p => p.startsWith('tha'))).toBe(true);
  });

  it('user-typed words rank above seed words (recency + count win)', async () => {
    const store = await freshStore();
    // User types "goose" three times — should outrank seed "goodbye" / "good"
    store.getState().learnWord('goose');
    store.getState().learnWord('goose');
    store.getState().learnWord('goose');
    store.getState().updatePredictions('goo');
    const top = store.getState().predictions[0]?.toLowerCase();
    expect(top).toBe('goose');
  });

  it('migration v1→v2 — empty persisted wordFreq gets backfilled with seeds', async () => {
    if (typeof localStorage === 'undefined') return;
    // Simulate a v1 user whose persisted state has empty wordFreq.
    localStorage.setItem('prism-aac-predictions', JSON.stringify({
      state: { wordFreq: {}, bigrams: {} },
      version: 1,
    }));
    const store = await freshStore();
    const { wordFreq } = store.getState();
    // After migrate, seeds must be present even though localStorage was empty.
    expect(Object.keys(wordFreq).length).toBeGreaterThan(40);
    expect(wordFreq).toHaveProperty('hello');
  });

  it('empty input surfaces the static DEFAULT_PREDICTIONS', async () => {
    const store = await freshStore();
    store.getState().updatePredictions('');
    expect(store.getState().predictions.length).toBeGreaterThanOrEqual(5);
  });
});
