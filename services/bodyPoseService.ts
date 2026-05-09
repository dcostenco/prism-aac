'use client';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Body Pose Tracking — Configurable body-part → cursor mapping
 *
 *  For children with severe motor disabilities who cannot use their hands
 *  but CAN move their arms, elbows, shoulders, or head. Uses MediaPipe
 *  Pose Landmarker (33 body landmarks) via WASM to track body movements
 *  and map them to cursor control.
 *
 *  Any trackable body part (nose, wrist, elbow, shoulder, index finger)
 *  can be mapped to cursor control, allowing each child to use whichever
 *  body part they can move most reliably.
 *
 *  Works entirely on-device. No external API calls. Offline-capable.
 *
 *  Camera management: uses the refcounted `cameraStream` singleton so
 *  body-pose + head-tracker can share a single getUserMedia stream
 *  (gap G in TRACKING_RELIABILITY.md). Falls back to a caller-provided
 *  video element for legacy callers.
 * ────────────────────────────────────────────────────────────────────────── */

import { acquireCamera, type CameraLease } from './cameraStream';
import { isValidCornerCalibration } from '@/lib/safeValidation';
// Stabilization stack — TRACKING_RELIABILITY.md items D / E / F.
// Smoother is One Euro Filter (Casiez 2012) instead of Kalman1D —
// MediaPipe + Chromium both use One Euro for real-time UI input;
// our prior Kalman was the outlier. Confidence-aware wrapper keeps
// the visibility-tracking behavior we needed for cheap webcams.
// Research report 2026-05-08 in CHANGELOG.
import { ConfidenceAwareOneEuro } from './oneEuroFilter';
import {
  MEDIAPIPE_WASM_URL,
  POSE_LANDMARKER_LITE_URL,
  FACE_DETECTOR_URL,
  FACE_LANDMARKER_URL,
  FpsWatchdog,
} from './mediapipeRuntime';
import {
  classifyMotion,
  fitSimilarityRansac,
  applyTransform,
  IDENTITY_TRANSFORM,
  type Point2D,
  type SimilarityTransform,
} from './egoMotion';
import { BaselineTracker } from './recalibration';

// ── MediaPipe Pose Landmark Indices ────────────────────────────────────────
//  0: nose        1-4: eyes       5-6: ears      7-10: mouth
// 11: left_shoulder   12: right_shoulder
// 13: left_elbow      14: right_elbow
// 15: left_wrist      16: right_wrist
// 17-22: hands (pinky, index, thumb pairs)
// 23-28: hips, knees, ankles
// 29-32: feet

export type TrackingTarget =
  | 'nose'
  | 'left_wrist'
  | 'right_wrist'
  // 'any_wrist' picks whichever wrist (left or right) has higher visibility
  // each frame — useful for users who switch hands, are left-handed, or have
  // limited motor control on one side. Resolves dynamically in the
  // detection loop, never used as a literal landmark index.
  | 'any_wrist'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_index'
  | 'right_index'
  // Same idea — picks the most-visible index finger each frame.
  | 'any_index'
  // Most permissive: best of all four hand landmarks (both wrists + both
  // index fingers). Recommended default when the user's hand position
  // varies across sessions.
  | 'any_hand';

// Concrete landmark indices. The 'any_*' aggregate targets are NOT included
// here — they're resolved at detection time by comparing visibilities across
// the underlying landmarks.
const LANDMARK_INDEX: Record<Exclude<TrackingTarget, 'any_wrist' | 'any_index' | 'any_hand'>, number> = {
  nose: 0,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_index: 19,
  right_index: 20,
};

/**
 * Resolve an aggregate target to the underlying landmark with the highest
 * visibility on the current frame. Returns null if none of the candidates
 * exist on the pose. Used for 'any_wrist' / 'any_index' / 'any_hand'.
 */
function resolveAggregateTarget(
  agg: 'any_wrist' | 'any_index' | 'any_hand',
  lm: Array<{ x: number; y: number; visibility?: number }>,
): { target: TrackingTarget; mark: { x: number; y: number; visibility?: number }; vis: number } | null {
  let candidates: Array<Exclude<TrackingTarget, 'any_wrist' | 'any_index' | 'any_hand'>>;
  if (agg === 'any_wrist') candidates = ['right_wrist', 'left_wrist'];
  else if (agg === 'any_index') candidates = ['right_index', 'left_index'];
  else candidates = ['right_wrist', 'left_wrist', 'right_index', 'left_index'];

  let best: { target: TrackingTarget; mark: { x: number; y: number; visibility?: number }; vis: number } | null = null;
  for (const c of candidates) {
    const idx = LANDMARK_INDEX[c];
    if (idx === undefined || lm.length <= idx) continue;
    const mark = lm[idx];
    const vis = mark.visibility ?? 0;
    if (!best || vis > best.vis) {
      best = { target: c, mark, vis };
    }
  }
  return best;
}

// ── Public Types ────────────────────────────────────────────────────────────

export interface PoseMapping {
  trackingTarget: TrackingTarget;
  cursorSmoothing: number; // EMA alpha 0.05–0.3
}

export interface PoseTrackerOptions {
  dwellMs: number;
  sensitivity: number;
  smoothing: number;
  trackingTarget: TrackingTarget;
  cursorSmoothing: number; // EMA alpha 0.05–0.3
  onMove: (x: number, y: number) => void;
  onDwell: (element: Element) => void;
  onStatusChange: (status: 'starting' | 'tracking' | 'lost' | 'stopped', activeTarget?: TrackingTarget) => void;
  /** Blend iris/gaze from FaceLandmarker into cursor position (0=nose only, 1=iris only). */
  useEyeGaze?: boolean;
  /** Weight 0–1, default 0.8. Only used when useEyeGaze is true. */
  eyeGazeWeight?: number;
}

export interface PoseTrackerHandle {
  stop: () => void;
  videoElement: HTMLVideoElement | null;
  /** Directly update the in-memory calibration used by the running tracker.
   *  Also persists to localStorage. Use when external code needs to update
   *  the live cursor mapping without restarting the tracker — e.g. the
   *  wizard's live-recentering interval. */
  setCalibration: (data: PoseCalibrationData) => void;
}

// ── Feature Detection ───────────────────────────────────────────────────────

export function isPoseTrackingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(navigator.mediaDevices?.getUserMedia) && typeof HTMLCanvasElement !== 'undefined';
}

// ── MediaPipe Pose Landmarker (WASM — works on ALL browsers) ───────────────

let poseLandmarker: unknown = null;
let poseLoadPromise: Promise<void> | null = null;
let useFaceDetectorFallback = false;

