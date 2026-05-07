/**
 * adaptiveEngine — localStorage hydration validator. The profile feeds
 * motor-rhythm cursor speed, dwell time, noise threshold, and tone
 * recommendations for the AAC user. A tampered persist could otherwise
 * inject NaN / -Infinity / huge values that silently break adaptation
 * — manifesting as a frozen cursor or unusable predictions for a user
 * who already can't articulate what's wrong.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadProfile, _invalidateCache, resetProfile } from '@/services/adaptiveEngine';

const PROFILE_KEY = 'prism-adaptive-profile';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  _invalidateCache();
  resetProfile();
  _invalidateCache();
});

function seed(profile: Record<string, unknown>): void {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  _invalidateCache();
}

describe('adaptiveEngine — sanitize numbers', () => {
  it('rejects NaN avgDwellMs', () => {
    seed({ version: 2, avgDwellMs: NaN });
    const p = loadProfile();
    expect(Number.isFinite(p.avgDwellMs)).toBe(true);
  });

  it('rejects -Infinity avgMoveSpeed', () => {
    seed({ version: 2, avgMoveSpeed: -Infinity });
    const p = loadProfile();
    expect(Number.isFinite(p.avgMoveSpeed)).toBe(true);
  });

  it('rejects negative motorRhythmSamples', () => {
    seed({ version: 2, motorRhythmSamples: -5 });
    const p = loadProfile();
    expect(p.motorRhythmSamples).toBeGreaterThanOrEqual(0);
  });

  it('rejects huge preferredVoiceRate', () => {
    seed({ version: 2, preferredVoiceRate: 9999 });
    const p = loadProfile();
    expect(p.preferredVoiceRate).toBeLessThanOrEqual(3);
  });

  it('rejects non-number noiseFloorDb', () => {
    seed({ version: 2, noiseFloorDb: 'silent' });
    const p = loadProfile();
    expect(typeof p.noiseFloorDb).toBe('number');
    expect(Number.isFinite(p.noiseFloorDb)).toBe(true);
  });
});

describe('adaptiveEngine — sanitize commonMispronunciations', () => {
  it('caps at MAX_MISPRONUNCIATIONS', () => {
    const huge: Record<string, string> = {};
    for (let i = 0; i < 5000; i++) huge[`word${i}`] = `pron${i}`;
    seed({ version: 2, commonMispronunciations: huge });
    const p = loadProfile();
    expect(Object.keys(p.commonMispronunciations).length).toBeLessThanOrEqual(500);
  });

  it('rejects non-string values', () => {
    seed({
      version: 2,
      commonMispronunciations: { good: 'ok', bad: 12345, alsoBad: null },
    });
    const p = loadProfile();
    expect(p.commonMispronunciations.good).toBe('ok');
    expect(p.commonMispronunciations.bad).toBeUndefined();
    expect(p.commonMispronunciations.alsoBad).toBeUndefined();
  });
});

describe('adaptiveEngine — sanitize categories', () => {
  it('rejects non-numeric count', () => {
    seed({
      version: 2,
      categories: {
        good: { count: 5, lastUsed: 100 },
        bad: { count: 'NaN', lastUsed: 100 },
        worse: { count: NaN, lastUsed: 100 },
      },
    });
    const p = loadProfile();
    expect(p.categories.good?.count).toBe(5);
    expect(p.categories.bad).toBeUndefined();
    expect(p.categories.worse).toBeUndefined();
  });

  it('caps at MAX_CATEGORIES', () => {
    const huge: Record<string, { count: number; lastUsed: number }> = {};
    for (let i = 0; i < 1000; i++) huge[`c${i}`] = { count: 1, lastUsed: 0 };
    seed({ version: 2, categories: huge });
    const p = loadProfile();
    expect(Object.keys(p.categories).length).toBeLessThanOrEqual(200);
  });
});

describe('adaptiveEngine — sanitize toneHistory', () => {
  it('drops entries with bogus tone', () => {
    seed({
      version: 2,
      toneHistory: [
        { context: 'hi', tone: 'friendly', timestamp: 100 },
        { context: 'evil', tone: 'hax', timestamp: 200 },
        { context: 'bad', tone: 'serious', timestamp: 'string' },
      ],
    });
    const p = loadProfile();
    expect(p.toneHistory.map((h) => h.tone)).toEqual(['friendly']);
  });

  it('caps at MAX_TONE_HISTORY', () => {
    const huge = Array.from({ length: 1000 }, (_, i) => ({
      context: `c${i}`, tone: 'neutral', timestamp: i,
    }));
    seed({ version: 2, toneHistory: huge });
    const p = loadProfile();
    expect(p.toneHistory.length).toBeLessThanOrEqual(200);
  });
});

describe('adaptiveEngine — sanitize timeOfDayPatterns', () => {
  it('rejects non-array words', () => {
    seed({
      version: 2,
      timeOfDayPatterns: {
        morning: [{ w: 'hi', t: 100, n: 5 }],
        evil: 'not-an-array',
      },
    });
    const p = loadProfile();
    expect(p.timeOfDayPatterns.morning?.length).toBe(1);
    expect(p.timeOfDayPatterns.evil).toBeUndefined();
  });

  it('caps words per period', () => {
    const huge = Array.from({ length: 500 }, (_, i) => ({ w: `w${i}`, t: i, n: 1 }));
    seed({ version: 2, timeOfDayPatterns: { morning: huge } });
    const p = loadProfile();
    expect(p.timeOfDayPatterns.morning.length).toBeLessThanOrEqual(100);
  });
});
