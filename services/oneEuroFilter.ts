/**
 * One Euro Filter — adaptive low-pass for real-time UI input.
 *
 * Reference: Casiez, Roussel & Vogel, "1€ Filter: A Simple Speed-Based
 * Low-Pass Filter for Noisy Input in Interactive Systems", CHI 2012.
 *   https://gery.casiez.net/1euro/
 *   https://gery.casiez.net/publications/CHI2012-casiez.pdf
 *
 * Why we use this (and not Kalman1D anymore):
 *   • MediaPipe's own `landmarks_smoothing_calculator` ships One Euro
 *     as the canonical smoother; Chromium uses it for stylus / touch
 *     prediction on every Android device. Our Kalman1D was the
 *     outlier — Casiez's paper directly compares the two and shows
 *     One Euro tracks the jitter-vs-lag trade-off better on noisy
 *     real-time input streams.
 *   • Two intuitive parameters (`mincutoff`, `beta`) instead of a
 *     hand-tuned Q/R covariance matrix that drifts as visibility
 *     changes.
 *   • At low velocity → low cutoff → heavy smoothing (jitter rejected).
 *     At high velocity → high cutoff → light smoothing (no lag).
 *
 * Confidence-aware extension (this codebase, May 2026):
 *   The original 1€ doesn't take a per-measurement confidence input.
 *   For AAC users on cheap webcams, MediaPipe's per-landmark
 *   visibility drops to 0.05–0.30 when the body part is partly out
 *   of frame — those frames should be smoothed harder so the
 *   cursor doesn't jump with the noise. We modulate `mincutoff`
 *   downward when visibility is low (less responsive, more stable),
 *   matching the strategy in HpEIS (Hu et al., ICME 2024).
 */

export interface OneEuroFilterOptions {
  /** Sampling rate in Hz. Used as fallback when timestamp dt is
   *  unavailable. Default 30 (matches our pose tracker target). */
  freq?: number;
  /** Minimum cutoff frequency in Hz. Lower → more smoothing at low
   *  velocity. Default 1.0 (Casiez recommended starting value). */
  mincutoff?: number;
  /** Speed coefficient. Higher → more aggressive cutoff increase
   *  with velocity (less lag during fast motion). Default 0.007. */
  beta?: number;
  /** Cutoff for the derivative low-pass. Default 1.0. */
  dcutoff?: number;
}

/** Single-axis exponential low-pass with configurable alpha. */
class LowPass {
  private y = 0;
  private s = 0; // smoothed value
  private initialized = false;

  filter(x: number, alpha: number): number {
    if (!Number.isFinite(x)) return this.s; // NaN defense — hold value
    if (!this.initialized) {
      this.s = x;
      this.initialized = true;
    } else {
      this.s = alpha * x + (1 - alpha) * this.s;
    }
    this.y = x;
    return this.s;
  }

  lastValue(): number { return this.y; }
  hasInit(): boolean { return this.initialized; }
  reset(initial = 0): void {
    this.y = initial;
    this.s = initial;
    this.initialized = false;
  }
  snapTo(v: number): void {
    if (!Number.isFinite(v)) return;
    this.s = v;
    this.y = v;
    this.initialized = true;
  }
}

export class OneEuroFilter {
  private readonly freq: number;
  private mincutoff: number;
  private beta: number;
  private readonly dcutoff: number;
  private readonly xFilt = new LowPass();
  private readonly dxFilt = new LowPass();
  private lastTimeMs = 0;

  constructor(opts: OneEuroFilterOptions = {}) {
    this.freq = opts.freq ?? 30;
    this.mincutoff = opts.mincutoff ?? 1.0;
    this.beta = opts.beta ?? 0.007;
    this.dcutoff = opts.dcutoff ?? 1.0;
  }

  /** Compute alpha for a given cutoff Hz at sampling rate freq. */
  private alpha(cutoff: number, freq: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / freq;
    return 1.0 / (1.0 + tau / te);
  }

  /** Update cutoff parameters at runtime — used by the
   *  confidence-aware wrapper to lower `mincutoff` when
   *  MediaPipe visibility is low (= more smoothing). */
  setMinCutoff(v: number): void {
    if (Number.isFinite(v) && v > 0) this.mincutoff = v;
  }
  setBeta(v: number): void {
    if (Number.isFinite(v) && v >= 0) this.beta = v;
  }

  /** Run a measurement update.
   *  - `value`: the raw sample (e.g. cursor x in pixels)
   *  - `timestampMs`: optional. If provided we compute true dt
   *    between samples; otherwise we use the configured freq.
   *  Returns the smoothed value. NaN-in → previous value out. */
  filter(value: number, timestampMs?: number): number {
    if (!Number.isFinite(value)) return this.xFilt.lastValue();

    let freq = this.freq;
    if (timestampMs !== undefined && this.lastTimeMs !== 0) {
      const dt = (timestampMs - this.lastTimeMs) / 1000;
      if (dt > 1e-6) freq = 1 / dt;
    }
    if (timestampMs !== undefined) this.lastTimeMs = timestampMs;

    // Estimate the rate of change.
    const dvalue = this.xFilt.hasInit()
      ? (value - this.xFilt.lastValue()) * freq
      : 0;
    const edvalue = this.dxFilt.filter(dvalue, this.alpha(this.dcutoff, freq));

    // Speed-adaptive cutoff: faster motion → higher cutoff →
    // less smoothing → less lag during deliberate motion.
    const cutoff = this.mincutoff + this.beta * Math.abs(edvalue);
    return this.xFilt.filter(value, this.alpha(cutoff, freq));
  }

