'use client';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Head / Eye Tracking — Multi-Camera with Fusion & Failover
 *
 *  Supports 1-4 simultaneous cameras (iPhone dual/triple, external USB).
 *  Each camera runs an independent detection loop. Results are fused:
 *    - Best confidence wins (highest face area = closest/clearest)
 *    - Instant failover: if camera A loses face, camera B takes over
 *    - Multi-cam average: when 2+ cameras see the face, positions are
 *      averaged for higher accuracy (triangulation effect)
 *
 *  Works entirely on-device. No external API calls. Offline-capable.
 *
 *  Reliability primitives (each in its own module — see TRACKING_RELIABILITY.md):
 *    headTrackerStability — drift / probe / edge-pin / fusion
 *    kalmanFilter1D       — confidence-aware smoothing  (gap D)
 *    egoMotion            — camera-shake suppression    (gap E)
 *    crossModalLockout    — gesture/dwell coordination  (gap H)
 *    recalibration        — background drift correction (gap F)
 * ────────────────────────────────────────────────────────────────────────── */

import {
  DriftDetector,
  EdgePinDetector,
} from './headTrackerStability';
import { Kalman1D } from './kalmanFilter1D';
import { classifyMotion } from './egoMotion';
import { isLocked, onGestureClaim } from './crossModalLockout';
import { BaselineTracker } from './recalibration';
import { acquireCamera, type CameraLease } from './cameraStream';
import { emitTrackingEvent } from './trackingTelemetry';

// ── Public Types ────────────────────────────────────────────────────────────

export interface FaceLandmarkData {
  blendshapes: Record<string, number>;
  headPose: { pitch: number; yaw: number; roll: number };
  timestamp: number;
}

export interface HeadTrackerOptions {
  dwellMs: number;
  sensitivity: number;
  smoothing: number;
  onMove: (x: number, y: number) => void;
  onDwell: (element: Element) => void;
  onStatusChange: (status: 'starting' | 'tracking' | 'lost' | 'stopped') => void;
  onLandmarks?: (data: FaceLandmarkData) => void;
  /**
   * Drift safety net — fires when the cursor exceeds the travel threshold
   * within the rolling window WITHOUT landing a dwell-click, OR when face
   * confidence collapses below the floor. Consumer should call .stop() and
   * surface a toast. See services/headTrackerStability.ts.
   */
  onDrift?: (reason: 'cursor-drift' | 'confidence-collapse') => void;
  /** Drift detector tuning (defaults from settingsStore). */
  driftThresholdPx?: number;
  driftWindowMs?: number;
  /** Fire when the post-disable reliability probe says it's safe to re-enable. */
  onAutoRecover?: () => void;
  /**
   * Optional DeviceMotion-aware drift suppression. When the host is shaking
   * (laptop on lap in moving car), the IMU reports it directly — we use
   * that to NOT trigger drift on what's actually environmental motion.
   * Caller wires `services/deviceMotion.ts.startMotionMonitor` and passes
   * a getter that returns the current motion state per frame.
   */
  isDeviceShaking?: () => boolean;
}

export interface HeadTrackerHandle {
  stop: () => void;
  videoElement: HTMLVideoElement | null;
  videoElements: HTMLVideoElement[];
  activeCameraCount: number;
}

// ── Feature Detection ───────────────────────────────────────────────────────

export function isHeadTrackingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(navigator.mediaDevices?.getUserMedia) && typeof HTMLCanvasElement !== 'undefined';
}

function hasFaceDetectorAPI(): boolean {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}

// ── MediaPipe Face Detection (works on ALL browsers via WASM) ───────────────

let mpFaceDetector: unknown = null;
let mpLoadPromise: Promise<void> | null = null;

async function initMediaPipeFace(): Promise<boolean> {
  if (mpFaceDetector) return true;
  if (mpLoadPromise) { await mpLoadPromise; return !!mpFaceDetector; }
  mpLoadPromise = (async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceDetector: MPFace, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      mpFaceDetector = await MPFace.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        // MediaPipe default 0.5. Identity locking via IoU continuity does
        // the multi-face filtering — bumping the floor to 0.7 caused the
        // tracker to lose lock under normal lighting.
        minDetectionConfidence: 0.5,
      });
    } catch {
      mpFaceDetector = null;
    }
  })();
  await mpLoadPromise;
  mpLoadPromise = null;
  return !!mpFaceDetector;
}

// ── FaceLandmarker (478 landmarks + 52 blendshapes + head pose matrix) ─────
// Runs alongside FaceDetector. FaceDetector provides the bounding box for
// cursor tracking; FaceLandmarker provides blendshapes + transformation matrix
// for gesture recognition (lip shapes, blink, head nod/shake).
// Only initialized when onLandmarks callback is provided (gesture mode).

let mpFaceLandmarker: unknown = null;
let mpLandmarkerLoadPromise: Promise<void> | null = null;

async function initMediaPipeFaceLandmarker(): Promise<boolean> {
  if (mpFaceLandmarker) return true;
  if (mpLandmarkerLoadPromise) { await mpLandmarkerLoadPromise; return !!mpFaceLandmarker; }
  mpLandmarkerLoadPromise = (async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      mpFaceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch {
      mpFaceLandmarker = null;
    }
  })();
  await mpLandmarkerLoadPromise;
  mpLandmarkerLoadPromise = null;
  return !!mpFaceLandmarker;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBlendshapes(result: any): Record<string, number> {
  const map: Record<string, number> = {};
  const categories = result?.faceBlendshapes?.[0]?.categories;
  if (!categories) return map;
  for (const c of categories) {
    map[c.categoryName] = c.score;
  }
  return map;
}

