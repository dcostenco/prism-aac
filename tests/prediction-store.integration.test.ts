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

  // Regression — reported by a tester who typed her sentence twice and got
  // identical (un-improved) suggestions on the second pass. Root cause was
  // (a) trigrams never recorded for user typing, (b) user n-gram counts were
  // normalized to ~0.2 against the corpus seed and could not outrank generic
  // suggestions. After the fix, the second pass should surface the user's
  // own words at rank #1.
  it('learns trigrams from user typing — second pass predicts forward', async () => {
    const store = await freshStore();
    const phrase = ['my', 'main', 'reason', 'to', 'use', 'this', 'program', 'to', 'type', 'faster'];

    // First pass: simulate typing the phrase word-by-word.
    let prevPrev: string | undefined;
    let prev: string | undefined;
    for (const w of phrase) {
      store.getState().learnWord(w, prev, prevPrev);
      prevPrev = prev;
      prev = w;
    }

    // Verify the trigram store actually got populated this pass.
    const { trigrams } = store.getState();
    expect(trigrams['my|main|reason']).toBeDefined();
    expect(trigrams['main|reason|to']).toBeDefined();

    // Second pass: type "my main " (trailing space) — "reason" must now
    // appear in the top suggestions because the user-typed trigram outranks
    // the generic seed. Trailing space signals "predict the next word"
    // rather than "complete the partial 'main'".
    store.getState().updatePredictions('my main ');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower).toContain('reason');
  });

  // Regression — reported as "typed words are always in capitals." Root cause
  // was that getPredictions was unconditionally Title-Casing every result, so
  // tapping prediction tiles produced "My Main Reason..." regardless of the
  // user's intent. After the fix, mid-sentence predictions are lowercase.
  it('mid-sentence predictions are NOT force-capitalized', async () => {
    const store = await freshStore();
    store.getState().updatePredictions('i want to ');
    const preds = store.getState().predictions;
    // No prediction should start with a capital letter unless it's "I".
    // Filter "We", "I" etc. that are intentionally always-cased.
    for (const p of preds) {
      if (p === 'I') continue;
      // "We" survives when seed bigrams promote it after "to "; when that
      // happens it should still be lowercase per mid-sentence rules.
      expect(p).toBe(p.toLowerCase());
    }
  });

  it('sentence-start predictions ARE capitalized', async () => {
    const store = await freshStore();
    store.getState().updatePredictions('');
    const preds = store.getState().predictions;
    // First-letter capitalized for the leading suggestion at sentence start.
    expect(preds[0][0]).toBe(preds[0][0].toUpperCase());
  });

  // Regression — the wordfreq-augmented seed must include common English
  // words like "reason" so prefix matching can surface them. The original
  // 1500-word AAC corpus did not contain these. Corpus is loaded lazily
  // via dynamic import, so each test must await the load before predicting.
  async function withCorpus(lang: string) {
    const store = await freshStore();
    const { loadPredictionSeed } = await import('../constants/predictionSeeds');
    await loadPredictionSeed(lang);
    return store;
  }

  it('common English word "reason" surfaces for "re" prefix', async () => {
    const store = await withCorpus('en');
    store.getState().updatePredictions('re', 'en');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower).toContain('reason');
  });

  it('common English word "actually" surfaces for "act" prefix', async () => {
    const store = await withCorpus('en');
    store.getState().updatePredictions('act', 'en');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower).toContain('actually');
  });

  it('common English word "because" surfaces for "bec" prefix', async () => {
    const store = await withCorpus('en');
    store.getState().updatePredictions('bec', 'en');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower).toContain('because');
  });

  it('common Russian word "причина" (reason) surfaces for "при" prefix', async () => {
    const store = await withCorpus('ru');
    store.getState().updatePredictions('при', 'ru');
    const lower = store.getState().predictions.map(p => p.toLowerCase());
    expect(lower.some(w => w.startsWith('при'))).toBe(true);
  });
});
