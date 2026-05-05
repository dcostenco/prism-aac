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