  /** Saccade override — for big intentional jumps where smoothing
   *  would feel laggy, snap directly. Use cautiously. */
  snapTo(value: number): void {
    this.xFilt.snapTo(value);
    this.dxFilt.reset(0);
  }

  /** Hard reset (e.g. recalibration / tracker restart). */
  reset(): void {
    this.xFilt.reset(0);
    this.dxFilt.reset(0);
    this.lastTimeMs = 0;
  }

  /** Last filtered value with no side effects. */
  get value(): number { return this.xFilt.lastValue(); }
}

/**
 * Confidence-aware One Euro wrapper — modulates `mincutoff` with
 * MediaPipe per-landmark visibility (0..1). High visibility =
 * trust the measurement, less smoothing. Low visibility = smooth
 * harder so a noisy out-of-frame frame doesn't jet the cursor.
 *
 *   mincutoff_min  →  applied when confidence ≤ confLo (default 0.3)
 *   mincutoff_max  →  applied when confidence ≥ confHi (default 1.0)
 *   linear interp between
 */
export class ConfidenceAwareOneEuro {
  private readonly filter: OneEuroFilter;
  private readonly mincutoffLow: number;
  private readonly mincutoffHigh: number;
  private readonly confLo: number;
  private readonly confHi: number;

  constructor(opts: {
    freq?: number;
    /** mincutoff when confidence ≥ confHi (default 1.0 Hz). */
    mincutoffHigh?: number;
    /** mincutoff when confidence ≤ confLo (default 0.3 Hz). */
    mincutoffLow?: number;
    confLo?: number;
    confHi?: number;
    beta?: number;
    dcutoff?: number;
  } = {}) {
    this.mincutoffHigh = opts.mincutoffHigh ?? 1.0;
    this.mincutoffLow = opts.mincutoffLow ?? 0.3;
    this.confLo = opts.confLo ?? 0.3;
    this.confHi = opts.confHi ?? 1.0;
    this.filter = new OneEuroFilter({
      freq: opts.freq,
      mincutoff: this.mincutoffHigh,
      beta: opts.beta,
      dcutoff: opts.dcutoff,
    });
  }

  /** Update with a measurement + its confidence (visibility 0..1). */
  update(value: number, confidence: number, timestampMs?: number): number {
    const c = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
    const t = (c - this.confLo) / Math.max(1e-6, this.confHi - this.confLo);
    const tClamped = Math.max(0, Math.min(1, t));
    // Linear interp from low → high mincutoff (confidence-driven).
    const mcConf = this.mincutoffLow + (this.mincutoffHigh - this.mincutoffLow) * tClamped;
    // Apply noise-driven scale on top — quiet env keeps mcConf,
    // heavy noise pulls it down toward mincutoffLow.
    const mc = Math.max(this.mincutoffLow, mcConf * this.noiseScale);
    this.filter.setMinCutoff(mc);
    return this.filter.filter(value, timestampMs);
  }

  snapTo(value: number): void { this.filter.snapTo(value); }
  reset(): void { this.filter.reset(); }
  get value(): number { return this.filter.value; }

  /**
   * Apply a noise-floor-driven adjustment on top of the
   * confidence-driven mincutoff. Reduces cutoff (= more smoothing)
   * when ambient noise is high. Live noise comes from the
   * BaselineTracker's running variance — so the smoother
   * automatically adapts to a moving car / shaky environment
   * without the user touching settings.
   *
   *   noise ≤ 0.005 (quiet, stationary)  → no extra smoothing
   *   noise ≥ 0.05  (heavy jitter / car) → cap mincutoff at the
   *                                         filter's configured Low.
   *   linear interp between, applied as a SCALAR on top of the
   *   confidence-derived mincutoff so confidence still wins.
   */
  setNoiseFloor(noise: number): void {
    if (!Number.isFinite(noise) || noise <= 0) {
      this.noiseScale = 1;
      return;
    }
    const NOISE_QUIET = 0.005;
    const NOISE_HEAVY = 0.05;
    const t = (noise - NOISE_QUIET) / (NOISE_HEAVY - NOISE_QUIET);
    const tClamped = Math.max(0, Math.min(1, t));
    // At quiet end: scale=1.0 (no extra smoothing).
    // At heavy end: scale=mincutoffLow / mincutoffHigh (cap at Low).
    const minScale = this.mincutoffLow / Math.max(this.mincutoffHigh, 1e-6);
    this.noiseScale = 1.0 - tClamped * (1.0 - minScale);
  }
  /** Internal scalar applied on top of confidence-derived mincutoff. */
  private noiseScale = 1.0;
}
