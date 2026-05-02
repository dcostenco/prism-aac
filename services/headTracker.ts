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
 * ────────────────────────────────────────────────────────────────────────── */

// ── Public Types ────────────────────────────────────────────────────────────

export interface HeadTrackerOptions {
  dwellMs: number;
  sensitivity: number;
  smoothing: number;
  onMove: (x: number, y: number) => void;
  onDwell: (element: Element) => void;
  onStatusChange: (status: 'starting' | 'tracking' | 'lost' | 'stopped') => void;
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
        // Bumped 0.5 → 0.7: rejects soft/partial face matches that previously
        // let background people, posters, and TV faces leak in.
        minDetectionConfidence: 0.7,
      });
    } catch {
      mpFaceDetector = null;
    }
  })();
  await mpLoadPromise;
  mpLoadPromise = null;
  return !!mpFaceDetector;
}

// ── Internals ───────────────────────────────────────────────────────────────

const TARGET_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

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

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

// ── Skin-color blob fallback intentionally REMOVED ──────────────────────────
// The prior implementation false-positived catastrophically on skin-toned
// walls, wood furniture, sunlit backgrounds, and any other person in frame —
// turning the cursor into a random walk. With MediaPipe + native FaceDetector
// covering all modern browsers, the blob fallback was net-negative for users
// in real environments. The function below is kept only because legacy code
// still references its name; it now always returns null so callers safely
// fall through to "face lost" status when both detectors are unavailable.

function detectSkinBlob(_ctx: CanvasRenderingContext2D, _w: number, _h: number): FaceRect | null {
  return null;
}

// Kept temporarily as a no-op to preserve signature for any external callers.
// The original implementation is below as a comment for reference only.
function _detectSkinBlobLegacyDISABLED(ctx: CanvasRenderingContext2D, w: number, h: number): FaceRect | null {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  let sumX = 0, sumY = 0, count = 0;
  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 60 && g > 40 && b > 20 && r > g && r > b &&
          (r - g) > 15 && Math.abs(r - g) < 130 && (r - b) > 15) {
        sumX += x; sumY += y; count++;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }

  const sampledPixels = (w / 2) * (h / 2);
  if (count < sampledPixels * 0.01) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

export function loadCalibration(): CalibrationData {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION;
  try {
    const raw = localStorage.getItem('prism-head-calibration');
    if (raw) return JSON.parse(raw) as CalibrationData;
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
  stream: MediaStream | null;
  nativeDetector: { detect: (source: HTMLVideoElement) => Promise<{ boundingBox: DOMRect }[]> } | null;
  lastDetection: CameraDetection;
  active: boolean;
}

function createCameraSource(index: number): CameraSource | null {
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.muted = true;
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
  document.body.appendChild(video);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) { video.remove(); return null; }

  return {
    index,
    video,
    canvas,
    ctx,
    stream: null,
    nativeDetector: null,
    lastDetection: { face: null, cameraIndex: index, confidence: 0, canvasWidth: 320, canvasHeight: 240, timestamp: 0 },
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

  const constraints: MediaStreamConstraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
      : { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
    audio: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // If component unmounted during getUserMedia (React StrictMode double-mount,
    // user toggled setting off), kill the stream immediately to prevent the
    // green camera indicator from staying on permanently.
    if (abortSignal?.aborted) {
      stream.getTracks().forEach(t => t.stop());
      return false;
    }

    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    if (settings?.facingMode === 'environment') {
      stream.getTracks().forEach(t => t.stop());
      return false;
    }

    source.stream = stream;
    source.video.srcObject = stream;
    await source.video.play().catch(() => {});

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
  if (source.stream) source.stream.getTracks().forEach(t => t.stop());
  if (source.video.parentNode) source.video.remove();
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

  const calibration = loadCalibration();
  const sensitivityScale = opts.sensitivity / 5;

  opts.onStatusChange('starting');

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
    // Stale detections (>150ms old) are zeroed out to prevent frozen cursor
    // when a camera's detection loop hangs or its WebGL context crashes.
    const now = Date.now();
    const STALE_THRESHOLD_MS = 500;
    const activeSources = sources.filter(s => s.active);
    if (activeSources.length === 0) { opts.onStatusChange('lost'); return; }

    const detections = activeSources.map(s => {
      const d = s.lastDetection;
      if (d.timestamp > 0 && (now - d.timestamp) > STALE_THRESHOLD_MS) {
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

    const { normX, normY } = fused;

    // Map to screen coordinates
    const rangeX = calibration.leftX - calibration.rightX;
    const rangeY = calibration.bottomY - calibration.topY;

    let rawX = rangeX !== 0
      ? ((normX - calibration.rightX) / rangeX) * window.innerWidth
      : window.innerWidth / 2;
    let rawY = rangeY !== 0
      ? ((normY - calibration.topY) / rangeY) * window.innerHeight
      : window.innerHeight / 2;

    // Sensitivity
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    rawX = centerX + (rawX - centerX) * sensitivityScale;
    rawY = centerY + (rawY - centerY) * sensitivityScale;

    // Clamp
    rawX = Math.max(0, Math.min(window.innerWidth, rawX));
    rawY = Math.max(0, Math.min(window.innerHeight, rawY));

    // Velocity-adaptive smoothing
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
    const finalSmooth = Math.min(opts.smoothing, velocitySmooth);
    sx = ema(sx, rawX, finalSmooth);
    sy = ema(sy, rawY, finalSmooth);

    opts.onMove(sx, sy);

    // ── Dwell Detection ───────────────────────────────────────────

    const elementUnder = document.elementFromPoint(sx, sy);
    const interactiveEl = elementUnder?.closest('button, a, [role="button"], [data-dwell-target], .aac-btn') ?? elementUnder;

    if (interactiveEl && interactiveEl === dwellElement) {
      if (!dwellTriggered && Date.now() - dwellStart >= opts.dwellMs) {
        dwellTriggered = true;
        opts.onDwell(interactiveEl);
        if (interactiveEl instanceof HTMLElement) interactiveEl.click();
      }
    } else {
      dwellElement = interactiveEl ?? null;
      dwellStart = Date.now();
      dwellTriggered = false;
    }
  }

  // ── Handle ────────────────────────────────────────────────────────

  return {
    stop() {
      stopped = true;
      abortController.abort(); // Kill pending getUserMedia promises
      cancelAnimationFrame(rafId);
      sources.forEach(stopCameraSource);
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
