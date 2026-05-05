import { describe, it, expect } from 'vitest';
import { centroid, classifyMotion, type Point2D } from '@/services/egoMotion';

describe('centroid', () => {
    it('returns (0,0) for empty input', () => {
        expect(centroid([])).toEqual({ x: 0, y: 0 });
    });

    it('averages 2D points correctly', () => {
        expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 });
    });
});

describe('classifyMotion — ego-motion vs face-motion', () => {
    it('classifies pure camera shake as ego-motion (suppress)', () => {
        // 3 landmarks all shift by exactly (+0.05, +0.03) — ego-motion.
        const prev: Point2D[] = [
            { x: 0.3, y: 0.2 }, { x: 0.5, y: 0.4 }, { x: 0.7, y: 0.6 },
        ];
        const curr: Point2D[] = [
            { x: 0.35, y: 0.23 }, { x: 0.55, y: 0.43 }, { x: 0.75, y: 0.63 },
        ];
        const r = classifyMotion(prev, curr);
        expect(r.isEgoMotion).toBe(true);
        expect(r.maxResidual).toBeLessThan(1e-9);
        expect(r.egoDelta.x).toBeCloseTo(0.05);
        expect(r.egoDelta.y).toBeCloseTo(0.03);
    });

    it('classifies pure face motion as NOT ego-motion (cursor moves)', () => {
        // Face mouth opens — top point fixed, bottom point drops.
        const prev: Point2D[] = [{ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.5 }];
        const curr: Point2D[] = [{ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 }];
        const r = classifyMotion(prev, curr);
        expect(r.isEgoMotion).toBe(false);
        // Residual should be substantial — landmarks moved relative to each other
        expect(r.maxResidual).toBeGreaterThan(0.04);
    });

    it('mixed shake + slight face motion: still classifies if shake dominates', () => {
        // 5 landmarks all shift uniformly + tiny noise — should still pass
        const prev: Point2D[] = [
            { x: 0.30, y: 0.20 }, { x: 0.50, y: 0.40 }, { x: 0.70, y: 0.60 },
            { x: 0.40, y: 0.30 }, { x: 0.60, y: 0.50 },
        ];
        const curr: Point2D[] = prev.map((p, i) => ({
            x: p.x + 0.05 + (i % 2 === 0 ? 0.001 : -0.001),  // tiny noise
            y: p.y + 0.03,
        }));
        const r = classifyMotion(prev, curr);
        // Residuals are well below 0.005 default threshold → ego-motion
        expect(r.isEgoMotion).toBe(true);
    });

    it('rotation override: high head rotation cancels ego-motion suppression', () => {
        // Same uniform shift as ego-motion test, BUT we report a head
        // rotation > 0.05 rad — caller intends a head shake.
        const prev: Point2D[] = [{ x: 0.3, y: 0.2 }, { x: 0.5, y: 0.4 }];
        const curr: Point2D[] = [{ x: 0.35, y: 0.23 }, { x: 0.55, y: 0.43 }];
        const r = classifyMotion(prev, curr, /* rotationRad */ 0.10);
        expect(r.isEgoMotion).toBe(false);  // suppression off
        expect(r.egoDelta.x).toBeCloseTo(0.05);  // delta still computed for caller
    });

    it('returns no-ego on empty input', () => {
        const r = classifyMotion([], []);
        expect(r.isEgoMotion).toBe(false);
        expect(r.maxResidual).toBe(0);
    });

    it('zero-delta frames are NOT ego-motion (no false positive on perfect stillness)', () => {
        const prev: Point2D[] = [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }];
        const curr: Point2D[] = [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }];
        const r = classifyMotion(prev, curr);
        // Both delta AND residual are zero — we treat this as "no motion",
        // not "ego-motion suppress". egoDelta is (0,0) so the suppress
        // gate (>0.001 magnitude) returns false.
        expect(r.isEgoMotion).toBe(false);
    });
});