function matrixToEuler(matrix: number[]): { pitch: number; yaw: number; roll: number } {
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

// ── Internals ───────────────────────────────────────────────────────────────

const TARGET_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
/**
 * Detections older than this are treated as stale — the corresponding
 * camera's loop has hung or its WebGL context crashed. Used to prevent
 * a frozen-cursor failure mode where the last good detection sticks.
 */
const STALE_DETECTION_MS = 500;
/**
 * Kalman process noise (px²/frame). Tuned for 15 fps with an expected
 * intentional cursor velocity of ±2 px/frame. Higher → snappier but
 * noisier; lower → smoother but laggier.
 */
const KALMAN_PROCESS_NOISE = 4;
/**
 * MediaPipe's face-area "confidence" is typically 0.005..0.05. We
 * scale by 20 to map that into the 0..1 range Kalman1D expects.
 * A 5% face-area share means "rock-solid"; below 0.5% we don't trust it.
 */
const FACE_AREA_TO_KALMAN_SCALE = 20;
/**
 * Anchor-based calibration learning rate. Each successful dwell-click
 * applies this fraction of the cursor-to-target offset to the calibration
 * anchors. Higher = converges faster but more sensitive to a single
 * off-center click. 0.3 = roughly half the error after 2 clicks, 90%
 * after 7 clicks.
 */
const ANCHOR_LEARNING_RATE = 0.3;
/** Below this pixel offset, the cursor was effectively on target — nothing to learn. */
const ANCHOR_MIN_PIXEL_OFFSET = 8;
/**
 * Above this pixel offset, the dwell almost certainly bubbled to a
 * non-intended ancestor (or the user's gaze missed completely). Don't
 * incorporate as ground truth — it would corrupt calibration.
 */
const ANCHOR_MAX_PIXEL_OFFSET = 200;

interface FaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CameraDetection {
  face: FaceRect | null;
  cameraIndex: number;
  confidence: number;
  canvasWidth: number;
  canvasHeight: number;
  timestamp: number;
}

// ── Calibration ─────────────────────────────────────────────────────────────

export interface CalibrationData {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
}

const DEFAULT_CALIBRATION: CalibrationData = {
  leftX: 0.7, rightX: 0.3, topY: 0.3, bottomY: 0.7,
};

/** Validate a calibration record. Tampered persist could otherwise
 *  inject NaN / Infinity / non-number values that propagate through
 *  the cursor mapping math (rangeX = leftX - rightX, divisions by it),
 *  freezing the head-tracker for an AAC user who can't articulate
 *  what's wrong. Bounds: normalized coordinates in (-1, 2) — slightly
 *  generous so off-screen calibration points still work, but
 *  Infinity / NaN / strings always fail. Also requires non-zero
 *  range on each axis so downstream divisions don't blow up. */
function isValidCalibration(c: unknown): c is CalibrationData {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  for (const k of ['leftX', 'rightX', 'topY', 'bottomY'] as const) {
    const v = x[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < -1 || v > 2) return false;
  }
  // Require non-zero ranges or downstream divisions blow up.
  if ((x.leftX as number) === (x.rightX as number)) return false;
  if ((x.topY as number) === (x.bottomY as number)) return false;
  return true;
}

export function loadCalibration(): CalibrationData {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION;
  try {
    const raw = localStorage.getItem('prism-head-calibration');
    if (!raw) return DEFAULT_CALIBRATION;
    const parsed = JSON.parse(raw);
    return isValidCalibration(parsed) ? parsed : DEFAULT_CALIBRATION;
  } catch { /* use defaults */ }
  return DEFAULT_CALIBRATION;
}

export function saveCalibration(data: CalibrationData): void {
  try { localStorage.setItem('prism-head-calibration', JSON.stringify(data)); } catch { /* */ }
}

// ── Camera Source (one per physical camera) ─────────────────────────────────

interface CameraSource {
  index: number;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /**
   * Refcounted lease from `cameraStream`. When held, the camera stream is
   * shared with other consumers (e.g. bodyPoseService); release on stop.
   */
  lease: CameraLease | null;
  nativeDetector: { detect: (source: HTMLVideoElement) => Promise<{ boundingBox: DOMRect }[]> } | null;
  lastDetection: CameraDetection;
  lastLandmarks: FaceLandmarkData | null;
  /**
   * Sparse set of normalized landmark coords (nose, eyes, mouth corners, chin)
   * captured per frame. Used by the ego-motion classifier in tick() to detect
   * whole-frame camera shake. Distinct from `lastLandmarks` which holds
   * blendshapes + head-pose for gesture recognition.
   */
  lastLandmarkPoints: { x: number; y: number }[] | null;
  /** Previous frame's `lastLandmarkPoints` — needed for ego-motion delta. */
  prevLandmarkPoints: { x: number; y: number }[] | null;
  active: boolean;
}

// MediaPipe FaceLandmarker indices for ego-motion centroid tracking.
// Picked to span the full face so the centroid is robust to local motion
// (e.g. blink alone won't shift the centroid much).
//   1   = nose tip
//   33  = right eye outer corner
//   263 = left eye outer corner
//   61  = mouth right corner
//   291 = mouth left corner
//   199 = chin tip
const EGO_MOTION_LANDMARK_INDICES = [1, 33, 263, 61, 291, 199] as const;

function createCameraSource(index: number): CameraSource | null {
  // Placeholder video element — replaced with the lease's shared video
  // in initCameraSource. Kept to avoid a nullable `video` field that
  // would force every call site to null-check.
  const video = document.createElement('video');
  video.muted = true;
  // NOT appended to DOM yet — we'll let cameraStream's lease element
  // be the visible/playing one. This placeholder is just a typing
  // convenience until init runs.

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  return {
    index,
    video,
    canvas,
    ctx,
    lease: null,
    nativeDetector: null,
    lastDetection: { face: null, cameraIndex: index, confidence: 0, canvasWidth: 320, canvasHeight: 240, timestamp: 0 },
    lastLandmarks: null,
    lastLandmarkPoints: null,
    prevLandmarkPoints: null,
    active: false,
  };
}

async function initCameraSource(source: CameraSource, deviceId?: string, abortSignal?: AbortSignal): Promise<boolean> {
  // SAFETY: reject back/environment cameras — they point away from the
  // child and produce garbage face detection. Only front-facing cameras
  // (built-in TrueDepth, external USB webcam aimed at user) are valid.
  if (deviceId) {
    const isBackCamera = await isEnvironmentCamera(deviceId);
    if (isBackCamera) return false;
  }

  try {
    // Refcounted acquire from the cameraStream singleton (gap G). If
    // bodyPoseService already owns this device, we get the SAME video
    // element and getUserMedia is NOT called twice.
    const lease = await acquireCamera({ deviceId, width: 320, height: 240 });
    if (!lease) return false;

    // If component unmounted during getUserMedia (React StrictMode double-mount,
    // user toggled setting off), release the lease immediately.
    if (abortSignal?.aborted) {
      lease.release();
      return false;
    }

    // Defense in depth — the singleton passes facingMode:'user' but
    // some hardware reports environment via track settings.
    const stream = lease.video.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    if (settings?.facingMode === 'environment') {
      lease.release();
      return false;
    }

    source.lease = lease;
    source.video = lease.video;

    await new Promise<void>((resolve) => {
      if (source.video.readyState >= 2) { resolve(); return; }
      source.video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });

    source.canvas.width = source.video.videoWidth || 320;
    source.canvas.height = source.video.videoHeight || 240;

    // Try MediaPipe Face Detection first (works on ALL browsers via WASM).
    // Falls back to Chrome-only FaceDetector API, then skin-color blob.
    await initMediaPipeFace();

    if (!mpFaceDetector && hasFaceDetectorAPI()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source.nativeDetector = new (window as any).FaceDetector({ maxDetectedFaces: 1, fastMode: true });
      } catch { /* fallback to skin blob */ }
    }

    source.active = true;
    return true;
  } catch {
    return false;
  }
}

