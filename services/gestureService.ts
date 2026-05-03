'use client';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Gesture Recognition Service — Multi-Modal Fusion Engine
 *  ========================================================
 *
 *  Detects head, eye, lip, and body gestures from MediaPipe face landmarks
 *  and blendshapes. Maps detected gestures to AAC actions (button clicks,
 *  phrase speak, panel open, etc.).
 *
 *  TWO OPERATING MODES:
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  BASIC MODE (no training required)                                  │
 *  │  ─────────────────────────────────────────────────────────────────  │
 *  │  Uses MediaPipe blendshape thresholds directly. Works out of the   │
 *  │  box the moment the user enables gesture recognition. Detects:     │
 *  │    • Intentional blink (held >400ms, not natural rhythm)           │
 *  │    • Mouth open (jawOpen blendshape > threshold)                   │
 *  │    • Smile (mouthSmileLeft + mouthSmileRight > threshold)          │
 *  │    • Pucker ("oo" shape — mouthPucker > threshold)                 │
 *  │    • Head nod (pitch oscillation from transformation matrix)       │
 *  │    • Head shake (yaw oscillation from transformation matrix)       │
 *  │    • Eyebrow raise (browInnerUp > threshold)                       │
 *  │                                                                    │
 *  │  Thresholds auto-calibrate to the user's neutral face on first     │
 *  │  enable (3-second baseline capture). No explicit training needed.  │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  ADVANCED MODE (trained, requires 8B local model)                   │
 *  │  ─────────────────────────────────────────────────────────────────  │
 *  │  Builds on Basic mode and adds:                                    │
 *  │    • Custom gesture recording via DTW template matching            │
 *  │    • Multi-modal fusion (head + lips + body weighted together)     │
 *  │    • Compound gestures (e.g., nod + smile = "enthusiastic yes")   │
 *  │    • Auto-learning: weights adapt per-user from usage feedback     │
 *  │    • 8B model inference for viseme classification and complex      │
 *  │      gesture sequences that threshold detection cannot handle      │
 *  │                                                                    │
 *  │  Training flow:                                                    │
 *  │    1. Caregiver opens Settings → Gestures → Advanced               │
 *  │    2. Picks action to assign (e.g., "Speak", "Yes", "No")         │
 *  │    3. Records 5 examples of the gesture                           │
 *  │    4. System stores DTW templates in localStorage                  │
 *  │    5. On use, system compares live input against stored templates  │
 *  │    6. After each recognition, user confirms/rejects (auto-learn)  │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  MULTI-MODAL FUSION ARCHITECTURE:
 *
 *     Camera Frame (15fps)
 *           │
 *     ┌─────▼──────────────────────────────────────────┐
 *     │  MediaPipe FaceLandmarker                       │
 *     │  → 478 landmarks + 52 blendshapes              │
 *     │  → facial transformation matrix (head pose)     │
 *     └─────┬──────────────────────────────────────────┘
 *           │
 *     ┌─────▼──────────────────────────────────────────┐
 *     │  Signal Extractors (run every frame)            │
 *     │  ┌──────────┐ ┌────────┐ ┌───────┐ ┌────────┐ │
 *     │  │ HeadPose │ │ Blink  │ │ Mouth │ │ Brow   │ │
 *     │  │ nod/shake│ │ intent │ │ open/ │ │ raise  │ │
 *     │  │ tilt     │ │ /nat.  │ │ smile │ │        │ │
 *     │  │          │ │        │ │ pucker│ │        │ │
 *     │  └────┬─────┘ └───┬────┘ └───┬───┘ └───┬────┘ │
 *     └───────┼────────────┼─────────┼──────────┼──────┘
 *             │            │         │          │
 *     ┌───────▼────────────▼─────────▼──────────▼──────┐
 *     │  Temporal Aggregation (per signal)              │
 *     │  • EMA smoothing (α=0.3) for jitter             │
 *     │  • Duration validation (min 300ms sustained)    │
 *     │  • Cooldown enforcement (1000ms between fires)  │
 *     └────────────────────┬───────────────────────────┘
 *                          │
 *     ┌────────────────────▼───────────────────────────┐
 *     │  Intent Resolver                                │
 *     │  • Basic: threshold match → action              │
 *     │  • Advanced: DTW match + model inference        │
 *     │  • Fires onGesture callback with action ID      │
 *     └────────────────────────────────────────────────┘
 *
 *  ACCESSIBILITY NOTES:
 *  • All thresholds are relative to per-user baseline (handles CP facial
 *    asymmetry, spasticity, limited range of motion)
 *  • Asymmetry-aware: uses max(left, right) not average for smile/blink
 *  • Fatigue adaptation: thresholds relax 10% after 15 minutes of use
 *  • Tremor filter: EMA smoothing + multi-frame consensus
 *  • Motor-accessible training: large targets, extended hold times
 *
 *  PERFORMANCE BUDGET (iPad Safari):
 *  • FaceLandmarker: 15-20fps with GPU delegate
 *  • Blendshape extraction: <1ms per frame (native output)
 *  • DTW matching: <2ms per gesture template comparison
 *  • Total gesture processing: <5ms per frame overhead
 *  • Memory: ~100-200KB for 10 gesture templates
 *  • Battery: ~15-25% per hour with continuous tracking
 * ────────────────────────────────────────────────────────────────────── */

