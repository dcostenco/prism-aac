/**
 * recalibration — background drift correction without re-running the
 * 4-corner ritual.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § F.
 *
 * Three correction signals, ranked by ease + impact:
 *
 *   1. CENTER drift — `BaselineTracker` exp-averages the user's normalized
 *      face position over a long window. When the moving mean diverges
 *      from the captured baseline by > offsetThreshold, return an offset
 *      correction the consumer applies to its calibration.
 *
 *   2. SCALE drift — `BaselineTracker` also tracks variance of (normX,
 *      normY). If variance shrinks below shrinkThreshold * baselineVar,
 *      the user moved closer to the camera (smaller motion range maps
 *      to the same screen) — return a scale correction.
 *
 *   3. ANCHOR — `recordAnchor()` is called by the consumer whenever the
 *      user lands a successful dwell-click on a known target. The cursor
 *      *was* exactly at the target's screen position; we use that as a
 *      ground-truth pinning event to reset offset.
 *
 * All pure logic. The caller owns the calibration data structure; this
 * module just emits corrections. Telemetry-friendly: every method
 * returns explicit "no correction needed" rather than mutating in place.
 */

export interface BaselineSample {
    /** Face position in normalized [0..1] camera-frame coords. */
    normX: number;
    normY: number;
    /** Wall-clock timestamp in ms (monotonic). */
    timestamp: number;
}

export interface BaselineTrackerOptions {
    /** Half-life in ms for the running mean. Default 60 seconds. */
    meanHalfLifeMs?: number;
    /** Half-life in ms for the running variance. Default 30 seconds. */
    varianceHalfLifeMs?: number;
    /**
     * Min normalized-coord drift before suggesting an offset correction.
     * Default 0.05 (≈ 5% of camera frame). Below this, drift is noise.
     */
    offsetThreshold?: number;
    /**
     * Min ms before correction is allowed to fire after baseline capture.
     * Avoids flapping during the first warm-up. Default 30 seconds.
     */
    minWarmupMs?: number;
    /**
     * Variance ratio (current/baseline) below which we suggest a scale
     * correction. Default 0.7 (= user moved 30% closer). Set to 0 to
     * disable scale corrections entirely.
     */
    shrinkThreshold?: number;
}

export interface OffsetCorrection {
    kind: 'offset';
    /** Amount to shift calibration anchors (in normalized coords). */
    deltaNormX: number;
    deltaNormY: number;
}

export interface ScaleCorrection {
    kind: 'scale';
    /** Multiplicative factor — current / baseline variance ratio. */
    scaleX: number;
    scaleY: number;
}

export interface AnchorCorrection {
    kind: 'anchor';
    /** What the cursor's normalized coord was when the user landed the click. */
    cursorNormX: number;
    cursorNormY: number;
    /** Where the dwell target was, in normalized screen coords. */
    targetNormX: number;
    targetNormY: number;
}

export type Correction = OffsetCorrection | ScaleCorrection | AnchorCorrection;

/* ── Pure helpers ─────────────────────────────────────────────────── */

/**
 * Convert a half-life (ms) and a delta-time (ms) into the alpha
 * coefficient for `next = prev * (1-α) + sample * α`. Equivalent
 * to discrete exponential smoothing with the given decay constant.
 */
export function alphaFromHalfLife(halfLifeMs: number, dtMs: number): number {
    if (halfLifeMs <= 0 || !Number.isFinite(halfLifeMs)) return 1;
    if (dtMs <= 0 || !Number.isFinite(dtMs)) return 0;
    // After dtMs, weight should be (1/2)^(dt/halfLife). α = 1 - that.
    return 1 - Math.pow(0.5, dtMs / halfLifeMs);
}

/* ── BaselineTracker ──────────────────────────────────────────────── */

export class BaselineTracker {
    private readonly meanHalfLifeMs: number;
    private readonly varianceHalfLifeMs: number;
    private readonly offsetThreshold: number;
    private readonly minWarmupMs: number;
    private readonly shrinkThreshold: number;

    private firstSampleTs = 0;
    private lastSampleTs = 0;
    /** Initial "baseline" — captured once on first push. */
    private baselineX = 0;
    private baselineY = 0;
    private baselineVarX = 0;
    private baselineVarY = 0;
    private baselineLockedAt = 0;
    /** Rolling mean / variance — updated each push. */
    private meanX = 0;
    private meanY = 0;
    private varX = 0;
    private varY = 0;
    /** Total samples seen. */
    private samples = 0;

