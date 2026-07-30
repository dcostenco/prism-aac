/**
 * predictionStore — hydration validator. A tampered localStorage entry
 * could inject an arbitrary phrase like "click here for free" with a
 * huge count, dominating the prediction bar and influencing what the
 * AAC user is led to tap. This is a real attack class on shared
 * tablets — defends the prediction-bar render from poisoning.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePredictionStore } from '@/store/predictionStore';

const HYDRATION_SCOPE = 'user:prediction-hydration@example.com';
const HYDRATION_LANGUAGE = 'en';
const HYDRATION_KEY = `prism-aac-predictions:v5:${encodeURIComponent(HYDRATION_SCOPE)}:${HYDRATION_LANGUAGE}`;
let resetCounter = 0;

beforeEach(() => {
  usePredictionStore.getState().activatePredictionIdentity(
    `anon:hydration-reset-${resetCounter += 1}`,
    HYDRATION_LANGUAGE,
  );
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    usePredictionStore.getState().activatePredictionIdentity(
      HYDRATION_SCOPE,
      HYDRATION_LANGUAGE,
    );
  }
});

function seedPersistedPredictions(state: Record<string, unknown>): void {
  window.localStorage.setItem(HYDRATION_KEY, JSON.stringify({
    state: {
      personalizationScope: HYDRATION_SCOPE,
      personalizationLanguage: HYDRATION_LANGUAGE,
      ...state,
    },
    version: 5,
  }));
}

describe('predictionStore — hydration validator', () => {
  it('drops wordFreq entries with non-numeric counts', async () => {
    seedPersistedPredictions({
      wordFreq: {
        'good': { count: 100, lastUsed: 0 },
        'evil': { count: 'haxor', lastUsed: 0 },                // bad: count not a number
        'broken': { count: NaN, lastUsed: 0 },                  // bad: NaN
        'negative': { count: -5, lastUsed: 0 },                 // bad: negative
        'no-entry': 'just-a-string',                            // bad: not an object
      },
    });
    await usePredictionStore.persist.rehydrate();
    const wf = usePredictionStore.getState().wordFreq;
    expect(wf['good']).toBeDefined();
    expect(wf['evil']).toBeUndefined();
    expect(wf['broken']).toBeUndefined();
    expect(wf['negative']).toBeUndefined();
    expect(wf['no-entry']).toBeUndefined();
  });

  it('clamps counts to a sane upper bound (defends sort path)', async () => {
    seedPersistedPredictions({
      wordFreq: {
        'spam': { count: 1e9, lastUsed: 0 },
      },
    });
    await usePredictionStore.persist.rehydrate();
    expect(usePredictionStore.getState().wordFreq['spam'].count).toBeLessThanOrEqual(100_000);
  });

  it('drops keys longer than the cap', async () => {
    const longKey = 'a'.repeat(500);
    seedPersistedPredictions({
      wordFreq: {
        [longKey]: { count: 10, lastUsed: 0 },
        'ok': { count: 10, lastUsed: 0 },
      },
    });
    await usePredictionStore.persist.rehydrate();
    expect(usePredictionStore.getState().wordFreq[longKey]).toBeUndefined();
    expect(usePredictionStore.getState().wordFreq['ok']).toBeDefined();
  });

  it('caps total wordFreq entry count', async () => {
    const huge: Record<string, { count: number; lastUsed: number }> = {};
    for (let i = 0; i < 60_000; i++) huge[`word${i}`] = { count: 1, lastUsed: 0 };
    seedPersistedPredictions({ wordFreq: huge });
    await usePredictionStore.persist.rehydrate();
    // Including SEED_EN merge, total should be bounded.
    expect(Object.keys(usePredictionStore.getState().wordFreq).length).toBeLessThanOrEqual(60_000);
  });
});
