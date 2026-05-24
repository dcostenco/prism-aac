/**
 * Body Pose Service — precision math tests
 *
 * bodyPoseService.ts has zero test coverage despite being the critical path
 * for children with severe motor disabilities who rely on pose tracking to
 * control AAC. This file pins the pure calibration math without requiring
 * MediaPipe WASM.
 *
 * Functions tested here were designed to be isolated (no browser APIs,
 * no MediaPipe, no camera) — the comments in bodyPoseService.ts explicitly
 * say so ("Extracted from startPoseTracker so the math can be unit-tested
 * without booting MediaPipe").
 */

import { describe, it, expect, vi } from 'vitest';

// Heavy infrastructure mocks — none of the pure functions under test use
// these, but importing bodyPoseService at module level would otherwise
// trigger cameraStream / mediapipeRuntime side-effect imports.
vi.mock('@/services/cameraStream', () => ({
    acquireCamera: vi.fn().mockResolvedValue({ release: vi.fn() }),
}));
vi.mock('@/services/mediapipeRuntime', () => ({
    MEDIAPIPE_TASKS_VISION_VERSION: '0.10.35',
    MEDIAPIPE_WASM_URL: 'https://cdn.test/wasm',
    POSE_LANDMARKER_LITE_URL: 'https://cdn.test/pose.task',
    FACE_LANDMARKER_URL: 'https://cdn.test/face.task',
    FACE_DETECTOR_URL: 'https://cdn.test/detector.tflite',
    HAND_LANDMARKER_URL: 'https://cdn.test/hand.task',
    FpsWatchdog: vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        fps: vi.fn().mockReturnValue(30),
    })),
}));
vi.mock('@/services/oneEuroFilter', () => ({
    ConfidenceAwareOneEuro: vi.fn().mockImplementation(() => ({
        filter: vi.fn((x: number) => x),
        reset: vi.fn(),
    })),
}));
vi.mock('@/services/egoMotion', () => ({
    classifyMotion: vi.fn().mockReturnValue('stationary'),
    fitSimilarityRansac: vi.fn().mockReturnValue(null),
    applyTransform: vi.fn((p: unknown) => p),
    IDENTITY_TRANSFORM: { scale: 1, angle: 0, tx: 0, ty: 0 },
}));
vi.mock('@/services/recalibration', () => ({
    BaselineTracker: vi.fn().mockImplementation(() => ({
        update: vi.fn(),
        baseline: vi.fn().mockReturnValue(null),
    })),
}));
vi.mock('@/services/wizardCalibration', () => ({
    isCalibrationUsable: vi.fn().mockReturnValue(true),
}));

import {
    mapPoseToScreen,
    computeCalibrationFromCorners,
    OnlineCalibrationLearner,
    DEFAULT_CALIBRATION,
    type PoseCalibrationData,
} from '@/services/bodyPoseService';

// ── mapPoseToScreen ──────────────────────────────────────────────────────────

