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
}

export interface PoseTrackerHandle {
  stop: () => void;
  videoElement: HTMLVideoElement | null;
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
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
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
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
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

export function loadPoseCalibration(): PoseCalibrationData {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION;
  // Shared NaN-defense — same predicate as headTracker.loadCalibration.
  // Imported from lib/safeValidation to avoid drift across the two
  // tracker callers.
  try {
    const raw = localStorage.getItem(calibrationKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidCornerCalibration(parsed)) return parsed;
    }
    // Try legacy key
    const legacy = localStorage.getItem('prism-pose-calibration');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (isValidCornerCalibration(parsed)) return parsed;
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

  const calibration = loadPoseCalibration();
  const sensitivityScale = opts.sensitivity / 5;
  // Online learner — observes the user's actual pose envelope as
  // they use the app and updates calibration on the fly. No wizard
  // required; it's the primary path for accessibility users who
  // can't complete formal calibration. (Wizard, if completed,
  // seeds the saved calibration — the learner refines from there.)
  const learner = new OnlineCalibrationLearner();
  let lastLearnerCommitFrame = 0;

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

    // Step 2: Initialize MediaPipe Pose Landmarker
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

        if (useFaceDetectorFallback) {
          const det = results?.detections?.[0];
          if (det?.boundingBox) {
            const bb = det.boundingBox;
            normX = (bb.originX + bb.width / 2) / (video.videoWidth || 640);
            normY = (bb.originY + bb.height / 2) / (video.videoHeight || 480);
            activeTarget = 'nose';
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

        if (normX !== null && normY !== null) {
          consecutiveErrors = 0;

          opts.onStatusChange('tracking', activeTarget);

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
            // Blend the learned calibration into the live one with
            // a slow EMA so cursor doesn't lurch when the bounds
            // shift. Faster blend (0.15) when the learner first
            // emits, slower (0.05) once a saved calibration is in
            // place — respects the wizard's contribution.
            const isFirstCommit = lastLearnerCommitFrame === 0;
            const BLEND = isFirstCommit ? 0.5 : 0.05;
            calibration.leftX = calibration.leftX * (1 - BLEND) + learned.leftX * BLEND;
            calibration.rightX = calibration.rightX * (1 - BLEND) + learned.rightX * BLEND;
            calibration.topY = calibration.topY * (1 - BLEND) + learned.topY * BLEND;
            calibration.bottomY = calibration.bottomY * (1 - BLEND) + learned.bottomY * BLEND;
            // Persist every ~5 seconds so a reload starts close to
            // where the user left off. (frameCount is per-tracker;
            // no wall clock available without shipping more state.)
            try { savePoseCalibration(calibration); } catch { /* */ }
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

          // Velocity-adaptive smoothing (blended with user cursorSmoothing)
          const dx = rawX - sx;
          const dy = rawY - sy;
          const velocity = Math.sqrt(dx * dx + dy * dy);
          const screenSize = Math.min(window.innerWidth, window.innerHeight);
          const screenFactor = screenSize < 768 ? 0.5 : screenSize < 1200 ? 0.7 : 1.0;
          const velocitySmooth = velocity < 5
            ? 0.03
            : velocity > 50
              ? 0.2 * screenFactor
              : 0.03 + (velocity - 5) / 45 * (0.2 * screenFactor - 0.03);
          const finalSmooth = Math.min(cursorAlpha, velocitySmooth);
          sx = ema(sx, rawX, finalSmooth);
          sy = ema(sy, rawY, finalSmooth);

          opts.onMove(sx, sy);

          // Emit raw normalized coords for calibration UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('prism-pose-sample', {
              detail: { normX, normY },
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
