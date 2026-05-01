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
 * ────────────────────────────────────────────────────────────────────────── */

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
  | 'left_elbow'
  | 'right_elbow'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_index'
  | 'right_index';

const LANDMARK_INDEX: Record<TrackingTarget, number> = {
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
  onStatusChange: (status: 'starting' | 'tracking' | 'lost' | 'stopped') => void;
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
      poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    } catch {
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

const DEFAULT_CALIBRATION: PoseCalibrationData = {
  leftX: 0.7,
  rightX: 0.3,
  topY: 0.3,
  bottomY: 0.7,
};

export function loadPoseCalibration(): PoseCalibrationData {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION;
  try {
    const raw = localStorage.getItem('prism-pose-calibration');
    if (raw) return JSON.parse(raw) as PoseCalibrationData;
  } catch { /* use defaults */ }
  return DEFAULT_CALIBRATION;
}

export function savePoseCalibration(data: PoseCalibrationData): void {
  try { localStorage.setItem('prism-pose-calibration', JSON.stringify(data)); } catch { /* */ }
}

// ── Pose Mapping Persistence ────────────────────────────────────────────────

const POSE_CONFIG_KEY = 'prism-pose-config';

export function savePoseMapping(mapping: PoseMapping): void {
  try { localStorage.setItem(POSE_CONFIG_KEY, JSON.stringify(mapping)); } catch { /* */ }
}

export function loadPoseMapping(): PoseMapping {
  if (typeof window === 'undefined') {
    return { trackingTarget: 'nose', cursorSmoothing: 0.1 };
  }
  try {
    const raw = localStorage.getItem(POSE_CONFIG_KEY);
    if (raw) return JSON.parse(raw) as PoseMapping;
  } catch { /* use defaults */ }
  return { trackingTarget: 'nose', cursorSmoothing: 0.1 };
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
  let ownStream: MediaStream | null = null; // Only set if we opened the camera ourselves
  const abortController = new AbortController();

  const targetIndex = LANDMARK_INDEX[opts.trackingTarget] ?? 0;

  // Smoothed cursor
  let sx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  let sy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

  // Dwell tracking
  let dwellElement: Element | null = null;
  let dwellStart = 0;
  let dwellTriggered = false;
  let lastFrameTime = 0;

  const calibration = loadPoseCalibration();
  const sensitivityScale = opts.sensitivity / 5;

  // Clamp cursor smoothing to valid range
  const cursorAlpha = Math.max(0.05, Math.min(0.3, opts.cursorSmoothing));

  opts.onStatusChange('starting');

  // ── Initialize camera + model ────────────────────────────────────────

  (async () => {
    // Step 1: Set up video source
    if (videoElement && videoElement.srcObject) {
      // Reuse existing video element from head tracking or other source
      video = videoElement;
    } else {
      // Open our own camera
      if (cameraDeviceId) {
        const isBack = await isEnvironmentCamera(cameraDeviceId);
        if (isBack) {
          opts.onStatusChange('stopped');
          return;
        }
      }

      const constraints: MediaStreamConstraints = {
        video: cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
          : { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Abort check: if stopped during async getUserMedia
        if (stopped || abortController.signal.aborted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        // Reject environment cameras by track settings
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.();
        if (settings?.facingMode === 'environment') {
          stream.getTracks().forEach(t => t.stop());
          opts.onStatusChange('stopped');
          return;
        }

        ownStream = stream;

        const vid = document.createElement('video');
        vid.setAttribute('playsinline', '');
        vid.setAttribute('autoplay', '');
        vid.muted = true;
        vid.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
        document.body.appendChild(vid);

        vid.srcObject = stream;
        await vid.play().catch(() => {});

        await new Promise<void>((resolve) => {
          if (vid.readyState >= 2) { resolve(); return; }
          vid.addEventListener('loadedmetadata', () => resolve(), { once: true });
          setTimeout(resolve, 3000);
        });

        video = vid;
      } catch {
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
    if (!modelReady || stopped) {
      opts.onStatusChange('stopped');
      return;
    }

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

        if (
          results?.landmarks?.length > 0 &&
          results.landmarks[0].length > targetIndex
        ) {
          consecutiveErrors = 0;
          const landmark = results.landmarks[0][targetIndex];

          // MediaPipe normalized landmarks are 0-1 (x: left-right, y: top-bottom)
          const normX = landmark.x;
          const normY = landmark.y;

          opts.onStatusChange('tracking');

          // Map normalized coordinates to screen via calibration
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

          // ── Dwell Detection ───────────────────────────────────────
          const elementUnder = document.elementFromPoint(sx, sy);
          const interactiveEl = elementUnder?.closest(
            'button, a, [role="button"], [data-dwell-target], .aac-btn'
          ) ?? elementUnder;

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

      // Only stop the stream if we opened it ourselves
      if (ownStream) {
        ownStream.getTracks().forEach(t => t.stop());
        ownStream = null;
      }

      // Only remove video element if we created it
      if (video && !videoElement && video.parentNode) {
        video.remove();
      }

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
