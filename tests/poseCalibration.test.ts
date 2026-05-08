/**
 * Calibration math — full audit per user request 2026-05-08 ("redo
 * all the math"). Tests the pure helpers extracted from
 * services/bodyPoseService.ts so we never re-introduce the inverted
 * leftX/rightX bug that made the wizard a placebo for ~12 months.
 *
 * Convention (load-bearing — see DEFAULT_CALIBRATION):
 *   leftX  > rightX (mirrored-X for "head turned to user-right" is LARGER)
 *   topY   < bottomY (normY for "head tilted up" is SMALLER)
 *
 * The runtime mapping
 *   rawX = (mirroredX - rightX) / (leftX - rightX) * screenW
 * requires leftX > rightX or rangeX flips sign and the MIN_RANGE
 * guard substitutes DEFAULT_CALIBRATION every frame.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CALIBRATION,
  mapPoseToScreen,
  computeCalibrationFromCorners,
  OnlineCalibrationLearner,
} from '@/services/bodyPoseService';

const SCREEN_W = 1280;
const SCREEN_H = 800;

// Realistic corner samples for a head-tracking user — `samples[i].x` is
// the raw normX (before mirror) reported by the pose tracker when the
// user looked at the i-th corner. We pick values consistent with:
//   user looks LEFT  → head turns left → nose appears on RIGHT of camera image → normX HIGH
//   user looks RIGHT → head turns right → nose appears on LEFT of camera image → normX LOW
//   user looks UP    → nose moves UP in camera image → normY LOW
//   user looks DOWN  → nose moves DOWN in camera image → normY HIGH
const REALISTIC_CORNERS = [
  { x: 0.85, y: 0.30 }, // TL — looking up-left   (normX HIGH, normY LOW)
  { x: 0.15, y: 0.30 }, // TR — looking up-right  (normX LOW,  normY LOW)
  { x: 0.15, y: 0.75 }, // BR — looking down-right(normX LOW,  normY HIGH)
  { x: 0.85, y: 0.75 }, // BL — looking down-left (normX HIGH, normY HIGH)
];

describe('computeCalibrationFromCorners — convention enforcement', () => {
  it('produces leftX > rightX (the runtime mapping requires this)', () => {
    const cal = computeCalibrationFromCorners(REALISTIC_CORNERS);
    expect(cal.leftX).toBeGreaterThan(cal.rightX);
  });

  it('produces topY < bottomY (the runtime mapping requires this)', () => {
    const cal = computeCalibrationFromCorners(REALISTIC_CORNERS);
    expect(cal.topY).toBeLessThan(cal.bottomY);
  });

  it('throws on wrong-arity input (defends against truncated samples)', () => {
    expect(() => computeCalibrationFromCorners([])).toThrow();
    expect(() => computeCalibrationFromCorners([{ x: 0.5, y: 0.5 }])).toThrow();
  });

  it('matches DEFAULT_CALIBRATION shape — leftX > rightX, topY < bottomY', () => {
    expect(DEFAULT_CALIBRATION.leftX).toBeGreaterThan(DEFAULT_CALIBRATION.rightX);
    expect(DEFAULT_CALIBRATION.topY).toBeLessThan(DEFAULT_CALIBRATION.bottomY);
  });

  it('still produces valid ordering when corner samples are noisy', () => {
    // Samples flipped by 5% jitter — still classified correctly because
    // Math.max/min works on the actual values, not on the corner labels.
    const noisy = [
      { x: 0.80, y: 0.32 }, // TL
      { x: 0.20, y: 0.28 }, // TR
      { x: 0.18, y: 0.78 }, // BR
      { x: 0.82, y: 0.72 }, // BL
    ];
    const cal = computeCalibrationFromCorners(noisy);
    expect(cal.leftX).toBeGreaterThan(cal.rightX);
    expect(cal.topY).toBeLessThan(cal.bottomY);
  });
});

describe('mapPoseToScreen — pose-x → screen-x (front camera mirror)', () => {
  // Build a calibration from realistic corners so we test the FULL
  // pipeline (capture → map), not a synthetic ideal calibration.
  const cal = computeCalibrationFromCorners(REALISTIC_CORNERS);

  it('user looks LEFT (normX high) → cursor at LEFT of screen', () => {
    // normX 0.85 = nose at right of camera image = user turned head left
    const { x } = mapPoseToScreen(0.85, 0.5, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeLessThan(SCREEN_W * 0.05); // within 5% of left edge
  });

  it('user looks RIGHT (normX low) → cursor at RIGHT of screen', () => {
    // normX 0.15 = nose at left of camera image = user turned head right
    const { x } = mapPoseToScreen(0.15, 0.5, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeGreaterThan(SCREEN_W * 0.95);
  });

  it('user looks center → cursor at center of screen', () => {
    // normX 0.5 = exactly between corners → middle of mapped range
    const midX = (REALISTIC_CORNERS[0].x + REALISTIC_CORNERS[1].x) / 2; // 0.5
    const { x } = mapPoseToScreen(midX, 0.5, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeCloseTo(SCREEN_W / 2, -1); // within ±5px of center
  });
});

describe('mapPoseToScreen — pose-y → screen-y', () => {
  const cal = computeCalibrationFromCorners(REALISTIC_CORNERS);

  it('user looks UP (normY low) → cursor at TOP of screen', () => {
    const { y } = mapPoseToScreen(0.5, 0.30, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(y).toBeLessThan(SCREEN_H * 0.05);
  });

  it('user looks DOWN (normY high) → cursor at BOTTOM of screen', () => {
    const { y } = mapPoseToScreen(0.5, 0.75, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(y).toBeGreaterThan(SCREEN_H * 0.95);
  });

  it('user looks vertically centered → cursor at vertical center', () => {
    const midY = (REALISTIC_CORNERS[0].y + REALISTIC_CORNERS[2].y) / 2; // ~0.525
    const { y } = mapPoseToScreen(0.5, midY, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(y).toBeCloseTo(SCREEN_H / 2, -1);
  });
});

describe('mapPoseToScreen — corner-to-corner round trip', () => {
  const cal = computeCalibrationFromCorners(REALISTIC_CORNERS);

  it('TL pose → cursor at top-left of screen', () => {
    const tl = REALISTIC_CORNERS[0];
    const { x, y } = mapPoseToScreen(tl.x, tl.y, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeLessThan(SCREEN_W * 0.05);
    expect(y).toBeLessThan(SCREEN_H * 0.05);
  });
  it('TR pose → cursor at top-right of screen', () => {
    const tr = REALISTIC_CORNERS[1];
    const { x, y } = mapPoseToScreen(tr.x, tr.y, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeGreaterThan(SCREEN_W * 0.95);
    expect(y).toBeLessThan(SCREEN_H * 0.05);
  });
  it('BR pose → cursor at bottom-right of screen', () => {
    const br = REALISTIC_CORNERS[2];
    const { x, y } = mapPoseToScreen(br.x, br.y, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeGreaterThan(SCREEN_W * 0.95);
    expect(y).toBeGreaterThan(SCREEN_H * 0.95);
  });
  it('BL pose → cursor at bottom-left of screen', () => {
    const bl = REALISTIC_CORNERS[3];
    const { x, y } = mapPoseToScreen(bl.x, bl.y, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeLessThan(SCREEN_W * 0.05);
    expect(y).toBeGreaterThan(SCREEN_H * 0.95);
  });
});

describe('mapPoseToScreen — defensive guards', () => {
  it('flags rangeOK=false and falls back to defaults when leftX < rightX', () => {
    // Inverted calibration — the bug class that shipped in prod for
    // months. The runtime guard substitutes defaults; we assert that
    // the returned cursor is therefore somewhere on screen, not NaN.
    const broken = { leftX: 0.05, rightX: 0.75, topY: 0.2, bottomY: 0.8 };
    const r = mapPoseToScreen(0.5, 0.5, broken, 1.0, SCREEN_W, SCREEN_H);
    expect(r.rangeOK).toBe(false);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x).toBeLessThanOrEqual(SCREEN_W);
  });

  it('flags rangeOK=false ONLY when range collapses below MIN_RANGE (0.02)', () => {
    // Calibrations as narrow as 0.05–0.20 are valid for accessibility
    // users with limited motion — they were getting reset to defaults
    // under the prior 0.30 floor. Only inverted / zero-range cals are
    // rejected now.
    const narrowButValid = { leftX: 0.55, rightX: 0.45, topY: 0.45, bottomY: 0.55 };
    expect(mapPoseToScreen(0.5, 0.5, narrowButValid, 1.0, SCREEN_W, SCREEN_H).rangeOK).toBe(true);
    const tooNarrow = { leftX: 0.51, rightX: 0.50, topY: 0.50, bottomY: 0.51 };
    expect(mapPoseToScreen(0.5, 0.5, tooNarrow, 1.0, SCREEN_W, SCREEN_H).rangeOK).toBe(false);
  });

  it('accepts a 0.10-wide accessibility-user calibration', () => {
    // Real-world AAC user: finger only sweeps from 0.45 to 0.55 of
    // camera image. Cursor must still span screen.
    const cal = { leftX: 0.55, rightX: 0.45, topY: 0.45, bottomY: 0.55 };
    const left = mapPoseToScreen(0.55 /* mirroredX would be 0.45 */, 0.45, cal, 1.0, SCREEN_W, SCREEN_H);
    const right = mapPoseToScreen(0.45 /* mirroredX would be 0.55 */, 0.55, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(left.rangeOK).toBe(true);
    expect(right.rangeOK).toBe(true);
    expect(left.x).toBeLessThan(SCREEN_W * 0.05);
    expect(right.x).toBeGreaterThan(SCREEN_W * 0.95);
  });

  it('clamps cursor to screen bounds for poses outside calibration rect', () => {
    const cal = DEFAULT_CALIBRATION;
    const r = mapPoseToScreen(2.0, 2.0, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(r.x).toBeLessThanOrEqual(SCREEN_W);
    expect(r.y).toBeLessThanOrEqual(SCREEN_H);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });
});