async function initPoseLandmarker(): Promise<boolean> {
  if (poseLandmarker) return true;
  if (poseLoadPromise) { await poseLoadPromise; return !!poseLandmarker; }
  poseLoadPromise = (async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: POSE_LANDMARKER_LITE_URL,
              delegate,
            },
            runningMode: 'VIDEO',
            // Allow up to 2 poses so identity locking has candidates when a
            // second person enters the frame. Confidence thresholds stay at
            // MediaPipe defaults (0.5) — bumping them to 0.7 made finger
            // landmarks almost never qualify, breaking pointer activity.
            // Identity locking does the multi-person filtering instead.
            numPoses: 2,
          });
          console.log(`[PoseTracker] PoseLandmarker initialized with ${delegate} delegate`);
          break;
        } catch (err) {
          console.warn(`[PoseTracker] ${delegate} delegate failed:`, err instanceof Error ? err.message : err);
          poseLandmarker = null;
        }
      }

      // Fallback: use FaceDetector (lighter model, proven on Safari)
      if (!poseLandmarker) {
        console.log('[PoseTracker] PoseLandmarker unavailable, falling back to FaceDetector for nose tracking');
        try {
          const { FaceDetector: MPFace } = vision;
          poseLandmarker = await MPFace.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: FACE_DETECTOR_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
          }) as unknown as typeof poseLandmarker;
          useFaceDetectorFallback = true;
          console.log('[PoseTracker] FaceDetector fallback initialized');
        } catch (faceErr) {
          console.error('[PoseTracker] FaceDetector fallback also failed:', faceErr instanceof Error ? faceErr.message : faceErr);
          poseLandmarker = null;
        }
      }
    } catch (e) {
      console.error('[PoseTracker] MediaPipe init failed:', e instanceof Error ? e.message : e);
      poseLandmarker = null;
    }
  })();
  await poseLoadPromise;
  poseLoadPromise = null;
  return !!poseLandmarker;
}

// ── FaceLandmarker (iris/gaze — lazy-initialized only when useEyeGaze) ───────

let faceLandmarkerForGaze: unknown = null;
let faceLandmarkerLoadPromise: Promise<void> | null = null;

async function initFaceLandmarkerForGaze(): Promise<boolean> {
  if (faceLandmarkerForGaze) return true;
  if (faceLandmarkerLoadPromise) { await faceLandmarkerLoadPromise; return !!faceLandmarkerForGaze; }
  faceLandmarkerLoadPromise = (async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      faceLandmarkerForGaze = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      console.log('[PoseTracker] FaceLandmarker for eye gaze initialized');
    } catch (e) {
      console.warn('[PoseTracker] FaceLandmarker for eye gaze init failed:', e instanceof Error ? e.message : e);
      faceLandmarkerForGaze = null;
    }
  })();
  await faceLandmarkerLoadPromise;
  faceLandmarkerLoadPromise = null;
  return !!faceLandmarkerForGaze;
}

// ── Calibration ─────────────────────────────────────────────────────────────

export interface PoseCalibrationData {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
}

// After X-mirroring (1-normX): mirroredX maps user's physical position to screen.
// Convention (load-bearing for the calibration math below):
//   leftX  = LARGER mirroredX value (head turned to user-right)
//   rightX = SMALLER mirroredX value (head turned to user-left)
//   topY   = SMALLER normY value (head tilted up)
//   bottomY= LARGER normY value (head tilted down)
// Inverting this ordering makes rangeX < 0 / rangeY < 0 and
// `MIN_RANGE` guard at line ~682 silently throws away the
// calibration — that bug shipped from May 2025 to May 2026 making
// the setup wizard a placebo.
export const DEFAULT_CALIBRATION: PoseCalibrationData = {
  leftX: 0.75,
  rightX: 0.05,
  topY: 0.2,
  bottomY: 0.8,
};

/** Pure calibration math: pose-normalized-x/y → screen pixel coords.
 *  Mirrors X (front camera), applies calibration rect, applies
 *  sensitivity zoom around center, clamps to screen.
 *  Extracted from startPoseTracker so the math can be unit-tested
 *  without booting MediaPipe. NEVER reads window — caller passes
 *  screenW/screenH explicitly. */
export function mapPoseToScreen(
  normX: number,
  normY: number,
  calibration: PoseCalibrationData,
  sensitivityScale: number,
  screenW: number,
  screenH: number,
): { x: number; y: number; rangeOK: boolean } {
  const mirroredX = 1.0 - normX;
  const rangeX = calibration.leftX - calibration.rightX;
  const rangeY = calibration.bottomY - calibration.topY;
  // Floor was 0.30 — too strict. Accessibility users with limited
  // motion operate in 0.05–0.20 range and were getting reset to
  // defaults every frame. 0.02 still guards against inverted/zero
  // calibrations (the actual corruption mode) without rejecting
  // legitimate small-range users.
  const MIN_RANGE = 0.02;
  const rangeOK = rangeX >= MIN_RANGE && rangeY >= MIN_RANGE;
  const cal = rangeOK ? calibration : DEFAULT_CALIBRATION;
  const rX = cal.leftX - cal.rightX;
  const rY = cal.bottomY - cal.topY;
  let rawX = ((mirroredX - cal.rightX) / rX) * screenW;
  let rawY = ((normY - cal.topY) / rY) * screenH;
  const centerX = screenW / 2;
  const centerY = screenH / 2;
  rawX = centerX + (rawX - centerX) * sensitivityScale;
  rawY = centerY + (rawY - centerY) * sensitivityScale;
  rawX = Math.max(0, Math.min(screenW, rawX));
  rawY = Math.max(0, Math.min(screenH, rawY));
  return { x: rawX, y: rawY, rangeOK };
}

/** Pure calibration computation: 4 corner pose samples (in the order
 *  TL, TR, BR, BL — matching TrackingSetupWizard's CORNER_TARGETS) →
 *  PoseCalibrationData in the convention the runtime mapping
 *  expects. Math.max/min ensures correct ordering by construction
 *  even if the user's camera or pose detection produces noisy
 *  corner samples. */
export function computeCalibrationFromCorners(
  samples: ReadonlyArray<{ x: number; y: number }>,
): PoseCalibrationData {
  if (samples.length !== 4) throw new Error('expected exactly 4 corner samples');
  const mx = (v: number) => 1.0 - v;
  const allMxX = samples.map((s) => mx(s.x));
  const allY = samples.map((s) => s.y);
  return {
    leftX: Math.max(...allMxX),
    rightX: Math.min(...allMxX),
    topY: Math.min(...allY),
    bottomY: Math.max(...allY),
  };
}

/** Online (no-wizard) calibration learner — observes the user's
 *  actual pose range as they use the app and produces a calibration
 *  that matches their real motion envelope. Built for accessibility
 *  users (the kind who can't complete a formal corner-pointing
 *  wizard but can still slowly point their finger / move their head
 *  during normal use). User request 2026-05-08: "math should be
 *  working as soon as head/nose detected ... auto correct / learn
 *  on the fly, don't rely on a settings result".
 *
 *  Strategy: keep a sliding window of the last ~10 seconds of pose
 *  samples (300 at 30Hz). Use the 5th and 95th percentile as the
 *  user's effective range — robust to MediaPipe outliers without
 *  requiring the user to ever physically reach the absolute extremes.
 *  Re-emits a calibration every UPDATE_EVERY frames once enough
 *  samples are buffered. */
export class OnlineCalibrationLearner {
  private bufX: number[] = [];
  private bufY: number[] = [];
  private frameCount = 0;
  private readonly MAX_SAMPLES: number;
  private readonly MIN_SAMPLES: number;
  private readonly UPDATE_EVERY: number;
  private readonly LO_PERCENTILE: number;
  private readonly HI_PERCENTILE: number;

  constructor(opts: {
    maxSamples?: number;
    minSamples?: number;
    updateEvery?: number;
    loPercentile?: number;
    hiPercentile?: number;
  } = {}) {
    this.MAX_SAMPLES = opts.maxSamples ?? 300;
    this.MIN_SAMPLES = opts.minSamples ?? 60;
    this.UPDATE_EVERY = opts.updateEvery ?? 30;
    this.LO_PERCENTILE = opts.loPercentile ?? 0.05;
    this.HI_PERCENTILE = opts.hiPercentile ?? 0.95;
  }

