/**
 * wizardCalibration — pure calibration math for the AAC head-tracking wizard.
 *
 * Life-safety: a degenerate calibration (leftX === rightX, NaN range) causes
 * division-by-zero in the cursor-mapping formula and freezes the cursor — the
 * user's ONLY input method if they are completely non-verbal.
 *
 * computeWizardCalibration is explicitly documented as "isolated from React
 * components so it is unit-testable and reusable".  These tests exercise the
 * full numerical contract without any browser / camera dependencies.
 */
import { describe, it, expect } from 'vitest';
import {
  computeWizardCalibration,
  computeCenterPreviewCalibration,
  isCalibrationUsable,
  WIZARD_PRACTICAL_MIN_RANGE,
  WIZARD_FALLBACK_RANGE_X,
  WIZARD_FALLBACK_RANGE_Y,
  type CenterSample,
  type CornerSample,
} from '@/services/wizardCalibration';

// ── helpers ───────────────────────────────────────────────────────────────────

// Symmetric corners: user reaches equally in all directions from screen center.
function symmetricCorners(): CornerSample[] {
  // Camera space: x=0 is left, x=1 is right.
  // TL camera (user's TL) has high x (camera-right) and low y.
  return [
    { x: 0.8, y: 0.2 }, // TL
    { x: 0.2, y: 0.2 }, // TR
    { x: 0.2, y: 0.8 }, // BR
    { x: 0.8, y: 0.8 }, // BL
  ];
}

const CENTER_NEUTRAL: CenterSample = { normX: 0.5, normY: 0.5 };

// ── computeWizardCalibration — basic contract ─────────────────────────────────

describe('computeWizardCalibration — basic contract', () => {
  it('throws when fewer than 4 corners are provided', () => {
    expect(() =>
      computeWizardCalibration(CENTER_NEUTRAL, [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }])
    ).toThrow('Expected exactly 4 corner samples');
  });

  it('throws when more than 4 corners are provided', () => {
    const corners = Array.from({ length: 5 }, () => ({ x: 0.5, y: 0.5 }));
    expect(() => computeWizardCalibration(CENTER_NEUTRAL, corners)).toThrow();
  });

  it('returns object with cal, usedFallbackRange, rangeX, rangeY', () => {
    const result = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(result).toHaveProperty('cal');
    expect(result).toHaveProperty('usedFallbackRange');
    expect(result).toHaveProperty('rangeX');
    expect(result).toHaveProperty('rangeY');
  });

  it('cal.leftX is always greater than cal.rightX', () => {
    const { cal } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(cal.leftX).toBeGreaterThan(cal.rightX);
  });

  it('cal.bottomY is always greater than cal.topY', () => {
    const { cal } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(cal.bottomY).toBeGreaterThan(cal.topY);
  });

  it('all cal values are in [0.05, 0.95]', () => {
    const { cal } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    for (const v of [cal.leftX, cal.rightX, cal.topY, cal.bottomY]) {
      expect(v).toBeGreaterThanOrEqual(0.05);
      expect(v).toBeLessThanOrEqual(0.95);
    }
  });

  it('rangeX matches cal.leftX - cal.rightX', () => {
    const result = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(result.rangeX).toBeCloseTo(result.cal.leftX - result.cal.rightX, 10);
  });

  it('rangeY matches cal.bottomY - cal.topY', () => {
    const result = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(result.rangeY).toBeCloseTo(result.cal.bottomY - result.cal.topY, 10);
  });
});

// ── computeWizardCalibration — good range path ────────────────────────────────

describe('computeWizardCalibration — good range (usedFallbackRange=false)', () => {
  it('does not use fallback when corner range ≥ WIZARD_PRACTICAL_MIN_RANGE', () => {
    const { usedFallbackRange } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(usedFallbackRange).toBe(false);
  });

  it('symmetric corners with center (0.5,0.5) produce symmetric calibration', () => {
    const { cal } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    // Mirror-symmetric: leftX mirror of rightX around 0.5
    expect(cal.leftX + cal.rightX).toBeCloseTo(1.0, 5);
    expect(cal.topY + cal.bottomY).toBeCloseTo(1.0, 5);
  });

  it('rangeX from symmetric corners is larger than WIZARD_PRACTICAL_MIN_RANGE', () => {
    const { rangeX } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    expect(rangeX).toBeGreaterThan(WIZARD_PRACTICAL_MIN_RANGE);
  });
});

// ── computeWizardCalibration — narrow range fallback ─────────────────────────