    constructor(opts: BaselineTrackerOptions = {}) {
        this.meanHalfLifeMs = opts.meanHalfLifeMs ?? 60_000;
        this.varianceHalfLifeMs = opts.varianceHalfLifeMs ?? 30_000;
        this.offsetThreshold = opts.offsetThreshold ?? 0.05;
        this.minWarmupMs = opts.minWarmupMs ?? 30_000;
        this.shrinkThreshold = opts.shrinkThreshold ?? 0.7;
    }

    /** Feed a frame. Returns the new running mean (mostly for tests). */
    push(s: BaselineSample): { meanX: number; meanY: number } {
        if (!Number.isFinite(s.normX) || !Number.isFinite(s.normY) || !Number.isFinite(s.timestamp)) {
            return { meanX: this.meanX, meanY: this.meanY };
        }
        if (this.samples === 0) {
            // First sample — seed everything.
            this.firstSampleTs = s.timestamp;
            this.lastSampleTs = s.timestamp;
            this.meanX = s.normX;
            this.meanY = s.normY;
            this.baselineX = s.normX;
            this.baselineY = s.normY;
            this.varX = 0;
            this.varY = 0;
            this.samples = 1;
            return { meanX: this.meanX, meanY: this.meanY };
        }
        const dt = Math.max(1, s.timestamp - this.lastSampleTs);
        const alphaMean = alphaFromHalfLife(this.meanHalfLifeMs, dt);
        const alphaVar = alphaFromHalfLife(this.varianceHalfLifeMs, dt);

        const nextMeanX = this.meanX + alphaMean * (s.normX - this.meanX);
        const nextMeanY = this.meanY + alphaMean * (s.normY - this.meanY);
        // Welford-like running variance (exponentially weighted).
        const dxBefore = s.normX - this.meanX;
        const dyBefore = s.normY - this.meanY;
        const dxAfter = s.normX - nextMeanX;
        const dyAfter = s.normY - nextMeanY;
        // The (dxBefore * dxAfter - varX) term can drive varX briefly
        // negative on a step change in mean (sample dragged the mean
        // past the previous mean). Variance is mathematically ≥ 0;
        // clamp so getNoiseFloor() and the scale-correction ratios
        // never produce nonsense.
        // Identified in May 2026 military-grade review.
        this.varX = Math.max(0, this.varX + alphaVar * (dxBefore * dxAfter - this.varX));
        this.varY = Math.max(0, this.varY + alphaVar * (dyBefore * dyAfter - this.varY));
        this.meanX = nextMeanX;
        this.meanY = nextMeanY;
        this.lastSampleTs = s.timestamp;
        this.samples++;

        // Lock the "what counts as normal" baseline AFTER warmup, so the
        // baseline reflects a settled mean rather than the noisy first
        // sample. Captured once and held.
        if (this.baselineLockedAt === 0 && (s.timestamp - this.firstSampleTs) >= this.minWarmupMs) {
            this.baselineX = this.meanX;
            this.baselineY = this.meanY;
            this.baselineVarX = this.varX;
            this.baselineVarY = this.varY;
            this.baselineLockedAt = s.timestamp;
        }

        return { meanX: this.meanX, meanY: this.meanY };
    }

    /**
     * Suggest a correction, or null if everything's within tolerance OR
     * we're still warming up. Caller applies the correction to its
     * calibration data and resets the baseline (via `acceptCorrection`)
     * so we don't keep re-firing the same delta.
     */
    suggestCorrection(now: number): Correction | null {
        if (this.baselineLockedAt === 0) return null;
        if (now - this.baselineLockedAt < this.minWarmupMs) return null;

        // Offset check (more impactful, runs first).
        const dx = this.meanX - this.baselineX;
        const dy = this.meanY - this.baselineY;
        if (Math.abs(dx) > this.offsetThreshold || Math.abs(dy) > this.offsetThreshold) {
            return { kind: 'offset', deltaNormX: dx, deltaNormY: dy };
        }

        // Scale check — only when shrinkThreshold is enabled (>0).
        if (this.shrinkThreshold > 0 && this.baselineVarX > 0 && this.baselineVarY > 0) {
            const ratioX = this.varX / this.baselineVarX;
            const ratioY = this.varY / this.baselineVarY;
            if (ratioX < this.shrinkThreshold && ratioY < this.shrinkThreshold) {
                return { kind: 'scale', scaleX: ratioX, scaleY: ratioY };
            }
        }
        return null;
    }