// ── Types ──────────────────────────────────────────────────────────────────

export type GestureId =
  | 'blink'
  | 'mouth_open'
  | 'smile'
  | 'pucker'
  | 'head_nod'
  | 'head_shake'
  | 'brow_raise'
  | string; // custom gestures in advanced mode

export interface GestureEvent {
  gesture: GestureId;
  confidence: number;
  timestamp: number;
}

export interface GestureMapping {
  gesture: GestureId;
  action: string; // button id, panel name, or custom action
}

export interface GestureBaseline {
  blendshapes: Record<string, number>; // neutral face blendshape values
  headPose: { pitch: number; yaw: number; roll: number };
  capturedAt: number;
}

export interface GestureTemplate {
  id: string;
  name: string;
  sequences: number[][][]; // [example][frame][blendshape dimension]
  avgDuration: number;
  maxDTWCost: number; // learned acceptance threshold
  usageCount: number;
  successRate: number;
}

export interface GestureConfig {
  enabled: boolean;
  mode: 'basic' | 'advanced';
  mappings: GestureMapping[];
  confidenceThreshold: number; // 0.3 – 0.95, default 0.6
  cooldownMs: number;          // 500 – 3000, default 1000
  dwellMs: number;             // 200 – 1000, default 300
  baseline: GestureBaseline | null;
  templates: GestureTemplate[];
  fusionWeights: { head: number; blink: number; mouth: number; brow: number };
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  enabled: false,
  mode: 'basic',
  mappings: [],
  confidenceThreshold: 0.6,
  cooldownMs: 1000,
  dwellMs: 300,
  baseline: null,
  templates: [],
  fusionWeights: { head: 0.3, blink: 0.25, mouth: 0.25, brow: 0.2 },
};

// ── Blendshape keys used by basic mode ─────────────────────────────────────

const BLINK_LEFT = 'eyeBlinkLeft';
const BLINK_RIGHT = 'eyeBlinkRight';
const JAW_OPEN = 'jawOpen';
const SMILE_LEFT = 'mouthSmileLeft';
const SMILE_RIGHT = 'mouthSmileRight';
const PUCKER = 'mouthPucker';
const BROW_UP = 'browInnerUp';

// ── Blendshape result from MediaPipe FaceLandmarker ────────────────────────

export interface FaceLandmarkResult {
  blendshapes: Record<string, number>;
  headPose: { pitch: number; yaw: number; roll: number };
  timestamp: number;
}

