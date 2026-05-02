'use client';

/**
 * Finger Proximity Detection — Camera-based "touch without touching"
 *
 * Uses the webcam to detect when the user's finger is approaching the
 * screen. As the finger gets closer, it appears larger in the camera
 * frame. When the apparent size crosses a threshold → virtual "click."
 *
 * Physics model:
 *   - Camera is at fixed distance D from screen surface
 *   - Finger at distance Z from camera has apparent width:
 *       W_apparent = (W_real × f) / Z
 *     where f = focal length in pixels
 *   - As Z decreases (finger approaches), W_apparent increases
 *   - When W_apparent exceeds threshold → finger is "touching" the screen
 *
 * Parallax correction:
 *   - Front camera is offset from screen center (top bezel on iPad)
 *   - As finger approaches, parallax shifts the apparent position
 *   - Correction: x_corrected = x_apparent + (x_apparent - cx) × (1 - Z/D)
 *     where cx = camera center X, D = camera-to-screen distance
 *
 * Velocity prediction:
 *   - Track dW/dt (rate of size change) to predict touch moment
 *   - If finger is approaching fast → trigger click slightly early
 *     for zero-latency response
 */

export interface ProximityState {
  fingerDetected: boolean;
  apparentWidth: number;     // px in camera frame
  estimatedDistance: number;  // estimated cm from screen
  approaching: boolean;      // finger moving toward screen
  velocity: number;          // px/frame rate of size change
  touchProbability: number;  // 0-1, likelihood of imminent touch
  correctedX: number;        // parallax-corrected screen X
  correctedY: number;        // parallax-corrected screen Y
}

export interface ProximityConfig {
  touchThresholdPx: number;       // apparent width at "touch" (default 80px)
  hoverThresholdPx: number;       // apparent width at "hover" (default 40px)
  realFingerWidthMm: number;      // child finger ~12mm, adult ~18mm
  cameraOffsetYPercent: number;   // camera position (0=top, 0.5=center, 1=bottom)
  velocityPredictionMs: number;   // predict touch N ms ahead (default 50)
}

const DEFAULT_CONFIG: ProximityConfig = {
  touchThresholdPx: 80,
  hoverThresholdPx: 40,
  realFingerWidthMm: 14,
  cameraOffsetYPercent: 0.05, // front camera near top of iPad
  velocityPredictionMs: 50,
};

// ── Focal Length Estimation ────────────────────────────────────────────
// Approximate focal length in pixels for common devices.
// f_px = (sensor_width_px × real_focal_length_mm) / sensor_width_mm
// iPad front camera: ~30mm equivalent, 640px capture width
// MacBook FaceTime: ~24mm equivalent, 640px capture width
const ESTIMATED_FOCAL_LENGTH_PX = 500;

// ── Proximity Calculator ───────────────────────────────────────────────

export class ProximityCalculator {
  private config: ProximityConfig;
  private history: Array<{ width: number; t: number }> = [];
  private readonly MAX_HISTORY = 10;

