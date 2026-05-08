/**
 * Procrustes / RANSAC similarity transform tests — Step 2 of the
 * SOTA-research roadmap. Replaces the prior binary centroid+residual
 * gate with a 4-DOF (tx, ty, scale, rotation) rigid-body fit per
 * Umeyama 1991 + RANSAC inlier selection (Fischler-Bolles 1981).
 *
 * The win this catches that the legacy method missed:
 *   • Vehicle ROLL → top landmarks shift opposite bottom landmarks
 *     under uniform rotation. Centroid stays put. classifyMotion's
 *     residuals look like deliberate motion → no suppression. The
 *     cursor jets around with each bump.
 *   • Procrustes fits the rotation directly → ego-motion classified
 *     correctly → cursor held.
 *
 * RANSAC also rejects outliers (a moving wrist among rigid body
 * landmarks) so the inlier-majority transform represents the
 * camera, not the user.
 */
import { describe, it, expect } from 'vitest';
import {
  fitSimilarityTransform,
  fitSimilarityRansac,
  applyTransform,
  centroid,
  IDENTITY_TRANSFORM,
  type Point2D,
} from '@/services/egoMotion';

const EPS = 1e-6;

// 8 rigid body landmarks (shoulders, hips, elbows, wrists).
const RIGID: Point2D[] = [
  { x: 0.30, y: 0.40 }, { x: 0.70, y: 0.40 }, // shoulders
  { x: 0.30, y: 0.60 }, { x: 0.70, y: 0.60 }, // hips
  { x: 0.20, y: 0.50 }, { x: 0.80, y: 0.50 }, // elbows
  { x: 0.15, y: 0.55 }, { x: 0.85, y: 0.55 }, // wrists
];

// Apply a synthetic similarity transform to all points.
const transformAll = (pts: Point2D[], tx: number, ty: number, s = 1, theta = 0): Point2D[] => {
  const c = Math.cos(theta), si = Math.sin(theta);
  return pts.map(p => ({
    x: s * (c * p.x - si * p.y) + tx,
    y: s * (si * p.x + c * p.y) + ty,
  }));
};

describe('fitSimilarityTransform — Umeyama 1991 closed-form', () => {
  it('recovers identity from same → same', () => {
    const t = fitSimilarityTransform(RIGID, RIGID);
    expect(Math.abs(t.tx)).toBeLessThan(EPS);
    expect(Math.abs(t.ty)).toBeLessThan(EPS);
    expect(t.scale).toBeCloseTo(1, 5);
    expect(Math.abs(t.theta)).toBeLessThan(EPS);
  });

  it('recovers pure translation', () => {
    const next = transformAll(RIGID, 0.05, 0.03);
    const t = fitSimilarityTransform(RIGID, next);
    expect(t.tx).toBeCloseTo(0.05, 4);
    expect(t.ty).toBeCloseTo(0.03, 4);
    expect(t.scale).toBeCloseTo(1, 4);
    expect(Math.abs(t.theta)).toBeLessThan(1e-3);
  });

  it('recovers pure rotation (vehicle roll)', () => {
    const theta = 0.1; // ~5.7°
    const next = transformAll(RIGID, 0, 0, 1, theta);
    const t = fitSimilarityTransform(RIGID, next);
    expect(t.theta).toBeCloseTo(theta, 3);
    expect(t.scale).toBeCloseTo(1, 4);
  });

  it('recovers pure scale', () => {
    const s = 1.1;
    const next = transformAll(RIGID, 0, 0, s, 0);
    const t = fitSimilarityTransform(RIGID, next);
    expect(t.scale).toBeCloseTo(s, 3);
    expect(Math.abs(t.theta)).toBeLessThan(1e-3);
  });

  it('recovers combined translation + rotation', () => {
    const next = transformAll(RIGID, 0.04, 0.02, 1, 0.05);
    const t = fitSimilarityTransform(RIGID, next);
    expect(t.tx).toBeCloseTo(0.04, 3);
    expect(t.ty).toBeCloseTo(0.02, 3);
    expect(t.theta).toBeCloseTo(0.05, 3);
  });

  it('returns identity for < 2 points (defensive)', () => {
    expect(fitSimilarityTransform([], [])).toEqual(IDENTITY_TRANSFORM);
    expect(fitSimilarityTransform([{ x: 0, y: 0 }], [{ x: 1, y: 1 }])).toEqual(IDENTITY_TRANSFORM);
  });

  it('returns identity for degenerate (coincident) prev points', () => {
    const same = [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }];
    const t = fitSimilarityTransform(same, RIGID.slice(0, 3));
    expect(t).toEqual(IDENTITY_TRANSFORM);
  });

  it('round-trip: applyTransform fully undoes the fit', () => {
    const next = transformAll(RIGID, 0.03, 0.02, 1.05, 0.08);
    const t = fitSimilarityTransform(RIGID, next);
    // Applying t to RIGID should give us back next (within numerical tolerance).
    for (let i = 0; i < RIGID.length; i++) {
      const predicted = applyTransform(RIGID[i], t);
      expect(predicted.x).toBeCloseTo(next[i].x, 5);
      expect(predicted.y).toBeCloseTo(next[i].y, 5);
    }
  });
});

