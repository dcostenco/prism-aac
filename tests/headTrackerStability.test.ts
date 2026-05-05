/**
 * headTrackerStability — pure-logic primitives for drift detection,
 * confidence-weighted fusion, and post-disable reliability probe.
 *
 * The tests below pin the exact thresholds + edge cases that matter for
 * the "military-stable in a moving car" requirement (auto-disable on
 * runaway cursor, recover when face stability returns, weight bad
 * cameras to zero in fusion).
 */
import { describe, it, expect } from 'vitest';
import {
    DriftDetector,
    ReliabilityProbe,
    fuseWeighted,
} from '@/services/headTrackerStability';

describe('DriftDetector — cursor-drift trigger', () => {
    it('does not trigger before minSamples', () => {
        const d = new DriftDetector({ travelThresholdPx: 10, minSamples: 5 });
        // Push 4 samples that exceed travel threshold — still no trigger
        for (let i = 0; i < 4; i++) {
            d.push({ x: i * 100, y: 0, confidence: 1, timestamp: i * 100 });
        }
        expect(d.check()).toBeNull();
    });

    it('triggers cursor-drift when cumulative travel > threshold + no dwell', () => {
        const d = new DriftDetector({ travelThresholdPx: 800, windowMs: 5000, minSamples: 3 });
        const t0 = 1_000_000;
        for (let i = 0; i < 10; i++) {
            // Each step jumps 100px in x — 10 steps × 100 = 1000px travel
            d.push({ x: i * 100, y: 0, confidence: 0.9, timestamp: t0 + i * 100 });
        }
        expect(d.check()).toBe('cursor-drift');
    });

    it('does NOT trigger when user landed a dwell-click in the window', () => {
        const d = new DriftDetector({ travelThresholdPx: 800, windowMs: 5000, minSamples: 3 });
        const t0 = 1_000_000;
        // Push samples with high travel BUT one of them is a dwell hit
        for (let i = 0; i < 10; i++) {
            d.push({
                x: i * 100, y: 0, confidence: 0.9,
                timestamp: t0 + i * 100,
                dwellFired: i === 5,  // user landed a click mid-window
            });
        }
        expect(d.check()).toBeNull();
    });

    it('triggers confidence-collapse when avg confidence < floor', () => {
        const d = new DriftDetector({
            travelThresholdPx: 1_000_000,  // disable cursor-trigger
            confidenceFloor: 0.4,
            minSamples: 3,
            windowMs: 5000,
        });
        for (let i = 0; i < 10; i++) {
            d.push({ x: 0, y: 0, confidence: 0.2, timestamp: 1_000_000 + i * 100 });
        }
        expect(d.check()).toBe('confidence-collapse');
    });

    it('drops samples outside the rolling window', () => {
        const d = new DriftDetector({ travelThresholdPx: 800, windowMs: 1000, minSamples: 3 });
        const t0 = 1_000_000;
        // 5 old samples (outside window) at full velocity
        for (let i = 0; i < 5; i++) {
            d.push({ x: i * 200, y: 0, confidence: 0.9, timestamp: t0 + i * 100 });
        }
        // Then 3 fresh samples (inside window) low velocity
        for (let i = 0; i < 3; i++) {
            d.push({ x: 1000, y: 0, confidence: 0.9, timestamp: t0 + 2000 + i * 100 });
        }
        // Old samples should be evicted; fresh samples have ~0 travel → no trigger
        expect(d.check()).toBeNull();
    });

    it('reset() clears state', () => {
        const d = new DriftDetector({ travelThresholdPx: 100, minSamples: 2 });
        d.push({ x: 0, y: 0, confidence: 0.9, timestamp: 0 });
        d.push({ x: 500, y: 0, confidence: 0.9, timestamp: 100 });
        expect(d.check()).toBe('cursor-drift');
        d.reset();
        expect(d.check()).toBeNull();
    });
});

describe('ReliabilityProbe — auto-recover after drift', () => {
    it('returns true after recoverFrames consecutive stable frames', () => {
        const p = new ReliabilityProbe({ recoverFrames: 5, stableConfidenceFloor: 0.7 });
        for (let i = 0; i < 4; i++) {
            expect(p.push(0.9)).toBe(false);
        }
        expect(p.push(0.9)).toBe(true);  // 5th frame trips it
    });

    it('resets streak on a single bad frame', () => {
        const p = new ReliabilityProbe({ recoverFrames: 3 });
        p.push(0.9); p.push(0.9);
        p.push(0.2);  // bad frame — resets streak
        expect(p.push(0.9)).toBe(false);
        expect(p.push(0.9)).toBe(false);
        expect(p.push(0.9)).toBe(true);  // 3 consecutive after reset
    });

    it('exposes currentStreak for progress UI', () => {
        const p = new ReliabilityProbe({ recoverFrames: 10 });
        p.push(0.9); p.push(0.9); p.push(0.9);
        expect(p.currentStreak).toBe(3);
    });
});

describe('fuseWeighted — confidence-weighted multi-camera fusion', () => {
    it('weights high-confidence camera over low-confidence', () => {
        const r = fuseWeighted([
            { normX: 0.0, normY: 0.0, confidence: 0.95 },
            { normX: 1.0, normY: 1.0, confidence: 0.10 },
        ]);
        // Should be dominated by the 0.95-confidence camera (≈0)
        expect(r).not.toBeNull();
        expect(r!.normX).toBeLessThan(0.15);
        expect(r!.normY).toBeLessThan(0.15);
    });

    it('returns null when total weight is too low', () => {
        const r = fuseWeighted([
            { normX: 0.5, normY: 0.5, confidence: 0.05 },
            { normX: 0.5, normY: 0.5, confidence: 0.05 },
        ], 0.3);
        expect(r).toBeNull();
    });

    it('skips zero-confidence cameras (bad camera does not poison)', () => {
        // Naive average would give (0+1)/2 = 0.5. Weighted should be 0.
        const r = fuseWeighted([
            { normX: 0.0, normY: 0.0, confidence: 0.9 },
            { normX: 1.0, normY: 1.0, confidence: 0.0 },  // dead camera
        ]);
        expect(r).not.toBeNull();
        expect(r!.normX).toBe(0.0);
        expect(r!.normY).toBe(0.0);
    });

    it('equal-confidence cameras average normally', () => {
        const r = fuseWeighted([
            { normX: 0.0, normY: 0.0, confidence: 0.8 },
            { normX: 1.0, normY: 1.0, confidence: 0.8 },
        ]);
        expect(r!.normX).toBeCloseTo(0.5);
        expect(r!.normY).toBeCloseTo(0.5);
    });
});