// IoU between two face rectangles. Used by identity locking to prefer the
// detection that overlaps the previously-tracked face, rather than always
// taking detections[0] — which would let a closer/larger background person
// hijack the cursor.
function iou(a: FaceRect, b: FaceRect): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.width, b.x + b.width);
  const iy2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

// Identity-lock minimum overlap. Below this, we treat a candidate as "not the
// same person" and reject in favor of the previous detection. 0.30 strikes a
// balance between forgiving slight head movement and rejecting jumps to a
// different face entirely.
const IDENTITY_LOCK_IOU = 0.30;
// How long to keep enforcing identity lock after the last good detection.
// After this, any face is allowed (so we re-acquire after the user steps away
// and comes back).
const IDENTITY_LOCK_TIMEOUT_MS = 2000;

function pickIdentityLockedFace(candidates: FaceRect[], previous: FaceRect | null, previousAge: number): FaceRect | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // No prior anchor or anchor is stale — fall back to largest face (closest).
  if (!previous || previousAge > IDENTITY_LOCK_TIMEOUT_MS) {
    return candidates.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
  }
  // Pick the candidate with highest IoU vs. previous; reject all if none clears
  // the threshold (prevents identity-swap to a different person in frame).
  let best: { rect: FaceRect; iou: number } | null = null;
  for (const c of candidates) {
    const o = iou(previous, c);
    if (!best || o > best.iou) best = { rect: c, iou: o };
  }
  if (best && best.iou >= IDENTITY_LOCK_IOU) return best.rect;
  return previous; // hold previous bbox; cursor freezes briefly rather than jumping
}

