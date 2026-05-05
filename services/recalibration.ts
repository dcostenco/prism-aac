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
        this.varX = this.varX + alphaVar * (dxBefore * dxAfter - this.varX);
        this.varY = this.varY + alphaVar * (dyBefore * dyAfter - this.varY);
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