describe('mapPoseToScreen — coordinate transform math', () => {
    const W = 1920;
    const H = 1080;
    const SENS = 1.0; // sensitivity 1.0 = identity scaling around center

    it('front camera: normX=0 (left edge of camera image) maps to right edge of screen', () => {
        // Front camera mirrors X. Camera's far-left → screen's far-right.
        const { x } = mapPoseToScreen(0.0, 0.5, DEFAULT_CALIBRATION, SENS, W, H);
        // mirroredX = 1.0; calibration range clamps to screenW
        expect(x).toBe(W);
    });

    it('front camera: normX=1 (right edge of camera image) maps to left edge of screen', () => {
        const { x } = mapPoseToScreen(1.0, 0.5, DEFAULT_CALIBRATION, SENS, W, H);
        // mirroredX = 0.0; maps to < rightX boundary → clamped to 0
        expect(x).toBe(0);
    });

    it('midpoint normX=0.5 maps to a plausible center-right position', () => {
        // DEFAULT_CALIBRATION: leftX=0.75, rightX=0.05 → mirroredX=0.5 is roughly center
        const { x, rangeOK } = mapPoseToScreen(0.5, 0.5, DEFAULT_CALIBRATION, SENS, W, H);
        expect(rangeOK).toBe(true);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThanOrEqual(W);
    });

    it('normY=0 maps to y=0 (top of screen)', () => {
        // topY=0.2: normY=0 is above the calibration range → clamps to 0
        const { y } = mapPoseToScreen(0.5, 0.0, DEFAULT_CALIBRATION, SENS, W, H);
        expect(y).toBe(0);
    });

    it('normY=1 maps to y=screenH (bottom of screen)', () => {
        // bottomY=0.8: normY=1 is below calibration range → clamps to screenH
        const { y } = mapPoseToScreen(0.5, 1.0, DEFAULT_CALIBRATION, SENS, W, H);
        expect(y).toBe(H);
    });

    it('vertical midpoint (normY matching topY + rangeY/2) maps to screenH/2', () => {
        // midY = 0.2 + (0.8 - 0.2) / 2 = 0.5
        const { y } = mapPoseToScreen(0.5, 0.5, DEFAULT_CALIBRATION, SENS, W, H);
        expect(y).toBeCloseTo(H / 2, 0);
    });

    it('sensitivity=2.0 amplifies distance from center', () => {
        const { x: x1 } = mapPoseToScreen(0.5, 0.5, DEFAULT_CALIBRATION, 1.0, W, H);
        const { x: x2 } = mapPoseToScreen(0.5, 0.5, DEFAULT_CALIBRATION, 2.0, W, H);
        // x1 is already > center, so x2 should be further from center (clamped to W)
        // or at minimum as far. With DEFAULT_CALIBRATION midpoint > center, x2 >= x1.
        expect(Math.abs(x2 - W / 2)).toBeGreaterThanOrEqual(Math.abs(x1 - W / 2));
    });

    it('REGRESSION: degenerate calibration (rangeX < 0.02) falls back to DEFAULT_CALIBRATION', () => {
        const degenerate: PoseCalibrationData = {
            leftX: 0.5,
            rightX: 0.5, // rangeX = 0
            topY: 0.2,
            bottomY: 0.8,
        };
        const { rangeOK } = mapPoseToScreen(0.5, 0.5, degenerate, SENS, W, H);
        expect(rangeOK).toBe(false);
        // Falls back to DEFAULT_CALIBRATION — must not crash or return NaN
        const { x, y } = mapPoseToScreen(0.5, 0.5, degenerate, SENS, W, H);
        expect(isNaN(x)).toBe(false);
        expect(isNaN(y)).toBe(false);
    });

    it('REGRESSION: degenerate calibration (rangeY < 0.02) falls back to DEFAULT_CALIBRATION', () => {
        const degenerate: PoseCalibrationData = {
            leftX: 0.75,
            rightX: 0.05,
            topY: 0.5,
            bottomY: 0.5, // rangeY = 0
        };
        const { rangeOK, x, y } = mapPoseToScreen(0.5, 0.5, degenerate, SENS, W, H);
        expect(rangeOK).toBe(false);
        expect(isNaN(x)).toBe(false);
        expect(isNaN(y)).toBe(false);
    });

    it('output is always clamped to [0, screenW] × [0, screenH]', () => {
        // Extreme inputs outside calibration range must clamp, never overflow.
        const extremes = [
            { nx: 0, ny: 0 }, { nx: 1, ny: 0 },
            { nx: 0, ny: 1 }, { nx: 1, ny: 1 },
            { nx: -0.5, ny: 1.5 },
        ];
        for (const { nx, ny } of extremes) {
            const { x, y } = mapPoseToScreen(nx, ny, DEFAULT_CALIBRATION, SENS, W, H);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(W);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(H);
        }
    });
});

// ── computeCalibrationFromCorners ────────────────────────────────────────────

describe('computeCalibrationFromCorners — 4-corner wizard math', () => {
    it('produces correct leftX/rightX/topY/bottomY from symmetric square corners', () => {
        // Corner order: TL, TR, BR, BL (TrackingSetupWizard convention)
        // pose-space:   {x:0.1,y:0.1}  {x:0.9,y:0.1}  {x:0.9,y:0.9}  {x:0.1,y:0.9}
        // mirroredX:    0.9             0.1             0.1             0.9
        const result = computeCalibrationFromCorners([
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.9 },
            { x: 0.1, y: 0.9 },
        ]);
        expect(result.leftX).toBeCloseTo(0.9);
        expect(result.rightX).toBeCloseTo(0.1);
        expect(result.topY).toBeCloseTo(0.1);
        expect(result.bottomY).toBeCloseTo(0.9);
    });

    it('ordering is robust — noisy corners produce correct max/min bounds', () => {
        // Corners delivered out of order with slight noise
        const result = computeCalibrationFromCorners([
            { x: 0.88, y: 0.08 }, // TR-ish
            { x: 0.12, y: 0.92 }, // BL-ish
            { x: 0.11, y: 0.09 }, // TL-ish
            { x: 0.89, y: 0.91 }, // BR-ish
        ]);
        // mirroredX values: 0.12, 0.88, 0.89, 0.11
        expect(result.leftX).toBeCloseTo(Math.max(0.12, 0.88, 0.89, 0.11), 2);
        expect(result.rightX).toBeCloseTo(Math.min(0.12, 0.88, 0.89, 0.11), 2);
        expect(result.topY).toBeCloseTo(Math.min(0.08, 0.92, 0.09, 0.91), 2);
        expect(result.bottomY).toBeCloseTo(Math.max(0.08, 0.92, 0.09, 0.91), 2);
    });

    it('throws a descriptive error when fewer than 4 samples are provided', () => {
        expect(() => computeCalibrationFromCorners([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }]))
            .toThrow('expected exactly 4 corner samples');
    });

    it('throws a descriptive error when more than 4 samples are provided', () => {
        expect(() => computeCalibrationFromCorners([
            { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.5 },
        ])).toThrow('expected exactly 4 corner samples');
    });
});