  push(mirroredX: number, normY: number): void {
    this.bufX.push(mirroredX);
    this.bufY.push(normY);
    if (this.bufX.length > this.MAX_SAMPLES) {
      this.bufX.shift();
      this.bufY.shift();
    }
    this.frameCount++;
  }

  /** Returns null until enough samples have accumulated, then a
   *  fresh calibration on every UPDATE_EVERY-th call. */
  maybeEmitCalibration(): PoseCalibrationData | null {
    if (this.bufX.length < this.MIN_SAMPLES) return null;
    if (this.frameCount % this.UPDATE_EVERY !== 0) return null;
    return this.snapshot();
  }

  /** Force-compute a calibration from current samples (for tests
   *  / on-demand commits — bypasses the UPDATE_EVERY gate). */
  snapshot(): PoseCalibrationData | null {
    if (this.bufX.length < this.MIN_SAMPLES) return null;
    const xs = [...this.bufX].sort((a, b) => a - b);
    const ys = [...this.bufY].sort((a, b) => a - b);
    const loIdx = Math.floor(xs.length * this.LO_PERCENTILE);
    const hiIdx = Math.min(xs.length - 1, Math.floor(xs.length * this.HI_PERCENTILE));
    return {
      // leftX/rightX convention: leftX = LARGER mirroredX.
      leftX: xs[hiIdx],
      rightX: xs[loIdx],
      topY: ys[loIdx],
      bottomY: ys[hiIdx],
    };
  }

  size(): number { return this.bufX.length; }
  reset(): void { this.bufX = []; this.bufY = []; this.frameCount = 0; }
}

function getOrientation(): 'landscape' | 'portrait' {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

function calibrationKey(orientation?: 'landscape' | 'portrait'): string {
  return `prism-pose-calibration-${orientation || getOrientation()}`;
}

/** Practical floor for a USABLE saved pose calibration range. Narrower
 *  than this and the cursor barely responds across the screen — the
 *  user is better off with DEFAULT_CALIBRATION until they re-run the
 *  wizard. The wizard's captureCorner now produces a DEFAULT-width
 *  fallback when corner samples cluster (rangeX≈0.70), so legitimate
 *  wizard outputs always exceed this floor; cals below the floor
 *  are degenerate residue from older builds and should be discarded. */
const MIN_PRACTICAL_SAVED_RANGE = 0.05;

function isUsableCornerCalibration(c: unknown): c is PoseCalibrationData {
  if (!isValidCornerCalibration(c)) return false;
  const cal = c as PoseCalibrationData;
  const rangeX = Math.abs(cal.leftX - cal.rightX);
  const rangeY = Math.abs(cal.bottomY - cal.topY);
  return rangeX >= MIN_PRACTICAL_SAVED_RANGE && rangeY >= MIN_PRACTICAL_SAVED_RANGE;
}

export function loadPoseCalibration(): PoseCalibrationData {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION;
  // Shared NaN-defense (isValidCornerCalibration) PLUS narrow-range
  // defense (isUsableCornerCalibration). A previously-saved
  // degenerate cal (rangeX≈0.02 from the May 2026 sofa scenario)
  // would pin the cursor to a 2 % pose region, leaving the user
  // unable to reach Settings to re-calibrate. Returning
  // DEFAULT_CALIBRATION on degenerate load gives them a working
  // cursor by default, and the wizard's online learner will adapt
  // from there.
  try {
    const raw = localStorage.getItem(calibrationKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isUsableCornerCalibration(parsed)) return parsed;
      console.warn('[PoseTracker] saved cal rejected — too narrow / invalid; using defaults');
    }
    // Try legacy key
    const legacy = localStorage.getItem('prism-pose-calibration');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (isUsableCornerCalibration(parsed)) return parsed;
    }
  } catch { /* use defaults */ }
  return DEFAULT_CALIBRATION;
}

export function savePoseCalibration(data: PoseCalibrationData): void {
  try { localStorage.setItem(calibrationKey(), JSON.stringify(data)); } catch { /* */ }
}

export function hasCalibration(orientation?: 'landscape' | 'portrait'): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(calibrationKey(orientation));
}

export { getOrientation };

// ── Pose Mapping Persistence ────────────────────────────────────────────────

const POSE_CONFIG_KEY = 'prism-pose-config';

export function savePoseMapping(mapping: PoseMapping): void {
  try { localStorage.setItem(POSE_CONFIG_KEY, JSON.stringify(mapping)); } catch { /* */ }
}

const VALID_TRACKING_TARGETS = new Set(['nose', 'left-eye', 'right-eye', 'left-shoulder', 'right-shoulder', 'left-wrist', 'right-wrist', 'left-index', 'right-index']);

/** Validate the pose mapping. trackingTarget must be one of the
 *  enum values (a tampered string could land in `LANDMARK_INDEX[c]`
 *  lookup and downstream switch — the lookup would no-op via the
 *  `idx === undefined` guard, but better to fail closed at load
 *  time). cursorSmoothing must be a finite number; the consumer
 *  already clamps to [0.05, 0.3] so any in-range number is safe. */
function isValidPoseMapping(m: unknown): m is PoseMapping {
  if (!m || typeof m !== 'object') return false;
  const x = m as Record<string, unknown>;
  if (typeof x.trackingTarget !== 'string' || !VALID_TRACKING_TARGETS.has(x.trackingTarget)) return false;
  if (typeof x.cursorSmoothing !== 'number' || !Number.isFinite(x.cursorSmoothing)) return false;
  return true;
}

export function loadPoseMapping(): PoseMapping {
  const fallback: PoseMapping = { trackingTarget: 'nose', cursorSmoothing: 0.1 };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(POSE_CONFIG_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return isValidPoseMapping(parsed) ? parsed : fallback;
  } catch { /* use defaults */ }
  return fallback;
}

// ── Internals ───────────────────────────────────────────────────────────────

const TARGET_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

// ── Camera Helpers ──────────────────────────────────────────────────────────

/**
 * Detect if a camera is rear/environment-facing by label heuristics.
 */
async function isEnvironmentCamera(deviceId: string): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const device = devices.find(d => d.deviceId === deviceId);
    if (!device) return false;
    const label = device.label.toLowerCase();
    return label.includes('back') || label.includes('rear') || label.includes('environment');
  } catch {
    return false;
  }
}

// ── Active tracker reference (for stopPoseTracker) ─────────────────────────

let activeHandle: PoseTrackerHandle | null = null;

// Wizard calibration freeze — when the TrackingSetupWizard is active, the
// online learner must NOT overwrite the saved calibration. The wizard is
// the authoritative calibration source; the learner's job is to adapt AFTER
// the wizard completes, not sabotage in-progress captures.
//
// Without this flag the learner overwrites DEFAULT_CALIBRATION (set at
// wizard-start) within seconds, producing a biased midpoint that leaves
// the cursor persistently off-center during wizard Steps 1 and 2.
//
// Usage: wizard calls freezeLearnerCalSaves() on "Get Started" and
// unfreezeLearnerCalSaves() on onComplete / onCancel.
let _learnerCalSavesFrozen = false;
export function freezeLearnerCalSaves(): void { _learnerCalSavesFrozen = true; }
export function unfreezeLearnerCalSaves(): void { _learnerCalSavesFrozen = false; }

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Start body pose tracking.
 *
 * @param opts - Tracking options including which body part to track
 * @param cameraDeviceId - Optional camera device ID. If omitted, uses default front camera.
 * @param videoElement - Optional existing video element to reuse (e.g. from head tracking).
 *   If provided, the service will share the existing camera stream instead of opening a new one.
 */