describe('mapPoseToScreen — sensitivity scaling', () => {
  const cal = computeCalibrationFromCorners(REALISTIC_CORNERS);

  it('sensitivity 1.0 = no zoom (cursor at calibrated position)', () => {
    const tl = REALISTIC_CORNERS[0];
    const { x } = mapPoseToScreen(tl.x, tl.y, cal, 1.0, SCREEN_W, SCREEN_H);
    expect(x).toBeLessThan(SCREEN_W * 0.05);
  });

  it('sensitivity > 1 amplifies movement around screen center', () => {
    // Halfway between center and TL pose → with 2x sensitivity, the
    // cursor should be MORE off-center than with 1x.
    const tl = REALISTIC_CORNERS[0];
    const midNormX = (tl.x + 0.5) / 2;
    const { x: x1 } = mapPoseToScreen(midNormX, 0.5, cal, 1.0, SCREEN_W, SCREEN_H);
    const { x: x2 } = mapPoseToScreen(midNormX, 0.5, cal, 2.0, SCREEN_W, SCREEN_H);
    const dist1 = Math.abs(x1 - SCREEN_W / 2);
    const dist2 = Math.abs(x2 - SCREEN_W / 2);
    expect(dist2).toBeGreaterThan(dist1);
  });

  it('sensitivity < 1 dampens movement', () => {
    const tl = REALISTIC_CORNERS[0];
    const { x: x1 } = mapPoseToScreen(tl.x, 0.5, cal, 1.0, SCREEN_W, SCREEN_H);
    const { x: x2 } = mapPoseToScreen(tl.x, 0.5, cal, 0.5, SCREEN_W, SCREEN_H);
    const dist1 = Math.abs(x1 - SCREEN_W / 2);
    const dist2 = Math.abs(x2 - SCREEN_W / 2);
    expect(dist2).toBeLessThan(dist1);
  });
});

