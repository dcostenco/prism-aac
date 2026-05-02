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
// Shifted left to compensate for right-hand bias (wrist center isn't body center).
const DEFAULT_CALIBRATION: PoseCalibrationData = {
  leftX: 0.75,
  rightX: 0.05,
  topY: 0.2,
  bottomY: 0.8,
};

function getOrientation(): 'landscape' | 'portrait' {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

function calibrationKey(orientation?: 'landscape' | 'portrait'): string {
  return `prism-pose-calibration-${orientation || getOrientation()}`;
}

export function loadPoseCalibration(): PoseCalibrationData {
  if (typeof window === 'undefined') return DEFAULT_CALIBRATION;
  try {
    const raw = localStorage.getItem(calibrationKey());
    if (raw) return JSON.parse(raw) as PoseCalibrationData;
    // Try legacy key
    const legacy = localStorage.getItem('prism-pose-calibration');
    if (legacy) return JSON.parse(legacy) as PoseCalibrationData;
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

  // Identity-lock anchor (last-known nose position in normalized 0-1 coords).
  // Set when MediaPipe returns a confidently-tracked nose; used to choose the
  // correct pose when multiple are returned in a frame, so the cursor doesn't
  // jump to a sibling who walks behind the user.
  let lockedAnchor: { x: number; y: number } | null = null;
  let lockedAnchorTimestamp = 0;

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

          // Auto-detect best available body part: requested target → nose → wrist → index
          const FALLBACK_CHAIN: TrackingTarget[] = [
            opts.trackingTarget,
            'nose', 'right_wrist', 'left_wrist', 'right_index', 'left_index',
            'right_elbow', 'left_elbow',
          ];
          for (const target of FALLBACK_CHAIN) {
            const idx = LANDMARK_INDEX[target];
            if (idx !== undefined && lm.length > idx) {
              const mark = lm[idx];
              const vis = mark.visibility ?? 0;
              // Visibility 0.3 — finger/index landmarks rarely report > 0.5
              // even in good lighting on the lite pose model, and a stricter
              // threshold caused "no cursor activity at all" reports.
              if (vis >= 0.3) {
                normX = mark.x;
                normY = mark.y;
                activeTarget = target;
                break;
              }
            }
          }
        }

        if (normX !== null && normY !== null) {
          consecutiveErrors = 0;

          opts.onStatusChange('tracking', activeTarget);

          // Adaptive calibration: expand observed range, slowly decay toward
          // current center. NOT gated on lockedAnchor — gating broke single-
          // user setups where the anchor briefly drops, leaving calibration
          // frozen at defaults and producing no cursor movement. Identity
          // locking does its job in the pose-picking step above; from there
          // the coords belong to the tracked person, so it's safe to adapt.
          // Inputs + outputs clamped to [0,1] for defense against bad data.
          const mirroredX = Math.max(0, Math.min(1, 1.0 - normX));
          const clampedY = Math.max(0, Math.min(1, normY));
          const ADAPT_RATE = 0.02;
          const DECAY_RATE = 0.0005;
          if (mirroredX < calibration.rightX) calibration.rightX += (mirroredX - calibration.rightX) * ADAPT_RATE;
          if (mirroredX > calibration.leftX) calibration.leftX += (mirroredX - calibration.leftX) * ADAPT_RATE;
          if (clampedY < calibration.topY) calibration.topY += (clampedY - calibration.topY) * ADAPT_RATE;
          if (clampedY > calibration.bottomY) calibration.bottomY += (clampedY - calibration.bottomY) * ADAPT_RATE;
          const midX = (calibration.leftX + calibration.rightX) / 2;
          const midY = (calibration.topY + calibration.bottomY) / 2;
          calibration.rightX += (midX - calibration.rightX) * DECAY_RATE;
          calibration.leftX += (midX - calibration.leftX) * DECAY_RATE;
          calibration.topY += (midY - calibration.topY) * DECAY_RATE;
          calibration.bottomY += (midY - calibration.bottomY) * DECAY_RATE;
          calibration.rightX = Math.max(0, Math.min(1, calibration.rightX));
          calibration.leftX = Math.max(0, Math.min(1, calibration.leftX));
          calibration.topY = Math.max(0, Math.min(1, calibration.topY));
          calibration.bottomY = Math.max(0, Math.min(1, calibration.bottomY));

          const rangeX = calibration.leftX - calibration.rightX;
          const rangeY = calibration.bottomY - calibration.topY;

          let rawX = rangeX !== 0
            ? ((mirroredX - calibration.rightX) / rangeX) * window.innerWidth
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

          // Emit raw normalized coords for calibration UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('prism-pose-sample', {
              detail: { normX: useFaceDetectorFallback ? normX : normX, normY },
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