describe('fitSimilarityRansac — outlier rejection', () => {
  it('rigid majority + 1 moving outlier → finds the rigid transform', () => {
    // 7 points stay rigid (camera shake = uniform translation),
    // 1 point (the wrist) moves deliberately.
    const cameraShifted = transformAll(RIGID, 0.04, 0.02);
    const withOutlier = [...cameraShifted];
    withOutlier[7] = { x: cameraShifted[7].x + 0.15, y: cameraShifted[7].y };
    const fit = fitSimilarityRansac(RIGID, withOutlier, {
      iterations: 30,
      inlierThreshold: 0.005,
      minInliers: 5,
    });
    expect(fit.transform.tx).toBeCloseTo(0.04, 3);
    expect(fit.transform.ty).toBeCloseTo(0.02, 3);
    // The moving wrist should NOT be classified as an inlier.
    expect(fit.inlierMask[7]).toBe(false);
    expect(fit.inlierCount).toBeGreaterThanOrEqual(5);
  });

  it('all-rigid → all inliers', () => {
    const cameraShifted = transformAll(RIGID, 0.05, 0.03);
    const fit = fitSimilarityRansac(RIGID, cameraShifted, {
      iterations: 20,
      inlierThreshold: 0.005,
    });
    expect(fit.inlierCount).toBe(RIGID.length);
  });

  it('all-moving (no rigid majority) → returns identity', () => {
    // Each landmark moves by a different random delta — no rigid
    // model fits. RANSAC should give up and return identity.
    const moving: Point2D[] = RIGID.map((p, i) => ({
      x: p.x + (i * 0.07 - 0.2),
      y: p.y + (i * 0.05 - 0.15),
    }));
    const fit = fitSimilarityRansac(RIGID, moving, {
      iterations: 20,
      inlierThreshold: 0.005,
      minInliers: 6,
    });
    // No coherent rigid majority → returns identity (or a low
    // inlier count we can ignore).
    expect(fit.inlierCount).toBeLessThan(6);
  });

  it('vehicle roll (pure rotation, all rigid) → recovers θ', () => {
    // The case the legacy classifyMotion missed.
    const theta = 0.08;
    const rolled = transformAll(RIGID, 0, 0, 1, theta);
    const fit = fitSimilarityRansac(RIGID, rolled, {
      iterations: 30,
      inlierThreshold: 0.01,
    });
    expect(fit.transform.theta).toBeCloseTo(theta, 2);
    expect(fit.inlierCount).toBeGreaterThanOrEqual(6);
  });

  it('< 3 points → returns identity defensively', () => {
    const fit = fitSimilarityRansac(
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      [{ x: 0.1, y: 0.1 }, { x: 1.1, y: 1.1 }],
    );
    expect(fit.transform).toEqual(IDENTITY_TRANSFORM);
    expect(fit.inlierCount).toBe(0);
  });
});

describe('applyTransform / centroid utilities', () => {
  it('applyTransform with identity is a no-op', () => {
    const out = applyTransform({ x: 0.5, y: 0.5 }, IDENTITY_TRANSFORM);
    expect(out).toEqual({ x: 0.5, y: 0.5 });
  });

  it('centroid of empty is (0, 0)', () => {
    expect(centroid([])).toEqual({ x: 0, y: 0 });
  });

  it('centroid is the mean', () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 2, y: 4 }])).toEqual({ x: 1, y: 2 });
  });
});