async function detectFromSource(source: CameraSource): Promise<CameraDetection> {
  if (!source.active || source.video.readyState < 2) {
    return { face: null, cameraIndex: source.index, confidence: 0, canvasWidth: source.canvas.width, canvasHeight: source.canvas.height, timestamp: Date.now() };
  }

  let face: FaceRect | null = null;
  const prev = source.lastDetection.face;
  const prevAge = prev ? Date.now() - source.lastDetection.timestamp : Number.POSITIVE_INFINITY;

  // Tier 1: MediaPipe Face Detection (WASM — works on Safari, Chrome, all browsers)
  if (mpFaceDetector && !face) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (mpFaceDetector as any).detectForVideo(source.video, Date.now());
      const dets = results?.detections ?? [];
      if (dets.length > 0) {
        const candidates: FaceRect[] = dets.map((d: { boundingBox: { originX: number; originY: number; width: number; height: number } }) => ({
          x: d.boundingBox.originX,
          y: d.boundingBox.originY,
          width: d.boundingBox.width,
          height: d.boundingBox.height,
        }));
        face = pickIdentityLockedFace(candidates, prev, prevAge);
      }
    } catch { /* MediaPipe failed — try next tier */ }
  }

  // Tier 2: Native FaceDetector API (Chrome-only)
  if (!face && source.nativeDetector) {
    try {
      const faces = await source.nativeDetector.detect(source.video);
      if (faces.length > 0) {
        const candidates: FaceRect[] = faces.map((f) => ({
          x: f.boundingBox.x,
          y: f.boundingBox.y,
          width: f.boundingBox.width,
          height: f.boundingBox.height,
        }));
        face = pickIdentityLockedFace(candidates, prev, prevAge);
      }
    } catch {
      source.nativeDetector = null;
    }
  }

  // Tier 3 (skin-blob) intentionally removed — see note above. If MediaPipe
  // and native FaceDetector both fail, we report face=null and let the caller
  // mark the camera 'lost' rather than emit garbage coordinates.

  // FaceLandmarker: extract blendshapes + head pose for gesture recognition
  if (mpFaceLandmarker) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lmResult = (mpFaceLandmarker as any).detectForVideo(source.video, Date.now());
      if (lmResult?.faceBlendshapes?.length > 0) {
        const bs = extractBlendshapes(lmResult);
        const matrixData = lmResult.facialTransformationMatrixes?.[0]?.data;
        const headPose = matrixData ? matrixToEuler(Array.from(matrixData)) : { pitch: 0, yaw: 0, roll: 0 };
        source.lastLandmarks = { blendshapes: bs, headPose, timestamp: Date.now() };
      }
      // Sparse landmark snapshot for ego-motion classification (gap E).
      // We only keep ~6 well-spread points so the classifier's centroid is
      // dominated by overall face position, not local features (blink/smile).
      const allLandmarks = lmResult?.faceLandmarks?.[0];
      if (allLandmarks?.length) {
        const sparse: { x: number; y: number }[] = [];
        for (const idx of EGO_MOTION_LANDMARK_INDICES) {
          const p = allLandmarks[idx];
          if (p) sparse.push({ x: p.x, y: p.y });
        }
        if (sparse.length === EGO_MOTION_LANDMARK_INDICES.length) {
          source.lastLandmarkPoints = sparse;
        }
      }
    } catch { /* FaceLandmarker failed — gesture detection degrades gracefully */ }
  }

  const confidence = face ? (face.width * face.height) / (source.canvas.width * source.canvas.height) : 0;

  const detection: CameraDetection = {
    face,
    cameraIndex: source.index,
    confidence,
    canvasWidth: source.canvas.width,
    canvasHeight: source.canvas.height,
    timestamp: Date.now(),
  };
  source.lastDetection = detection;
  return detection;
}

function stopCameraSource(source: CameraSource): void {
  source.active = false;
  // Refcounted release — only stops the underlying stream when the
  // last consumer releases. The singleton owns the video element's
  // DOM lifecycle, so we don't manually .remove() it.
  if (source.lease) {
    source.lease.release();
    source.lease = null;
  }
}

// ── Multi-Camera Fusion ─────────────────────────────────────────────────────

// Active Failover fusion: use the SINGLE best camera (highest confidence).
// DO NOT average coordinates across cameras — cameras at different physical
// positions have incompatible coordinate planes (face at y=0.3 on cam A
// vs y=0.7 on cam B). Averaging produces garbage cursor positions.
//
// Failover: if the best camera loses the face for >3 consecutive frames,
// switch to the next best camera instantly.
const FAILOVER_THRESHOLD = 3;
let primaryCameraIndex = 0;
let lostFrameCount = 0;

function fuseCameraDetections(detections: CameraDetection[]): { normX: number; normY: number } | null {
  const valid = detections.filter(d => d.face !== null);
  if (valid.length === 0) {
    lostFrameCount++;
    return null;
  }

  // Check if current primary camera still has a detection
  const primaryDetection = valid.find(d => d.cameraIndex === primaryCameraIndex);

  if (primaryDetection) {
    lostFrameCount = 0;
    const f = primaryDetection.face!;
    return {
      normX: (f.x + f.width / 2) / primaryDetection.canvasWidth,
      normY: (f.y + f.height / 2) / primaryDetection.canvasHeight,
    };
  }

  // Primary lost face — count consecutive lost frames
  lostFrameCount++;

  if (lostFrameCount >= FAILOVER_THRESHOLD) {
    // Failover: switch to the camera with highest confidence
    const best = valid.reduce((a, b) => a.confidence > b.confidence ? a : b);
    primaryCameraIndex = best.cameraIndex;
    lostFrameCount = 0;
    const f = best.face!;
    return {
      normX: (f.x + f.width / 2) / best.canvasWidth,
      normY: (f.y + f.height / 2) / best.canvasHeight,
    };
  }

  // During failover grace period, use the best available camera temporarily
  const best = valid.reduce((a, b) => a.confidence > b.confidence ? a : b);
  const f = best.face!;
  return {
    normX: (f.x + f.width / 2) / best.canvasWidth,
    normY: (f.y + f.height / 2) / best.canvasHeight,
  };
}

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Start head tracking with 1-4 cameras.
 *
 * @param opts - Tracking options
 * @param cameraDeviceIds - Array of camera device IDs (or single string for backward compat).
 *   If empty/undefined, uses the default front-facing camera.
 *   iPhone 14+: pass both front cameras for redundancy.
 *   Desktop: pass USB webcam + built-in for failover.
 */