describe('computeWizardCalibration — narrow range fallback', () => {
  // User can barely move — all 4 corners clustered near center
  const clusteredCorners: CornerSample[] = [
    { x: 0.52, y: 0.52 },
    { x: 0.48, y: 0.52 },
    { x: 0.48, y: 0.48 },
    { x: 0.52, y: 0.48 },
  ];

  it('sets usedFallbackRange=true when raw range < WIZARD_PRACTICAL_MIN_RANGE', () => {
    const { usedFallbackRange } = computeWizardCalibration(CENTER_NEUTRAL, clusteredCorners);
    expect(usedFallbackRange).toBe(true);
  });

  it('applies WIZARD_FALLBACK_RANGE_X when range is narrow', () => {
    const { rangeX } = computeWizardCalibration(CENTER_NEUTRAL, clusteredCorners);
    expect(rangeX).toBeCloseTo(WIZARD_FALLBACK_RANGE_X, 5);
  });

  it('applies WIZARD_FALLBACK_RANGE_Y when range is narrow', () => {
    const { rangeY } = computeWizardCalibration(CENTER_NEUTRAL, clusteredCorners);
    expect(rangeY).toBeCloseTo(WIZARD_FALLBACK_RANGE_Y, 5);
  });

  it('exactly-at-minimum range does NOT trigger fallback', () => {
    // Raw rangeX = exactly WIZARD_PRACTICAL_MIN_RANGE → usedFallbackRange = false
    const half = WIZARD_PRACTICAL_MIN_RANGE / 2;
    const corners: CornerSample[] = [
      { x: 0.5 + half, y: 0.5 + half },
      { x: 0.5 - half, y: 0.5 + half },
      { x: 0.5 - half, y: 0.5 - half },
      { x: 0.5 + half, y: 0.5 - half },
    ];
    // allMxX = [0.5 - half, 0.5 + half, 0.5 + half, 0.5 - half]
    // rawRangeX = 2*half = WIZARD_PRACTICAL_MIN_RANGE
    const { usedFallbackRange } = computeWizardCalibration(CENTER_NEUTRAL, corners);
    // < not ≤: exactly at min is NOT fallback
    expect(usedFallbackRange).toBe(false);
  });
});

// ── computeWizardCalibration — center anchoring ───────────────────────────────

describe('computeWizardCalibration — center anchoring', () => {
  it('null center falls back to corner centroid anchor', () => {
    const symCorners = symmetricCorners();
    const withNull = computeWizardCalibration(null, symCorners);
    const withCenter = computeWizardCalibration(CENTER_NEUTRAL, symCorners);
    // For symmetric corners, centroid IS (0.5, 0.5) so results should match
    expect(withNull.cal.leftX).toBeCloseTo(withCenter.cal.leftX, 5);
    expect(withNull.cal.rightX).toBeCloseTo(withCenter.cal.rightX, 5);
    expect(withNull.cal.topY).toBeCloseTo(withCenter.cal.topY, 5);
    expect(withNull.cal.bottomY).toBeCloseTo(withCenter.cal.bottomY, 5);
  });

  it('off-center user neutral shifts calibration anchor', () => {
    // User's neutral is offset right of screen center (low camera-X = high mirror-X)
    const shiftedCenter: CenterSample = { normX: 0.3, normY: 0.5 }; // user looks slightly left in camera
    const { cal } = computeWizardCalibration(shiftedCenter, symmetricCorners());
    const { cal: symCal } = computeWizardCalibration(CENTER_NEUTRAL, symmetricCorners());
    // Shifted center should produce a different (asymmetric) calibration
    expect(cal.leftX).not.toBeCloseTo(symCal.leftX, 3);
  });

  it('calibration is anchored on center, not corner centroid for asymmetric reach', () => {
    // Asymmetric corners — user can reach far right but not far left
    const asymCorners: CornerSample[] = [
      { x: 0.9, y: 0.2 }, // TL (camera): very far right in camera → user's left
      { x: 0.5, y: 0.2 }, // TR (camera): center right
      { x: 0.5, y: 0.8 }, // BR
      { x: 0.9, y: 0.8 }, // BL
    ];
    const explicitCenter: CenterSample = { normX: 0.5, normY: 0.5 };
    const { cal } = computeWizardCalibration(explicitCenter, asymCorners);
    // With explicit center at (0.5, 0.5), anchorMirX = 0.5
    // cal should be centered around 0.5 on X axis
    expect((cal.leftX + cal.rightX) / 2).toBeCloseTo(0.5, 1);
  });
});

// ── computeWizardCalibration — clamping to [0.05, 0.95] ──────────────────────

describe('computeWizardCalibration — boundary clamping', () => {
  it('extreme corners (0 and 1) produce cal clamped to [0.05, 0.95]', () => {
    // User has enormous head movement range — corners at 0 and 1
    const extremeCorners: CornerSample[] = [
      { x: 1.0, y: 0.0 },
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: 1.0 },
      { x: 1.0, y: 1.0 },
    ];
    const { cal } = computeWizardCalibration(CENTER_NEUTRAL, extremeCorners);
    expect(cal.leftX).toBeLessThanOrEqual(0.95);
    expect(cal.rightX).toBeGreaterThanOrEqual(0.05);
    expect(cal.topY).toBeGreaterThanOrEqual(0.05);
    expect(cal.bottomY).toBeLessThanOrEqual(0.95);
  });
});

