import { describe, it, expect } from 'vitest';
import {
    BaselineTracker,
    alphaFromHalfLife,
    recordAnchor,
} from '@/services/recalibration';

describe('alphaFromHalfLife — pure decay coefficient', () => {
    it('alpha = 0.5 when dt equals half-life', () => {
        expect(alphaFromHalfLife(1000, 1000)).toBeCloseTo(0.5);
    });

    it('alpha approaches 1 for large dt', () => {
        expect(alphaFromHalfLife(1000, 100_000)).toBeCloseTo(1);
    });

    it('alpha approaches 0 for tiny dt', () => {
        expect(alphaFromHalfLife(60_000, 1)).toBeLessThan(0.01);
    });

    it('zero or negative half-life gives alpha=1 (no smoothing)', () => {
        expect(alphaFromHalfLife(0, 100)).toBe(1);
        expect(alphaFromHalfLife(-100, 100)).toBe(1);
    });

    it('zero or negative dt gives alpha=0 (no update)', () => {
        expect(alphaFromHalfLife(1000, 0)).toBe(0);
        expect(alphaFromHalfLife(1000, -100)).toBe(0);
    });

    it('NaN inputs are handled defensively', () => {
        expect(alphaFromHalfLife(Number.NaN, 100)).toBe(1);
        expect(alphaFromHalfLife(1000, Number.NaN)).toBe(0);
    });
});

describe('BaselineTracker — startup behavior', () => {
    it('first sample seeds the mean and locks no baseline yet', () => {
        const t = new BaselineTracker();
        const r = t.push({ normX: 0.5, normY: 0.4, timestamp: 0 });
        expect(r.meanX).toBe(0.5);
        expect(r.meanY).toBe(0.4);
        expect(t.snapshot.baselineLocked).toBe(false);
    });

    it('does not suggest a correction during warmup', () => {
        const t = new BaselineTracker({ minWarmupMs: 30_000 });
        for (let i = 0; i < 100; i++) {
            t.push({ normX: 0.7, normY: 0.5, timestamp: i * 100 });  // 10s total
        }
        expect(t.suggestCorrection(10_000)).toBeNull();
    });

    it('locks baseline after warmup elapses', () => {
        const t = new BaselineTracker({ minWarmupMs: 5000 });
        for (let i = 0; i < 100; i++) {
            t.push({ normX: 0.5, normY: 0.5, timestamp: i * 100 });  // 10s
        }
        expect(t.snapshot.baselineLocked).toBe(true);
    });
});

describe('BaselineTracker — offset drift', () => {
    it('detects a sustained center shift after warmup + cooldown', () => {
        const t = new BaselineTracker({
            minWarmupMs: 1000,
            offsetThreshold: 0.05,
            meanHalfLifeMs: 500,
        });
        // Warmup at center
        for (let i = 0; i < 50; i++) {
            t.push({ normX: 0.5, normY: 0.5, timestamp: i * 50 });  // 2.5s
        }
        // Now user shifts left consistently
        for (let i = 0; i < 50; i++) {
            t.push({ normX: 0.35, normY: 0.5, timestamp: 2500 + i * 50 });
        }
        // Need to be past minWarmupMs from baselineLockedAt to suggest correction
        const c = t.suggestCorrection(10_000);
        expect(c?.kind).toBe('offset');
        if (c?.kind === 'offset') {
            expect(c.deltaNormX).toBeLessThan(-0.05);
            expect(Math.abs(c.deltaNormY)).toBeLessThan(0.05);
        }
    });

    it('does not suggest correction if drift stays under threshold', () => {
        const t = new BaselineTracker({
            minWarmupMs: 1000,
            offsetThreshold: 0.1,
        });
        for (let i = 0; i < 50; i++) t.push({ normX: 0.5, normY: 0.5, timestamp: i * 50 });
        // Tiny drift only
        for (let i = 0; i < 50; i++) t.push({ normX: 0.52, normY: 0.5, timestamp: 2500 + i * 50 });
        expect(t.suggestCorrection(10_000)).toBeNull();
    });

    it('acceptCorrection clears the suggestion (one-shot)', () => {
        const t = new BaselineTracker({
            minWarmupMs: 500,
            offsetThreshold: 0.05,
            meanHalfLifeMs: 500,
        });
        for (let i = 0; i < 30; i++) t.push({ normX: 0.5, normY: 0.5, timestamp: i * 50 });
        for (let i = 0; i < 30; i++) t.push({ normX: 0.35, normY: 0.5, timestamp: 1500 + i * 50 });
        expect(t.suggestCorrection(10_000)?.kind).toBe('offset');
        t.acceptCorrection(10_000);
        // Right after accept, baseline equals current mean → no correction
        expect(t.suggestCorrection(10_000)).toBeNull();
    });

    it('reset() clears the baseline lock', () => {
        const t = new BaselineTracker({ minWarmupMs: 500 });
        for (let i = 0; i < 30; i++) t.push({ normX: 0.5, normY: 0.5, timestamp: i * 50 });
        expect(t.snapshot.baselineLocked).toBe(true);
        t.reset();
        expect(t.snapshot.baselineLocked).toBe(false);
        expect(t.snapshot.samples).toBe(0);
    });
});