export function startHeadTracker(
  opts: HeadTrackerOptions,
  cameraDeviceIds?: string | string[],
): HeadTrackerHandle {
  let stopped = false;
  let rafId = 0;
  const sources: CameraSource[] = [];
  const abortController = new AbortController();

  // Reliability primitives (statically imported at top — no circular dep).
  // Each is pure / DOM-free, so they can be unit-tested without the
  // full tracker. See TRACKING_RELIABILITY.md for which gap each closes.
  const driftDetector = new DriftDetector({
    travelThresholdPx: opts.driftThresholdPx ?? 800,
    windowMs: opts.driftWindowMs ?? 5000,
  });
  // Background calibration drift correction (gap F). Tracks the running
  // mean of (normX, normY) over a 60s window. When it diverges from the
  // captured baseline, we mutate the calibration anchors in place and
  // persist them — no user-visible "please recalibrate" prompt.
  const baselineTracker = new BaselineTracker();
  // Edge-pin detector — fires when the cursor lives on a screen edge for
  // multiple seconds (calibration-broken / tracking-lost-to-corner).
  const edgePin = new EdgePinDetector({
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
  });
  // Confidence-aware Kalman filters replace the EMA. Low-confidence frames
  // (face partially out, glasses glare, lighting drop) hold the prediction
  // instead of dragging the cursor toward a noisy measurement.
  // q≈4 → expects up to ±2px/frame of true cursor motion at 15fps;
  // r is dynamically derived from per-frame confidence.
  const kalmanX = new Kalman1D(KALMAN_PROCESS_NOISE);
  const kalmanY = new Kalman1D(KALMAN_PROCESS_NOISE);
  let kalmanInitialized = false;

  // Cross-modal lockout state — populated when gestureService dispatches
  // a `gesture-claim` event. Subscription happens AFTER dwell vars are
  // declared (further down) so the handler can clear dwell state safely.
  let lastGestureClaimTs = 0;

  // Window resize handler — keep edge-pin band aligned with viewport.
  const onResize = () => edgePin.setScreen(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', onResize);

  let driftFired = false;  // one-shot — don't spam onDrift on every frame

  // Normalize input: single string → array
  const ids: (string | undefined)[] = cameraDeviceIds
    ? (Array.isArray(cameraDeviceIds) ? cameraDeviceIds : [cameraDeviceIds])
    : [undefined]; // default camera

  // Smoothed cursor
  let sx = window.innerWidth / 2;
  let sy = window.innerHeight / 2;

  // Dwell tracking
  let dwellElement: Element | null = null;
  let dwellStart = 0;
  let dwellTriggered = false;
  let lastFrameTime = 0;

  // Subscribe to gesture-claim AFTER dwell vars exist. When a gesture
  // commits, suppress dwell-click for `lockoutMs` so an intentional blink
  // doesn't fire BOTH the gesture AND the dwell click. Reset in-progress
  // dwell so the user must re-acquire the target.
  const offGestureClaim = onGestureClaim((d) => {
    lastGestureClaimTs = d.timestamp;
    dwellElement = null;
    dwellStart = 0;
    dwellTriggered = false;
  });

  const calibration = loadCalibration();
  const sensitivityScale = opts.sensitivity / 5;

  opts.onStatusChange('starting');

  // Always initialize FaceLandmarker. Two reasons:
  //   1. Gesture detection (only used when onLandmarks is provided) — opt-in.
  //   2. Ego-motion suppression (gap E) — needs landmark coordinates EVEN
  //      when the user hasn't enabled gestures. Without this, a user who
  //      only enables head tracking gets no protection from camera shake
  //      ("moving car" requirement). The extra ~5MB WASM model is amortized
  //      over the session and only loaded once.
  initMediaPipeFaceLandmarker().catch(() => {});

  // ── Initialize all cameras ──────────────────────────────────────────

  const initPromises = ids.map(async (deviceId, i) => {
    const source = createCameraSource(i);
    if (!source) return;
    sources.push(source);
    await initCameraSource(source, deviceId, abortController.signal);
  });

  Promise.all(initPromises).then(() => {
    if (stopped) { sources.forEach(stopCameraSource); return; }
    const activeSources = sources.filter(s => s.active);
    if (activeSources.length === 0) {
      opts.onStatusChange('stopped');
      return;
    }

    // Each camera runs its OWN independent detection loop writing to
    // source.lastDetection. This prevents a slow USB camera (10fps) from
    // throttling a fast iPad camera (60fps), and isolates exceptions so
    // one camera crash doesn't kill the entire tracking system.
    for (const source of activeSources) {
      startCameraDetectionLoop(source);
    }

    rafId = requestAnimationFrame(tick);
  });

  // ── tick() helpers ──────────────────────────────────────────────
  // Each closes over the local state (sources, calibration, kalmans,
  // baseline tracker). Extracted from tick() for readability — the
  // top-level loop is now a sequence of named operations.

  /**
   * Ego-motion check. Returns true iff the entire face shifted by the
   * same delta this frame (camera shake, not user motion). Caller
   * should NOT update the cursor when this is true. Updates the
   * source's `prevLandmarkPoints` after the comparison.
   */
  function suppressOnEgoMotion(primary: CameraSource): boolean {
    if (!primary.lastLandmarkPoints) return false;
    const prev = primary.prevLandmarkPoints;
    let isEgoMotion = false;
    let deltaMagnitude = 0;
    if (prev) {
      const headPose = primary.lastLandmarks?.headPose;
      const rotation = headPose
        ? Math.max(Math.abs(headPose.pitch), Math.abs(headPose.yaw), Math.abs(headPose.roll))
        : 0;
      const r = classifyMotion(prev, primary.lastLandmarkPoints, rotation);
      isEgoMotion = r.isEgoMotion;
      deltaMagnitude = Math.abs(r.egoDelta.x) + Math.abs(r.egoDelta.y);
    }
    primary.prevLandmarkPoints = primary.lastLandmarkPoints;
    if (isEgoMotion) {
      emitTrackingEvent({
        type: 'ego-motion-suppress',
        deltaMagnitude,
        timestamp: Date.now(),
      });
    }
    return isEgoMotion;
  }

  /**
   * Push a sample to the baseline tracker; if it suggests a correction,
   * apply it to the calibration anchors in place and persist. Runs once
   * per frame; cooldown is enforced inside the tracker via acceptCorrection.
   */
  function applyRecalibration(normX: number, normY: number, ts: number): void {
    baselineTracker.push({ normX, normY, timestamp: ts });
    const c = baselineTracker.suggestCorrection(ts);
    if (!c) return;
    let magnitude = 0;
    if (c.kind === 'offset') {
      calibration.leftX  += c.deltaNormX;
      calibration.rightX += c.deltaNormX;
      calibration.topY   += c.deltaNormY;
      calibration.bottomY += c.deltaNormY;
      magnitude = Math.hypot(c.deltaNormX, c.deltaNormY);
    } else if (c.kind === 'scale') {
      // Stretch from the calibration midpoint by sqrt(ratio) so the user's
      // now-tighter motion still spans the full screen.
      const midX = (calibration.leftX + calibration.rightX) / 2;
      const midY = (calibration.topY + calibration.bottomY) / 2;
      const sX = c.scaleX > 0 ? Math.sqrt(c.scaleX) : 1;
      const sY = c.scaleY > 0 ? Math.sqrt(c.scaleY) : 1;
      calibration.leftX  = midX + (calibration.leftX  - midX) * sX;
      calibration.rightX = midX + (calibration.rightX - midX) * sX;
      calibration.topY   = midY + (calibration.topY   - midY) * sY;
      calibration.bottomY = midY + (calibration.bottomY - midY) * sY;
      magnitude = (sX + sY) / 2;
    } else if (c.kind === 'anchor') {
      magnitude = Math.hypot(c.cursorNormX - c.targetNormX, c.cursorNormY - c.targetNormY);
    }
    saveCalibration(calibration);
    baselineTracker.acceptCorrection(ts);
    emitTrackingEvent({
      type: 'recalibration-applied',
      kind: c.kind,
      magnitude,
      timestamp: ts,
    });
  }

  /**
   * Map a normalized (camera-frame) coord into a screen-pixel coord using
   * the current 4-corner calibration, sensitivity, and viewport bounds.
   * Pure function over the captured calibration + sensitivityScale.
   */
  function mapToScreen(normX: number, normY: number): { rawX: number; rawY: number } {
    const rangeX = calibration.leftX - calibration.rightX;
    const rangeY = calibration.bottomY - calibration.topY;
    let rawX = rangeX !== 0
      ? ((normX - calibration.rightX) / rangeX) * window.innerWidth
      : window.innerWidth / 2;
    let rawY = rangeY !== 0
      ? ((normY - calibration.topY) / rangeY) * window.innerHeight
      : window.innerHeight / 2;
    // Sensitivity (radial gain from screen center)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    rawX = centerX + (rawX - centerX) * sensitivityScale;
    rawY = centerY + (rawY - centerY) * sensitivityScale;
    // Clamp to viewport
    rawX = Math.max(0, Math.min(window.innerWidth, rawX));
    rawY = Math.max(0, Math.min(window.innerHeight, rawY));
    return { rawX, rawY };
  }

  /** Average the per-camera face-area confidence into a single 0..1 number. */
  function computeAvgConfidence(active: CameraSource[]): number {
    if (active.length === 0) return 0;
    let sum = 0;
    for (const src of active) sum += src.lastDetection.confidence || 0;
    return sum / active.length;
  }

  /**
   * Anchor-based calibration correction (gap F follow-up).
   *
   * When the user dwell-clicks a known-position button, the offset
   * between the cursor's smoothed screen position (sx, sy) and the
   * button's center IS the calibration error at this moment — the
   * cleanest possible ground truth. We shift the calibration anchors
   * by a fraction of that offset (learning rate) so a single off-
   * center click can't overcorrect, but a series of clicks converges
   * the calibration to the user's true mapping.
   *
   * Math: shifting both leftX and rightX uniformly by +δ shifts the
   * pre-sensitivity rawX output by -δ/rangeX * window.innerWidth.
   * With sensitivity applied: shift_pre = (cursor_post - target_post) /
   * sensitivityScale, and δ = shift_pre * rangeX / W.
   */
  function applyAnchorCorrection(targetEl: Element): void {
    if (!(targetEl instanceof Element)) return;
    const rect = targetEl.getBoundingClientRect();
    const tx = rect.left + rect.width / 2;
    const ty = rect.top + rect.height / 2;
    const dx = sx - tx;
    const dy = sy - ty;
    const offsetMag = Math.hypot(dx, dy);
    // Below noise floor: cursor was effectively on target — nothing to learn.
    // Above outlier ceiling: probably a missed click that bubbled to a parent.
    if (offsetMag < ANCHOR_MIN_PIXEL_OFFSET || offsetMag > ANCHOR_MAX_PIXEL_OFFSET) return;
    if (sensitivityScale <= 0) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const rangeX = calibration.leftX - calibration.rightX;
    const rangeY = calibration.bottomY - calibration.topY;
    if (rangeX === 0 || rangeY === 0) return;

    const deltaX = (dx / sensitivityScale) * rangeX / W * ANCHOR_LEARNING_RATE;
    const deltaY = (dy / sensitivityScale) * rangeY / H * ANCHOR_LEARNING_RATE;
    calibration.leftX  += deltaX;
    calibration.rightX += deltaX;
    calibration.topY   += deltaY;
    calibration.bottomY += deltaY;
    saveCalibration(calibration);
    // Reset the slow-drift baseline so it doesn't ALSO fire an offset
    // correction on top of this one.
    baselineTracker.acceptCorrection(Date.now());
    emitTrackingEvent({
      type: 'recalibration-applied',
      kind: 'anchor',
      magnitude: offsetMag,
      timestamp: Date.now(),
    });
  }

  /**
   * Confidence-weighted Kalman smoothing. Lazy-initializes both filters
   * from the first measurement so the cursor doesn't snap toward (0, 0).
   * `kalmanInitialized` is closure state.
   */
  function kalmanSmooth(rawX: number, rawY: number, avgConfidence: number): { sx: number; sy: number } {
    if (!kalmanInitialized) {
      kalmanX.reset(rawX);
      kalmanY.reset(rawY);
      kalmanInitialized = true;
      return { sx: rawX, sy: rawY };
    }
    const kalmanConf = Math.max(0, Math.min(1, avgConfidence * FACE_AREA_TO_KALMAN_SCALE));
    return {
      sx: kalmanX.update(rawX, kalmanConf),
      sy: kalmanY.update(rawY, kalmanConf),
    };
  }

  function startCameraDetectionLoop(source: CameraSource): void {
    let camLastFrame = 0;
    let consecutiveErrors = 0;
    let detecting = false;
    function camTick() {
      if (stopped || !source.active) return;
      requestAnimationFrame(camTick);

      // Skip if previous detection is still running (async)
      if (detecting) return;

      const now = performance.now();
      if (now - camLastFrame < FRAME_INTERVAL_MS) return;
      camLastFrame = now;

      detecting = true;
      detectFromSource(source).then(() => {
        consecutiveErrors = 0;
      }).catch(() => {
        consecutiveErrors++;
        // Only kill camera after 10 consecutive failures (not a single glitch)
        if (consecutiveErrors > 10) {
          source.active = false;
          source.lastDetection = { ...source.lastDetection, face: null, confidence: 0 };
        }
      }).finally(() => {
        detecting = false;
      });
    }
    requestAnimationFrame(camTick);
  }

  // ── Per-frame Fusion (synchronous — never awaits cameras) ─────────

  function tick(ts: number) {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);

    if (ts - lastFrameTime < FRAME_INTERVAL_MS) return;
    lastFrameTime = ts;

    // Read latest cached detections from all cameras (synchronous read).
    // Stale detections are zeroed out to prevent frozen cursor when a
    // camera's detection loop hangs or its WebGL context crashes.
    const now = Date.now();
    const activeSources = sources.filter(s => s.active);
    if (activeSources.length === 0) { opts.onStatusChange('lost'); return; }

    const detections = activeSources.map(s => {
      const d = s.lastDetection;
      if (d.timestamp > 0 && (now - d.timestamp) > STALE_DETECTION_MS) {
        return { ...d, face: null, confidence: 0 };
      }
      return d;
    });
    const fused = fuseCameraDetections(detections);

    if (!fused) {
      opts.onStatusChange('lost');
      dwellElement = null;
      dwellStart = 0;
      dwellTriggered = false;
      return;
    }

    opts.onStatusChange('tracking');

    // Identify the primary (best confidence) camera once — we use it both
    // for gesture-landmark emission and for ego-motion classification.
    const primarySource = activeSources.reduce((best, s) =>
      s.lastDetection.confidence > best.lastDetection.confidence ? s : best
    );

    // Emit face landmarks from the primary camera for gesture detection
    if (opts.onLandmarks) {
      if (primarySource.lastLandmarks && (now - primarySource.lastLandmarks.timestamp) < STALE_DETECTION_MS) {
        opts.onLandmarks(primarySource.lastLandmarks);
      }
    }

    // Ego-motion suppression (gap E) — see suppressOnEgoMotion below.
    if (suppressOnEgoMotion(primarySource)) {
      // Camera shake — keep last cursor position, skip dwell increment.
      opts.onMove(sx, sy);
      return;
    }

    const { normX, normY } = fused;

    // Background recalibration (gap F) — see applyRecalibration below.
    applyRecalibration(normX, normY, now);

    // Calibration → screen-pixel mapping with sensitivity + clamping.
    const { rawX, rawY } = mapToScreen(normX, normY);

    // Confidence-weighted Kalman smoothing (gap D) — see kalmanSmooth below.
    const avgConfidence = computeAvgConfidence(activeSources);
    ({ sx, sy } = kalmanSmooth(rawX, rawY, avgConfidence));

    opts.onMove(sx, sy);

    // ── Dwell Detection ───────────────────────────────────────────
    // Suppressed during cross-modal lockout window (gap H): when a
    // gesture has just committed, the user's blink/smile is an
    // intentional gesture, not a dwell action.
    const nowTs = Date.now();
    const dwellLocked = isLocked(lastGestureClaimTs, nowTs);

    const elementUnder = document.elementFromPoint(sx, sy);
    const interactiveEl = elementUnder?.closest('button, a, [role="button"], [data-dwell-target], .aac-btn') ?? elementUnder;

    let dwellFiredThisFrame = false;
    if (!dwellLocked && interactiveEl && interactiveEl === dwellElement) {
      if (!dwellTriggered && nowTs - dwellStart >= opts.dwellMs) {
        dwellTriggered = true;
        dwellFiredThisFrame = true;
        // Use this successful dwell as ground-truth for calibration —
        // the cursor was AT (sx,sy), the user wanted (tx,ty). Shift
        // anchors by a fraction of that offset.
        applyAnchorCorrection(interactiveEl);
        opts.onDwell(interactiveEl);
        if (interactiveEl instanceof HTMLElement) interactiveEl.click();
      }
    } else {
      dwellElement = interactiveEl ?? null;
      dwellStart = nowTs;
      dwellTriggered = false;
    }

    // ── Drift safety net ──────────────────────────────────────────
    // Per-frame sample → DriftDetector + EdgePinDetector. On first
    // trip, fire onDrift exactly once and let the consumer decide to
    // stop(). EdgePin escalation is treated as cursor-drift; a single
    // pin episode is a softer warning that we don't auto-disable on
    // (the user may be reaching a corner button intentionally).
    //
    // IMU gating: if the device is currently bouncing (DeviceMotion >
    // threshold), suppress drift checks for this frame. The cursor IS
    // jumping but it's environmental — auto-disabling would be wrong.
    // We still PUSH the sample so the rolling window stays continuous;
    // we just skip the `check()` while motion is active.
    const deviceShaking = opts.isDeviceShaking?.() ?? false;
    if (!driftFired) {
      driftDetector.push({
        x: sx,
        y: sy,
        confidence: avgConfidence,
        timestamp: nowTs,
        dwellFired: dwellFiredThisFrame,
      });
      if (!deviceShaking) {
        const reason = driftDetector.check();
        if (reason && opts.onDrift) {
          driftFired = true;
          emitTrackingEvent({ type: 'drift', reason, timestamp: nowTs });
          opts.onDrift(reason);
          return;
        }

        const pinResult = edgePin.push(sx, sy, nowTs);
        if (pinResult === 'pin') {
          emitTrackingEvent({ type: 'edge-pin-warn', timestamp: nowTs });
        } else if (pinResult === 'escalate' && opts.onDrift) {
          driftFired = true;
          emitTrackingEvent({ type: 'edge-pin-escalate', timestamp: nowTs });
          emitTrackingEvent({ type: 'drift', reason: 'edge-pin-escalate', timestamp: nowTs });
          opts.onDrift('cursor-drift');
        }
      }
    }
  }

  // ── Hardware escape hatch — Esc disables tracking immediately ────
  // Critical for AAC users when calibration goes wrong: the cursor may
  // be unreliable, so the user can't necessarily click a "disable"
  // button. Esc on any keyboard always works regardless of cursor state.
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !stopped) {
      stopped = true;
      abortController.abort();
      cancelAnimationFrame(rafId);
      sources.forEach(stopCameraSource);
      window.removeEventListener('keydown', escHandler);
      opts.onStatusChange('stopped');
      // Surface as a drift event so the consumer's UX (toast, recovery
      // probe) reacts the same way as an auto-trigger.
      if (opts.onDrift && !driftFired) {
        driftFired = true;
        emitTrackingEvent({ type: 'drift', reason: 'cursor-drift', timestamp: Date.now() });
        opts.onDrift('cursor-drift');
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', escHandler);
  }

  // ── Handle ────────────────────────────────────────────────────────

  return {
    stop() {
      stopped = true;
      abortController.abort(); // Kill pending getUserMedia promises
      cancelAnimationFrame(rafId);
      sources.forEach(stopCameraSource);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', escHandler);
        window.removeEventListener('resize', onResize);
      }
      offGestureClaim();
      opts.onStatusChange('stopped');
    },
    get videoElement() {
      return sources[0]?.video ?? null;
    },
    get videoElements() {
      return sources.map(s => s.video);
    },
    get activeCameraCount() {
      return sources.filter(s => s.active).length;
    },
  };
}

