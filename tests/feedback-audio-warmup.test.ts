/**
 * feedback — audio warmup + discrete tone functions gap coverage.
 *
 * The existing feedback.test.ts covers hapticTap/hapticHeavy/tapFeedback/
 * keyFeedback/deleteFeedback. The following exports had zero coverage:
 *   startAudioWarmup, stopAudioWarmup, playClick, playKeyClick,
 *   playDelete, playTimerRing
 *
 * All of these are best-effort (they fail silently when AudioContext is
 * unavailable, as on iOS WebViews). The tests verify the contract:
 * no throw in a jsdom environment where AudioContext IS available.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  startAudioWarmup,
  stopAudioWarmup,
  playClick,
  playKeyClick,
  playDelete,
  playTimerRing,
} from '@/services/feedback';

beforeEach(() => {
  // Reset AudioContext call count so tests are independent.
  vi.clearAllMocks?.();
});

// ── startAudioWarmup / stopAudioWarmup ────────────────────────────────────────

describe('startAudioWarmup', () => {
  it('does not throw', () => {
    expect(() => startAudioWarmup()).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => {
      startAudioWarmup();
      startAudioWarmup();
    }).not.toThrow();
  });
});

describe('stopAudioWarmup', () => {
  it('does not throw when warmup was never started', () => {
    expect(() => stopAudioWarmup()).not.toThrow();
  });

  it('does not throw after startAudioWarmup', () => {
    startAudioWarmup();
    expect(() => stopAudioWarmup()).not.toThrow();
  });

  it('is idempotent — calling twice after start does not throw', () => {
    startAudioWarmup();
    stopAudioWarmup();
    expect(() => stopAudioWarmup()).not.toThrow();
  });

  it('start → stop → start cycle does not throw', () => {
    expect(() => {
      startAudioWarmup();
      stopAudioWarmup();
      startAudioWarmup();
      stopAudioWarmup();
    }).not.toThrow();
  });
});

// ── discrete tone functions ───────────────────────────────────────────────────

describe('playClick', () => {
  it('does not throw', () => {
    expect(() => playClick()).not.toThrow();
  });
});

describe('playKeyClick', () => {
  it('does not throw', () => {
    expect(() => playKeyClick()).not.toThrow();
  });
});

describe('playDelete', () => {
  it('does not throw', () => {
    expect(() => playDelete()).not.toThrow();
  });
});

// ── playTimerRing ─────────────────────────────────────────────────────────────

describe('playTimerRing', () => {
  it('does not throw (resolves without error)', async () => {
    await expect(playTimerRing()).resolves.toBeUndefined();
  });

  it('is callable multiple times in succession without throwing', async () => {
    await expect(playTimerRing()).resolves.toBeUndefined();
    await expect(playTimerRing()).resolves.toBeUndefined();
  });
});