export function startPoseTracker(
  opts: PoseTrackerOptions,
  cameraDeviceId?: string,
  videoElement?: HTMLVideoElement,
): PoseTrackerHandle {
  // Stop any existing tracker first
  if (activeHandle) {
    activeHandle.stop();
    activeHandle = null;
  }

  // Test escape-hatch: when window.__POSE_TEST_DRIVE === true, skip
  // MediaPipe + camera entirely and return a tracker driven by
  // window.__simulatePose / window.__simulatePoseLost. Used by the
  // wizard scenario harness (scripts/wizard-scenarios.mjs) so static
  // photos can serve as PIP backdrops while the wizard's phase
  // machine is exercised deterministically. NO-OP in production —
  // the flag is never set on prod-served HTML.
  if (typeof window !== 'undefined' &&
      (window as unknown as { __POSE_TEST_DRIVE?: boolean }).__POSE_TEST_DRIVE) {
    return startTestDrivenTracker(opts);
  }

  let stopped = false;
  let rafId = 0;
  let video: HTMLVideoElement | null = null;
  let cameraLease: CameraLease | null = null; // Set if we acquired via cameraStream
  const abortController = new AbortController();

  // Aggregate ('any_*') and concrete targets are both resolved per-frame in
  // the detection loop — see resolveAggregateTarget + the FALLBACK_CHAIN
  // walks. No static index is computed here.

  // Smoothed cursor
  let sx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  let sy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

  // Identity-lock anchor (last-known nose position in normalized 0-1 coords).
  // Set when MediaPipe returns a confidently-tracked nose; used to choose the
  // correct pose when multiple are returned in a frame, so the cursor doesn't
  // jump to a sibling who walks behind the user.
  let lockedAnchor: { x: number; y: number } | null = null;
  let lockedAnchorTimestamp = 0;
  // Diagnostic throttle — see the tick loop. Last timestamp we logged a
  // "no detection" message; prevents 15fps console flooding.
  let detectionLogThrottle = 0;
  // Tracks consecutive frames where landmarks came back but every entry
  // was below the visibility floor — useful to surface "the model sees
  // you but everything is occluded" in dev tools.
  let lowVisStreak = 0;

  // Dwell tracking
  let dwellElement: Element | null = null;
  let dwellStart = 0;
  let dwellTriggered = false;
  let lastFrameTime = 0;

  const loadedCal = loadPoseCalibration();
  // CORRUPT-NARROW DEFENSE: if the saved cal has a tiny range
  // (< 0.10 normalized on either axis), treat it as corrupt and
  // reset to factory defaults so bootstrap mode can rebuild from
  // observation. User report 2026-05-08: a stuck wizard saved
  // L=0.524 R=0.493 (rangeX=0.031) — head-still motion baked
  // into permanent calibration → cursor jumped across the screen
  // on every tiny head wobble. Threshold 0.10 is well below any
  // legitimate user range; corrupt cals are typically < 0.05.
  const RECOVERY_MIN_RANGE = 0.10;
  const loadedRangeX = loadedCal.leftX - loadedCal.rightX;
  const loadedRangeY = loadedCal.bottomY - loadedCal.topY;
  const isCorruptNarrow = loadedRangeX < RECOVERY_MIN_RANGE || loadedRangeY < RECOVERY_MIN_RANGE
    || loadedRangeX < 0 || loadedRangeY < 0;
  if (isCorruptNarrow) {
    console.warn(
      `[PoseTracker] CORRUPT-NARROW saved calibration detected ` +
      `(rangeX=${loadedRangeX.toFixed(3)}, rangeY=${loadedRangeY.toFixed(3)}) ` +
      `— resetting to defaults so adaptive bootstrap can rebuild.`
    );
  }
  const calibration: PoseCalibrationData = isCorruptNarrow
    ? { ...DEFAULT_CALIBRATION }
    : loadedCal;
  if (isCorruptNarrow) {
    try { savePoseCalibration(calibration); } catch { /* */ }
  }
  // After possible reset, detect whether we're at factory defaults
  // (drives the learner's blend mode below: bootstrap vs expand-only).
  const isFactoryDefaults =
    Math.abs(calibration.leftX - DEFAULT_CALIBRATION.leftX) < 0.001 &&
    Math.abs(calibration.rightX - DEFAULT_CALIBRATION.rightX) < 0.001 &&
    Math.abs(calibration.topY - DEFAULT_CALIBRATION.topY) < 0.001 &&
    Math.abs(calibration.bottomY - DEFAULT_CALIBRATION.bottomY) < 0.001;
  const sensitivityScale = opts.sensitivity / 5;
  // Online learner — observes the user's actual pose envelope. In
  // bootstrap mode (no wizard run yet) it can fully populate the
  // calibration from observed motion. In expand-only mode (wizard
  // ran) it can only widen the rect when the user reaches further
  // than the wizard captured — never shrinks the wizard's truth.
  const learner = new OnlineCalibrationLearner();
  let lastLearnerCommitFrame = 0;

  // ── Stabilization stack (TRACKING_RELIABILITY.md D + E + F) ─────────────
  // Smoother: confidence-aware One Euro Filter (Casiez CHI 2012).
  // Two parameters (`mincutoff`, `beta`) instead of Kalman's Q/R
  // tuning. The confidence-aware wrapper modulates `mincutoff` with
  // MediaPipe's per-landmark visibility — low-vis frames smooth
  // harder, high-vis frames track responsively.
  //
  // Tuning: mincutoff 1.0 Hz at high confidence (Casiez recommended
  // starting value); 0.3 Hz at low confidence (heavy smoothing for
  // partly-out-of-frame poses). beta 0.007 keeps lag low during
  // deliberate fast moves. Both are conservative defaults; the
  // adaptive cutoff handles the rest.
  const oneEuroX = new ConfidenceAwareOneEuro({
    freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
  });
  const oneEuroY = new ConfidenceAwareOneEuro({
    freq: 30, mincutoffHigh: 1.0, mincutoffLow: 0.3, beta: 0.007,
  });
  let oneEuroInitialized = false;
  // Ego-motion suppression: previous-frame landmark snapshot. When
  // ALL landmarks shift uniformly (zero per-landmark residual), the
  // CAMERA moved (car bump, lap-held laptop wobble), not the user.
  // classifyMotion returns isEgoMotion=true and we skip onMove.
  let prevLandmarksForEgo: Point2D[] | null = null;
  // Baseline tracker — exp-averaged pose center + variance, lets us
  // detect slow drift (auto-focus shift, user shifted in seat) and
  // suggest calibration corrections without forcing recalibration.
  const baselineTracker = new BaselineTracker();
  let lastBaselineApplyTime = 0;
  // FPS watchdog (TRACKING_RELIABILITY.md item D + research review):
  // detect thermal throttling on iPad mini 6 / low-end devices and
  // surface a starvation event so the UI can warn the caregiver
  // (or, in a future commit, swap to MoveNet Lightning).
  const fpsWatchdog = new FpsWatchdog({
    starvationThresholdFps: 12, // < 12 fps for 3s → starved
    starvationConsecutiveMs: 3000,
  });
  let starvationEventDispatched = false;

  // Clamp cursor smoothing to valid range
  const cursorAlpha = Math.max(0.05, Math.min(0.3, opts.cursorSmoothing));

  opts.onStatusChange('starting');

  // ── Initialize camera + model ────────────────────────────────────────

  (async () => {
    // Step 1: Set up video source
    if (videoElement && videoElement.srcObject) {
      // Legacy path — caller passed an explicit video element.
      // Used by tests and pre-singleton callers; bypasses cameraStream.
      video = videoElement;
    } else {
      // Reject environment-facing cameras BEFORE acquiring (the singleton
      // doesn't apply this policy — that's a body/head-tracker concern).
      if (cameraDeviceId) {
        const isBack = await isEnvironmentCamera(cameraDeviceId);
        if (isBack) {
          opts.onStatusChange('stopped');
          return;
        }
      }

      try {
        // Refcounted acquire — if head-tracker is already using the same
        // camera at the same resolution, we get the SAME video element
        // and getUserMedia is NOT called twice (gap G).
        const lease = await acquireCamera({
          deviceId: cameraDeviceId,
          width: 320,
          height: 240,
        });

        // Abort check: if stopped during async acquire.
        if (stopped || abortController.signal.aborted) {
          lease?.release();
          return;
        }

        if (!lease) {
          console.error('[PoseTracker] Camera acquire failed (permission denied or no device).');
          opts.onStatusChange('stopped');
          return;
        }

        // Defense in depth — even if we passed facingMode:'user' to
        // acquireCamera, some devices may report environment via
        // settings. Drop the lease if so.
        const stream = lease.video.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        const settings = track?.getSettings?.();
        if (settings?.facingMode === 'environment') {
          lease.release();
          opts.onStatusChange('stopped');
          return;
        }

        cameraLease = lease;
        video = lease.video;
      } catch (camErr) {
        console.error('[PoseTracker] Camera access failed:', camErr instanceof Error ? camErr.message : camErr);
        opts.onStatusChange('stopped');
        return;
      }
    }

    if (stopped) return;
    if (!video || video.readyState < 2) {
      // Wait for video to be ready if reusing an element
      if (video) {
        await new Promise<void>((resolve) => {
          if (video!.readyState >= 2) { resolve(); return; }
          video!.addEventListener('loadeddata', () => resolve(), { once: true });
          setTimeout(resolve, 3000);
        });
      }
      if (!video || video.readyState < 2) {
        opts.onStatusChange('stopped');
        return;
      }
    }

    // Step 2: Initialize MediaPipe Pose Landmarker (and optionally FaceLandmarker for iris/gaze)
    if (opts.useEyeGaze) {
      // Fire-and-forget — iris blend will start as soon as it's ready;
      // cursor still works from pose-only in the meantime.
      void initFaceLandmarkerForGaze();
    }
    const modelReady = await initPoseLandmarker();
    if (!modelReady) {
      console.error('[PoseTracker] Model failed to load — cursor will use pointer fallback');
      opts.onStatusChange('stopped');
      return;
    }
    if (stopped) {
      opts.onStatusChange('stopped');
      return;
    }
    console.log('[PoseTracker] Model loaded, starting detection loop');

    // Step 3: Start detection loop
    let detecting = false;
    let consecutiveErrors = 0;

    function tick(ts: number) {
      if (stopped) return;
      rafId = requestAnimationFrame(tick);

      if (ts - lastFrameTime < FRAME_INTERVAL_MS) return;
      lastFrameTime = ts;

      if (detecting || !video || video.readyState < 2) return;

      detecting = true;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = (poseLandmarker as any).detectForVideo(video, performance.now());

        let normX: number | null = null;
        let normY: number | null = null;
        let activeTarget = opts.trackingTarget;

        // Diagnostic: every ~1s log what MediaPipe returned. Helps the user
        // tell from devtools whether the model is detecting at all vs
        // detecting but visibility-rejected vs everything fine. Throttled
        // so we don't flood the console at 15fps.
        if (!detectionLogThrottle || ts - detectionLogThrottle > 1000) {
          detectionLogThrottle = ts;
          const nLandmarks = results?.landmarks?.length ?? 0;
          const nDetections = results?.detections?.length ?? 0;
          if (nLandmarks === 0 && nDetections === 0) {
            console.debug('[PoseTracker] no detection — check lighting / camera framing');
          }
        }

        // Hoisted so the post-mapping stabilization stack (Kalman /
        // ego-motion / baseline) below can read the active landmark
        // visibility and full landmark array.
        let frameLandmarks: Array<{ x: number; y: number; visibility?: number }> | null = null;
        let frameChosenVis = 0.5;

        if (useFaceDetectorFallback) {
          const det = results?.detections?.[0];
          if (det?.boundingBox) {
            const bb = det.boundingBox;
            normX = (bb.originX + bb.width / 2) / (video.videoWidth || 640);
            normY = (bb.originY + bb.height / 2) / (video.videoHeight || 480);
            activeTarget = 'nose';
            frameChosenVis = (det as { categories?: Array<{ score?: number }> })
              .categories?.[0]?.score ?? 0.7;
          }
        } else if (results?.landmarks?.length > 0) {
          // Identity locking for multi-person frames: when MediaPipe returns
          // more than one pose (some configurations / scene complexity), pick
          // the pose whose nose-anchor is closest to the previously-locked
          // anchor. Without this, the tracker can jump to a sibling who
          // happens to be slightly more prominent on a given frame.
          let bestPoseIdx = 0;
          if (results.landmarks.length > 1 && lockedAnchor) {
            let bestDist = Number.POSITIVE_INFINITY;
            for (let i = 0; i < results.landmarks.length; i++) {
              const nose = results.landmarks[i][LANDMARK_INDEX.nose];
              if (!nose) continue;
              const dx = nose.x - lockedAnchor.x;
              const dy = nose.y - lockedAnchor.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < bestDist) { bestDist = d; bestPoseIdx = i; }
            }
            // If no pose is within a reasonable radius (~25% of frame), the
            // locked person likely left the frame — fall through and re-lock.
            if (bestDist > 0.25) bestPoseIdx = 0;
          }
          const lm = results.landmarks[bestPoseIdx];

          // Update the anchor (nose position) for next-frame identity lock.
          // Threshold kept low (0.3) so the anchor is set under normal
          // lighting; the multi-pose disambiguation only matters when 2+
          // poses are returned anyway.
          const noseLm = lm[LANDMARK_INDEX.nose];
          if (noseLm && (noseLm.visibility ?? 0) >= 0.3) {
            lockedAnchor = { x: noseLm.x, y: noseLm.y };
            lockedAnchorTimestamp = Date.now();
          } else if (lockedAnchor && Date.now() - lockedAnchorTimestamp > 2000) {
            lockedAnchor = null;
          }

          // Resolve aggregate ('any_*') targets dynamically each frame —
          // pick whichever underlying landmark has higher visibility. Lets
          // the user switch hands or be left-handed without changing config.
          const requested = opts.trackingTarget;
          let chosen: { mark: { x: number; y: number }; target: TrackingTarget; vis: number } | null = null;
          if (requested === 'any_wrist' || requested === 'any_index' || requested === 'any_hand') {
            const agg = resolveAggregateTarget(requested, lm);
            if (agg && agg.vis >= 0.3) {
              chosen = { mark: agg.mark, target: agg.target, vis: agg.vis };
            }
          }

          // Concrete-landmark fallback chain, used both for non-aggregate
          // requests and as a last resort when the aggregate failed (e.g.
          // both wrists below threshold). Two-pass:
          //   A — accept first landmark with vis >= 0.3 (good signal)
          //   B — if A failed, accept first with vis >= 0.1 (weak fallback)
          const FALLBACK_CHAIN: TrackingTarget[] = [
            requested,
            'nose', 'right_wrist', 'left_wrist', 'right_index', 'left_index',
            'right_elbow', 'left_elbow',
          ];
          if (!chosen) {
            for (const target of FALLBACK_CHAIN) {
              if (target === 'any_wrist' || target === 'any_index' || target === 'any_hand') continue;
              const idx = LANDMARK_INDEX[target];
              if (idx === undefined || lm.length <= idx) continue;
              const mark = lm[idx];
              const vis = mark.visibility ?? 0;
              if (vis >= 0.3) { chosen = { mark, target, vis }; break; }
            }
          }
          if (!chosen) {
            // Aggregate weak-signal fallback before going to chain pass B,
            // so a low-vis matching wrist still beats a low-vis nose.
            if (requested === 'any_wrist' || requested === 'any_index' || requested === 'any_hand') {
              const agg = resolveAggregateTarget(requested, lm);
              if (agg && agg.vis >= 0.1) {
                chosen = { mark: agg.mark, target: agg.target, vis: agg.vis };
              }
            }
          }
          if (!chosen) {
            for (const target of FALLBACK_CHAIN) {
              if (target === 'any_wrist' || target === 'any_index' || target === 'any_hand') continue;
              const idx = LANDMARK_INDEX[target];
              if (idx === undefined || lm.length <= idx) continue;
              const mark = lm[idx];
              const vis = mark.visibility ?? 0;
              if (vis >= 0.1) { chosen = { mark, target, vis }; break; }
            }
          }
          if (chosen) {
            normX = chosen.mark.x;
            normY = chosen.mark.y;
            activeTarget = chosen.target;
            frameLandmarks = lm;
            frameChosenVis = chosen.vis;
            if (chosen.vis < 0.3) {
              lowVisStreak += 1;
              if (lowVisStreak === 30 || lowVisStreak === 300) {
                console.debug('[PoseTracker] low confidence (vis=' + chosen.vis.toFixed(2) + ', target=' + chosen.target + ') — try better lighting / move closer');
              }
            } else {
              lowVisStreak = 0;
            }
          } else {
            lowVisStreak += 1;
            if (lowVisStreak === 30) {
              console.debug('[PoseTracker] landmarks present but all below visibility floor — check framing');
            }
          }
        }

        // Eye/iris gaze blend — when useEyeGaze is requested and
        // FaceLandmarker has iris data, blend iris position with pose.
        // Iris moves with GAZE direction (not just head rotation), giving
        // full-screen cursor reach without any head turning.
        // Iris landmarks: 468 = right iris center, 473 = left iris center.
        if (opts.useEyeGaze && normX !== null && normY !== null && faceLandmarkerForGaze) {
          try {
            const faceResult = (faceLandmarkerForGaze as { detectForVideo: (v: HTMLVideoElement, t: number) => { faceLandmarks?: Array<Array<{ x: number; y: number }>> } }).detectForVideo(video!, performance.now());
            const fl = faceResult?.faceLandmarks?.[0];
            const rightIris = fl?.[468];
            const leftIris  = fl?.[473];
            if (rightIris && leftIris) {
              const irisX = (rightIris.x + leftIris.x) / 2;
              const irisY = (rightIris.y + leftIris.y) / 2;
              const w = Math.max(0, Math.min(1, opts.eyeGazeWeight ?? 0.8));
              normX = normX * (1 - w) + irisX * w;
              normY = normY * (1 - w) + irisY * w;
            }
          } catch { /* FaceLandmarker failed — continue with pose-only */ }
        }

        if (normX !== null && normY !== null) {
          consecutiveErrors = 0;

          opts.onStatusChange('tracking', activeTarget);

          // FPS watchdog — only ticks on frames where we got a valid
          // pose, so dropped/blank frames don't artificially deflate
          // the FPS estimate. Dispatch a window event ONCE when the
          // model goes starved so a UI warning can fire.
          fpsWatchdog.tick(typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (!starvationEventDispatched && fpsWatchdog.isStarved()) {
            starvationEventDispatched = true;
            console.warn(`[PoseTracker] FPS STARVED — model running at ${fpsWatchdog.fps().toFixed(1)} fps for >3s. Device may be throttled or model too heavy.`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('prism-pose-starved', {
                detail: { fps: fpsWatchdog.fps() },
              }));
            }
          }

          // Online learning calibration — observe the user's actual
          // pose envelope and adapt on the fly. Replaces the prior
          // expand-only/decay-toward-center logic, which never
          // shrunk the calibration to match a user with limited
          // motion: their actual range stayed inside the wide
          // defaults so expand never fired, and decay-to-center
          // only fired when range was already wider than defaults.
          // Result: accessibility users (the primary AAC audience)
          // never got an effective calibration without completing
          // a formal wizard their motor abilities couldn't pass.
          // User request 2026-05-08: math should work as soon as
          // pose is detected, with auto-correction during use.
          const mirroredX = Math.max(0, Math.min(1, 1.0 - normX));
          const clampedY = Math.max(0, Math.min(1, normY));
          learner.push(mirroredX, clampedY);
          const learned = learner.maybeEmitCalibration();
          if (learned) {
            if (isFactoryDefaults) {
              // BOOTSTRAP MODE — no wizard run yet. Aggressively
              // populate the calibration from the user's observed
              // motion envelope so the cursor starts working
              // without manual calibration. Fast blend on first
              // commit (0.5 → ~50% of observed bounds), slower
              // thereafter (0.1) so subsequent commits gently
              // refine.
              const isFirstCommit = lastLearnerCommitFrame === 0;
              const BLEND = isFirstCommit ? 0.5 : 0.1;
              calibration.leftX = calibration.leftX * (1 - BLEND) + learned.leftX * BLEND;
              calibration.rightX = calibration.rightX * (1 - BLEND) + learned.rightX * BLEND;
              calibration.topY = calibration.topY * (1 - BLEND) + learned.topY * BLEND;
              calibration.bottomY = calibration.bottomY * (1 - BLEND) + learned.bottomY * BLEND;
            } else {
              // EXPAND-ONLY MODE — wizard ran (cal differs from
              // defaults). The wizard captured the user's range
              // with caregiver assistance; that's our floor. We
              // only nudge bounds OUTWARD when we observe the
              // user reaching further. Drift correction
              // (re-centering) is handled by BaselineTracker
              // via offset suggestions further down.
              const EXPAND_BLEND = 0.05;
              if (learned.leftX > calibration.leftX) {
                calibration.leftX += (learned.leftX - calibration.leftX) * EXPAND_BLEND;
              }
              if (learned.rightX < calibration.rightX) {
                calibration.rightX += (learned.rightX - calibration.rightX) * EXPAND_BLEND;
              }
              if (learned.topY < calibration.topY) {
                calibration.topY += (learned.topY - calibration.topY) * EXPAND_BLEND;
              }
              if (learned.bottomY > calibration.bottomY) {
                calibration.bottomY += (learned.bottomY - calibration.bottomY) * EXPAND_BLEND;
              }
            }
            if (!_learnerCalSavesFrozen) {
              try { savePoseCalibration(calibration); } catch { /* */ }
            }
            lastLearnerCommitFrame++;
          }
          calibration.rightX = Math.max(0, Math.min(1, calibration.rightX));
          calibration.leftX = Math.max(0, Math.min(1, calibration.leftX));
          calibration.topY = Math.max(0, Math.min(1, calibration.topY));
          calibration.bottomY = Math.max(0, Math.min(1, calibration.bottomY));

          // Calibration sanity: if the range collapsed (decay outran expand
          // while user was idle, or stale localStorage from a buggy build),
          // the cursor pins near center. 0.30 is a forgiving threshold —
          // narrower than that and the cursor barely responds across the
          // screen anyway, even if technically not "collapsed". Reset to
          // wide defaults; the adapt step rebuilds the user's actual range.
          // Also: if rightX > leftX (i.e. inverted/swapped — corrupt data),
          // reset unconditionally.
          // Defensive guard ONLY for inverted/zero ranges — users
          // with limited motion (e.g. AAC users with motor
          // disability) routinely operate inside a 0.05–0.20
          // pose-space range, and the prior 0.30 floor reset their
          // calibration to defaults every frame. The online learner
          // above produces correct ordering by construction; this
          // guard exists for stale localStorage / corrupt data.
          const MIN_RANGE = 0.02;
          let rangeX = calibration.leftX - calibration.rightX;
          let rangeY = calibration.bottomY - calibration.topY;
          if (rangeX < MIN_RANGE || rangeY < MIN_RANGE || rangeX < 0 || rangeY < 0) {
            console.warn(
              '[PoseTracker] CALIBRATION INVALID — saved cal had ' +
              'rangeX=' + rangeX.toFixed(3) + ' rangeY=' + rangeY.toFixed(3) +
              ' (need both ≥ 0.02 + positive). Resetting to defaults; ' +
              'online learner will adapt within ~2 seconds. leftX=' +
              calibration.leftX.toFixed(3) + ' rightX=' + calibration.rightX.toFixed(3) +
              ' topY=' + calibration.topY.toFixed(3) +
              ' bottomY=' + calibration.bottomY.toFixed(3)
            );
            calibration.leftX = DEFAULT_CALIBRATION.leftX;
            calibration.rightX = DEFAULT_CALIBRATION.rightX;
            calibration.topY = DEFAULT_CALIBRATION.topY;
            calibration.bottomY = DEFAULT_CALIBRATION.bottomY;
            try { savePoseCalibration(calibration); } catch {}
            rangeX = calibration.leftX - calibration.rightX;
            rangeY = calibration.bottomY - calibration.topY;
          }

          let rawX = ((mirroredX - calibration.rightX) / rangeX) * window.innerWidth;
          let rawY = ((normY - calibration.topY) / rangeY) * window.innerHeight;

          // Sensitivity
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          rawX = centerX + (rawX - centerX) * sensitivityScale;
          rawY = centerY + (rawY - centerY) * sensitivityScale;

          // Clamp
          rawX = Math.max(0, Math.min(window.innerWidth, rawX));
          rawY = Math.max(0, Math.min(window.innerHeight, rawY));

          // ── Ego-motion compensation (TRACKING_RELIABILITY.md item E) ──
          //
          // CRITICAL: the rigid-majority subset MUST exclude landmarks
          // that move with the tracked body part. For nose/head
          // tracking, ears move WITH the head — including them in
          // "rigid majority" causes RANSAC to classify normal head
          // movement as camera shake and suppress every cursor update
          // (user report 2026-05-08, Image #32). Subset is target-
          // dependent.
          //
          // Threshold raised from 0.005 → 0.03 normalized: small
          // natural body sway (breathing, posture micro-adjustments)
          // produces ~0.005-0.015 of frame-to-frame transform that
          // we DO want to track, not suppress. 0.03 only catches
          // genuine camera shocks (vehicle bump, lap wobble).
          const isHeadTracking = activeTarget === 'nose';
          const SAFE_LANDMARK_INDICES_HEAD = [11, 12, 23, 24]; // shoulders + hips ONLY
          const SAFE_LANDMARK_INDICES_BODY = [7, 8, 11, 12, 23, 24]; // ears + shoulders + hips
          const safeIndices = isHeadTracking
            ? SAFE_LANDMARK_INDICES_HEAD
            : SAFE_LANDMARK_INDICES_BODY;

          const currLandmarksForEgo: Point2D[] = [];
          if (frameLandmarks) {
            for (const idx of safeIndices) {
              const p = frameLandmarks[idx];
              if (p && (p.visibility ?? 0) >= 0.5) {
                currLandmarksForEgo.push({ x: p.x, y: p.y });
              }
            }
          }
          let cameraTransform: SimilarityTransform = { ...IDENTITY_TRANSFORM };
          let cameraTransformInliers = 0;
          if (prevLandmarksForEgo && currLandmarksForEgo.length >= 3 &&
              prevLandmarksForEgo.length === currLandmarksForEgo.length) {
            const fit = fitSimilarityRansac(prevLandmarksForEgo, currLandmarksForEgo, {
              iterations: 12,
              inlierThreshold: 0.01,
              minInliers: 3,
            });
            cameraTransform = fit.transform;
            cameraTransformInliers = fit.inlierCount;
          }
          if (currLandmarksForEgo.length > 0) prevLandmarksForEgo = currLandmarksForEgo;

          const transformMagnitude = Math.hypot(cameraTransform.tx, cameraTransform.ty)
            + Math.abs(Math.log(cameraTransform.scale))
            + Math.abs(cameraTransform.theta);
          // Binary ego-motion suppression DISABLED 2026-05-08 after
          // user reports of "can't pass step 1, stayed still". The
          // detector kept finding rigid-camera-motion in normal
          // sitting (breathing, micro-posture, head moving toward
          // the center target) and freezing the cursor for the
          // user. The One Euro smoother (Stage 5) already handles
          // ongoing jitter via its noise-floor-modulated cutoff —
          // that path is robust and well-tested. The continuous
          // ego-motion subtraction (research roadmap Step 2.5) is
          // the proper fix; until then, NEVER suppress and let the
          // smoother carry the load. cameraTransform is still
          // computed and exposed via the diag event for visibility.
          const suppressForEgoMotion = false;
          // Touch the variables so TS doesn't complain about unused.
          void cameraTransformInliers;
          void transformMagnitude;

          // ── Confidence-aware One Euro smoothing (item D) ──
          // Casiez CHI 2012. MediaPipe + Chromium use One Euro for
          // real-time UI input; it tracks the jitter-vs-lag trade-off
          // better than Kalman on noisy variable-confidence streams.
          // The confidence-aware wrapper modulates `mincutoff` with
          // visibility, so low-confidence frames smooth harder.
          const measurementConfidence = Math.max(0.05, Math.min(1, frameChosenVis));
          if (!oneEuroInitialized) {
            oneEuroX.snapTo(rawX);
            oneEuroY.snapTo(rawY);
            oneEuroInitialized = true;
          }
          const nowMs = Date.now();
          if (suppressForEgoMotion) {
            // During ego-motion, hold the previous filtered value.
            // (One Euro doesn't have an explicit predict-step like
            // Kalman, but skipping the update is equivalent — the
            // filter just doesn't advance until the next non-ego
            // frame.)
            sx = oneEuroX.value;
            sy = oneEuroY.value;
          } else {
            sx = oneEuroX.update(rawX, measurementConfidence, nowMs);
            sy = oneEuroY.update(rawY, measurementConfidence, nowMs);
          }

          // ── Baseline drift correction (item F) + live noise floor ──
          if (!suppressForEgoMotion) {
            baselineTracker.push({ normX: mirroredX, normY: clampedY, timestamp: Date.now() });
            // Live noise → smoother cutoff. Quiet user keeps responsive
            // tracking; jittery environment / spasticity gets heavier
            // smoothing automatically without the user touching settings.
            // The noise floor is RMS of running variance over a 30s
            // half-life, so it's slow-moving and won't flap with single
            // bad frames.
            const noise = baselineTracker.getNoiseFloor();
            oneEuroX.setNoiseFloor(noise);
            oneEuroY.setNoiseFloor(noise);

            const now = Date.now();
            if (now - lastBaselineApplyTime > 5000) {
              lastBaselineApplyTime = now;
              const correction = baselineTracker.suggestCorrection(now);
              if (correction?.kind === 'offset') {
                const dx = correction.deltaNormX ?? 0;
                const dy = correction.deltaNormY ?? 0;
                calibration.leftX = Math.max(0, Math.min(1, calibration.leftX + dx));
                calibration.rightX = Math.max(0, Math.min(1, calibration.rightX + dx));
                calibration.topY = Math.max(0, Math.min(1, calibration.topY + dy));
                calibration.bottomY = Math.max(0, Math.min(1, calibration.bottomY + dy));
                try { savePoseCalibration(calibration); } catch {}
              }
            }
          }

          if (!suppressForEgoMotion) {
            opts.onMove(sx, sy);
          }

          // Emit raw normalized coords + diagnostic state for the
          // calibration UI / wizard diag panel.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('prism-pose-sample', {
              detail: {
                normX, normY,
                noiseFloor: baselineTracker.getNoiseFloor(),
                visibility: frameChosenVis,
                egoSuppressed: suppressForEgoMotion,
              },
            }));
          }

          // ── Dwell Detection ───────────────────────────────────────
          const elementUnder = document.elementFromPoint(sx, sy);
          const interactiveEl = elementUnder?.closest(
            'button, a, [role="button"], [data-dwell-target], .aac-btn'
          ) ?? elementUnder;

          if (interactiveEl && interactiveEl === dwellElement) {
            if (!dwellTriggered && Date.now() - dwellStart >= opts.dwellMs) {
              dwellTriggered = true;
              // Feed the adaptive engine: actual dwell-to-trigger latency teaches
              // the system the child's motor rhythm. Async require keeps the
              // hot path tight — module is tiny and already preloaded by speak().
              try {
                import('./adaptiveEngine').then((m) => m.recordDwell(Date.now() - dwellStart));
              } catch {}
              opts.onDwell(interactiveEl);
              if (interactiveEl instanceof HTMLElement) interactiveEl.click();
            }
          } else {
            dwellElement = interactiveEl ?? null;
            dwellStart = Date.now();
            dwellTriggered = false;
          }
        } else {
          // No pose detected
          opts.onStatusChange('lost');
          dwellElement = null;
          dwellStart = 0;
          dwellTriggered = false;
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors > 10) {
          opts.onStatusChange('lost');
        }
      } finally {
        detecting = false;
      }
    }

    rafId = requestAnimationFrame(tick);
  })();

  // ── Handle ────────────────────────────────────────────────────────────

  const handle: PoseTrackerHandle = {
    stop() {
      stopped = true;
      abortController.abort();
      cancelAnimationFrame(rafId);

      // Refcounted release — only stops the stream if we were the last
      // consumer. If head-tracker is still using the same camera, the
      // singleton keeps the stream alive for it.
      if (cameraLease) {
        cameraLease.release();
        cameraLease = null;
      }

      // Don't manually remove the video element when leased — the
      // singleton owns its lifecycle. Only nullify our reference.
      // For the legacy `videoElement` reuse path, we never owned the
      // element either, so no removal is needed there either.
      video = null;
      opts.onStatusChange('stopped');

      if (activeHandle === handle) {
        activeHandle = null;
      }
    },
    get videoElement() {
      return video;
    },
    setCalibration(data: PoseCalibrationData) {
      calibration.leftX = data.leftX;
      calibration.rightX = data.rightX;
      calibration.topY = data.topY;
      calibration.bottomY = data.bottomY;
      try { savePoseCalibration(calibration); } catch { /* */ }
    },
  };

  activeHandle = handle;
  return handle;
}