// ── Camera Enumeration ──────────────────────────────────────────────────────

export interface CameraInfo {
  deviceId: string;
  label: string;
  facing: 'user' | 'environment' | 'unknown';
}

/**
 * Detect if a camera is rear/environment-facing by label heuristics.
 * Back cameras have labels like "Back Camera", "Rear", "Environment".
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

function inferFacingMode(label: string): 'user' | 'environment' | 'unknown' {
  const l = label.toLowerCase();
  if (l.includes('back') || l.includes('rear') || l.includes('environment')) return 'environment';
  if (l.includes('front') || l.includes('facetime') || l.includes('truedepth') || l.includes('user')) return 'user';
  return 'unknown';
}

/**
 * List all cameras with facing mode information.
 * Use `listFrontCameras()` for head tracking — never pass back cameras.
 */
export async function listCameras(): Promise<CameraInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${i + 1}`,
        facing: inferFacingMode(d.label || ''),
      }));
  } catch {
    return [];
  }
}

/**
 * List only front-facing cameras suitable for head tracking.
 * NEVER returns back/environment cameras.
 *
 * Handles browser privacy: enumerateDevices() censors labels until
 * camera permission is granted. We request a temporary generic stream
 * to trigger the permission prompt, then immediately release it.
 */
export async function listFrontCameras(): Promise<CameraInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return [];

  // Only probe getUserMedia if labels are censored (browser privacy).
  // Check raw device labels BEFORE our fallback "Camera N" assignment.
  let all = await listCameras();
  let rawDevices: MediaDeviceInfo[] = [];
  try { rawDevices = await navigator.mediaDevices.enumerateDevices(); } catch { /* */ }
  const hasRealLabels = rawDevices.some(d => d.kind === 'videoinput' && d.label.length > 0);
  if (!hasRealLabels && all.length > 0) {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());
      all = await listCameras(); // Re-enumerate with labels now visible
    } catch {
      return all; // Permission denied — return what we have
    }
  }

  return all.filter(c => c.facing !== 'environment');
}