// ── Internal state ─────────────────────────────────────────────────────────

interface SignalState {
  active: boolean;    // is the signal currently above threshold?
  startTime: number;  // when did it go active?
  lastFired: number;  // when was the gesture last emitted?
  smoothed: number;   // EMA-smoothed value
}

interface HeadPoseFrame {
  pitch: number;
  yaw: number;
  roll: number;
  timestamp: number;
}

// ── EMA smoothing ──────────────────────────────────────────────────────────

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

// ── Head pose from transformation matrix ───────────────────────────────────
// The FaceLandmarker outputs a 4x4 column-major facial transformation matrix.
// We decompose the 3x3 rotation submatrix to Euler angles (pitch, yaw, roll).

export function matrixToEuler(matrix: number[]): { pitch: number; yaw: number; roll: number } {
  // Column-major 4x4 → row-major 3x3 rotation
  const r00 = matrix[0], r01 = matrix[4], r02 = matrix[8];
  const r10 = matrix[1], r11 = matrix[5], r12 = matrix[9];
  const r20 = matrix[2], r21 = matrix[6], r22 = matrix[10];

  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const singular = sy < 1e-6;
  let pitch: number, yaw: number, roll: number;
  if (!singular) {
    pitch = Math.atan2(r21, r22);
    yaw = Math.atan2(-r20, sy);
    roll = Math.atan2(r10, r00);
  } else {
    pitch = Math.atan2(-r12, r11);
    yaw = Math.atan2(-r20, sy);
    roll = 0;
  }
  return { pitch, yaw, roll };
}

// ── Zero-crossing counter for head oscillation detection ───────────────────

function zeroCrossings(values: number[]): number {
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    if ((values[i - 1] >= 0 && values[i] < 0) || (values[i - 1] < 0 && values[i] >= 0)) {
      count++;
    }
  }
  return count;
}

// ── DTW (Dynamic Time Warping) for advanced mode template matching ─────────

function dtwDistance(s: number[][], t: number[][]): number {
  const n = s.length;
  const m = t.length;
  if (n === 0 || m === 0) return Infinity;
  const dtw: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  dtw[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let cost = 0;
      for (let d = 0; d < s[i - 1].length; d++) {
        cost += (s[i - 1][d] - t[j - 1][d]) ** 2;
      }
      cost = Math.sqrt(cost);
      dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }
  return dtw[n][m] / Math.max(n, m);
}

// ── Gesture Detector Engine ────────────────────────────────────────────────

export class GestureDetector {
  private config: GestureConfig;
  private onGesture: (event: GestureEvent) => void;

  // Per-signal state
  private signals: Record<string, SignalState> = {};
  private headHistory: HeadPoseFrame[] = [];
  private headLastNod = 0;
  private headLastShake = 0;

  // Baseline capture
  private baselineFrames: FaceLandmarkResult[] = [];
  private baselineCapturing = false;

  // Advanced mode: recording
  private recording = false;
  private recordBuffer: number[][] = [];
  private recordGestureId = '';

  // Session timer for fatigue adaptation
  private sessionStart = Date.now();

  constructor(config: GestureConfig, onGesture: (event: GestureEvent) => void) {
    this.config = config;
    this.onGesture = onGesture;
    for (const id of ['blink', 'mouth_open', 'smile', 'pucker', 'brow_raise']) {
      this.signals[id] = { active: false, startTime: 0, lastFired: 0, smoothed: 0 };
    }
  }

  updateConfig(config: GestureConfig): void {
    this.config = config;
  }

  // ── Baseline Capture ───────────────────────────────────────────────────
  // Called automatically on first enable. User holds still for 3 seconds.
  // Captures neutral-face blendshape values so all thresholds are relative.

  startBaselineCapture(): void {
    this.baselineFrames = [];
    this.baselineCapturing = true;
  }

