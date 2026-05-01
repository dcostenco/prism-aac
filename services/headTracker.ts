'use client';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Head / Eye Tracking Accessibility Service for PrismAAC
 *
 *  Uses the browser FaceDetector API (Chrome 87+, Safari 17+) with a
 *  canvas-based skin-color blob fallback. Runs entirely on-device with
 *  no external API calls — works offline.
 *
 *  Flow:
 *    1. Request camera via getUserMedia
 *    2. Each rAF frame (throttled to ~15 fps): detect face position
 *    3. Map face center to screen coordinates
 *    4. Emit smoothed cursor position events
 *    5. Dwell detection: when cursor rests on same element for N ms → click
 * ────────────────────────────────────────────────────────────────────────── */

// ── Public Types ────────────────────────────────────────────────────────────

export interface HeadTrackerOptions {
  dwellMs: number;        // default 1200ms
  sensitivity: number;    // 1-10, default 5
  smoothing: number;      // 0-1, default 0.15 (adaptive: less on small screens)
  onMove: (x: number, y: number) => void;
  onDwell: (element: Element) => void;
  onStatusChange: (status: 'starting' | 'tracking' | 'lost' | 'stopped') => void;
}

export interface HeadTrackerHandle {
  stop: () => void;
  /** The hidden <video> element used for the camera feed (for PIP preview). */
  videoElement: HTMLVideoElement | null;
}

// ── Feature Detection ───────────────────────────────────────────────────────

export function isHeadTrackingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // Camera access + canvas are the minimum requirements
  return !!(navigator.mediaDevices?.getUserMedia) && typeof HTMLCanvasElement !== 'undefined';
}

