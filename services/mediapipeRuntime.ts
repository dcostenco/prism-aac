/**
 * MediaPipe runtime configuration — pinned version + FPS watchdog +
 * fallback hooks. Centralizes the CDN URL so all callers
 * (bodyPoseService, headTracker, reliabilityProbe) use the same
 * pinned version. No more `@latest` silent model swaps.
 *
 * Step 3 of the May 2026 SOTA-research roadmap. Research finding:
 * `@latest` on jsdelivr is a moving target; MediaPipe has historically
 * shipped breaking model changes that broke us silently. Pinning to
 * the version declared in package.json keeps the CDN aligned with
 * what we tested against.
 */

/** Pinned MediaPipe version. Update by:
 *    1. Bumping `@mediapipe/tasks-vision` in package.json + lockfile.
 *    2. Updating this constant to match.
 *    3. Verifying the CDN URL resolves to HTTP 200.
 *    4. Running the full pose test suite.
 *  Both steps must happen in the SAME commit so the CDN never
 *  serves a different version than the npm package. */
export const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.35';

export const MEDIAPIPE_WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;

/**
 * Body-pose model URL. Pinned to /1/ versioned path (not /latest/) for
 * the same reason as the wasm — stable mapping. The .task file format
 * is what MediaPipe expects for PoseLandmarker; do not swap to .tflite
 * (the format used by FaceDetector / blaze_face).
 */
export const POSE_LANDMARKER_LITE_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const FACE_LANDMARKER_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const FACE_DETECTOR_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export const HAND_LANDMARKER_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * FPS watchdog — exponentially-weighted moving average of frame
 * intervals. Used to detect when the model is starving on a thermal-
 * throttled iPad mini 6 (or any low-end device) and trigger a
 * fallback to a lighter model.
 *
 * Update once per frame with the current high-res timestamp. After
 * N samples (default 30 = ~1 second at 30Hz), `fps()` returns a
 * smoothed estimate. `isStarved(threshold)` returns true when the
 * EWMA falls below `threshold` for `consecutiveSec` seconds.
 *
 * Decay constant matches a ~1-second time horizon so a sustained
 * thermal dip is caught quickly without flapping on individual
 * slow frames.
 */
export class FpsWatchdog {
  private readonly halfLifeMs: number;
  private readonly starvationThresholdFps: number;
  private readonly starvationConsecutiveMs: number;

  private lastFrameMs = 0;
  private frameInterval = 0; // EWMA of dt, in ms
  private samples = 0;
  private starvationStartMs = 0;
  private starved = false;

  constructor(opts: {
    halfLifeMs?: number;
    starvationThresholdFps?: number;
    starvationConsecutiveMs?: number;
  } = {}) {
    this.halfLifeMs = opts.halfLifeMs ?? 1000;
    this.starvationThresholdFps = opts.starvationThresholdFps ?? 12;
    this.starvationConsecutiveMs = opts.starvationConsecutiveMs ?? 3000;
  }

  /** Call once per frame with the current timestamp. */
  tick(nowMs: number): void {
    if (this.lastFrameMs === 0) {
      this.lastFrameMs = nowMs;
      return;
    }
    const dt = nowMs - this.lastFrameMs;
    this.lastFrameMs = nowMs;
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.frameInterval === 0) {
      this.frameInterval = dt;
    } else {
      // EWMA on frame interval. α from half-life over dt.
      const alpha = 1 - Math.pow(0.5, dt / this.halfLifeMs);
      this.frameInterval = this.frameInterval + alpha * (dt - this.frameInterval);
    }
    this.samples++;
    // Track sustained starvation.
    const fps = this.fps();
    if (fps > 0 && fps < this.starvationThresholdFps) {
      if (this.starvationStartMs === 0) this.starvationStartMs = nowMs;
      else if (nowMs - this.starvationStartMs >= this.starvationConsecutiveMs) {
        this.starved = true;
      }
    } else {
      this.starvationStartMs = 0;
      // Don't reset `starved` once tripped — caller decides when to recover.
    }
  }

  /** Smoothed FPS estimate. Returns 0 during warmup. */
  fps(): number {
    if (this.samples < 5 || this.frameInterval <= 0) return 0;
    return 1000 / this.frameInterval;
  }

  /** True when FPS has been < threshold for `starvationConsecutiveMs`. */
  isStarved(): boolean {
    return this.starved;
  }

  /** Caller-controlled reset (e.g. after switching to a lighter model). */
  reset(): void {
    this.lastFrameMs = 0;
    this.frameInterval = 0;
    this.samples = 0;
    this.starvationStartMs = 0;
    this.starved = false;
  }
}