describe('BaselineTracker — scale drift', () => {
    it('detects when variance shrinks (user moved closer)', () => {
        // For variance to be a useful signal, we need warmup to span at
        // least 5 variance-half-lives so the baseline reflects settled
        // motion noise — otherwise baselineVar is captured too early.
        const t = new BaselineTracker({
            minWarmupMs: 3000,
            offsetThreshold: 0.5,  // disable offset trigger
            varianceHalfLifeMs: 500,
            shrinkThreshold: 0.7,
        });
        // Phase 1 — wide range of motion (sin oscillation ±0.1) for 5s
        // so variance has time to fully settle before baseline locks.
        for (let i = 0; i < 100; i++) {
            t.push({
                normX: 0.5 + Math.sin(i) * 0.1,
                normY: 0.5 + Math.cos(i) * 0.1,
                timestamp: i * 50,  // 5000ms total
            });
        }
        // Phase 2 — much smaller range (closer to camera) for another 8s
        for (let i = 0; i < 160; i++) {
            t.push({
                normX: 0.5 + Math.sin(i) * 0.02,
                normY: 0.5 + Math.cos(i) * 0.02,
                timestamp: 5000 + i * 50,
            });
        }
        const c = t.suggestCorrection(20_000);
        expect(c?.kind).toBe('scale');
        if (c?.kind === 'scale') {
            expect(c.scaleX).toBeLessThan(0.7);
            expect(c.scaleY).toBeLessThan(0.7);
        }
    });

    it('shrinkThreshold=0 disables scale corrections', () => {
        const t = new BaselineTracker({
            minWarmupMs: 500,
            offsetThreshold: 0.5,
            shrinkThreshold: 0,
        });
        for (let i = 0; i < 50; i++) {
            t.push({ normX: 0.5 + Math.sin(i) * 0.1, normY: 0.5, timestamp: i * 100 });
        }
        for (let i = 0; i < 80; i++) {
            t.push({ normX: 0.5, normY: 0.5, timestamp: 5000 + i * 100 });
        }
        expect(t.suggestCorrection(20_000)).toBeNull();
    });
});

describe('recordAnchor — stateless ground-truth helper', () => {
    it('returns the input wrapped as an AnchorCorrection', () => {
        const c = recordAnchor({
            cursorNormX: 0.45,
            cursorNormY: 0.6,
            targetNormX: 0.5,
            targetNormY: 0.55,
        });
        expect(c.kind).toBe('anchor');
        expect(c.cursorNormX).toBe(0.45);
        expect(c.cursorNormY).toBe(0.6);
        expect(c.targetNormX).toBe(0.5);
        expect(c.targetNormY).toBe(0.55);
    });
});