// ── Module-level stop (convenience) ─────────────────────────────────────────

/**
 * Stop the currently active pose tracker, if any.
 */
export function stopPoseTracker(): void {
  if (activeHandle) {
    activeHandle.stop();
    activeHandle = null;
  }
}

// ── Test-driven tracker (gated on window.__POSE_TEST_DRIVE) ─────────────────
//
// Provides window.__simulatePose(target, normX, normY, vis?) and
// window.__simulatePoseLost() so a Playwright/vitest driver can step the
// wizard through every phase using synthetic landmarks while a real
// photograph plays in the PIP via canvas.captureStream. All real users
// hit the production code path above; this branch is unreachable unless
// the flag is set BEFORE the bundle loads (page.addInitScript).

interface PoseTestDriveAPI {
  simulatePose: (target: TrackingTarget, normX: number, normY: number, vis?: number) => void;
  simulatePoseLost: () => void;
}

function startTestDrivenTracker(opts: PoseTrackerOptions): PoseTrackerHandle {
  let stopped = false;
  // Status flips to 'starting' synchronously, mirroring the real path.
  opts.onStatusChange('starting');

  const api: PoseTestDriveAPI = {
    simulatePose(target, normX, normY, vis = 0.9) {
      if (stopped) return;
      opts.onStatusChange('tracking', target);
      // Wizard listens for prism-pose-sample to fill its sample buffer.
      // Detail mirrors what the real tick() loop dispatches.
      window.dispatchEvent(new CustomEvent('prism-pose-sample', {
        detail: {
          normX, normY,
          visibility: vis,
          noiseFloor: 0.005,
          egoSuppressed: false,
        },
      }));
    },
    simulatePoseLost() {
      if (stopped) return;
      opts.onStatusChange('lost');
    },
  };

  const w = window as unknown as {
    __simulatePose?: PoseTestDriveAPI['simulatePose'];
    __simulatePoseLost?: PoseTestDriveAPI['simulatePoseLost'];
  };
  w.__simulatePose = api.simulatePose;
  w.__simulatePoseLost = api.simulatePoseLost;

  const handle: PoseTrackerHandle = {
    stop() {
      stopped = true;
      opts.onStatusChange('stopped');
      if (activeHandle === handle) activeHandle = null;
    },
    videoElement: null,
    setCalibration(_data: PoseCalibrationData) { /* no-op in test mode */ },
  };
  activeHandle = handle;
  return handle;
}