  constructor(config: Partial<ProximityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a detected finger/hand landmark and compute proximity state.
   *
   * @param fingerTipX - normalized X position of fingertip (0-1)
   * @param fingerTipY - normalized Y position of fingertip (0-1)
   * @param fingerWidth - apparent width of finger in pixels
   * @param canvasWidth - camera frame width
   * @param canvasHeight - camera frame height
   * @param screenWidth - screen width in pixels
   * @param screenHeight - screen height in pixels
   */
  update(
    fingerTipX: number,
    fingerTipY: number,
    fingerWidth: number,
    canvasWidth: number,
    canvasHeight: number,
    screenWidth: number,
    screenHeight: number,
  ): ProximityState {
    const now = performance.now();

    // ── Distance estimation ────────────────────────────────────────
    // Pinhole-camera model: Z_mm = (W_real_mm × f_pixels) / W_apparent_pixels.
    // Both the real width and the focal length must be in their natural units —
    // no 96dpi conversion (the prior version mixed CSS-pixels with focal-pixels
    // and produced distance estimates that were off by ~3.78×).
    const estimatedZmm = fingerWidth > 0
      ? (this.config.realFingerWidthMm * ESTIMATED_FOCAL_LENGTH_PX) / fingerWidth
      : 9999;

    // Distance from screen ≈ Z - camera-to-screen offset (~3cm for iPad).
    const cameraToScreenCm = 3;
    const estimatedDistanceCm = Math.max(0, estimatedZmm / 10 - cameraToScreenCm);

    // ── Velocity tracking ──────────────────────────────────────────
    this.history.push({ width: fingerWidth, t: now });
    if (this.history.length > this.MAX_HISTORY) this.history.shift();

    let velocity = 0;
    if (this.history.length >= 2) {
      const oldest = this.history[0];
      const newest = this.history[this.history.length - 1];
      const dt = newest.t - oldest.t;
      if (dt > 0) {
        velocity = (newest.width - oldest.width) / (dt / 1000); // px/sec
      }
    }

    const approaching = velocity > 5; // growing = approaching

    // ── Touch probability ──────────────────────────────────────────
    // Based on current size + velocity prediction
    const predictedWidth = fingerWidth + velocity * (this.config.velocityPredictionMs / 1000);
    const touchProb = Math.min(1, Math.max(0,
      (predictedWidth - this.config.hoverThresholdPx) /
      (this.config.touchThresholdPx - this.config.hoverThresholdPx)
    ));

    // ── Parallax correction ────────────────────────────────────────
    // Camera is offset from screen center (typically at top bezel).
    // As finger approaches, the parallax shift increases.
    // x_corrected = x + (x - 0.5) × parallax_factor
    // parallax_factor = camera_offset × (1 - distance_ratio)
    const cameraMaxDistanceCm = 60; // max tracking distance
    const distanceRatio = Math.min(1, estimatedDistanceCm / cameraMaxDistanceCm);
    const parallaxStrength = 1 - distanceRatio; // stronger when closer

    const cameraCenterX = 0.5;
    const cameraCenterY = this.config.cameraOffsetYPercent;

    // Parallax shifts the apparent position AWAY from camera center
    // as the finger gets closer (perspective effect)
    const parallaxX = (fingerTipX - cameraCenterX) * parallaxStrength * 0.3;
    const parallaxY = (fingerTipY - cameraCenterY) * parallaxStrength * 0.3;

    const correctedNormX = Math.max(0, Math.min(1, fingerTipX + parallaxX));
    const correctedNormY = Math.max(0, Math.min(1, fingerTipY + parallaxY));

    // Map to screen coordinates (camera is mirrored)
    const correctedX = (1 - correctedNormX) * screenWidth;
    const correctedY = correctedNormY * screenHeight;

    return {
      fingerDetected: fingerWidth > 5,
      apparentWidth: fingerWidth,
      estimatedDistance: Math.round(estimatedDistanceCm * 10) / 10,
      approaching,
      velocity: Math.round(velocity * 10) / 10,
      touchProbability: Math.round(touchProb * 100) / 100,
      correctedX,
      correctedY,
    };
  }

  /**
   * Check if the current state indicates a "touch" with hysteresis to prevent
   * spurious clicks when probability fluctuates around the threshold. The
   * `wasInTouch` argument tracks whether we were in the touch state on the
   * previous frame; releasing requires probability to fall meaningfully below
   * the entry threshold (0.65) before re-arming.
   */
  isTouch(state: ProximityState, wasInTouch: boolean = false): boolean {
    if (wasInTouch) return state.touchProbability >= 0.65;
    return state.touchProbability >= 0.85;
  }

  /**
   * Check if the finger is in "hover" range (approaching but not touching).
   */
  isHover(state: ProximityState): boolean {
    return state.touchProbability >= 0.3 && state.touchProbability < 0.85;
  }

  reset(): void {
    this.history = [];
  }
}

// ── Integration with Pose/Hand Tracker ─────────────────────────────────

/**
 * Compute finger length proxy from MediaPipe hand landmarks (MCP→TIP distance).
 * Used as the "apparent size" signal — closer finger = larger MCP→TIP span.
 *
 * IMPORTANT: x and y must be scaled by canvasWidth and canvasHeight respectively;
 * scaling both by canvasWidth (the previous bug) distorts the distance for any
 * non-square frame.
 */
export function computeFingerApparentWidth(
  landmarks: Array<{ x: number; y: number; z: number }>,
  canvasWidth: number,
  canvasHeight: number = canvasWidth,
): number {
  if (landmarks.length < 21) return 0;

  // Index finger: MCP (5) to TIP (8)
  const mcp = landmarks[5];
  const tip = landmarks[8];

  const dx = (tip.x - mcp.x) * canvasWidth;
  const dy = (tip.y - mcp.y) * canvasHeight;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute finger size proxy from MediaPipe Pose landmarks (33-pt model only
 * gives wrist + 3 hand points; full hand is in HandLandmarker).
 * Uses wrist (15/16) to index (19/20) distance as a coarse proxy.
 */
export function computeFingerWidthFromPose(
  landmarks: Array<{ x: number; y: number; z: number }>,
  canvasWidth: number,
  canvasHeight: number = canvasWidth,
  isRightHand: boolean = true,
): number {
  if (landmarks.length < 33) return 0;

  const wristIdx = isRightHand ? 16 : 15;
  const indexIdx = isRightHand ? 20 : 19;

  const wrist = landmarks[wristIdx];
  const index = landmarks[indexIdx];

  const dx = (index.x - wrist.x) * canvasWidth;
  const dy = (index.y - wrist.y) * canvasHeight;

  // Empirical scale: wrist→index span averages ~3× finger width on adults.
  return Math.sqrt(dx * dx + dy * dy) * 0.3;
}

// ── Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism-proximity-config';

export function loadProximityConfig(): ProximityConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* */ }
  return DEFAULT_CONFIG;
}

export function saveProximityConfig(config: Partial<ProximityConfig>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_CONFIG, ...config })); } catch { /* */ }
}