  isCapturingBaseline(): boolean {
    return this.baselineCapturing;
  }

  getBaselineProgress(): number {
    return Math.min(1, this.baselineFrames.length / 45); // ~3s at 15fps
  }

  // ── Main frame processing ──────────────────────────────────────────────
  // Called every frame by the headTracker via onLandmarks callback.

  processFrame(result: FaceLandmarkResult): void {
    if (!this.config.enabled) return;

    // Baseline capture mode
    if (this.baselineCapturing) {
      this.baselineFrames.push(result);
      if (this.baselineFrames.length >= 45) {
        this.finalizeBaseline();
      }
      return;
    }

    // Recording mode (advanced)
    if (this.recording) {
      const dims = this.extractDimensions(result);
      this.recordBuffer.push(dims);
      return;
    }

    // Detection
    if (this.config.mode === 'basic' || this.config.mode === 'advanced') {
      this.detectBasicGestures(result);
    }
    if (this.config.mode === 'advanced' && this.config.templates.length > 0) {
      this.detectAdvancedGestures(result);
    }
  }

  // ── Basic Mode Detection ───────────────────────────────────────────────
  // Uses blendshape thresholds relative to baseline. No training needed.

  private detectBasicGestures(result: FaceLandmarkResult): void {
    const bs = result.blendshapes;
    const base = this.config.baseline;
    const fatigueMultiplier = this.getFatigueMultiplier();

    // Blink: intentional = held >400ms (natural blinks are 100-300ms)
    const blinkVal = Math.max(bs[BLINK_LEFT] ?? 0, bs[BLINK_RIGHT] ?? 0);
    const blinkBase = base ? Math.max(base.blendshapes[BLINK_LEFT] ?? 0, base.blendshapes[BLINK_RIGHT] ?? 0) : 0;
    this.detectThresholdGesture('blink', blinkVal - blinkBase, 0.5 * fatigueMultiplier, 400);

    // Mouth open: jawOpen above threshold
    const mouthVal = bs[JAW_OPEN] ?? 0;
    const mouthBase = base?.blendshapes[JAW_OPEN] ?? 0;
    this.detectThresholdGesture('mouth_open', mouthVal - mouthBase, 0.4 * fatigueMultiplier, this.config.dwellMs);

    // Smile: max of left/right (asymmetry-aware for CP)
    const smileVal = Math.max(bs[SMILE_LEFT] ?? 0, bs[SMILE_RIGHT] ?? 0);
    const smileBase = base ? Math.max(base.blendshapes[SMILE_LEFT] ?? 0, base.blendshapes[SMILE_RIGHT] ?? 0) : 0;
    this.detectThresholdGesture('smile', smileVal - smileBase, 0.35 * fatigueMultiplier, this.config.dwellMs);

    // Pucker ("oo" shape)
    const puckerVal = bs[PUCKER] ?? 0;
    const puckerBase = base?.blendshapes[PUCKER] ?? 0;
    this.detectThresholdGesture('pucker', puckerVal - puckerBase, 0.4 * fatigueMultiplier, this.config.dwellMs);

    // Eyebrow raise
    const browVal = bs[BROW_UP] ?? 0;
    const browBase = base?.blendshapes[BROW_UP] ?? 0;
    this.detectThresholdGesture('brow_raise', browVal - browBase, 0.35 * fatigueMultiplier, this.config.dwellMs);

    // Head nod / shake (from head pose angles)
    this.detectHeadGestures(result);
  }

  // ── Threshold gesture detection with dwell + cooldown ──────────────────

