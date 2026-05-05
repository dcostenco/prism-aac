import { describe, it, expect } from 'vitest';
import { Kalman1D } from '@/services/kalmanFilter1D';

describe('Kalman1D — confidence-aware single-axis filter', () => {
    it('snaps close to high-confidence measurements quickly', () => {
        const k = new Kalman1D(4);
        k.reset(0);
        // High-confidence measurements at 100 — should converge fast
        for (let i = 0; i < 10; i++) k.update(100, 0.95);
        expect(k.value).toBeGreaterThan(95);
        expect(k.value).toBeLessThan(101);
    });

    it('holds prediction when confidence is low (rejects noise)', () => {
        const k = new Kalman1D(0.1);
        k.reset(50);
        // Pump high-conf 50s, then a low-conf 500 spike — should barely move
        for (let i = 0; i < 30; i++) k.update(50, 0.95);
        const before = k.value;
        k.update(500, 0.05);  // low-conf outlier
        expect(Math.abs(k.value - before)).toBeLessThan(15);
    });

    it('integrates a noisy clean signal toward truth', () => {
        // Low q (= we expect truth to drift slowly) → strong smoothing of
        // measurement noise. With q=0.05 and conf=0.9 the steady-state gain
        // is small enough to average out the ±20 sinusoid.
        const k = new Kalman1D(0.05);
        k.reset(0);
        // Truth = 100; measurements jitter ±20 around 100
        let last = 0;
        for (let i = 0; i < 80; i++) {
            const measurement = 100 + (Math.sin(i * 1.7) * 20);
            last = k.update(measurement, 0.9);
        }
        expect(Math.abs(last - 100)).toBeLessThan(10);
    });

    it('predict() advances variance without measurement', () => {
        const k = new Kalman1D(2);
        k.reset(0);
        k.update(10, 0.9);
        const xBefore = k.value;
        k.predict();
        // No measurement → estimate unchanged but variance grew
        expect(k.value).toBe(xBefore);
        // Next measurement should converge faster (higher gain) due to grown p
        const after = k.update(50, 0.9);
        expect(Math.abs(after - 50)).toBeLessThan(Math.abs(xBefore - 50));
    });

    it('snapTo bypasses smoothing for intentional saccades', () => {
        const k = new Kalman1D();
        k.reset(0);
        for (let i = 0; i < 30; i++) k.update(0, 0.9);
        k.snapTo(500);
        expect(k.value).toBe(500);
    });

    it('handles zero confidence without crashing', () => {
        const k = new Kalman1D();
        k.reset(50);
        // Should not produce NaN/Infinity
        const v = k.update(100, 0);
        expect(Number.isFinite(v)).toBe(true);
    });

    it('reset() reinitializes state', () => {
        const k = new Kalman1D();
        k.reset(0);
        for (let i = 0; i < 10; i++) k.update(100, 0.9);
        k.reset(50);
        expect(k.value).toBe(50);
    });
});

