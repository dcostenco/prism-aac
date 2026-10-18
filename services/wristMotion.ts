/** Wrist-only measurement conditioning. This estimates observed motion, not
 * intention or a diagnosis. It never changes calibration or tracking source. */
import { CAMERA_FRAME_STALE_MS } from './cameraFrameTiming';
export interface WristPoint { x: number; y: number }
export interface WristProjection { gain: WristPoint; tolerancePx: number }
interface Sample extends WristPoint { time: number }
export interface WristMotionResult {
  point: WristPoint;
  noise: number;
  paused: boolean;
  /** A held cursor is not permission to activate an AAC control. */
  selectionReady: boolean;
  held: boolean;
  rejected: boolean;
}
const HISTORY_MS = 2000;
const MAX_SAMPLES = 40;
const PAUSE_WINDOW_MS = 400;
const MIN_PAUSE_SPAN_MS = 300;
export const WRIST_PAUSE_SAMPLE_COUNT = 5;
const JUMP_SPEED = 0.6; // normalized camera-frame units/second
const JUMP_FLOOR = 0.04;
const JUMP_CEILING = 0.12;
const NOISE_JUMP_MULTIPLIER = 4;
const PAUSE_ENTER_NOISE_MULTIPLIER = 3;
const PAUSE_EXIT_NOISE_MULTIPLIER = 4;
const TREND_ENTER_ERROR_MULTIPLIER = 2.5;
const TREND_EXIT_ERROR_MULTIPLIER = 3.5;
const RESIDUAL_CORRELATION_LIMIT = 0.8;
const AXES = ['x', 'y'] as const;
const CONFIRM_NOISE_MULTIPLIER = 2;
const CONFIRM_FLOOR = 0.008;
const PIXEL_FRACTION = 0.5;
export const WRIST_MOTION_REFERENCE_SIZE = 320;
const PAUSE_ESCAPE_NOISE_MULTIPLIER = 3;
const NORMAL_IQR = 1.349;
const DIFFERENCE_IQR_TO_SIGMA = 1 / (NORMAL_IQR * Math.SQRT2);
const NOISY_INPUT_FLOOR = 0.005;
const NOISY_QUALIFICATION_MS = 1000;
export const MIN_WRIST_SELECTION_MS = 1200;
export const WRIST_SELECTION_NOISE_CEILING = NOISY_INPUT_FLOOR;
const MIN_SELECTION_FPS = 4.5;
const SELECTION_INTERVAL_JITTER = 0.2;
const MAX_SELECTION_MEDIAN_INTERVAL_MS = 1000 / MIN_SELECTION_FPS * (1 + SELECTION_INTERVAL_JITTER);
const CURSOR_DIAGONALS_PER_SECOND = 0.7;
const MAX_CURSOR_INTERVAL_MS = 100;
const CURSOR_SETTLE_DIAGONAL_FRACTION = 0.004;

/** Short legacy dwell settings cannot bypass fresh camera evidence. Other
 * input methods retain their own configured timing. */
export const wristSelectionDwellMs = (requested: number) => Math.max(MIN_WRIST_SELECTION_MS, requested);

/** Even a sustained model discontinuity cannot teleport the cursor. Bound
 * recovery gaps as well; a long absence is not permission for a large jump. */
export function limitWristCursorStep(previous: WristPoint, next: WristPoint, elapsedMs: number, width: number, height: number) {
  const amount = distance(previous, next);
  const limit = Math.hypot(width, height) * CURSOR_DIAGONALS_PER_SECOND * Math.max(0, Math.min(MAX_CURSOR_INTERVAL_MS, elapsedMs)) / 1000;
  if (amount <= limit || amount === 0) return { ...next, limited: false };
  return { x: previous.x + (next.x - previous.x) * limit / amount,
    y: previous.y + (next.y - previous.y) * limit / amount, limited: true };
}
export function wristCursorTolerance(width: number, height: number): number {
  return Math.max(2, Math.hypot(width, height) * CURSOR_SETTLE_DIAGONAL_FRACTION);
}
export function wristCursorSettled(cursor: WristPoint, target: WristPoint, width: number, height: number): boolean {
  return distance(cursor, target) <= wristCursorTolerance(width, height);
}