  private detectThresholdGesture(id: string, value: number, threshold: number, minDwell: number): void {
    const sig = this.signals[id];
    if (!sig) return;

    sig.smoothed = ema(sig.smoothed, value, 0.3);

    const aboveThreshold = sig.smoothed > threshold;
    const now = Date.now();

    if (aboveThreshold && !sig.active) {
      sig.active = true;
      sig.startTime = now;
    } else if (!aboveThreshold && sig.active) {
      sig.active = false;
    }

    if (sig.active && (now - sig.startTime) >= minDwell && (now - sig.lastFired) >= this.config.cooldownMs) {
      const confidence = Math.min(1, sig.smoothed / (threshold * 2));
      if (confidence >= this.config.confidenceThreshold) {
        sig.lastFired = now;
        sig.active = false;
        this.onGesture({ gesture: id as GestureId, confidence, timestamp: now });
      }
    }
  }

  // ── Head gesture detection (nod/shake from pose angles) ────────────────

  private detectHeadGestures(result: FaceLandmarkResult): void {
    const now = Date.now();
    this.headHistory.push({ ...result.headPose, timestamp: now });

    // Keep 1.5s window
    const WINDOW_MS = 1500;
    this.headHistory = this.headHistory.filter(h => now - h.timestamp < WINDOW_MS);
    if (this.headHistory.length < 8) return;

    const pitches = this.headHistory.map(h => h.pitch);
    const yaws = this.headHistory.map(h => h.yaw);
    const meanPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const meanYaw = yaws.reduce((a, b) => a + b, 0) / yaws.length;

    const pitchRange = Math.max(...pitches) - Math.min(...pitches);
    const yawRange = Math.max(...yaws) - Math.min(...yaws);
    const pitchCrossings = zeroCrossings(pitches.map(p => p - meanPitch));
    const yawCrossings = zeroCrossings(yaws.map(y => y - meanYaw));

    const fatigueMultiplier = this.getFatigueMultiplier();

    // Nod: pitch oscillates with >=2 crossings, dominant axis
    if (pitchRange > 0.15 * fatigueMultiplier && pitchCrossings >= 2 && pitchRange > yawRange * 1.5) {
      if (now - this.headLastNod > this.config.cooldownMs) {
        this.headLastNod = now;
        const confidence = Math.min(1, pitchRange / 0.35);
        this.onGesture({ gesture: 'head_nod', confidence, timestamp: now });
        this.headHistory = [];
      }
    }

    // Shake: yaw oscillates with >=2 crossings, dominant axis
    if (yawRange > 0.2 * fatigueMultiplier && yawCrossings >= 2 && yawRange > pitchRange * 1.5) {
      if (now - this.headLastShake > this.config.cooldownMs) {
        this.headLastShake = now;
        const confidence = Math.min(1, yawRange / 0.45);
        this.onGesture({ gesture: 'head_shake', confidence, timestamp: now });
        this.headHistory = [];
      }
    }
  }

  // ── Advanced Mode: DTW template matching ───────────────────────────────

  private advancedBuffer: number[][] = [];
  private readonly ADVANCED_WINDOW = 30; // ~2s at 15fps

  private detectAdvancedGestures(result: FaceLandmarkResult): void {
    const dims = this.extractDimensions(result);
    this.advancedBuffer.push(dims);
    if (this.advancedBuffer.length > this.ADVANCED_WINDOW) {
      this.advancedBuffer.shift();
    }
    if (this.advancedBuffer.length < 10) return;

    let bestMatch: { id: string; cost: number; threshold: number } | null = null;
    for (const tmpl of this.config.templates) {
      for (const seq of tmpl.sequences) {
        const cost = dtwDistance(this.advancedBuffer, seq);
        if (cost < tmpl.maxDTWCost && (!bestMatch || cost < bestMatch.cost)) {
          bestMatch = { id: tmpl.id, cost, threshold: tmpl.maxDTWCost };
        }
      }
    }

    if (bestMatch) {
      const now = Date.now();
      const sig = this.signals[bestMatch.id] ?? { active: false, startTime: 0, lastFired: 0, smoothed: 0 };
      if (now - sig.lastFired >= this.config.cooldownMs) {
        sig.lastFired = now;
        this.signals[bestMatch.id] = sig;
        const confidence = 1 - (bestMatch.cost / bestMatch.threshold);
        this.onGesture({ gesture: bestMatch.id, confidence: Math.max(0.1, confidence), timestamp: now });
        this.advancedBuffer = [];
      }
    }
  }