describe('OnlineCalibrationLearner — auto-learns from real motion', () => {
  it('returns null until minimum samples accumulate', () => {
    const l = new OnlineCalibrationLearner({ minSamples: 60 });
    for (let i = 0; i < 30; i++) l.push(0.5 + Math.random() * 0.1, 0.5);
    expect(l.snapshot()).toBeNull();
    expect(l.maybeEmitCalibration()).toBeNull();
  });

  it('emits a calibration matching the observed pose envelope', () => {
    // Simulate 200 samples of a user whose finger sweeps mirroredX
    // 0.30→0.70 and normY 0.40→0.60 — a realistic limited-motion
    // user.
    const l = new OnlineCalibrationLearner();
    for (let i = 0; i < 200; i++) {
      const t = i / 199;
      l.push(0.30 + 0.40 * t, 0.40 + 0.20 * t);
    }
    const cal = l.snapshot();
    expect(cal).not.toBeNull();
    if (!cal) return;
    // 5th–95th percentile of a uniform sweep approximates the true
    // bounds with a small tolerance.
    expect(cal.rightX).toBeGreaterThan(0.30); // 5th percentile > min
    expect(cal.rightX).toBeLessThan(0.40);
    expect(cal.leftX).toBeGreaterThan(0.60);
    expect(cal.leftX).toBeLessThan(0.70);
    expect(cal.topY).toBeGreaterThan(0.40);
    expect(cal.bottomY).toBeLessThan(0.60);
    expect(cal.leftX).toBeGreaterThan(cal.rightX); // convention OK
  });

  it('is robust to outlier samples (5th/95th percentile)', () => {
    const l = new OnlineCalibrationLearner();
    // Mostly samples in [0.45, 0.55], plus 2 outliers at 0.0 and 1.0
    for (let i = 0; i < 100; i++) l.push(0.45 + (i / 100) * 0.10, 0.5);
    l.push(0.0, 0.5);
    l.push(1.0, 0.5);
    const cal = l.snapshot();
    expect(cal).not.toBeNull();
    if (!cal) return;
    // Outliers should NOT define the bounds — the 5th/95th
    // percentile pulls in to the dense cluster.
    expect(cal.rightX).toBeGreaterThan(0.40);
    expect(cal.leftX).toBeLessThan(0.60);
  });

  it('rolls the window — old samples drop out as new ones arrive', () => {
    const l = new OnlineCalibrationLearner({ maxSamples: 100, minSamples: 50 });
    // Phase 1: user moves in a small range
    for (let i = 0; i < 100; i++) l.push(0.45 + (i / 100) * 0.10, 0.5);
    const phase1 = l.snapshot();
    // Phase 2: user grows their range — push 100 more samples in
    // a wider envelope. Window holds last 100 samples, so phase 1
    // values should be evicted.
    for (let i = 0; i < 100; i++) l.push(0.20 + (i / 100) * 0.60, 0.5);
    const phase2 = l.snapshot();
    expect(phase1).not.toBeNull();
    expect(phase2).not.toBeNull();
    if (!phase1 || !phase2) return;
    // Phase 2 cal range should be wider than phase 1.
    expect(phase2.leftX - phase2.rightX).toBeGreaterThan(phase1.leftX - phase1.rightX);
  });

  it('maybeEmitCalibration only fires every UPDATE_EVERY-th call', () => {
    const l = new OnlineCalibrationLearner({ updateEvery: 30, minSamples: 30 });
    let emits = 0;
    for (let i = 0; i < 90; i++) {
      l.push(0.5, 0.5);
      if (l.maybeEmitCalibration()) emits++;
    }
    // 90 samples / 30 = 3 emissions
    expect(emits).toBe(3);
  });

  it('reset() clears the buffer', () => {
    const l = new OnlineCalibrationLearner({ minSamples: 60 });
    for (let i = 0; i < 100; i++) l.push(0.5, 0.5);
    expect(l.size()).toBe(100);
    l.reset();
    expect(l.size()).toBe(0);
    expect(l.snapshot()).toBeNull();
  });
});