function quantile(values: number[], fraction: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
const distance = (a: WristPoint, b: WristPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const projectedDistance = (a: WristPoint, b: WristPoint, projection: WristProjection) =>
  Math.hypot((a.x - b.x) * projection.gain.x, (a.y - b.y) * projection.gain.y);
const center = (samples: Sample[]): WristPoint => ({
  x: (quantile(samples.map(p => p.x), 0.25) + quantile(samples.map(p => p.x), 0.75)) / 2,
  y: (quantile(samples.map(p => p.y), 0.25) + quantile(samples.map(p => p.y), 0.75)) / 2,
});
/** Fit against actual timestamps, not frame indices. Detrended residuals
 * measure noise without learning a steady deliberate trajectory as tremor. */
function fitAxis(samples: Sample[], axis: 'x' | 'y') {
  const count = samples.length;
  const averageTime = samples.reduce((sum, p) => sum + p.time, 0) / count;
  const average = samples.reduce((sum, p) => sum + p[axis], 0) / count;
  const times = samples.map(p => p.time - averageTime);
  const variance = times.reduce((sum, t) => sum + t * t, 0);
  const slope = variance ? samples.reduce((sum, p, i) => sum + times[i] * (p[axis] - average), 0) / variance : 0;
  const residuals = samples.map((p, i) => p[axis] - average - slope * times[i]);
  const squares = residuals.reduce((sum, r) => sum + r * r, 0);
  const adjacent = residuals.slice(1).reduce((sum, r, i) => sum + r * residuals[i], 0);
  const correlation = squares ? Math.max(-RESIDUAL_CORRELATION_LIMIT, Math.min(RESIDUAL_CORRELATION_LIMIT, adjacent / squares)) : 0;
  const error = count > 2 && variance ? Math.sqrt(squares / (count - 2) / variance * (1 + correlation) / (1 - correlation)) : 0;
  return { slope, error, residuals };
}

export class WristMotion {
  private raw: Sample[] = [];
  private accepted: Sample[] = [];
  private previous: Sample | null = null;
  private candidate: Sample | null = null;
  private latch: WristPoint | null = null;
  private latchNoise = 0;
  private lastTime: number | null = null;
  private noise = 0;
  private quality: Array<{ time: number; noise: number }> = [];

  /** Break pause continuity on any lost/unobserved frame. Retain the measured
   * noise history and last accepted position. Losing tracking is neither
   * evidence that tremor disappeared nor permission to trust a far first
   * recovery sample. A genuine displacement can still confirm in two frames. */
  interrupt(): void {
    this.accepted = []; this.candidate = null; this.latch = null;
    this.lastTime = null;
  }

  update(point: WristPoint, time: number, cameraLongSide: number, projection?: WristProjection): WristMotionResult {
    const empty = (): WristMotionResult => ({ point: this.previous ?? point, noise: this.noise,
      paused: false, selectionReady: false, held: true, rejected: true });
    if (![point.x, point.y, time].every(Number.isFinite) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      const result = empty(); this.interrupt(); return result;
    }
    if (projection && ![projection.gain.x, projection.gain.y, projection.tolerancePx].every(value => Number.isFinite(value) && value > 0)) {
      const result = empty(); this.interrupt(); return result;
    }
    if (this.lastTime !== null && time <= this.lastTime) { const result = empty(); this.interrupt(); return result; }
    if (this.lastTime !== null && time - this.lastTime >= CAMERA_FRAME_STALE_MS) this.interrupt();
    const dt = this.lastTime === null ? 0 : time - this.lastTime;
    this.lastTime = time;
    const sample = { ...point, time };
    this.raw.push(sample);
    this.raw = this.raw.filter(p => time - p.time <= HISTORY_MS).slice(-MAX_SAMPLES);
    this.measureNoise();
    const pixelFloor = PIXEL_FRACTION / Math.max(1, Math.min(WRIST_MOTION_REFERENCE_SIZE, cameraLongSide));
    const jumpLimit = Math.min(JUMP_CEILING, Math.max(JUMP_FLOOR, JUMP_SPEED * dt / 1000, this.noise * NOISE_JUMP_MULTIPLIER));
    if (this.previous && distance(sample, this.previous) > jumpLimit) {
      const consistent = this.candidate && distance(sample, this.candidate) <= Math.max(CONFIRM_FLOOR, this.noise * CONFIRM_NOISE_MULTIPLIER);
      if (!consistent) {
        this.candidate = sample; this.latch = null; this.accepted = [];
        return empty();
      }
      this.accepted = []; this.latch = null;
    }
    this.candidate = null; this.previous = sample;
    this.accepted.push(sample);
    this.accepted = this.accepted.filter(p => time - p.time <= HISTORY_MS).slice(-MAX_SAMPLES);
    if (this.accepted.length >= WRIST_PAUSE_SAMPLE_COUNT) {
      // Differences under-measure correlated jitter. Use robust positional
      // residuals too, but ONLY accepted observations (not a rejected jump).
      const residualNoise = AXES.map(axis => {
        const { residuals } = fitAxis(this.accepted, axis);
        return (quantile(residuals, 0.75) - quantile(residuals, 0.25)) / NORMAL_IQR;
      });
      this.noise = Math.max(this.noise, Math.hypot(...residualNoise) / Math.SQRT2);
    }
    // The real SDK journey produced 122–205ms intervals. A fixed 400ms
    // window could never contain five samples on that live stream.
    const tail = this.accepted.slice(-WRIST_PAUSE_SAMPLE_COUNT);
    const windowMs = Math.max(PAUSE_WINDOW_MS, time - tail[0].time);
    const recent = this.accepted.filter(p => time - p.time <= windowMs);
    const span = time - recent[0].time;
    const qualified = this.noise <= NOISY_INPUT_FLOOR || time - this.accepted[0].time >= NOISY_QUALIFICATION_MS;
    const ready = qualified && recent.length >= WRIST_PAUSE_SAMPLE_COUNT && span >= MIN_PAUSE_SPAN_MS;
    const travel = ready ? this.trendTravel(recent, span) : Infinity;
    // After a clock rollback the retained estimates count as current, so a
    // reset cannot hide noise either; they still age out of the bounded window.
    this.quality.push({ time, noise: this.noise });
    this.quality = this.quality.map(p => p.time > time ? { ...p, time } : p)
      .filter(p => time - p.time <= HISTORY_MS).slice(-MAX_SAMPLES);
    const intervals = this.accepted.slice(1).map((p, i) => p.time - this.accepted[i].time);
    // A quiet camera-space reading can still be many screen pixels at high
    // calibration gain. Such input is cursor feedback, not selection proof.
    const noiseLimit = projection ? Math.min(WRIST_SELECTION_NOISE_CEILING,
      projection.tolerancePx / Math.max(projection.gain.x, projection.gain.y)) : WRIST_SELECTION_NOISE_CEILING;
    const trustedMeasurement = time - this.accepted[0].time >= MIN_WRIST_SELECTION_MS &&
      this.quality.every(p => p.noise <= noiseLimit) &&
      quantile(intervals, 0.5) <= MAX_SELECTION_MEDIAN_INTERVAL_MS;
    // Enter cautiously; once resting, do not reset dwell on an ordinary
    // noise excursion or a shrinking estimate. Directed travel still escapes
    // through a per-axis trend check, including orthogonal tremor.
    const pauseNoise = Math.max(this.noise, this.latch ? this.latchNoise : 0);
    const noiseMultiplier = this.latch ? PAUSE_EXIT_NOISE_MULTIPLIER : PAUSE_ENTER_NOISE_MULTIPLIER;
    let paused = ready && travel <= Math.max(pixelFloor * span / PAUSE_WINDOW_MS, pauseNoise * noiseMultiplier);
    if (paused && this.directedTravel(pixelFloor, projection)) paused = false;
    // A small coherent movement must eventually escape the rest latch even
    // when each individual step is below the measured jitter envelope.
    if (paused && this.latch && distance(center(recent), this.latch) > Math.max(pixelFloor * 4, pauseNoise * PAUSE_ESCAPE_NOISE_MULTIPLIER)) paused = false;
    // A noisy motion can latch an intermediate point. Once a whole fresh
    // low-noise window settles elsewhere, that old wide envelope cannot keep
    // authorizing the stale anchor. Release it without selecting this frame.
    if (paused && this.latch && trustedMeasurement && (projection
      ? projectedDistance(center(recent), this.latch, projection) > projection.tolerancePx
      : distance(center(recent), this.latch) > Math.max(pixelFloor * 4, this.noise * PAUSE_ESCAPE_NOISE_MULTIPLIER))) paused = false;
    if (paused && !this.latch) { this.latch = center(recent); this.latchNoise = this.noise; }
    if (!paused) this.latch = null;
    const stable = this.latch ?? (this.accepted.length >= 3 ? {
      x: quantile(this.accepted.slice(-3).map(p => p.x), 0.5),
      y: quantile(this.accepted.slice(-3).map(p => p.y), 0.5),
    } : point);
    // Fail closed outside the supported low-noise envelope. Do not infer
    // intent from a rest latch, or from a momentarily shrinking noise estimate.
    // Noise raises the statistical escape threshold above slow purposeful
    // travel. Do not let that authorize a click: the measured trend itself
    // must stay within the screen tolerance over a complete target hold.
    // Keep this separate from the physical rest latch so ordinary tremor
    // does not force the displayed cursor to chase each noisy observation.
    const selectionTravel = projection && trustedMeasurement ? Math.hypot(...AXES.map(axis =>
      fitAxis(this.accepted, axis).slope * projection.gain[axis])) * MIN_WRIST_SELECTION_MS : 0;
    const selectionReady = paused && trustedMeasurement && (!projection ||
      selectionTravel <= projection.tolerancePx && projectedDistance(center(recent), stable, projection) <= projection.tolerancePx);
    return { point: stable, noise: this.noise, paused, selectionReady, held: paused, rejected: false };
  }

  private measureNoise(): void {
    const differences: WristPoint[] = [];
    for (let i = 1; i < this.raw.length; i++) {
      const a = this.raw[i - 1], b = this.raw[i], dt = b.time - a.time;
      if (dt > 0 && dt < CAMERA_FRAME_STALE_MS) differences.push({ x: (b.x - a.x) / dt, y: (b.y - a.y) / dt });
    }
    if (differences.length < 3) return;
    const intervals = this.raw.slice(1).map((p, i) => p.time - this.raw[i].time).filter(dt => dt > 0 && dt < CAMERA_FRAME_STALE_MS);
    const dt = quantile(intervals, 0.5);
    // IQR is robust to isolated jumps and stays nonzero for alternating
    // tremor. MAD around the median collapses for that two-level signal.
    const x = differences.map(p => p.x), y = differences.map(p => p.y);
    const nx = (quantile(x, 0.75) - quantile(x, 0.25)) * dt * DIFFERENCE_IQR_TO_SIGMA;
    const ny = (quantile(y, 0.75) - quantile(y, 0.25)) * dt * DIFFERENCE_IQR_TO_SIGMA;
    this.noise = Math.hypot(nx, ny) / Math.SQRT2;
  }

  private directedTravel(pixelFloor: number, projection?: WristProjection): boolean {
    const span = this.accepted[this.accepted.length - 1].time - this.accepted[0].time;
    const multiplier = this.latch ? TREND_EXIT_ERROR_MULTIPLIER : TREND_ENTER_ERROR_MULTIPLIER;
    return AXES.some(axis => {
      const fit = fitAxis(this.accepted, axis);
      const floor = projection ? Math.min(pixelFloor * 4, projection.tolerancePx / projection.gain[axis]) : pixelFloor * 4;
      return Math.abs(fit.slope) * span > Math.max(floor, fit.error * span * multiplier);
    });
  }

  private trendTravel(samples: Sample[], span: number): number {
    const averageTime = samples.reduce((s, p) => s + p.time, 0) / samples.length;
    const averageX = samples.reduce((s, p) => s + p.x, 0) / samples.length;
    const averageY = samples.reduce((s, p) => s + p.y, 0) / samples.length;
    let varianceTime = 0, x = 0, y = 0;
    for (const p of samples) {
      const t = p.time - averageTime;
      varianceTime += t * t; x += t * (p.x - averageX); y += t * (p.y - averageY);
    }
    return varianceTime > 0 ? Math.hypot(x, y) * span / varianceTime : Infinity;
  }
}