// ── OnlineCalibrationLearner ─────────────────────────────────────────────────

describe('OnlineCalibrationLearner — adaptive no-wizard calibration', () => {
    // The learner observes the user's real motion range and emits calibration
    // automatically — critical for users who cannot complete the 4-corner wizard.

    it('returns null from maybeEmitCalibration until MIN_SAMPLES are accumulated', () => {
        const learner = new OnlineCalibrationLearner({ minSamples: 10, updateEvery: 10 });
        for (let i = 0; i < 9; i++) {
            learner.push(0.2 + i * 0.05, 0.3 + i * 0.05);
        }
        expect(learner.maybeEmitCalibration()).toBeNull();
        expect(learner.size()).toBe(9);
    });

    it('emits a non-null calibration once MIN_SAMPLES reached and UPDATE_EVERY aligns', () => {
        const learner = new OnlineCalibrationLearner({ minSamples: 10, updateEvery: 10 });
        for (let i = 0; i < 10; i++) {
            learner.push(0.1 + i * 0.08, 0.2 + i * 0.06);
        }
        // frameCount=10, 10 % 10 = 0 → emit
        const cal = learner.maybeEmitCalibration();
        expect(cal).not.toBeNull();
        expect(cal!.leftX).toBeGreaterThan(cal!.rightX);
        expect(cal!.bottomY).toBeGreaterThan(cal!.topY);
    });

    it('snapshot() bypasses the UPDATE_EVERY gate and returns calibration on demand', () => {
        const learner = new OnlineCalibrationLearner({ minSamples: 5, updateEvery: 100 });
        for (let i = 0; i < 10; i++) {
            learner.push(0.2 + i * 0.05, 0.3 + i * 0.04);
        }
        // frameCount=10, 10 % 100 ≠ 0 → maybeEmit returns null
        expect(learner.maybeEmitCalibration()).toBeNull();
        // but snapshot() bypasses the gate
        expect(learner.snapshot()).not.toBeNull();
    });

    it('uses 5th/95th percentile so outlier samples do not corrupt calibration', () => {
        // With 100+ samples, loIdx=5 and hiIdx=94 — the extreme outliers at index 0
        // and 99 are trimmed, so they cannot set the calibration bounds.
        // (With only 20 samples, loIdx=1 and hiIdx=19 → outliers still included.)
        const learner = new OnlineCalibrationLearner({ minSamples: 100, updateEvery: 100 });
        // 100 normal mirroredX samples in a tight band [0.30, 0.70]
        for (let i = 0; i < 100; i++) {
            learner.push(0.30 + (i / 99) * 0.40, 0.20 + (i / 99) * 0.40);
        }
        // 2 extreme outliers appended (buffer at 102 → trims 2 oldest normal samples)
        learner.push(0.0, 0.0);
        learner.push(1.0, 1.0);
        const cal = learner.snapshot()!;
        // After 5th/95th percentile trimming, extreme outliers at 0.0 and 1.0
        // must not become the calibration bounds.
        expect(cal.leftX).toBeLessThan(0.99);
        expect(cal.rightX).toBeGreaterThan(0.01);
    });

    it('REGRESSION: buffer overflow — size() never exceeds maxSamples', () => {
        const learner = new OnlineCalibrationLearner({ maxSamples: 20 });
        for (let i = 0; i < 50; i++) {
            learner.push(0.5, 0.5);
        }
        expect(learner.size()).toBe(20);
    });

    it('reset() clears buffer and frame counter', () => {
        const learner = new OnlineCalibrationLearner({ minSamples: 5 });
        for (let i = 0; i < 10; i++) learner.push(0.5, 0.5);
        learner.reset();
        expect(learner.size()).toBe(0);
        expect(learner.snapshot()).toBeNull();
        // After reset, pushing less than minSamples returns null again
        learner.push(0.5, 0.5);
        expect(learner.maybeEmitCalibration()).toBeNull();
    });

    it('calibration leftX > rightX (convention: left = higher mirroredX)', () => {
        // For a typical user moving left↔right:
        // far-left camera pose → mirroredX near 1.0 = left side of screen (leftX)
        // far-right camera pose → mirroredX near 0.0 = right side of screen (rightX)
        const learner = new OnlineCalibrationLearner({ minSamples: 10, updateEvery: 10 });
        // push samples spanning a reasonable range (0.2 .. 0.9 mirroredX)
        for (let i = 0; i < 10; i++) {
            learner.push(0.1 + i * 0.08, 0.2 + i * 0.05);
        }
        const cal = learner.snapshot()!;
        expect(cal!.leftX).toBeGreaterThan(cal!.rightX);
        expect(cal!.bottomY).toBeGreaterThan(cal!.topY);
    });
});
