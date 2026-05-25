/**
 * bodyPoseService — cold-state functions with no active tracker
 *
 * stopPoseTracker and applyCalibrationToActiveTracker both guard on
 * `activeHandle` being set. In the test environment no tracker is ever
 * started, so both are no-ops. Tests verify the no-throw contract and
 * that the module is importable without crashing.
 *
 * initFaceLandmarkerForGazeEager is also tested here — it fires off an
 * async load (which will fail gracefully in jsdom) but must not throw
 * synchronously.
 */
import { describe, it, expect } from 'vitest';
import {
  stopPoseTracker,
  applyCalibrationToActiveTracker,
  initFaceLandmarkerForGazeEager,
} from '@/services/bodyPoseService';

// ── stopPoseTracker ───────────────────────────────────────────────────────────

describe('stopPoseTracker', () => {
  it('does not throw when no tracker is active', () => {
    expect(() => stopPoseTracker()).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => {
      stopPoseTracker();
      stopPoseTracker();
    }).not.toThrow();
  });

  it('returns undefined', () => {
    expect(stopPoseTracker()).toBeUndefined();
  });
});

// ── applyCalibrationToActiveTracker ──────────────────────────────────────────

describe('applyCalibrationToActiveTracker', () => {
  const sampleCalibration = {
    centerX: 0.5,
    centerY: 0.5,
    rangeX: 0.4,
    rangeY: 0.4,
    orientation: 'landscape' as const,
    version: 1,
    capturedAt: Date.now(),
  };

  it('does not throw when no tracker is active', () => {
    expect(() => applyCalibrationToActiveTracker(sampleCalibration)).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => {
      applyCalibrationToActiveTracker(sampleCalibration);
      applyCalibrationToActiveTracker(sampleCalibration);
    }).not.toThrow();
  });

  it('returns undefined', () => {
    expect(applyCalibrationToActiveTracker(sampleCalibration)).toBeUndefined();
  });
});

// ── initFaceLandmarkerForGazeEager ────────────────────────────────────────────

describe('initFaceLandmarkerForGazeEager', () => {
  it('does not throw synchronously', () => {
    expect(() => initFaceLandmarkerForGazeEager()).not.toThrow();
  });

  it('returns undefined (fire-and-forget)', () => {
    expect(initFaceLandmarkerForGazeEager()).toBeUndefined();
  });
});
