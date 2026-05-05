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
