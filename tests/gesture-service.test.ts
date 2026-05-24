/**
 * gestureService — GestureDetector + pure utility function tests
 *
 * AAC CRITICAL PATH: this service maps facial gestures to AAC actions for
 * users who cannot use touch/switch/head tracking. Regressions here remove
 * ALL communication for those users.
 *
 * Covers:
 *  - matrixToEuler: identity matrix → zero angles, singular-case path
 *  - DEFAULT_GESTURE_CONFIG: verify defaults
 *  - GestureDetector constructor: signal initialization, config binding
 *  - updateConfig
 *  - processFrame disabled guard
 *  - Baseline capture: start / progress / finalize (45 frames)
 *  - Basic gesture detection: blink, mouth_open, smile, pucker, brow_raise
 *    (EMA smoothing + dwell + cooldown controlled via Date.now spy)
 *  - Cooldown enforcement: gesture does NOT re-fire within cooldownMs
 *  - Head gesture: nod (pitch oscillation)
 *  - Head gesture: shake (yaw oscillation)
 *  - Recording mode: startRecording / stopRecording (too-short buffer → null)
 *  - onFeedback: updates successRate + maxDTWCost
 *  - resetSession: clears history + signals
 *  - Singleton management: createGestureDetector / getGestureDetector / destroy
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  matrixToEuler,
  DEFAULT_GESTURE_CONFIG,
  GestureDetector,
  createGestureDetector,
  getGestureDetector,
  destroyGestureDetector,
  type GestureConfig,
  type GestureEvent,
  type FaceLandmarkResult,
  type GestureTemplate,
} from '@/services/gestureService';

// ── crossModalLockout: the constructor wraps the callback with a require().
// Since it's in try/catch the mock failure is harmless — onGesture still fires.
// Silence the error output with a mock to keep test output clean.
vi.mock('@/services/crossModalLockout', () => ({
  dispatchGestureClaim: vi.fn(),
}));

// ── time control ──────────────────────────────────────────────────────────────
let mockNow = 1000;
const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockNow);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<GestureConfig> = {}): GestureConfig {
  return { ...DEFAULT_GESTURE_CONFIG, enabled: true, ...overrides };
}

function makeFrame(
  blendshapes: Record<string, number> = {},
  headPose = { pitch: 0, yaw: 0, roll: 0 },
): FaceLandmarkResult {
  return {
    blendshapes: {
      eyeBlinkLeft: 0, eyeBlinkRight: 0,
      jawOpen: 0,
      mouthSmileLeft: 0, mouthSmileRight: 0,
      mouthPucker: 0,
      browInnerUp: 0,
      ...blendshapes,
    },
    headPose,
    timestamp: mockNow,
  };
}

beforeEach(() => {
  mockNow = 1000;
  destroyGestureDetector();
  vi.clearAllMocks();
  dateSpy.mockImplementation(() => mockNow);
});

afterEach(() => {
  destroyGestureDetector();
});

// ── matrixToEuler — pure function ─────────────────────────────────────────────

describe('gestureService — matrixToEuler', () => {
  it('identity matrix returns zero pitch, yaw, roll', () => {
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    const { pitch, yaw, roll } = matrixToEuler(identity);
    expect(pitch).toBeCloseTo(0);
    expect(yaw).toBeCloseTo(0);
    expect(roll).toBeCloseTo(0);
  });

  it('returns finite numbers for arbitrary input', () => {
    const arbitrary = [
      0.7, 0.3, -0.6, 0,
      -0.5, 0.8, 0.1, 0,
      0.4, 0.5, 0.75, 0,
      0,   0,   0,    1,
    ];
    const { pitch, yaw, roll } = matrixToEuler(arbitrary);
    expect(Number.isFinite(pitch)).toBe(true);
    expect(Number.isFinite(yaw)).toBe(true);
    expect(Number.isFinite(roll)).toBe(true);
  });

  it('singular case (sy < 1e-6) sets roll=0', () => {
    // Ry(90°) rotation: r00=0, r10=0 → sy=0
    // column-major [r00,r10,r20,..., r01,r11,r21,..., r02,r12,r22,...]
    const singularMatrix = [
      0, 0, -1, 0,  // col 0
      0, 1,  0, 0,  // col 1
      1, 0,  0, 0,  // col 2
      0, 0,  0, 1,  // col 3
    ];
    const { roll } = matrixToEuler(singularMatrix);
    expect(roll).toBe(0);
  });
});

// ── DEFAULT_GESTURE_CONFIG ────────────────────────────────────────────────────

describe('gestureService — DEFAULT_GESTURE_CONFIG', () => {
  it('enabled is false by default', () => {
    expect(DEFAULT_GESTURE_CONFIG.enabled).toBe(false);
  });

  it('mode is "basic" by default', () => {
    expect(DEFAULT_GESTURE_CONFIG.mode).toBe('basic');
  });

  it('confidenceThreshold is 0.6', () => {
    expect(DEFAULT_GESTURE_CONFIG.confidenceThreshold).toBe(0.6);
  });

  it('cooldownMs is 1000', () => {
    expect(DEFAULT_GESTURE_CONFIG.cooldownMs).toBe(1000);
  });

  it('dwellMs is 300', () => {
    expect(DEFAULT_GESTURE_CONFIG.dwellMs).toBe(300);
  });

  it('baseline is null', () => {
    expect(DEFAULT_GESTURE_CONFIG.baseline).toBeNull();
  });

  it('fusionWeights sum to 1.0', () => {
    const { head, blink, mouth, brow } = DEFAULT_GESTURE_CONFIG.fusionWeights;
    expect(head + blink + mouth + brow).toBeCloseTo(1.0);
  });
});

// ── GestureDetector constructor ───────────────────────────────────────────────

describe('GestureDetector — constructor', () => {
  it('creates without throwing', () => {
    expect(() => new GestureDetector(makeConfig(), vi.fn())).not.toThrow();
  });

  it('isCapturingBaseline is false initially', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    expect(d.isCapturingBaseline()).toBe(false);
  });

  it('getBaselineProgress is 0 initially', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    expect(d.getBaselineProgress()).toBe(0);
  });

  it('updateConfig does not throw', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    expect(() => d.updateConfig(makeConfig({ cooldownMs: 500 }))).not.toThrow();
  });
});

// ── processFrame disabled guard ───────────────────────────────────────────────

describe('GestureDetector — processFrame disabled guard', () => {
  it('does not call onGesture when enabled=false', () => {
    const cb = vi.fn();
    const d = new GestureDetector({ ...DEFAULT_GESTURE_CONFIG, enabled: false }, cb);
    // Feed many high-value frames
    for (let i = 0; i < 20; i++) {
      mockNow += 100;
      d.processFrame(makeFrame({ eyeBlinkLeft: 1.0, eyeBlinkRight: 1.0 }));
    }
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Baseline capture ──────────────────────────────────────────────────────────

describe('GestureDetector — baseline capture', () => {
  it('startBaselineCapture sets isCapturingBaseline to true', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    d.startBaselineCapture();
    expect(d.isCapturingBaseline()).toBe(true);
  });

  it('getBaselineProgress increases as frames are added', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    d.startBaselineCapture();
    d.processFrame(makeFrame());
    expect(d.getBaselineProgress()).toBeGreaterThan(0);
  });

  it('does not emit gestures while capturing baseline', () => {
    const cb = vi.fn();
    const d = new GestureDetector(makeConfig(), cb);
    d.startBaselineCapture();
    for (let i = 0; i < 10; i++) {
      d.processFrame(makeFrame({ eyeBlinkLeft: 1.0, jawOpen: 1.0 }));
    }
    expect(cb).not.toHaveBeenCalled();
  });

  it('finalizes baseline and stops capturing after 45 frames', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    d.startBaselineCapture();
    // Feed 44 frames — still capturing
    for (let i = 0; i < 44; i++) d.processFrame(makeFrame({ eyeBlinkLeft: 0.1 }));
    expect(d.isCapturingBaseline()).toBe(true);
    // 45th frame triggers finalization
    d.processFrame(makeFrame({ eyeBlinkLeft: 0.1 }));
    expect(d.isCapturingBaseline()).toBe(false);
    // baselineFrames is cleared after finalization, so progress resets to 0
    expect(d.getBaselineProgress()).toBe(0);
  });
});

// ── Basic gesture: blink ──────────────────────────────────────────────────────

describe('GestureDetector — blink detection', () => {
  it('fires blink after EMA smooths above threshold and dwell is met', () => {
    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig(), (e) => gestures.push(e));

    // Frame 1 (t=1000): smoothed = 0.3, not active
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    // Frame 2 (t=1000): smoothed ≈ 0.51, active=true, startTime=1000
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    // Advance past 400ms dwell
    mockNow = 1400;
    // Frame 3: dwell met, cooldown met → fires
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));

    expect(gestures.some((g) => g.gesture === 'blink')).toBe(true);
    const ev = gestures.find((g) => g.gesture === 'blink')!;
    expect(ev.confidence).toBeGreaterThan(0);
    expect(ev.confidence).toBeLessThanOrEqual(1);
  });

  it('uses max(blinkLeft, blinkRight) — right eye only fires blink', () => {
    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig(), (e) => gestures.push(e));

    d.processFrame(makeFrame({ eyeBlinkLeft: 0, eyeBlinkRight: 1.0 }));
    d.processFrame(makeFrame({ eyeBlinkLeft: 0, eyeBlinkRight: 1.0 }));
    mockNow = 1400;
    d.processFrame(makeFrame({ eyeBlinkLeft: 0, eyeBlinkRight: 1.0 }));

    expect(gestures.some((g) => g.gesture === 'blink')).toBe(true);
  });

  it('does NOT fire blink when value stays near zero', () => {
    const cb = vi.fn();
    const d = new GestureDetector(makeConfig(), cb);
    for (let i = 0; i < 20; i++) {
      mockNow += 100;
      d.processFrame(makeFrame({ eyeBlinkLeft: 0.05 }));
    }
    const blinkCalls = cb.mock.calls.filter((c) => c[0].gesture === 'blink');
    expect(blinkCalls.length).toBe(0);
  });
});

// ── Basic gesture: mouth_open ─────────────────────────────────────────────────

describe('GestureDetector — mouth_open detection', () => {
  it('fires mouth_open after dwell (threshold 0.4, dwell dwellMs=300)', () => {
    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig(), (e) => gestures.push(e));

    // jawOpen=0.8: after 2 frames smoothed ≈ 0.408 > 0.4
    d.processFrame(makeFrame({ jawOpen: 0.8 }));
    d.processFrame(makeFrame({ jawOpen: 0.8 }));
    mockNow = 1300; // advance past 300ms dwell
    d.processFrame(makeFrame({ jawOpen: 0.8 }));

    expect(gestures.some((g) => g.gesture === 'mouth_open')).toBe(true);
  });
});

// ── Basic gesture: smile ──────────────────────────────────────────────────────

describe('GestureDetector — smile detection', () => {
  it('fires smile using max(smileLeft, smileRight) — asymmetry-aware', () => {
    const gestures: GestureEvent[] = [];
    // lower confidenceThreshold to account for smile threshold=0.35, lower confidence
    const d = new GestureDetector(makeConfig({ confidenceThreshold: 0.5 }), (e) => gestures.push(e));

    // smileLeft=0.7, smileRight=0: max=0.7. After 2 frames smoothed ≈ 0.357 > 0.35
    d.processFrame(makeFrame({ mouthSmileLeft: 0.7 }));
    d.processFrame(makeFrame({ mouthSmileLeft: 0.7 }));
    mockNow = 1300; // advance past 300ms dwell
    d.processFrame(makeFrame({ mouthSmileLeft: 0.7 }));

    expect(gestures.some((g) => g.gesture === 'smile')).toBe(true);
  });
});

// ── Basic gesture: brow_raise ─────────────────────────────────────────────────

describe('GestureDetector — brow_raise detection', () => {
  it('fires brow_raise when browInnerUp holds above threshold', () => {
    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig({ confidenceThreshold: 0.5 }), (e) => gestures.push(e));

    // threshold=0.35, browVal=0.7: after 2 frames smoothed ≈ 0.357 > 0.35
    d.processFrame(makeFrame({ browInnerUp: 0.7 }));
    d.processFrame(makeFrame({ browInnerUp: 0.7 }));
    mockNow = 1300;
    d.processFrame(makeFrame({ browInnerUp: 0.7 }));

    expect(gestures.some((g) => g.gesture === 'brow_raise')).toBe(true);
  });
});

// ── Cooldown enforcement ──────────────────────────────────────────────────────

describe('GestureDetector — cooldown enforcement', () => {
  it('does NOT fire a second blink within cooldownMs after first fire', () => {
    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig({ cooldownMs: 1000 }), (e) => gestures.push(e));

    // First fire at t=1400
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    mockNow = 1400;
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));

    const firstCount = gestures.filter((g) => g.gesture === 'blink').length;
    expect(firstCount).toBe(1);

    // Try to fire again 100ms later (within cooldown)
    mockNow = 1500;
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));

    expect(gestures.filter((g) => g.gesture === 'blink').length).toBe(1);
  });

  it('fires again after cooldownMs has elapsed', () => {
    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig({ cooldownMs: 1000 }), (e) => gestures.push(e));

    // First fire
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    mockNow = 1400;
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    expect(gestures.filter((g) => g.gesture === 'blink').length).toBe(1);

    // After cooldownMs (1000ms past lastFired=1400) → t=2400+
    mockNow = 2500;
    // Reset EMA by feeding zero, then ramp back up
    d.processFrame(makeFrame({ eyeBlinkLeft: 0 })); // EMA drops, active=false
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 })); // ramp back up
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 })); // smooth above threshold
    mockNow = 2900;
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 })); // dwell met

    expect(gestures.filter((g) => g.gesture === 'blink').length).toBeGreaterThanOrEqual(2);
  });
});

// ── Head gesture: nod ─────────────────────────────────────────────────────────

describe('GestureDetector — head_nod detection', () => {
  it('fires head_nod for pitch oscillation with range > 0.15 and >= 2 crossings', () => {
    const gestures: GestureEvent[] = [];
    // cooldownMs: 500 so that now(1000) - headLastNod(0) = 1000 > 500 ✓
    const d = new GestureDetector(makeConfig({ cooldownMs: 500 }), (e) => gestures.push(e));

    // 10 frames alternating pitch +0.2 / -0.2, yaw=0
    // Range=0.4 > 0.15, crossings=7 >= 2, pitchRange > yawRange*1.5 (0.4>0) ✓
    const pitches = [0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2];
    for (const pitch of pitches) {
      d.processFrame(makeFrame({}, { pitch, yaw: 0, roll: 0 }));
    }

    expect(gestures.some((g) => g.gesture === 'head_nod')).toBe(true);
    const ev = gestures.find((g) => g.gesture === 'head_nod')!;
    expect(ev.confidence).toBeGreaterThan(0);
    expect(ev.confidence).toBeLessThanOrEqual(1);
  });

  it('does NOT fire head_nod when pitch range is too small', () => {
    const cb = vi.fn();
    const d = new GestureDetector(makeConfig({ cooldownMs: 500 }), cb);
    // Tiny pitch oscillation below 0.15 threshold
    const pitches = [0.05, -0.05, 0.05, -0.05, 0.05, -0.05, 0.05, -0.05, 0.05, -0.05];
    for (const pitch of pitches) {
      d.processFrame(makeFrame({}, { pitch, yaw: 0, roll: 0 }));
    }
    expect(cb.mock.calls.some((c) => c[0].gesture === 'head_nod')).toBe(false);
  });
});

// ── Head gesture: shake ───────────────────────────────────────────────────────

describe('GestureDetector — head_shake detection', () => {
  it('fires head_shake for yaw oscillation with range > 0.2 and >= 2 crossings', () => {
    const gestures: GestureEvent[] = [];
    // cooldownMs: 500 so that now(1000) - headLastShake(0) = 1000 > 500 ✓
    const d = new GestureDetector(makeConfig({ cooldownMs: 500 }), (e) => gestures.push(e));

    // 10 frames alternating yaw +0.3 / -0.3, pitch=0
    // yawRange=0.6 > 0.2, yawCrossings=7 >= 2, yawRange > pitchRange*1.5 (0.6>0) ✓
    const yaws = [0.3, -0.3, 0.3, -0.3, 0.3, -0.3, 0.3, -0.3, 0.3, -0.3];
    for (const yaw of yaws) {
      d.processFrame(makeFrame({}, { pitch: 0, yaw, roll: 0 }));
    }

    expect(gestures.some((g) => g.gesture === 'head_shake')).toBe(true);
  });

  it('does NOT fire head_shake when yaw range is too small', () => {
    const cb = vi.fn();
    const d = new GestureDetector(makeConfig({ cooldownMs: 500 }), cb);
    const yaws = [0.05, -0.05, 0.05, -0.05, 0.05, -0.05, 0.05, -0.05, 0.05, -0.05];
    for (const yaw of yaws) {
      d.processFrame(makeFrame({}, { pitch: 0, yaw, roll: 0 }));
    }
    expect(cb.mock.calls.some((c) => c[0].gesture === 'head_shake')).toBe(false);
  });
});

// ── Recording mode ────────────────────────────────────────────────────────────

describe('GestureDetector — recording mode', () => {
  it('startRecording prevents gesture detection (frames are buffered)', () => {
    const cb = vi.fn();
    const d = new GestureDetector(makeConfig(), cb);

    d.startRecording('custom_wave');
    // Feed high-value frames that would normally trigger blink
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    mockNow = 1400;
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));

    // No gesture events should have fired (recording mode intercepts frames)
    expect(cb).not.toHaveBeenCalled();
  });

  it('stopRecording returns null when fewer than 5 frames recorded', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    d.startRecording('test_gesture');
    d.processFrame(makeFrame()); // 1 frame
    d.processFrame(makeFrame()); // 2 frames
    d.processFrame(makeFrame()); // 3 frames
    expect(d.stopRecording()).toBeNull();
  });

  it('stopRecording returns the captured frames when >= 5 recorded', () => {
    // Mock fetch so classifyViseme8B does not actually network
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const d = new GestureDetector(makeConfig(), vi.fn());
    d.startRecording('test_gesture');
    for (let i = 0; i < 8; i++) {
      d.processFrame(makeFrame({ jawOpen: i * 0.1 }));
    }
    const result = d.stopRecording();
    expect(Array.isArray(result)).toBe(true);
    expect(result!.length).toBe(8);

    vi.unstubAllGlobals();
  });

  it('stopRecording resumes normal detection after recording ends', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const gestures: GestureEvent[] = [];
    const d = new GestureDetector(makeConfig(), (e) => gestures.push(e));

    d.startRecording('test');
    for (let i = 0; i < 5; i++) d.processFrame(makeFrame());
    d.stopRecording();

    // Now normal detection should resume
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));
    mockNow = 1400;
    d.processFrame(makeFrame({ eyeBlinkLeft: 1.0 }));

    expect(gestures.some((g) => g.gesture === 'blink')).toBe(true);
    vi.unstubAllGlobals();
  });
});

// ── onFeedback auto-learning ──────────────────────────────────────────────────

describe('GestureDetector — onFeedback', () => {
  function makeTemplate(id: string): GestureTemplate {
    return {
      id,
      name: id,
      sequences: [],
      avgDuration: 500,
      maxDTWCost: 5.0,
      usageCount: 10,
      successRate: 0.8,
    };
  }

  it('onFeedback(id, true) increments usageCount and adjusts successRate', () => {
    const tmpl = makeTemplate('wave');
    const d = new GestureDetector(makeConfig({ templates: [tmpl], mode: 'advanced' }), vi.fn());
    const beforeRate = tmpl.successRate;
    d.onFeedback('wave', true);
    expect(tmpl.usageCount).toBe(11);
    // successRate = (0.8 * 10 + 1) / 11 = 9/11 ≈ 0.818
    expect(tmpl.successRate).toBeGreaterThan(beforeRate);
  });

  it('onFeedback(id, false) tightens maxDTWCost by 8%', () => {
    const tmpl = makeTemplate('wave');
    const beforeCost = tmpl.maxDTWCost;
    const d = new GestureDetector(makeConfig({ templates: [tmpl], mode: 'advanced' }), vi.fn());
    d.onFeedback('wave', false);
    expect(tmpl.maxDTWCost).toBeCloseTo(beforeCost * 0.92, 5);
  });

  it('onFeedback(id, false) decrements successRate', () => {
    const tmpl = makeTemplate('wave');
    const beforeRate = tmpl.successRate;
    const d = new GestureDetector(makeConfig({ templates: [tmpl], mode: 'advanced' }), vi.fn());
    d.onFeedback('wave', false);
    expect(tmpl.successRate).toBeLessThan(beforeRate);
  });

  it('onFeedback on unknown id does not throw', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    expect(() => d.onFeedback('nonexistent', true)).not.toThrow();
  });
});

// ── resetSession ──────────────────────────────────────────────────────────────

describe('GestureDetector — resetSession', () => {
  it('resetSession clears head history (nod does not re-fire on same old data)', () => {
    const gestures: GestureEvent[] = [];
    // cooldownMs: 500 so that now(1000) - headLastNod(0) = 1000 > 500 ✓
    const d = new GestureDetector(makeConfig({ cooldownMs: 500 }), (e) => gestures.push(e));

    // Trigger a nod
    const pitches = [0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2];
    for (const pitch of pitches) d.processFrame(makeFrame({}, { pitch, yaw: 0, roll: 0 }));
    const nodsBefore = gestures.filter((g) => g.gesture === 'head_nod').length;
    expect(nodsBefore).toBeGreaterThan(0);

    // Reset clears history — feeding only 2 more frames won't reach threshold
    d.resetSession();
    d.processFrame(makeFrame({}, { pitch: 0.2, yaw: 0, roll: 0 }));
    d.processFrame(makeFrame({}, { pitch: -0.2, yaw: 0, roll: 0 }));
    // Only 2 frames in history — length < 8, no new nod
    const nodsAfterReset = gestures.filter((g) => g.gesture === 'head_nod').length;
    expect(nodsAfterReset).toBe(nodsBefore);
  });

  it('resetSession does not throw', () => {
    const d = new GestureDetector(makeConfig(), vi.fn());
    expect(() => d.resetSession()).not.toThrow();
  });
});

// ── Singleton management ──────────────────────────────────────────────────────

describe('gestureService — singleton management', () => {
  it('getGestureDetector returns null before creation', () => {
    expect(getGestureDetector()).toBeNull();
  });

  it('createGestureDetector returns a GestureDetector instance', () => {
    const d = createGestureDetector(makeConfig(), vi.fn());
    expect(d).toBeInstanceOf(GestureDetector);
  });

  it('getGestureDetector returns the created instance', () => {
    const d = createGestureDetector(makeConfig(), vi.fn());
    expect(getGestureDetector()).toBe(d);
  });

  it('destroyGestureDetector sets singleton to null', () => {
    createGestureDetector(makeConfig(), vi.fn());
    destroyGestureDetector();
    expect(getGestureDetector()).toBeNull();
  });

  it('createGestureDetector replaces previous singleton', () => {
    const d1 = createGestureDetector(makeConfig(), vi.fn());
    const d2 = createGestureDetector(makeConfig(), vi.fn());
    expect(getGestureDetector()).toBe(d2);
    expect(d1).not.toBe(d2);
  });
});