    /**
     * Caller calls this after applying a returned correction. Resets the
     * baseline anchors to the current mean so the next diff starts from
     * the new equilibrium.
     */
    acceptCorrection(now: number): void {
        this.baselineX = this.meanX;
        this.baselineY = this.meanY;
        this.baselineVarX = this.varX;
        this.baselineVarY = this.varY;
        this.baselineLockedAt = now;
    }

    /** Hard reset — call when a fresh manual calibration is captured. */
    reset(): void {
        this.firstSampleTs = 0;
        this.lastSampleTs = 0;
        this.baselineX = this.baselineY = 0;
        this.baselineVarX = this.baselineVarY = 0;
        this.baselineLockedAt = 0;
        this.meanX = this.meanY = 0;
        this.varX = this.varY = 0;
        this.samples = 0;
    }

    /** Diagnostic snapshot. */
    get snapshot() {
        return {
            samples: this.samples,
            meanX: this.meanX,
            meanY: this.meanY,
            baselineX: this.baselineX,
            baselineY: this.baselineY,
            varX: this.varX,
            varY: this.varY,
            baselineLocked: this.baselineLockedAt !== 0,
        };
    }

    /**
     * Live noise floor — RMS of running variance per axis, in
     * normalized [0..1] pose-space units. Used by the smoother
     * (services/oneEuroFilter.ts) to auto-tune its mincutoff:
     * high noise → lower cutoff (heavier smoothing), quiet
     * environment → higher cutoff (more responsive cursor).
     *
     * Returns 0 during warmup (insufficient samples) so the
     * smoother stays at its default tuning until we have a
     * meaningful estimate.
     *
     * Typical values:
     *   • Stationary user, good lighting:    ~0.001 – 0.005
     *   • Light hand jitter / talking:       ~0.005 – 0.015
     *   • Moving car / lap-held laptop:      ~0.020 – 0.080+
     *   • Severe spasticity / camera shake:  ~0.050+
     */
    getNoiseFloor(): number {
        if (this.samples < 30) return 0;
        return Math.sqrt(this.varX * this.varX + this.varY * this.varY);
    }
}

/* ── CorrectionLoop — thin client for Synalux L1/L2/L3 pipeline ──── */

/**
 * Thin client wrapping the canonical three-level tracking auto-correction
 * loop implemented in Synalux (POST /api/v1/prism-aac/tracking/correct).
 *
 * Architecture (from prism-training/PLAN_2026-05-09_THREE_LAYER_AAC.md):
 *   L1 MEASURE  — EWMA drift detection (runs in Synalux, state mirrored here)
 *   L2 CORRECT  — correction vector returned by Synalux → applied locally
 *   L3 VERIFY   — linearly-weighted summary of post-correction drift;
 *                 Synalux decides success / retry / needs-recalibration
 *
 * Online path: every `checkIntervalMs` this client POSTs the accumulated
 *   drift samples + current state to Synalux and applies the returned action.
 *
 * Offline fallback: BaselineTracker + single-level correction (no L3 verify).
 *   Ensures the cursor keeps working in schools / hospitals with no WiFi.
 *   The fallback fires `prism-recalibration-needed` after maxRetries as well.
 */

import { SYNALUX_API } from '@/lib/portalConfig';

interface RemoteState {
  phase: 'L1_IDLE' | 'L2_CORRECTING' | 'L3_VERIFYING';
  retryCount: number;
  firstCorrectionTs: number;
  verifyStartTs: number;
  verifyDrifts: number[];
  ewma: {
    meanX: number; meanY: number;
    baselineX: number; baselineY: number;
    baselineLockedAt: number;
    firstSampleTs: number;
    samples: number; lastTs: number;
  };
}

type RemoteAction =
  | { kind: 'none'; state: RemoteState }
  | { kind: 'apply_offset'; dx: number; dy: number; state: RemoteState }
  | { kind: 'needs_recalibration'; reason: string; state: RemoteState };

export interface CorrectionLoopOptions {
  /** How often to call Synalux for a decision (ms). Default 2 000. */
  checkIntervalMs?: number;
  /** Max offline-fallback retries before firing prism-recalibration-needed. Default 3. */
  maxRetries?: number;
}

export class CorrectionLoop {
  private readonly checkIntervalMs: number;
  private readonly maxRetries: number;

  // Online path state — mirrored from Synalux responses.
  private remoteState: RemoteState | null = null;
  private pendingSamples: Array<{ x: number; y: number; ts: number }> = [];
  private lastCheckTs = 0;
  private inFlight = false;

  // Offline fallback — BaselineTracker (L1 only).
  private readonly fallbackTracker: BaselineTracker;
  private fallbackRetries = 0;
  private fallbackLastApplyTs = 0;

