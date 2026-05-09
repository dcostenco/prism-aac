'use client';
/**
 * Wizard calibration math — isolated from React components so it is
 * unit-testable and reusable.
 *
 * Architecture: three-layer calibration pipeline
 *
 *   Layer 1 — Wizard (this module)
 *     Captures user's neutral head pose (center) and movement range
 *     (corners). Produces an anchored calibration that maps the user's
 *     actual motion envelope to the full screen.
 *
 *   Layer 2 — Online learner (bodyPoseService → OnlineCalibrationLearner)
 *     Observes the user's actual pose range during normal use and widens
 *     the calibration when the user reaches further than the wizard
 *     captured (expand-only so the wizard's anchor is never shrunk).
 *
 *   Layer 3 — Baseline drift correction (recalibration → BaselineTracker)
 *     Detects slow posture drift (user shifts in seat, lighting changes)
 *     and re-centers the calibration offset every ~5 s so the cursor
 *     tracks the user's current neutral without requiring re-calibration.
 *
 * This module is Layer 1.
 */

import { DEFAULT_CALIBRATION, type PoseCalibrationData } from './bodyPoseService';

/** ── Constants ────────────────────────────────────────────────────────── */

/**
 * Minimum practical range below which the wizard treats captured corners
 * as "clustered" (user couldn't reach the corners physically) and falls
 * back to a DEFAULT-width calibration anchored on the captured center.
 * Below 0.10 the cursor barely responds to natural head movement.
 */
export const WIZARD_PRACTICAL_MIN_RANGE = 0.10;

/**
 * Fallback range used when corner samples are too narrow.
 * Chosen to give ~3× amplification for users with ±0.05 head range:
 *   ±0.05 / 0.30 × screenWidth = 23 % of screen per direction.
 */
export const WIZARD_FALLBACK_RANGE_X = 0.30;
export const WIZARD_FALLBACK_RANGE_Y = 0.24;

/** ── Types ────────────────────────────────────────────────────────────── */

export interface CenterSample {
  normX: number;
  normY: number;
}

export interface CornerSample {
  x: number; // raw (un-mirrored) normX average for this corner
  y: number; // normY average
}

export interface WizardCalibrationResult {
  cal: PoseCalibrationData;
  usedFallbackRange: boolean;
  rangeX: number;
  rangeY: number;
}

/** ── Core calibration math ────────────────────────────────────────────── */

/**
 * Compute final calibration from a captured center sample and 4 corner
 * samples.
 *
 * Algorithm:
 *   1. Use raw corner samples to derive the range the user can physically
 *      reach (narrow-range fallback if < WIZARD_PRACTICAL_MIN_RANGE).
 *   2. Re-center the calibration rectangle on the captured center sample
 *      so cursor lands ON the screen center when the user faces neutral —
 *      regardless of how symmetric (or asymmetric) their corner movement is.
 *
 * Why re-centering matters: without it, the cal midpoint is the centroid
 * of {TL, TR, BR, BL} which is rarely the user's actual neutral pose
 * (reclining users have asymmetric reach, off-axis cameras, etc.).
 */
export function computeWizardCalibration(
  center: CenterSample | null,
  corners: ReadonlyArray<CornerSample>,
): WizardCalibrationResult {
  if (corners.length !== 4) {
    throw new Error('Expected exactly 4 corner samples');
  }

  // Mirror the X axis: PoseLandmarker normX 0=left,1=right in camera frame.
  // The cursor convention is opposite (user's left = screen left), so we
  // flip. All subsequent math is in "mirrored" space.
  const allMxX = corners.map(s => 1 - s.x);
  const allY   = corners.map(s => s.y);

  const rawCal: PoseCalibrationData = {
    leftX:   Math.max(...allMxX),
    rightX:  Math.min(...allMxX),
    topY:    Math.min(...allY),
    bottomY: Math.max(...allY),
  };

  const rawRangeX = rawCal.leftX - rawCal.rightX;
  const rawRangeY = rawCal.bottomY - rawCal.topY;
  const usedFallbackRange =
    rawRangeX < WIZARD_PRACTICAL_MIN_RANGE ||
    rawRangeY < WIZARD_PRACTICAL_MIN_RANGE;

  const finalRangeX = usedFallbackRange ? WIZARD_FALLBACK_RANGE_X : rawRangeX;
  const finalRangeY = usedFallbackRange ? WIZARD_FALLBACK_RANGE_Y : rawRangeY;

  // Anchor: use captured center (user's neutral pose).
  // Fallback when no center captured: use raw cal midpoint (no re-centering).
  const anchor = center ?? {
    normX: 1 - (rawCal.leftX + rawCal.rightX) / 2,
    normY: (rawCal.topY + rawCal.bottomY) / 2,
  };
  const anchorMirX = 1 - anchor.normX;

  const cal: PoseCalibrationData = {
    leftX:   Math.min(0.95, anchorMirX + finalRangeX / 2),
    rightX:  Math.max(0.05, anchorMirX - finalRangeX / 2),
    topY:    Math.max(0.05, anchor.normY - finalRangeY / 2),
    bottomY: Math.min(0.95, anchor.normY + finalRangeY / 2),
  };

  return { cal, usedFallbackRange, rangeX: cal.leftX - cal.rightX, rangeY: cal.bottomY - cal.topY };
}

/**
 * Compute a temporary "preview" calibration anchored on a center sample
 * and using DEFAULT-width range. Used immediately after captureCenter so
 * the Step-2 (corners) cursor preview is correctly centered on the user's
 * neutral, not on DEFAULT_CALIBRATION's generic (0.4, 0.5) midpoint.
 */
export function computeCenterPreviewCalibration(center: CenterSample): PoseCalibrationData {
  const anchorMirX = 1 - center.normX;
  return {
    leftX:   Math.min(0.95, anchorMirX + WIZARD_FALLBACK_RANGE_X / 2),
    rightX:  Math.max(0.05, anchorMirX - WIZARD_FALLBACK_RANGE_X / 2),
    topY:    Math.max(0.05, center.normY - WIZARD_FALLBACK_RANGE_Y / 2),
    bottomY: Math.min(0.95, center.normY + WIZARD_FALLBACK_RANGE_Y / 2),
  };
}

/**
 * Returns true iff a loaded calibration is usable (non-degenerate).
 * Used by loadPoseCalibration to auto-discard stale bad calibrations.
 */
export function isCalibrationUsable(
  cal: PoseCalibrationData,
  minRange = 0.05,
): boolean {
  const rangeX = Math.abs(cal.leftX - cal.rightX);
  const rangeY = Math.abs(cal.bottomY - cal.topY);
  return (
    rangeX >= minRange &&
    rangeY >= minRange &&
    cal.leftX > cal.rightX &&
    cal.bottomY > cal.topY &&
    [cal.leftX, cal.rightX, cal.topY, cal.bottomY].every(
      v => Number.isFinite(v) && v >= 0 && v <= 1,
    )
  );
}

/** Alias for DEFAULT_CALIBRATION so consumers can import from one place. */
export { DEFAULT_CALIBRATION };