// ── computeCenterPreviewCalibration ──────────────────────────────────────────

describe('computeCenterPreviewCalibration', () => {
  it('returns a calibration with fallback ranges', () => {
    const cal = computeCenterPreviewCalibration({ normX: 0.5, normY: 0.5 });
    expect(cal.leftX - cal.rightX).toBeCloseTo(WIZARD_FALLBACK_RANGE_X, 5);
    expect(cal.bottomY - cal.topY).toBeCloseTo(WIZARD_FALLBACK_RANGE_Y, 5);
  });

  it('all values in [0.05, 0.95]', () => {
    const cal = computeCenterPreviewCalibration({ normX: 0.5, normY: 0.5 });
    expect(cal.leftX).toBeLessThanOrEqual(0.95);
    expect(cal.rightX).toBeGreaterThanOrEqual(0.05);
    expect(cal.topY).toBeGreaterThanOrEqual(0.05);
    expect(cal.bottomY).toBeLessThanOrEqual(0.95);
  });

  it('center at (0.5, 0.5) produces symmetric calibration', () => {
    const cal = computeCenterPreviewCalibration({ normX: 0.5, normY: 0.5 });
    // anchorMirX = 1 - 0.5 = 0.5 → symmetric around 0.5
    expect(cal.leftX + cal.rightX).toBeCloseTo(1.0, 5);
    expect(cal.topY + cal.bottomY).toBeCloseTo(1.0, 5);
  });

  it('cal.leftX > cal.rightX and cal.bottomY > cal.topY', () => {
    const cal = computeCenterPreviewCalibration({ normX: 0.4, normY: 0.6 });
    expect(cal.leftX).toBeGreaterThan(cal.rightX);
    expect(cal.bottomY).toBeGreaterThan(cal.topY);
  });
});

// ── isCalibrationUsable ───────────────────────────────────────────────────────

describe('isCalibrationUsable', () => {
  const validCal = { leftX: 0.8, rightX: 0.2, topY: 0.2, bottomY: 0.8 };

  it('valid calibration returns true', () => {
    expect(isCalibrationUsable(validCal)).toBe(true);
  });

  it('leftX < rightX (inverted X axis) returns false', () => {
    expect(isCalibrationUsable({ leftX: 0.2, rightX: 0.8, topY: 0.2, bottomY: 0.8 })).toBe(false);
  });

  it('bottomY < topY (inverted Y axis) returns false', () => {
    expect(isCalibrationUsable({ leftX: 0.8, rightX: 0.2, topY: 0.8, bottomY: 0.2 })).toBe(false);
  });

  it('X range below minRange returns false', () => {
    // Range = 0.04 < default minRange 0.05
    expect(isCalibrationUsable({ leftX: 0.52, rightX: 0.48, topY: 0.2, bottomY: 0.8 })).toBe(false);
  });

  it('Y range below minRange returns false', () => {
    expect(isCalibrationUsable({ leftX: 0.8, rightX: 0.2, topY: 0.52, bottomY: 0.54 })).toBe(false);
  });

  it('range clearly above minRange returns true', () => {
    // 0.625 - 0.5 = 0.125 (exact binary fraction, well above default minRange 0.05)
    expect(isCalibrationUsable({ leftX: 0.75, rightX: 0.625, topY: 0.25, bottomY: 0.375 })).toBe(true);
  });

  it('NaN leftX returns false', () => {
    expect(isCalibrationUsable({ leftX: NaN, rightX: 0.2, topY: 0.2, bottomY: 0.8 })).toBe(false);
  });

  it('NaN topY returns false', () => {
    expect(isCalibrationUsable({ leftX: 0.8, rightX: 0.2, topY: NaN, bottomY: 0.8 })).toBe(false);
  });

  it('leftX = rightX (zero range) returns false', () => {
    expect(isCalibrationUsable({ leftX: 0.5, rightX: 0.5, topY: 0.2, bottomY: 0.8 })).toBe(false);
  });

  it('value outside [0, 1] range returns false', () => {
    expect(isCalibrationUsable({ leftX: 1.5, rightX: 0.2, topY: 0.2, bottomY: 0.8 })).toBe(false);
  });

  it('negative value returns false', () => {
    expect(isCalibrationUsable({ leftX: 0.8, rightX: -0.1, topY: 0.2, bottomY: 0.8 })).toBe(false);
  });

  it('custom minRange respected', () => {
    // Range = 0.125 (exact binary fraction: 0.75-0.625=0.125, 0.375-0.25=0.125)
    // 0.125 > 0.05 (default) but 0.125 < 0.20 (strict)
    const cal = { leftX: 0.75, rightX: 0.625, topY: 0.25, bottomY: 0.375 };
    expect(isCalibrationUsable(cal, 0.05)).toBe(true);
    expect(isCalibrationUsable(cal, 0.20)).toBe(false);
  });
});