describe('BaselineTracker — military hardening: adversarial inputs', () => {
    it('rejects NaN samples without polluting state', () => {
        const t = new BaselineTracker();
        t.push({ normX: 0.5, normY: 0.5, timestamp: 0 });
        const before = t.snapshot;
        t.push({ normX: Number.NaN, normY: 0.5, timestamp: 100 });
        t.push({ normX: 0.5, normY: Number.NaN, timestamp: 200 });
        t.push({ normX: 0.5, normY: 0.5, timestamp: Number.NaN });
        // Mean / samples should match the pre-NaN state
        const after = t.snapshot;
        expect(after.meanX).toBe(before.meanX);
        expect(after.meanY).toBe(before.meanY);
        expect(after.samples).toBe(before.samples);
    });

    it('survives 10000 samples without overflow', () => {
        const t = new BaselineTracker({ minWarmupMs: 100 });
        for (let i = 0; i < 10000; i++) {
            t.push({
                normX: 0.5 + (Math.random() - 0.5) * 0.1,
                normY: 0.5 + (Math.random() - 0.5) * 0.1,
                timestamp: i * 33,  // ~30fps
            });
        }
        const s = t.snapshot;
        expect(Number.isFinite(s.meanX)).toBe(true);
        expect(Number.isFinite(s.meanY)).toBe(true);
        expect(Number.isFinite(s.varX)).toBe(true);
        expect(Number.isFinite(s.varY)).toBe(true);
        expect(s.samples).toBe(10000);
    });

    it('out-of-order timestamps do not crash (dt clamped to 1)', () => {
        const t = new BaselineTracker({ minWarmupMs: 100 });
        t.push({ normX: 0.5, normY: 0.5, timestamp: 1000 });
        // Time goes backward — common with system clock adjustments
        expect(() => t.push({ normX: 0.5, normY: 0.5, timestamp: 500 })).not.toThrow();
        expect(Number.isFinite(t.snapshot.meanX)).toBe(true);
    });

    it('repeated identical timestamps are treated as dt=1', () => {
        const t = new BaselineTracker({ minWarmupMs: 100 });
        for (let i = 0; i < 10; i++) {
            t.push({ normX: 0.5, normY: 0.5, timestamp: 0 });
        }
        // 9 effective updates with dt=1 each — some smoothing
        expect(Number.isFinite(t.snapshot.meanX)).toBe(true);
        expect(t.snapshot.samples).toBe(10);
    });

    it('extreme normX (negative or > 1) does not crash', () => {
        const t = new BaselineTracker({ minWarmupMs: 100 });
        t.push({ normX: -5, normY: 10, timestamp: 0 });
        t.push({ normX: 1e9, normY: -1e9, timestamp: 100 });
        expect(Number.isFinite(t.snapshot.meanX)).toBe(true);
        expect(Number.isFinite(t.snapshot.meanY)).toBe(true);
    });

    it('suggestCorrection before any push returns null', () => {
        const t = new BaselineTracker();
        expect(t.suggestCorrection(10_000)).toBeNull();
    });

    it('suggestCorrection right at warmup edge is null (strict <)', () => {
        const t = new BaselineTracker({ minWarmupMs: 1000 });
        // Push enough samples to lock baseline at t=1000, then check
        // suggestCorrection at exactly t=1000+1000 (= minWarmupMs after lock).
        for (let i = 0; i <= 20; i++) {
            t.push({ normX: 0.3, normY: 0.5, timestamp: i * 50 });  // 0..1000
        }
        // baselineLockedAt should be 1000. now - lockedAt = 999 < minWarmup
        const c = t.suggestCorrection(1999);
        expect(c).toBeNull();
        // At exactly minWarmupMs after lock, still null per strict <
        const c2 = t.suggestCorrection(2000);
        expect(c2).toBeNull();
        // Just past, no offset (mean == baseline) → null
        const c3 = t.suggestCorrection(2001);
        expect(c3).toBeNull();
    });

    it('after acceptCorrection, suggestion follows new baseline', () => {
        const t = new BaselineTracker({
            minWarmupMs: 500,
            offsetThreshold: 0.05,
            meanHalfLifeMs: 500,
        });
        for (let i = 0; i < 30; i++) t.push({ normX: 0.5, normY: 0.5, timestamp: i * 50 });
        for (let i = 0; i < 30; i++) t.push({ normX: 0.35, normY: 0.5, timestamp: 1500 + i * 50 });
        expect(t.suggestCorrection(10_000)?.kind).toBe('offset');
        t.acceptCorrection(10_000);
        // Drift even further left
        for (let i = 0; i < 30; i++) t.push({ normX: 0.20, normY: 0.5, timestamp: 11_000 + i * 50 });
        const c = t.suggestCorrection(20_000);
        expect(c?.kind).toBe('offset');
        if (c?.kind === 'offset') {
            // Should reflect the NEW drift relative to the post-accept baseline
            expect(c.deltaNormX).toBeLessThan(-0.05);
        }
    });
});