  constructor(opts: CorrectionLoopOptions = {}) {
    this.checkIntervalMs = opts.checkIntervalMs ?? 2_000;
    this.maxRetries      = opts.maxRetries      ?? 3;
    this.fallbackTracker = new BaselineTracker({
      offsetThreshold: 0.03,
      minWarmupMs: 15_000,
      meanHalfLifeMs: 30_000,
    });
  }

  /** Feed a pose sample every frame. */
  push(sample: BaselineSample): void {
    this.pendingSamples.push({ x: sample.normX, y: sample.normY, ts: sample.timestamp });
    if (this.pendingSamples.length > 300) this.pendingSamples.shift();
    this.fallbackTracker.push(sample);
  }

  /**
   * Call at checkIntervalMs cadence. Fires Synalux API (or fallback) and
   * invokes applyOffset when a correction is needed.
   * Fire-and-forget — does not block the RAF loop.
   */
  requestTick(
    now: number,
    applyOffset: (dx: number, dy: number) => void,
    applyScale: (sX: number, sY: number) => void,
  ): void {
    if (now - this.lastCheckTs < this.checkIntervalMs) return;
    if (this.inFlight) return;
    this.lastCheckTs = now;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      this.inFlight = true;
      const samples = this.pendingSamples.splice(0);
      fetch(`${SYNALUX_API}/api/v1/prism-aac/tracking/correct`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: this.remoteState,
          samples,
          nowMs: now,
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(5_000) : undefined,
      })
        .then(r => r.ok ? r.json() as Promise<RemoteAction> : null)
        .then(action => {
          if (!action) return;
          this.remoteState = action.state;
          if (action.kind === 'apply_offset') {
            applyOffset(action.dx, action.dy);
            console.log(`[CorrectionLoop] L2 applied via Synalux dx=${action.dx.toFixed(4)} dy=${action.dy.toFixed(4)}`);
          } else if (action.kind === 'needs_recalibration') {
            this.fireRecalibrationNeeded(action.reason);
            this.remoteState = null;
          }
        })
        .catch(() => { /* network error — next tick will retry */ })
        .finally(() => { this.inFlight = false; });
    } else {
      // Offline fallback: single-level correction from BaselineTracker.
      if (now - this.fallbackLastApplyTs < this.checkIntervalMs) return;
      const correction = this.fallbackTracker.suggestCorrection(now);
      if (correction?.kind === 'offset') {
        this.fallbackLastApplyTs = now;
        applyOffset(correction.deltaNormX ?? 0, correction.deltaNormY ?? 0);
        this.fallbackTracker.acceptCorrection(now);
        this.fallbackRetries++;
        if (this.fallbackRetries >= this.maxRetries) {
          this.fireRecalibrationNeeded('offline-max-retries');
          this.fallbackRetries = 0;
        }
      } else if (correction?.kind === 'scale') {
        this.fallbackLastApplyTs = now;
        applyScale(correction.scaleX, correction.scaleY);
        this.fallbackTracker.acceptCorrection(now);
      }
    }
  }

  /** Call after a fresh wizard calibration — resets all state. */
  reset(): void {
    this.remoteState = null;
    this.pendingSamples = [];
    this.lastCheckTs = 0;
    this.inFlight = false;
    this.fallbackTracker.reset();
    this.fallbackRetries = 0;
    this.fallbackLastApplyTs = 0;
  }

  getNoiseFloor(): number { return this.fallbackTracker.getNoiseFloor(); }

  private fireRecalibrationNeeded(reason: string): void {
    console.warn(`[CorrectionLoop] NEEDS_RECALIBRATION — ${reason}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('prism-recalibration-needed', {
        detail: { reason },
      }));
    }
  }
}

/* ── Anchor recording ─────────────────────────────────────────────── */

/**
 * `recordAnchor` is a stateless helper: given a known dwell target and
 * the cursor's normalized position at click-time, return the implied
 * offset correction. Caller decides whether to apply it.
 *
 * Why: when the user lands a click on a target whose screen position is
 * known, the cursor's MediaPipe normX/normY at that instant maps EXACTLY
 * to that screen position by definition (the click happened *because*
 * the cursor was on it). If our calibration was perfect, that mapping
 * would already produce the target's screen coords — any deviation IS
 * the calibration error.
 */
export function recordAnchor(input: {
    cursorNormX: number;
    cursorNormY: number;
    targetNormX: number;
    targetNormY: number;
}): AnchorCorrection {
    return { kind: 'anchor', ...input };
}
