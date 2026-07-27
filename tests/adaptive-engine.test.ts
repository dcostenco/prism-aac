/**
 * Adaptive Engine Tests — Real-life scenarios + regression guards
 * ═══════════════════════════════════════════════════════════════
 *
 * Each test maps to a real-life situation a child or caregiver
 * encounters. These aren't abstract unit tests — they're the
 * behavioral contract for how the system adapts.
 *
 * v2 expansion: covers the fixes shipped in the cross-system
 * adaptive engine (auto tone switch, EMA-after-cap, punctuation,
 * stems, emergency passthrough, frequency categories, vocab decay).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectTone,
  recordTone,
  recordDwell,
  recordMoveSpeed,
  getAdaptedDwellMs,
  getAdaptedCursorSmoothing,
  recordMispronunciation,
  correctPronunciation,
  updateNoiseFloor,
  getNoiseAdaptedThreshold,
  isQuietEnvironment,
  recordMessage,
  getContextSuggestions,
  getPreferredCategories,
  getAdaptiveSummary,
  resetProfile,
  loadProfile,
  autoSwitchTone,
  toneToAzureStyle,
  toneToRate,
  toneToSystemHint,
  flushAdaptiveProfile,
  getAdaptiveSignals,
  _invalidateCache,
} from '../services/adaptiveEngine';

beforeEach(() => {
  resetProfile();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

afterEach(() => {
  flushAdaptiveProfile();
});

// ═══════════════════════════════════════════════════════════════
// TONE — happy path
// ═══════════════════════════════════════════════════════════════

describe('Tone: Emergency situations', () => {
  it('child types "help me" → serious', () => {
    expect(detectTone('help me')).toBe('serious');
  });
  it('child types "I hurt" → serious', () => {
    expect(detectTone('I hurt')).toBe('serious');
  });
  it('child types "call 911" → serious', () => {
    expect(detectTone('call 911')).toBe('serious');
  });
  it('child types "I am scared" → serious', () => {
    expect(detectTone('I am scared')).toBe('serious');
  });
});

describe('Tone: Happy moments', () => {
  it('child types "I want to play!" → excited', () => {
    expect(detectTone('I want to play!')).toBe('excited');
  });
  it('child types "I love you" → friendly', () => {
    expect(detectTone('I love you')).toBe('friendly');
  });
  it('child types "yes please" → friendly', () => {
    expect(detectTone('yes please')).toBe('friendly');
  });
  it('child types "thank you" → friendly', () => {
    expect(detectTone('thank you')).toBe('friendly');
  });
});

describe('Tone: Calm/tired', () => {
  it('child types "I am tired" → empathetic', () => {
    expect(detectTone('I am tired')).toBe('empathetic');
  });
  it('child types "bedtime" → empathetic', () => {
    expect(detectTone('bedtime')).toBe('empathetic');
  });
  it('child types "all done" → empathetic', () => {
    expect(detectTone('all done')).toBe('empathetic');
  });
});

describe('Tone: Question / neutral', () => {
  it('child types "where is mom?" → friendly', () => {
    expect(detectTone('where is mom?')).toBe('friendly');
  });
  it('child types "water" → neutral', () => {
    expect(detectTone('water')).toBe('neutral');
  });
});

// ═══════════════════════════════════════════════════════════════
// TONE — regression: punctuation + stems (the bug from the review)
// ═══════════════════════════════════════════════════════════════

describe('Tone: Punctuation-attached emergency words', () => {
  it('"I need help!" still detects serious', () => {
    expect(detectTone('I need help!')).toBe('serious');
  });
  it('"my arm hurts." still detects serious', () => {
    expect(detectTone('my arm hurts.')).toBe('serious');
  });
  it('"I am hurting" matches via stem', () => {
    expect(detectTone('I am hurting')).toBe('serious');
  });
  it('"someone is bleeding" matches stem', () => {
    expect(detectTone('someone is bleeding')).toBe('serious');
  });
});

describe('Tone: Auto switch records as it detects', () => {
  it('autoSwitchTone returns the tone and records it', () => {
    const t = autoSwitchTone('I am scared');
    expect(t).toBe('serious');
    expect(loadProfile().toneHistory.length).toBe(1);
    expect(loadProfile().toneHistory[0].tone).toBe('serious');
  });

  it('toneToAzureStyle maps known tones', () => {
    // Updated for f153864: invalid Azure SSML styles ('gentle','general') replaced
    expect(toneToAzureStyle('serious')).toBe('calm');
    expect(toneToAzureStyle('excited')).toBe('cheerful');
    expect(toneToAzureStyle('friendly')).toBe('friendly');
    expect(toneToAzureStyle('empathetic')).toBe('empathetic');
    expect(toneToAzureStyle('neutral')).toBe('friendly');
  });

  it('toneToRate slows for serious + speeds for excited', () => {
    expect(toneToRate('serious', 1.0)).toBeLessThan(1.0);
    expect(toneToRate('excited', 1.0)).toBeGreaterThan(1.0);
    expect(toneToRate('neutral', 1.0)).toBe(1.0);
  });

  it('calm tones never make the normal 0.5 AAC rate faster', () => {
    expect(toneToRate('serious', 0.5)).toBeLessThanOrEqual(0.5);
    expect(toneToRate('empathetic', 0.5)).toBeLessThanOrEqual(0.5);
  });

  it('toneToSystemHint gives non-empty for non-neutral', () => {
    expect(toneToSystemHint('serious').length).toBeGreaterThan(20);
    expect(toneToSystemHint('neutral')).toBe('');
  });
});

describe('Tone: Hysteresis on dominant mood', () => {
  it('a single emergency does NOT flip dominantMood to urgent', () => {
    // 9 friendly + 1 serious — should NOT be urgent yet
    for (let i = 0; i < 9; i++) recordTone('hello', 'friendly');
    recordTone('help', 'serious');
    expect(loadProfile().dominantMood).toBe('happy');
  });

  it('6 of last 10 events serious DOES flip to urgent', () => {
    for (let i = 0; i < 4; i++) recordTone('hello', 'friendly');
    for (let i = 0; i < 6; i++) recordTone('help', 'serious');
    expect(loadProfile().dominantMood).toBe('urgent');
  });
});

// ═══════════════════════════════════════════════════════════════
// GESTURE — motor adaptation + EMA-after-cap
// ═══════════════════════════════════════════════════════════════

describe('Gesture: Motor speed adaptation', () => {
  it('slow motor → longer dwell with 20% buffer', () => {
    for (let i = 0; i < 20; i++) recordDwell(2000);
    const a = getAdaptedDwellMs();
    expect(a).toBeGreaterThanOrEqual(2000);
    expect(a).toBeLessThanOrEqual(3000);
  });

  it('fast motor → shorter dwell, clamped to 400ms minimum', () => {
    for (let i = 0; i < 20; i++) recordDwell(500);
    const a = getAdaptedDwellMs();
    expect(a).toBeLessThanOrEqual(700);
    expect(a).toBeGreaterThanOrEqual(400);
  });

  it('cursor smoothing tracks move speed', () => {
    for (let i = 0; i < 20; i++) recordMoveSpeed(30);
    expect(getAdaptedCursorSmoothing()).toBeLessThanOrEqual(0.08);
  });

  it('uses safe defaults until 10 samples', () => {
    recordDwell(500);
    recordDwell(500);
    expect(getAdaptedDwellMs()).toBe(1200);
    expect(getAdaptedCursorSmoothing()).toBe(0.12);
  });
});

describe('Gesture: EMA-after-cap regression', () => {
  it('after 1000 samples at 500ms, switching to 2000ms still moves the average', () => {
    // Saturate: 1000 selections of 500ms — running avg ≈ 500
    for (let i = 0; i < 1000; i++) recordDwell(500);
    const before = loadProfile().avgDwellMs;
    expect(before).toBeLessThan(600);
    // Now child has a regression and starts taking 2000ms
    for (let i = 0; i < 100; i++) recordDwell(2000);
    const after = loadProfile().avgDwellMs;
    // Pre-fix this would barely move (1/1001 contribution per sample);
    // post-fix EMA α=0.02 with 100 samples means avg should rise meaningfully.
    expect(after).toBeGreaterThan(before + 100);
    expect(after).toBeLessThan(2100); // sanity: not way overshot
  });
});

// ═══════════════════════════════════════════════════════════════
// PRONUNCIATION — emergency passthrough
// ═══════════════════════════════════════════════════════════════

describe('Pronunciation: Common patterns', () => {
  it('learns "wawa" → "water"', () => {
    recordMispronunciation('wawa', 'water');
    expect(correctPronunciation('wawa')).toBe('water');
  });
  it('case insensitive lookup', () => {
    recordMispronunciation('Wawa', 'water');
    expect(correctPronunciation('wawa')).toBe('water');
  });
  it('unknown words pass through', () => {
    expect(correctPronunciation('hello')).toBe('hello');
  });
});

describe('Pronunciation: Emergency passthrough (safety)', () => {
  it('never lets caregiver shadow "help" with a wrong correction', () => {
    recordMispronunciation('help', 'helper');
    // Even though we tried to record it, emergency words bypass corrections
    expect(correctPronunciation('help')).toBe('help');
  });

  it('emergency words always pass through case-insensitively', () => {
    for (const w of ['help', 'hurt', 'scared', 'pain', 'emergency', 'call', '911']) {
      recordMispronunciation(w, `WRONG_${w}`);
      expect(correctPronunciation(w).toLowerCase()).toBe(w);
      expect(correctPronunciation(w.toUpperCase()).toLowerCase()).toBe(w);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// NOISE — clamps + transitions
// ═══════════════════════════════════════════════════════════════

describe('Noise: Quiet vs noisy', () => {
  it('quiet home', () => {
    for (let i = 0; i < 30; i++) updateNoiseFloor(-55);
    expect(isQuietEnvironment()).toBe(true);
    expect(getNoiseAdaptedThreshold()).toBeLessThan(-30);
  });

  it('noisy car still produces a usable threshold (clamped)', () => {
    for (let i = 0; i < 100; i++) updateNoiseFloor(-15); // very loud
    expect(isQuietEnvironment()).toBe(false);
    const t = getNoiseAdaptedThreshold();
    // Without the upper clamp, threshold would be 0dB (unusable for any voice).
    // Clamp guarantees ≤ -20dB so voice can still trigger.
    expect(t).toBeLessThanOrEqual(-20);
  });

  it('threshold always above noise floor (never silences)', () => {
    for (let i = 0; i < 30; i++) updateNoiseFloor(-25);
    const p = loadProfile();
    expect(getNoiseAdaptedThreshold()).toBeGreaterThan(p.noiseFloorDb);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROMPT PATTERNS — frequency, decay, time-of-day
// ═══════════════════════════════════════════════════════════════

describe('Prompt: Frequency-weighted categories (regression)', () => {
  it('100x-yesterday category outranks 1x-today category', () => {
    const realNow = Date.now;
    // Yesterday at 24h ago — 100 messages in food
    Date.now = () => realNow.call(Date) - 24 * 60 * 60 * 1000;
    for (let i = 0; i < 100; i++) recordMessage('I want food', 'food');
    // Today, 1 message in activities
    Date.now = realNow;
    recordMessage('play', 'activities');

    const top = getPreferredCategories();
    expect(top[0]).toBe('food'); // frequency × decay → food still wins
  });
});

describe('Prompt: Message length tracking', () => {
  it('child uses short messages', () => {
    for (let i = 0; i < 20; i++) recordMessage('water');
    for (let i = 0; i < 20; i++) recordMessage('bathroom please');
    expect(loadProfile().avgMessageLength).toBeLessThan(2.5);
  });

  it('child uses longer sentences', () => {
    for (let i = 0; i < 20; i++) recordMessage('I want to go to the playground please');
    expect(loadProfile().avgMessageLength).toBeGreaterThan(5);
  });
});

describe('Prompt: Time-of-day vocab decay', () => {
  it('words older than 30 days are dropped from suggestions', () => {
    const realNow = Date.now;
    // 60 days ago, child loved "snowman"
    Date.now = () => realNow.call(Date) - 60 * 24 * 60 * 60 * 1000;
    recordMessage('build snowman today');
    flushAdaptiveProfile();
    // Today, brand new vocabulary
    Date.now = realNow;
    recordMessage('today swimming pool fun');

    const sug = getContextSuggestions();
    expect(sug).not.toContain('snowman');
    // Token >2 chars filter is in tokenize() — 'fun' is 3 chars, should appear
    expect(sug.some((w) => w === 'swimming' || w === 'pool')).toBe(true);
  });
});

describe('Prompt: getContextSuggestions ranks by usage count', () => {
  it('frequently-used words rank higher', () => {
    for (let i = 0; i < 5; i++) recordMessage('breakfast time');
    recordMessage('rare unique sentence');
    const sug = getContextSuggestions();
    // 'breakfast' was repeated 5 times, 'rare' once
    expect(sug.indexOf('breakfast')).toBeLessThan(sug.indexOf('rare'));
  });
});

// ═══════════════════════════════════════════════════════════════
// SCHEMA / PERSISTENCE
// ═══════════════════════════════════════════════════════════════

describe('Schema: v1 → v2 migration', () => {
  it('migrates old topCategories[] to frequency-weighted categories{}', () => {
    if (typeof localStorage === 'undefined') return;
    const v1 = {
      version: 1,
      topCategories: ['activities', 'food'],
    };
    localStorage.setItem('prism-adaptive-profile', JSON.stringify(v1));
    // Discard the in-memory cache so loadProfile() re-reads from storage and
    // runs the migration path. resetProfile() would clear localStorage.
    _invalidateCache();
    const p = loadProfile();
    expect(p.version).toBe(2);
    expect(p.categories.activities).toBeDefined();
    expect(p.categories.food).toBeDefined();
    // First entry got higher count (more recent at the front of the v1 array)
    expect(p.categories.activities.count).toBeGreaterThanOrEqual(p.categories.food.count);
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-SYSTEM SIGNALS — what synalux / prism-mcp / prism-coder consume
// ═══════════════════════════════════════════════════════════════

describe('Adaptive Signals (cross-process)', () => {
  it('produces a flat snapshot with no PII', () => {
    recordDwell(1500);
    recordDwell(1500);
    recordMoveSpeed(80);
    recordMessage('hello world', 'food');

    const sig = getAdaptiveSignals();
    expect(sig).toHaveProperty('tone');
    expect(sig).toHaveProperty('dwellMs');
    expect(sig).toHaveProperty('moveSpeed');
    expect(sig).toHaveProperty('quietEnv');
    expect(sig).toHaveProperty('avgMessageLen');
    expect(sig.topCategories).toEqual(expect.arrayContaining(['food']));
    // No history / message text / mispronunciations leak
    expect(sig).not.toHaveProperty('toneHistory');
    expect(sig).not.toHaveProperty('commonMispronunciations');
  });
});

// ═══════════════════════════════════════════════════════════════
// BCBA / SAFETY
// ═══════════════════════════════════════════════════════════════

describe('BCBA: Adaptation is additive, never restrictive', () => {
  it('adapted dwell never below 400ms', () => {
    for (let i = 0; i < 100; i++) recordDwell(100);
    expect(getAdaptedDwellMs()).toBeGreaterThanOrEqual(400);
  });

  it('adapted dwell never above 3000ms', () => {
    for (let i = 0; i < 100; i++) recordDwell(10000);
    expect(getAdaptedDwellMs()).toBeLessThanOrEqual(3000);
  });

  it('noise threshold caps at -20dB to keep voice triggerable', () => {
    for (let i = 0; i < 200; i++) updateNoiseFloor(0); // converged on full noise
    expect(getNoiseAdaptedThreshold()).toBeLessThanOrEqual(-20);
  });
});

describe('BCBA: Reset capability', () => {
  it('reset clears all learned adaptations', () => {
    recordDwell(2000);
    recordMispronunciation('wawa', 'water');
    recordMessage('test message', 'food');

    resetProfile();

    const profile = loadProfile();
    expect(profile.avgDwellMs).toBe(1200);
    expect(profile.avgMessageLength).toBe(3);
    expect(Object.keys(profile.commonMispronunciations).length).toBe(0);
  });
});

describe('Adaptive Summary', () => {
  it('produces human-readable summary for caregiver', () => {
    recordDwell(1500);
    recordMoveSpeed(80);
    const summary = getAdaptiveSummary();
    expect(summary).toContain('Mood:');
    expect(summary).toContain('Avg message:');
    expect(summary).toContain('Motor speed:');
    expect(summary).toContain('Noise floor:');
  });
});