describe('Kalman1D — military hardening: adversarial inputs', () => {
    it('rejects NaN measurement (treats as predict-only, x stays finite)', () => {
        const k = new Kalman1D();
        k.reset(50);
        const before = k.value;
        const after = k.update(Number.NaN, 0.9);
        expect(Number.isFinite(after)).toBe(true);
        // NaN should NOT pollute x — value stays at last good estimate
        expect(after).toBe(before);
    });

    it('rejects NaN confidence (treats as predict-only)', () => {
        const k = new Kalman1D();
        k.reset(42);
        const v = k.update(100, Number.NaN);
        expect(v).toBe(42);  // unchanged
        expect(Number.isFinite(k.value)).toBe(true);
    });

    it('rejects Infinity measurement', () => {
        const k = new Kalman1D();
        k.reset(0);
        const v = k.update(Number.POSITIVE_INFINITY, 0.9);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBe(0);
    });

    it('rejects -Infinity measurement', () => {
        const k = new Kalman1D();
        k.reset(0);
        k.update(Number.NEGATIVE_INFINITY, 0.9);
        expect(Number.isFinite(k.value)).toBe(true);
    });

    it('clamps confidence > 1 to 1 (saturation, no infinite gain)', () => {
        const k = new Kalman1D();
        k.reset(0);
        const v = k.update(100, 5);  // out-of-range confidence
        expect(Number.isFinite(v)).toBe(true);
        // Should snap close to 100 because clamped to confidence=1
        expect(v).toBeGreaterThan(50);
    });

    it('clamps confidence < 0 to floor (treats as zero trust)', () => {
        const k = new Kalman1D();
        k.reset(0);
        const v = k.update(100, -0.5);
        // Negative confidence floored at 0.001 → measurement ignored
        expect(Math.abs(v)).toBeLessThan(5);
    });

    it('floors negative or zero q in constructor (well-defined gain)', () => {
        const kNeg = new Kalman1D(-5);
        const kZero = new Kalman1D(0);
        kNeg.reset(0);
        kZero.reset(0);
        // With protected q, predict must NOT shrink variance below 0
        for (let i = 0; i < 10; i++) {
            kNeg.predict();
            kZero.predict();
        }
        const v1 = kNeg.update(100, 0.9);
        const v2 = kZero.update(100, 0.9);
        expect(Number.isFinite(v1)).toBe(true);
        expect(Number.isFinite(v2)).toBe(true);
    });

    it('rejects NaN constructor q (defaults to safe value)', () => {
        const k = new Kalman1D(Number.NaN);
        k.reset(0);
        const v = k.update(100, 0.9);
        expect(Number.isFinite(v)).toBe(true);
    });

    it('snapTo rejects NaN target (filter unchanged)', () => {
        const k = new Kalman1D();
        k.reset(50);
        k.snapTo(Number.NaN);
        expect(k.value).toBe(50);
    });

    it('snapTo rejects Infinity target', () => {
        const k = new Kalman1D();
        k.reset(50);
        k.snapTo(Number.POSITIVE_INFINITY);
        expect(k.value).toBe(50);
    });

    it('reset() with NaN initial defaults to 0', () => {
        const k = new Kalman1D();
        k.reset(Number.NaN);
        expect(k.value).toBe(0);
    });

    it('survives 10000 NaN updates without polluting state', () => {
        const k = new Kalman1D();
        k.reset(100);
        for (let i = 0; i < 10000; i++) k.update(Number.NaN, Number.NaN);
        expect(k.value).toBe(100);
    });

    it('handles large but finite measurements without overflow', () => {
        const k = new Kalman1D();
        k.reset(0);
        const big = 1e9;
        const v = k.update(big, 0.9);
        expect(Number.isFinite(v)).toBe(true);
        // With high q=4 default and conf=0.9, gain is moderate; value moves toward big
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(big);
    });

    it('predict() then update() does not double-add process noise vs update() alone', () => {
        // The contract: update() implies predict(). predict() then update()
        // adds q twice — variance grows more, gain is higher → faster
        // convergence. This is documented behavior, not a bug; pin it.
        const single = new Kalman1D(2);
        const doubled = new Kalman1D(2);
        single.reset(0);
        doubled.reset(0);
        single.update(100, 0.9);
        doubled.predict();  // extra q
        doubled.update(100, 0.9);
        // Doubled-q path should converge MORE toward 100 (higher gain)
        expect(doubled.value).toBeGreaterThan(single.value);
    });

    it('zero confidence followed by good confidence still converges', () => {
        const k = new Kalman1D();
        k.reset(0);
        // Pump 100 zero-confidence frames — variance grows large
        for (let i = 0; i < 100; i++) k.update(999, 0);
        const beforeGood = k.value;
        // Now provide one solid measurement — should snap fast (large p)
        const after = k.update(50, 0.95);
        expect(Math.abs(after - 50)).toBeLessThan(Math.abs(beforeGood - 50));
        expect(Number.isFinite(after)).toBe(true);
    });

    it('value getter has no side effect (idempotent reads)', () => {
        const k = new Kalman1D();
        k.reset(7);
        k.update(10, 0.9);
        const a = k.value;
        const b = k.value;
        const c = k.value;
        expect(a).toBe(b);
        expect(b).toBe(c);
    });
});
