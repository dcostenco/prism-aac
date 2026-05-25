/**
 * bodyPoseService + handProfileService — storage and state helpers
 *
 * hasCalibration, savePoseMapping, freezeLearnerCalSaves, unfreezeLearnerCalSaves,
 * subscribePoseSamples: these had zero coverage. All are either simple
 * localStorage operations or module-state toggles.
 *
 * handProfileService::saveProfiles is the counterpart to loadProfiles
 * (already indirectly tested via getActiveProfile). Direct round-trip
 * coverage adds a regression net for the quota-guard path.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasCalibration,
  savePoseMapping,
  freezeLearnerCalSaves,
  unfreezeLearnerCalSaves,
  subscribePoseSamples,
} from '@/services/bodyPoseService';
import { saveProfiles, loadProfiles } from '@/services/handProfileService';

// ── bodyPoseService — hasCalibration ─────────────────────────────────────────

describe('hasCalibration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when no calibration has been saved', () => {
    expect(hasCalibration()).toBe(false);
  });

  it('returns false for landscape when only portrait is missing', () => {
    expect(hasCalibration('landscape')).toBe(false);
    expect(hasCalibration('portrait')).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof hasCalibration()).toBe('boolean');
  });

  it('does not throw', () => {
    expect(() => hasCalibration()).not.toThrow();
    expect(() => hasCalibration('landscape')).not.toThrow();
    expect(() => hasCalibration('portrait')).not.toThrow();
  });
});

// ── bodyPoseService — savePoseMapping ─────────────────────────────────────────

describe('savePoseMapping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not throw with a valid mapping', () => {
    expect(() => savePoseMapping({ trackingTarget: 'nose', cursorSmoothing: 0.1 })).not.toThrow();
  });

  it('persists the mapping to localStorage', () => {
    savePoseMapping({ trackingTarget: 'left_wrist', cursorSmoothing: 0.2 });
    const raw = localStorage.getItem('prism-pose-config');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.trackingTarget).toBe('left_wrist');
  });

  it('does not throw for any valid tracking target', () => {
    const targets = ['nose', 'left_wrist', 'right_wrist', 'any_wrist',
      'left_elbow', 'right_elbow', 'any_hand'] as const;
    for (const t of targets) {
      expect(() => savePoseMapping({ trackingTarget: t, cursorSmoothing: 0.1 })).not.toThrow();
    }
  });
});

// ── bodyPoseService — freezeLearnerCalSaves / unfreezeLearnerCalSaves ────────

describe('freezeLearnerCalSaves / unfreezeLearnerCalSaves', () => {
  it('freezeLearnerCalSaves does not throw', () => {
    expect(() => freezeLearnerCalSaves()).not.toThrow();
  });

  it('unfreezeLearnerCalSaves does not throw', () => {
    expect(() => unfreezeLearnerCalSaves()).not.toThrow();
  });

  it('calling freeze → unfreeze → freeze cycle does not throw', () => {
    expect(() => {
      freezeLearnerCalSaves();
      unfreezeLearnerCalSaves();
      freezeLearnerCalSaves();
      unfreezeLearnerCalSaves();
    }).not.toThrow();
  });

  it('both return undefined', () => {
    expect(freezeLearnerCalSaves()).toBeUndefined();
    expect(unfreezeLearnerCalSaves()).toBeUndefined();
  });
});

// ── bodyPoseService — subscribePoseSamples ────────────────────────────────────

describe('subscribePoseSamples', () => {
  it('returns a cleanup function', () => {
    const cleanup = subscribePoseSamples(() => {});
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('cleanup does not throw', () => {
    const cleanup = subscribePoseSamples(() => {});
    expect(() => cleanup()).not.toThrow();
  });

  it('calling cleanup twice does not throw (idempotent)', () => {
    const cleanup = subscribePoseSamples(() => {});
    cleanup();
    expect(() => cleanup()).not.toThrow();
  });
});

// ── handProfileService — saveProfiles ────────────────────────────────────────

describe('saveProfiles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not throw with a valid profiles array', () => {
    expect(() => saveProfiles([{
      id: 'test',
      name: 'Test',
      dwellTime: 800,
      dwellEnabled: true,
      gestureSpeed: 1.0,
      touchPrecision: 1.0,
      autoScan: false,
      scanSpeed: 1.0,
      created: new Date().toISOString(),
      lastCalibrated: new Date().toISOString(),
    }])).not.toThrow();
  });

  it('round-trips through loadProfiles', () => {
    const profile = {
      id: 'my-profile',
      name: 'My Profile',
      dwellTime: 1200,
      dwellEnabled: false,
      gestureSpeed: 0.8,
      touchPrecision: 0.9,
      autoScan: true,
      scanSpeed: 1.5,
      created: '2026-01-01T00:00:00Z',
      lastCalibrated: '2026-01-01T00:00:00Z',
    };
    saveProfiles([profile]);
    const loaded = loadProfiles();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('my-profile');
    expect(loaded[0].name).toBe('My Profile');
  });

  it('does not throw with an empty profiles array', () => {
    expect(() => saveProfiles([])).not.toThrow();
  });

  it('returns undefined', () => {
    expect(saveProfiles([])).toBeUndefined();
  });
});