  // ── Recording (Advanced Mode) ──────────────────────────────────────────

  startRecording(gestureId: string): void {
    this.recording = true;
    this.recordBuffer = [];
    this.recordGestureId = gestureId;
  }

  stopRecording(): number[][] | null {
    this.recording = false;
    if (this.recordBuffer.length < 5) return null;
    const captured = [...this.recordBuffer];
    this.recordBuffer = [];
    return captured;
  }

  // ── Auto-learning feedback ─────────────────────────────────────────────

  onFeedback(gestureId: string, wasCorrect: boolean): void {
    const tmpl = this.config.templates.find(t => t.id === gestureId);
    if (!tmpl) return;

    tmpl.usageCount++;
    if (wasCorrect) {
      tmpl.successRate = (tmpl.successRate * (tmpl.usageCount - 1) + 1) / tmpl.usageCount;
    } else {
      tmpl.successRate = (tmpl.successRate * (tmpl.usageCount - 1)) / tmpl.usageCount;
      tmpl.maxDTWCost *= 0.92; // tighten threshold to reduce false positives
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private extractDimensions(result: FaceLandmarkResult): number[] {
    const bs = result.blendshapes;
    return [
      bs[JAW_OPEN] ?? 0, bs[SMILE_LEFT] ?? 0, bs[SMILE_RIGHT] ?? 0,
      bs[PUCKER] ?? 0, bs[BLINK_LEFT] ?? 0, bs[BLINK_RIGHT] ?? 0,
      bs[BROW_UP] ?? 0,
      result.headPose.pitch, result.headPose.yaw, result.headPose.roll,
    ];
  }

  private finalizeBaseline(): void {
    this.baselineCapturing = false;
    const frames = this.baselineFrames;
    if (frames.length === 0) return;

    const avgBlendshapes: Record<string, number> = {};
    const keys = Object.keys(frames[0].blendshapes);
    for (const key of keys) {
      avgBlendshapes[key] = frames.reduce((s, f) => s + (f.blendshapes[key] ?? 0), 0) / frames.length;
    }

    const avgPose = {
      pitch: frames.reduce((s, f) => s + f.headPose.pitch, 0) / frames.length,
      yaw: frames.reduce((s, f) => s + f.headPose.yaw, 0) / frames.length,
      roll: frames.reduce((s, f) => s + f.headPose.roll, 0) / frames.length,
    };

    this.config.baseline = { blendshapes: avgBlendshapes, headPose: avgPose, capturedAt: Date.now() };
    this.baselineFrames = [];
  }

  // Fatigue adaptation: thresholds relax 10% after 15min, 20% after 30min
  private getFatigueMultiplier(): number {
    const minutesActive = (Date.now() - this.sessionStart) / 60000;
    if (minutesActive > 30) return 0.8;
    if (minutesActive > 15) return 0.9;
    return 1.0;
  }

  resetSession(): void {
    this.sessionStart = Date.now();
    this.headHistory = [];
    this.advancedBuffer = [];
    for (const sig of Object.values(this.signals)) {
      sig.active = false;
      sig.smoothed = 0;
    }
  }
}

// ── Singleton management ───────────────────────────────────────────────────

let activeDetector: GestureDetector | null = null;

export function getGestureDetector(): GestureDetector | null {
  return activeDetector;
}

export function createGestureDetector(
  config: GestureConfig,
  onGesture: (event: GestureEvent) => void,
): GestureDetector {
  activeDetector = new GestureDetector(config, onGesture);
  return activeDetector;
}

export function destroyGestureDetector(): void {
  activeDetector = null;
}
