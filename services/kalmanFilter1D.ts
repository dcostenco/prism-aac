/**
 * Kalman1D — confidence-aware single-axis Kalman filter.
 *
 * Replaces the velocity-adaptive EMA in headTracker.ts. EMA has a single
 * trust knob; Kalman trusts each measurement *individually* by its
 * confidence — high confidence → measurement dominates (snappy), low
 * confidence → prediction dominates (cursor stays put rather than
 * following noise).
 *
 * Critical for cheap webcams + bad lighting: when MediaPipe confidence
 * dips, Kalman freezes the cursor instead of jumping with the jitter.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § D.
 */

export class Kalman1D {
    /** Estimated position. */
    private x = 0;
    /** Estimated variance. */
    private p = 1;
    /** Process noise (model variance — small for human motion). */
    private readonly q: number;

    constructor(q = 4 /* px²/frame for typical user-intent velocity */) {
        // Negative or non-finite q would cause variance to shrink each
        // predict() and gain to explode. Floor at a tiny positive value
        // so the filter is always well-defined.
        this.q = Number.isFinite(q) && q > 0 ? q : 4;
    }

    /** Run a predict step (no measurement). Returns the predicted x. */
    predict(): number {
        this.p += this.q;
        return this.x;
    }

    /**
     * Run a measurement update. Returns the posterior x.
     *
     * `measurement` — observed position (px)
     * `confidence` — 0..1, fraction of trust in this measurement.
     *   confidence == 1 → measurement noise R = 0.001 (snap to it).
     *   confidence == 0 → R = ~1000 (ignore it, hold prediction).
     *
     * The mapping `R = 1/confidence - 1` keeps gain ∈ (0, ~1) and is
     * monotonic. We floor confidence at 0.001 to avoid div-by-zero.
     */
    update(measurement: number, confidence: number): number {
        // Adversarial input handling: NaN/Infinity in measurement or
        // confidence used to permanently poison `x`. We treat them as
        // "no measurement" and just predict forward instead of crashing.
        // Math.max/min propagate NaN, so we must guard explicitly.
        if (!Number.isFinite(measurement) || !Number.isFinite(confidence)) {
            return this.predict();
        }
        // Predict step (handle uneven frame rates: caller can call predict()
        // alone for skipped frames; otherwise update() implies predict()
        // because we add q here).
        this.p += this.q;
        const c = Math.max(0.001, Math.min(1, confidence));
        const r = (1 / c) - 1;          // measurement noise variance
        const k = this.p / (this.p + r); // Kalman gain ∈ (0,1)
        this.x = this.x + k * (measurement - this.x);
        this.p = (1 - k) * this.p;
        return this.x;
    }

    /**
     * Saccade override — bypass the smoother for fast intentional moves.
     * If the measurement is far from current estimate AND confidence is
     * high, snap directly to it instead of slowly converging. Used by
     * the head tracker to keep big intentional gaze shifts feeling
     * snappy while still suppressing high-frequency noise.
     */
    snapTo(measurement: number): void {
        // Reject non-finite snaps — a NaN saccade target would freeze
        // the cursor permanently. Better to leave the filter as-is.
        if (!Number.isFinite(measurement)) return;
        this.x = measurement;
        this.p = 1;
    }

    /** Hard reset — call after recalibration / scene change. */
    reset(initial = 0): void {
        this.x = Number.isFinite(initial) ? initial : 0;
        this.p = 1;
    }

    /** Current estimate (no side effects). */
    get value(): number { return this.x; }
}