/** Returns true when the native FaceDetector API is available. */
function hasFaceDetectorAPI(): boolean {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
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

/** Exponential moving-average filter. */
function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

// ── Skin-color Blob Fallback ────────────────────────────────────────────────

function detectSkinBlob(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): FaceRect | null {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Simple skin-color heuristic (works for a broad range of skin tones)
      if (
        r > 60 && g > 40 && b > 20 &&
        r > g && r > b &&
        (r - g) > 15 &&
        Math.abs(r - g) < 130 &&
        (r - b) > 15
      ) {
        sumX += x;
        sumY += y;
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Require at least 1% of sampled pixels to be skin-colored
  const sampledPixels = (w / 2) * (h / 2);
  if (count < sampledPixels * 0.01) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ── Calibration ─────────────────────────────────────────────────────────────

export interface CalibrationData {
  /** Normalized face-center X when looking at screen left edge */
  leftX: number;
  /** Normalized face-center X when looking at screen right edge */
  rightX: number;
  /** Normalized face-center Y when looking at top */
  topY: number;
  /** Normalized face-center Y when looking at bottom */
  bottomY: number;
}

const DEFAULT_CALIBRATION: CalibrationData = {
  leftX: 0.7,   // face appears on right side of camera when looking left
  rightX: 0.3,
  topY: 0.3,
  bottomY: 0.7,
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
  try {
    localStorage.setItem('prism-head-calibration', JSON.stringify(data));
  } catch { /* localStorage quota or disabled */ }
}

// ── Main Entry Point ────────────────────────────────────────────────────────

export function startHeadTracker(
  opts: HeadTrackerOptions,
  cameraDeviceId?: string,
): HeadTrackerHandle {
  let stopped = false;
  let rafId = 0;
  let stream: MediaStream | null = null;
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.muted = true;
  video.style.position = 'fixed';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Smoothed cursor position
  let sx = window.innerWidth / 2;
  let sy = window.innerHeight / 2;

  // Dwell tracking
  let dwellElement: Element | null = null;
  let dwellStart = 0;
  let dwellTriggered = false;

  // Timing
  let lastFrameTime = 0;

  // Native detector (if available)
  let nativeDetector: { detect: (source: HTMLVideoElement) => Promise<{ boundingBox: DOMRect }[]> } | null = null;

  const calibration = loadCalibration();

  const sensitivityScale = opts.sensitivity / 5; // normalize so 5 = 1.0

  opts.onStatusChange('starting');

  // ── Camera Setup ──────────────────────────────────────────────────────

  const constraints: MediaStreamConstraints = {
    video: cameraDeviceId
      ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
      : { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
    audio: false,
  };

  navigator.mediaDevices.getUserMedia(constraints).then((s) => {
    if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    video.srcObject = s;
    video.play().catch(() => { /* auto-play policy; video is muted so usually OK */ });

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;

      // Init native face detector if available
      if (hasFaceDetectorAPI()) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nativeDetector = new (window as any).FaceDetector({ maxDetectedFaces: 1, fastMode: true });
        } catch { /* fallback to canvas blob */ }
      }

      rafId = requestAnimationFrame(tick);
    }, { once: true });
  }).catch(() => {
    opts.onStatusChange('stopped');
  });

  // ── Per-frame Processing ──────────────────────────────────────────────

  async function tick(ts: number) {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);

    // Throttle to TARGET_FPS
    if (ts - lastFrameTime < FRAME_INTERVAL_MS) return;
    lastFrameTime = ts;

    if (video.readyState < 2) return; // not enough data

    let face: FaceRect | null = null;

    // Try native FaceDetector first
    if (nativeDetector) {
      try {
        const faces = await nativeDetector.detect(video);
        if (faces.length > 0) {
          const bb = faces[0].boundingBox;
          face = { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
        }
      } catch {
        // API threw — fall back to canvas
        nativeDetector = null;
      }
    }

    // Fallback: canvas skin-color blob
    if (!face) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      face = detectSkinBlob(ctx, canvas.width, canvas.height);
    }

    if (!face) {
      opts.onStatusChange('lost');
      // Reset dwell when face is lost
      dwellElement = null;
      dwellStart = 0;
      dwellTriggered = false;
      return;
    }

    opts.onStatusChange('tracking');

    // Normalize face center to 0..1
    const normX = (face.x + face.width / 2) / canvas.width;
    const normY = (face.y + face.height / 2) / canvas.height;

    // Map normalized face position to screen coordinates using calibration
    // Camera is mirrored: moving head left → face moves right in camera
    const rangeX = calibration.leftX - calibration.rightX;
    const rangeY = calibration.bottomY - calibration.topY;

    let rawX = rangeX !== 0
      ? ((normX - calibration.rightX) / rangeX) * window.innerWidth
      : window.innerWidth / 2;
    let rawY = rangeY !== 0
      ? ((normY - calibration.topY) / rangeY) * window.innerHeight
      : window.innerHeight / 2;

    // Apply sensitivity scaling (amplify movement from center)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    rawX = centerX + (rawX - centerX) * sensitivityScale;
    rawY = centerY + (rawY - centerY) * sensitivityScale;

    // Clamp
    rawX = Math.max(0, Math.min(window.innerWidth, rawX));
    rawY = Math.max(0, Math.min(window.innerHeight, rawY));

    // Velocity-adaptive smoothing: fast head movement = responsive,
    // slow/still = stable (eliminates wiggle at rest, fast for intentional moves)
    const dx = rawX - sx;
    const dy = rawY - sy;
    const velocity = Math.sqrt(dx * dx + dy * dy);
    const screenSize = Math.min(window.innerWidth, window.innerHeight);
    const screenFactor = screenSize < 768 ? 0.5 : screenSize < 1200 ? 0.7 : 1.0;
    // Low velocity (<5px): heavy smoothing 0.03 (rock stable)
    // Medium (5-50px): interpolate smoothing
    // High velocity (>50px): light smoothing 0.2 (responsive to intentional moves)
    const velocitySmooth = velocity < 5
      ? 0.03
      : velocity > 50
        ? 0.2 * screenFactor
        : 0.03 + (velocity - 5) / 45 * (0.2 * screenFactor - 0.03);
    const finalSmooth = Math.min(opts.smoothing, velocitySmooth);
    sx = ema(sx, rawX, finalSmooth);
    sy = ema(sy, rawY, finalSmooth);

    opts.onMove(sx, sy);

    // ── Dwell Detection ───────────────────────────────────────────────

    const elementUnder = document.elementFromPoint(sx, sy);
    // Walk up to find clickable / interactive ancestor
    const interactiveEl = elementUnder?.closest('button, a, [role="button"], [data-dwell-target], .aac-btn') ?? elementUnder;

    if (interactiveEl && interactiveEl === dwellElement) {
      // Still on the same element
      if (!dwellTriggered && Date.now() - dwellStart >= opts.dwellMs) {
        dwellTriggered = true;
        opts.onDwell(interactiveEl);
        // Simulate click
        if (interactiveEl instanceof HTMLElement) {
          interactiveEl.click();
        }
      }
    } else {
      // Moved to a different element — reset dwell
      dwellElement = interactiveEl ?? null;
      dwellStart = Date.now();
      dwellTriggered = false;
    }
  }

  // ── Handle ────────────────────────────────────────────────────────────

  const handle: HeadTrackerHandle = {
    stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (video.parentNode) video.parentNode.removeChild(video);
      opts.onStatusChange('stopped');
    },
    get videoElement() {
      return video;
    },
  };

  return handle;
}

// ── Camera Enumeration ──────────────────────────────────────────────────────

export async function listCameras(): Promise<{ deviceId: string; label: string }[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  } catch {
    return [];
  }
}