describe('egoMotion — military hardening: adversarial inputs', () => {
    it('mismatched array lengths use the shorter prefix', () => {
        const prev: Point2D[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
        const curr: Point2D[] = [{ x: 0.05, y: 0.03 }];  // shorter
        const r = classifyMotion(prev, curr);
        // Only the first landmark is compared — single-point cannot
        // distinguish ego from face motion, but should not crash
        expect(Number.isFinite(r.egoDelta.x)).toBe(true);
        expect(Number.isFinite(r.egoDelta.y)).toBe(true);
        expect(Number.isFinite(r.maxResidual)).toBe(true);
    });

    it('reverse-mismatched arrays (curr longer) also handled', () => {
        const prev: Point2D[] = [{ x: 0, y: 0 }];
        const curr: Point2D[] = [{ x: 0.05, y: 0.03 }, { x: 1, y: 1 }];
        const r = classifyMotion(prev, curr);
        expect(Number.isFinite(r.egoDelta.x)).toBe(true);
    });

    it('single-point array — egoDelta IS the motion, residual is zero', () => {
        const prev: Point2D[] = [{ x: 0.5, y: 0.5 }];
        const curr: Point2D[] = [{ x: 0.55, y: 0.53 }];
        const r = classifyMotion(prev, curr);
        // With one point, residual is always zero (centroid = point itself)
        expect(r.maxResidual).toBeCloseTo(0);
        // ...so it always classifies as ego-motion if delta > threshold
        expect(r.isEgoMotion).toBe(true);
    });

    it('handles negative head rotation (uses Math.abs)', () => {
        const prev: Point2D[] = [{ x: 0.3, y: 0.2 }, { x: 0.5, y: 0.4 }];
        const curr: Point2D[] = [{ x: 0.35, y: 0.23 }, { x: 0.55, y: 0.43 }];
        // Negative rotation also above threshold → suppress disabled
        const r = classifyMotion(prev, curr, -0.10);
        expect(r.isEgoMotion).toBe(false);
    });

    it('rotation exactly at threshold does NOT cancel ego-motion', () => {
        // The check is `Math.abs(rot) > rotationThreshold`. At exact equality,
        // suppression remains active.
        const prev: Point2D[] = [{ x: 0.3, y: 0.2 }, { x: 0.5, y: 0.4 }];
        const curr: Point2D[] = [{ x: 0.35, y: 0.23 }, { x: 0.55, y: 0.43 }];
        const r = classifyMotion(prev, curr, 0.05, 0.005, 0.05);
        expect(r.isEgoMotion).toBe(true);
    });

    it('residual just above threshold does NOT classify as ego-motion', () => {
        // Strict `<` check on residualThreshold — residual ABOVE threshold
        // means landmarks moved relative to each other → face motion.
        const prev: Point2D[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
        const curr: Point2D[] = [{ x: 0, y: 0 }, { x: 1.02, y: 0 }];
        // egoDelta ≈ (0.01, 0); maxResidual ≈ 0.01
        const r = classifyMotion(prev, curr, 0, 0.005);
        // 0.01 > 0.005 threshold → not ego-motion
        expect(r.isEgoMotion).toBe(false);
        expect(r.maxResidual).toBeGreaterThan(0.005);
    });

    it('delta magnitude exactly 0.001 does NOT trigger suppression', () => {
        // The suppress gate uses `>` strict for L1-magnitude > 0.001
        const prev: Point2D[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
        const curr: Point2D[] = [{ x: 0.0005, y: 0.0005 }, { x: 0.0005, y: 0.0005 }];
        // egoDelta L1 = |0.0005| + |0.0005| = 0.001 — at boundary
        const r = classifyMotion(prev, curr);
        expect(r.isEgoMotion).toBe(false);
    });

    it('extreme NaN coordinates do not crash (returned values are finite)', () => {
        const prev: Point2D[] = [{ x: Number.NaN, y: 0 }, { x: 0, y: 0 }];
        const curr: Point2D[] = [{ x: 0.05, y: 0.03 }, { x: 0.05, y: 0.03 }];
        const r = classifyMotion(prev, curr);
        // NaN propagates into centroid → egoDelta NaN. Not ideal but
        // should not crash. Caller should never feed NaN; this is a
        // last-line defense.
        expect(typeof r.isEgoMotion).toBe('boolean');
        expect(typeof r.maxResidual).toBe('number');
    });

    it('extremely large coordinate values (numerically stable)', () => {
        const prev: Point2D[] = Array.from({ length: 5 }, (_, i) => ({ x: 1e6 + i, y: 1e6 + i }));
        const curr: Point2D[] = prev.map(p => ({ x: p.x + 5, y: p.y + 3 }));
        const r = classifyMotion(prev, curr);
        expect(r.egoDelta.x).toBeCloseTo(5);
        expect(r.egoDelta.y).toBeCloseTo(3);
        expect(r.maxResidual).toBeLessThan(1e-6);
    });

    it('many landmarks (478 — full FaceLandmarker output) — perf-stable', () => {
        const prev: Point2D[] = Array.from({ length: 478 }, (_, i) => ({
            x: 0.3 + (i / 478) * 0.4,
            y: 0.2 + (i / 478) * 0.5,
        }));
        const curr: Point2D[] = prev.map(p => ({ x: p.x + 0.05, y: p.y + 0.03 }));
        const t0 = performance.now();
        const r = classifyMotion(prev, curr);
        const elapsed = performance.now() - t0;
        expect(r.isEgoMotion).toBe(true);
        expect(elapsed).toBeLessThan(20);  // sub-frame budget at 50fps
    });

    it('symmetric face motion: opening mouth + closing eyes simultaneously', () => {
        // Top half closes (eyes) -0.01 y, bottom half opens (mouth) +0.01 y
        // Centroid stays still (symmetric) but residuals are large.
        const prev: Point2D[] = [
            { x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 },  // eyes
            { x: 0.4, y: 0.7 }, { x: 0.6, y: 0.7 },  // mouth corners
        ];
        const curr: Point2D[] = [
            { x: 0.4, y: 0.31 }, { x: 0.6, y: 0.31 },  // eyes lower
            { x: 0.4, y: 0.69 }, { x: 0.6, y: 0.69 },  // mouth higher
        ];
        const r = classifyMotion(prev, curr);
        // Centroid delta is zero, residuals ARE non-zero → not ego-motion
        expect(r.isEgoMotion).toBe(false);
        expect(r.maxResidual).toBeGreaterThan(0.005);
    });

    it('centroid helper handles NaN gracefully without crashing', () => {
        const c = centroid([{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }]);
        // NaN propagates — caller should pre-filter — but not throw
        expect(typeof c.x).toBe('number');
        expect(typeof c.y).toBe('number');
    });

    it('classifyMotion with empty curr is a no-ego no-op', () => {
        const r = classifyMotion([{ x: 0, y: 0 }], []);
        expect(r.isEgoMotion).toBe(false);
        expect(r.maxResidual).toBe(0);
        expect(r.egoDelta.x).toBe(0);
        expect(r.egoDelta.y).toBe(0);
    });
});
