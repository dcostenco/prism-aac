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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hasCalibration,
  loadPoseCalibration,
  beginPoseCalibrationDraft,
  hasPoseCalibrationForTarget,
  markPoseWizardCompleted,
  savePoseCalibration,
  savePoseMapping,
  freezeLearnerCalSaves,
  unfreezeLearnerCalSaves,
  subscribePoseSamples,
} from '@/services/bodyPoseService';
import { saveProfiles, loadProfiles } from '@/services/handProfileService';
import { CAMERA_WRIST_SOURCE } from '@/services/cameraTrackingTargets';

const PORTRAIT_KEY = 'prism-pose-calibration-portrait';
const LANDSCAPE_KEY = 'prism-pose-calibration-landscape';
const LEGACY_KEY = 'prism-pose-calibration';
const COMPLETION_KEY = 'prism_pose_wizard_completed';
const PROFILE = { leftX: 0.8, rightX: 0.2, topY: 0.2, bottomY: 0.8 };

function setPortrait(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
}

function setLandscape(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 844 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
}

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

describe('pose calibration draft', () => {
  beforeEach(() => {
    localStorage.clear();
    setPortrait();
  });

  it('stages portrait/landscape/completion while leaving durable keys unchanged', () => {
    const oldPortrait = JSON.stringify({ ...PROFILE, leftX: 0.75 });
    const oldLandscape = JSON.stringify({ ...PROFILE, bottomY: 0.75 });
    localStorage.setItem(PORTRAIT_KEY, oldPortrait);
    localStorage.setItem(LANDSCAPE_KEY, oldLandscape);
    localStorage.setItem(LEGACY_KEY, 'legacy-profile');
    localStorage.setItem(COMPLETION_KEY, 'false');
    const draft = beginPoseCalibrationDraft();

    savePoseCalibration(PROFILE);
    setLandscape();
    savePoseCalibration({ ...PROFILE, bottomY: 0.75 });
    setPortrait();
    markPoseWizardCompleted();
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(oldPortrait);
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBe(oldLandscape);
    expect(localStorage.getItem(LEGACY_KEY)).toBe('legacy-profile');
    expect(localStorage.getItem(COMPLETION_KEY)).toBe('false');
    draft.rollback();
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(oldPortrait);
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBe(oldLandscape);
    expect(localStorage.getItem(LEGACY_KEY)).toBe('legacy-profile');
  });

  it('rollback returns the old profile, including absent-original keys', () => {
    const old = JSON.stringify({ ...PROFILE, rightX: 0.25 });
    localStorage.setItem(PORTRAIT_KEY, old);
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration(PROFILE);
    markPoseWizardCompleted();
    draft.rollback();
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(old);
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBeNull();
    expect(localStorage.getItem(COMPLETION_KEY)).toBeNull();
  });

  it('rotation commits only the active orientation and preserves the factory orientation', () => {
    const oldLandscape = JSON.stringify({ ...PROFILE, leftX: 0.65 });
    localStorage.setItem(LANDSCAPE_KEY, oldLandscape);
    const draft = beginPoseCalibrationDraft();
    setLandscape();
    savePoseCalibration({ ...PROFILE, bottomY: 0.75 }); // factory preview
    setPortrait();
    savePoseCalibration(PROFILE); // finished current orientation
    markPoseWizardCompleted();
    draft.commit();
    expect(JSON.parse(localStorage.getItem(PORTRAIT_KEY)!)).toEqual(PROFILE);
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBe(oldLandscape);
    expect(localStorage.getItem(COMPLETION_KEY)).toBe('true');
  });

  it('commit persists the active orientation when its original is absent', () => {
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration(PROFILE);
    setPortrait();
    markPoseWizardCompleted();
    draft.commit();
    expect(JSON.parse(localStorage.getItem(PORTRAIT_KEY)!)).toEqual(PROFILE);
    expect(localStorage.getItem(COMPLETION_KEY)).toBe('true');
  });

  it.each([
    { name: 'factory preview', profile: PROFILE },
    { name: 'unfinished profile', profile: { ...PROFILE, wizardCompleted: false, trackingTarget: 'right_wrist', orientation: 'portrait' } },
    { name: 'other wrist', profile: { ...PROFILE, wizardCompleted: true, trackingTarget: 'left_wrist', orientation: 'portrait' } },
    { name: 'other orientation', profile: { ...PROFILE, wizardCompleted: true, trackingTarget: 'right_wrist', orientation: 'landscape' } },
  ])('completed binding guard rejects $name before writing any saved profile', item => {
    const original = JSON.stringify({ ...PROFILE, wizardCompleted: true, trackingTarget: 'right_wrist', orientation: 'portrait' });
    localStorage.setItem(PORTRAIT_KEY, original);
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration(item.profile);
    markPoseWizardCompleted();
    try {
      expect(() => draft.commit('portrait', 'right_wrist')).toThrow();
      expect(localStorage.getItem(PORTRAIT_KEY)).toBe(original);
      expect(localStorage.getItem(COMPLETION_KEY)).toBeNull();
    } finally { draft.rollback(); }
  });

  it('commits a completed matching binding and keeps the other orientation unchanged', () => {
    const other = JSON.stringify(PROFILE);
    localStorage.setItem(LANDSCAPE_KEY, other);
    const finished = { ...PROFILE, wizardCompleted: true, trackingTarget: 'right_wrist' as const, orientation: 'portrait' as const, coordinateSource: CAMERA_WRIST_SOURCE };
    const draft = beginPoseCalibrationDraft(CAMERA_WRIST_SOURCE);
    savePoseCalibration(finished);
    draft.commit('portrait', 'right_wrist');
    expect(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`)).toBe(JSON.stringify(finished));
    expect(localStorage.getItem(PORTRAIT_KEY)).toBeNull();
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBe(other);
    expect(hasPoseCalibrationForTarget('right_wrist')).toBe(true);
  });

  it('rejects an invalid pending record even when a legacy fallback appears ready', () => {
    const previous = JSON.stringify({ ...PROFILE, wizardCompleted: true, trackingTarget: 'right_wrist', orientation: 'portrait' });
    localStorage.setItem(LEGACY_KEY, previous);
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration({ ...PROFILE, leftX: 0.201 });
    expect(hasPoseCalibrationForTarget('right_wrist')).toBe(false); // A legacy pose record cannot authorize hand coordinates.
    try {
      expect(() => draft.commit('portrait', 'right_wrist')).toThrow(/Complete calibration/);
      expect(localStorage.getItem(PORTRAIT_KEY)).toBeNull();
      expect(localStorage.getItem(LEGACY_KEY)).toBe(previous);
    } finally { draft.rollback(); }
  });

  it('blocks commit after a conflicting other-tab write', () => {
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration(PROFILE);
    localStorage.setItem(PORTRAIT_KEY, 'other-tab');
    expect(() => draft.commit()).toThrow(/changed during setup/);
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe('other-tab');
    draft.rollback();
  });

  it('rejects an orientation change even if the new orientation has a staged preview', () => {
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration(PROFILE);
    markPoseWizardCompleted();
    setLandscape();
    savePoseCalibration({ ...PROFILE, wizardCompleted: false });
    expect(() => draft.commit('portrait')).toThrow('Screen orientation changed');
    expect(localStorage.getItem(PORTRAIT_KEY)).toBeNull();
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBeNull();
    expect(localStorage.getItem(COMPLETION_KEY)).toBeNull();
    setPortrait();
    draft.commit('portrait');
    expect(JSON.parse(localStorage.getItem(PORTRAIT_KEY)!)).toEqual(PROFILE);
    expect(localStorage.getItem(LANDSCAPE_KEY)).toBeNull();
  });

  it.each([null, JSON.stringify({ ...PROFILE, leftX: 0.7 })])('restores the original %s when a later setItem fails', original => {
    if (original !== null) localStorage.setItem(PORTRAIT_KEY, original);
    const draft = beginPoseCalibrationDraft();
    savePoseCalibration(PROFILE);
    markPoseWizardCompleted();
    // setup.ts already supplies vi.fn storage. Capture its implementation,
    // not the mock function itself (which would re-enter this failure spy).
    const realSetItem = vi.mocked(localStorage.setItem).getMockImplementation()!;
    const setItem = vi.spyOn(localStorage, 'setItem');
    const writes: string[] = [];
    let firstWriteValue: string | null = null;
    setItem.mockImplementation((key, value) => {
      writes.push(key);
      if (writes.length === 2) {
        firstWriteValue = localStorage.getItem(PORTRAIT_KEY);
        throw new Error('quota');
      }
      realSetItem(key, value);
    });
    try {
      expect(() => draft.commit()).toThrow('quota');
    } finally {
      setItem.mockImplementation(realSetItem);
    }
    draft.rollback();
    expect(writes[0]).toBe(PORTRAIT_KEY);
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(firstWriteValue).toBe(JSON.stringify(PROFILE));
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(original);
    expect(localStorage.getItem(COMPLETION_KEY)).toBeNull();
  });

  it('snapshot getItem failure leaves no active draft', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('read failed');
    });
    try {
      expect(() => beginPoseCalibrationDraft()).toThrow('read failed');
    } finally {
      getItem.mockRestore();
    }
    const recovered = beginPoseCalibrationDraft();
    recovered.rollback();
  });

  it('an old closed lease cannot roll back a newer lease', () => {
    const old = beginPoseCalibrationDraft();
    old.rollback();
    const newer = beginPoseCalibrationDraft();
    savePoseCalibration(PROFILE);
    old.rollback();
    newer.commit();
    expect(JSON.parse(localStorage.getItem(PORTRAIT_KEY)!)).toEqual(PROFILE);
  });
});

describe.each([0, 0.003, 0.015])('hand coordinate calibration binding, offset=%s', offset => {
  it('keeps old pose bytes, rejects their control binding, and commits only the explicit hand draft', () => {
    localStorage.clear(); setPortrait();
    const legacy = { ...PROFILE, leftX: PROFILE.leftX + offset, rightX: PROFILE.rightX + offset,
      wizardCompleted: true, trackingTarget: 'right_wrist' as const, orientation: 'portrait' as const };
    const bytes = JSON.stringify(legacy); localStorage.setItem(PORTRAIT_KEY, bytes);
    expect(hasPoseCalibrationForTarget('right_wrist')).toBe(false);
    expect(loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(legacy); // Inspection only, never usable control.
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(bytes);
    const draft = beginPoseCalibrationDraft(CAMERA_WRIST_SOURCE);
    const hand = { ...legacy, coordinateSource: CAMERA_WRIST_SOURCE };
    savePoseCalibration(hand);
    expect(localStorage.getItem(`prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`)).toBeNull();
    draft.commit('portrait', 'right_wrist');
    expect(hasPoseCalibrationForTarget('right_wrist')).toBe(true);
    expect(loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(hand);
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(bytes);
    const canceled = beginPoseCalibrationDraft(CAMERA_WRIST_SOURCE);
    savePoseCalibration({ ...hand, leftX: hand.leftX + 0.01 }); canceled.rollback();
    expect(loadPoseCalibration(CAMERA_WRIST_SOURCE)).toEqual(hand);
    expect(localStorage.getItem(PORTRAIT_KEY)).toBe(bytes);
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
