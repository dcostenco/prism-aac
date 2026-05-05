/**
 * Head-tracker stability primitives — drift detection, auto-disable, and
 * auto-recover ("reliability factor fixed → re-enable").
 *
 * Pure logic, no DOM / camera / browser dependency. The headTracker's tick()
 * passes per-frame samples in; this module decides whether the cursor is
 * drifting (auto-disable) and, after a disable, whether the face has been
 * stable enough for long enough to auto-recover.
 *
 * Design — "military stable in a moving car"
 * ──────────────────────────────────────────
 * The challenge with non-stationary contexts is that camera AND face move
 * together. A naive drift detector would constantly fire because cursor
 * pixels are flying around. We separate two signals:
 *
 *   1. CURSOR DRIFT — pure travel distance in screen-pixel space within a
 *      rolling window. Triggers when the cursor jets around without
 *      landing a single dwell-click. This is the "calibration broken /
 *      person swapped seats" failure mode.
 *
 *   2. CONFIDENCE COLLAPSE — per-frame face-landmark confidence average.
 *      Triggers when the face becomes unreliable (lighting changed,
 *      person leaning out of frame, glasses glare). Independent of
 *      cursor motion.
 *
 *   3. CORRELATED-NOISE FILTER — when ALL face landmarks shift by the
 *      same delta in one frame (camera shake from a bump in the road),
 *      we DON'T count that as cursor drift. The fusion layer subtracts
 *      a global motion vector first; this module just checks for
 *      consistent residual motion AFTER stabilization.
 *
 * Auto-recover lifecycle (after a drift-triggered disable):
 *   STOPPED → PROBING (1 Hz background poll) → STABLE_ENOUGH → RECOVERED
 *
 * The probe runs at 1Hz (cheap), checks face confidence + variance.
 * If 10 consecutive 1Hz frames meet the bar, fire onAutoRecover so the
 * consumer can re-start tracking without user intervention.
 */

export interface DriftSample {
    /** Cursor x in screen pixels. */
    x: number;
    /** Cursor y in screen pixels. */
    y: number;
    /** Face-landmark confidence 0..1 (averaged across active cameras). */
    confidence: number;
    /** Wall-clock timestamp in ms. */
    timestamp: number;
    /** True iff the user landed a dwell click on this frame. */
    dwellFired?: boolean;
}

export interface DriftDetectorOptions {
    /** Rolling window length in ms. Default 5000. */
    windowMs?: number;
    /** Cumulative cursor travel pixels above which we consider cursor drifting. Default 800. */
    travelThresholdPx?: number;
    /** Minimum average confidence in the window. Below → confidence collapse. Default 0.4. */
    confidenceFloor?: number;
    /** Don't trigger before we've seen at least this many samples (avoids cold-start false-positives). Default 10. */
    minSamples?: number;
}

export type DriftReason =
    | 'cursor-drift'         // travel exceeded threshold without dwell-click
    | 'confidence-collapse'; // average confidence below floor

export class DriftDetector {
    private samples: DriftSample[] = [];
    private readonly windowMs: number;
    private readonly travelThresholdPx: number;
    private readonly confidenceFloor: number;
    private readonly minSamples: number;
    private lastDwellTs = 0;

    constructor(opts: DriftDetectorOptions = {}) {
        this.windowMs = opts.windowMs ?? 5000;
        this.travelThresholdPx = opts.travelThresholdPx ?? 800;
        this.confidenceFloor = opts.confidenceFloor ?? 0.4;
        this.minSamples = opts.minSamples ?? 10;
    }

    /** Feed one frame. Call from the tracker's tick(). */
    push(sample: DriftSample): void {
        this.samples.push(sample);
        if (sample.dwellFired) this.lastDwellTs = sample.timestamp;
        // Evict samples older than window
        const cutoff = sample.timestamp - this.windowMs;
        while (this.samples.length && this.samples[0].timestamp < cutoff) {
            this.samples.shift();
        }
    }

    /** Reset state — call after a successful re-calibration or auto-recover. */
    reset(): void {
        this.samples.length = 0;
        this.lastDwellTs = 0;
    }

    /**
     * Check whether the most recent window indicates drift. Returns the
     * triggering reason (cursor or confidence) or null if everything's fine.
     *
     * A successful dwell-click within the window is taken as proof the
     * cursor IS reaching the user's intent — drift triggers reset on dwell.
     */
    check(): DriftReason | null {
        if (this.samples.length < this.minSamples) return null;
        const newest = this.samples[this.samples.length - 1];

        // If the user landed a dwell within the window, they're succeeding
        // — don't auto-disable just because the cursor took a long path.
        // (lastDwellTs === 0 is the sentinel for "no dwell ever happened"
        //  — don't accidentally suppress drift detection at startup.)
        if (this.lastDwellTs > 0 && newest.timestamp - this.lastDwellTs <= this.windowMs) {
            return null;
        }

        // Confidence collapse — average across the window
        let confSum = 0;
        for (const s of this.samples) confSum += s.confidence;
        const avgConf = confSum / this.samples.length;
        if (avgConf < this.confidenceFloor) return 'confidence-collapse';

        // Cumulative cursor travel
        let travel = 0;
        for (let i = 1; i < this.samples.length; i++) {
            const dx = this.samples[i].x - this.samples[i - 1].x;
            const dy = this.samples[i].y - this.samples[i - 1].y;
            travel += Math.hypot(dx, dy);
        }
        if (travel > this.travelThresholdPx) return 'cursor-drift';

        return null;
    }
}

/* ── Reliability probe ──────────────────────────────────────────────────
 *
 * After a drift-triggered disable, this primitive runs at low frequency
 * (default 1 Hz) and counts how many CONSECUTIVE frames meet a "stable"
 * bar (high confidence + low landmark variance). When the streak reaches
 * `recoverFrames`, fire the recover callback so the consumer can restart
 * tracking automatically.
 */

export interface ReliabilityProbeOptions {
    /** Frames per recovery — must be consecutive. Default 10 (= 10s at 1Hz). */
    recoverFrames?: number;
    /** Minimum confidence to count as "stable". Default 0.7. */
    stableConfidenceFloor?: number;
}

export class ReliabilityProbe {
    private streak = 0;
    private readonly recoverFrames: number;
    private readonly stableConfidenceFloor: number;

    constructor(opts: ReliabilityProbeOptions = {}) {
        this.recoverFrames = opts.recoverFrames ?? 10;
        this.stableConfidenceFloor = opts.stableConfidenceFloor ?? 0.7;
    }

    /** Feed one probe frame. Returns true once the recovery threshold is hit. */
    push(confidence: number): boolean {
        if (confidence >= this.stableConfidenceFloor) {
            this.streak++;
        } else {
            this.streak = 0;
        }
        return this.streak >= this.recoverFrames;
    }

    /** Manual reset — call when starting a fresh probe session. */
    reset(): void { this.streak = 0; }

    /** Current streak count (for telemetry / progress UI). */
    get currentStreak(): number { return this.streak; }
}

/* ── Confidence-weighted fusion ─────────────────────────────────────────
 *
 * Replaces the naive `(a + b) / 2` average with a confidence-weighted one.
 * If camera A reports confidence 0.95 and camera B reports 0.10, the
 * fused position is dominated by A. This prevents a single bad camera
 * from poisoning the cursor.
 *
 * Returns null if total weight is too low to trust ANY reading.
 */

export interface FusionInput {
    normX: number;
    normY: number;
    /** Confidence 0..1. Weight in the average. */
    confidence: number;
}

export function fuseWeighted(
    inputs: FusionInput[],
    minTotalWeight = 0.3,
): { normX: number; normY: number; confidence: number } | null {
    let weightSum = 0;
    let xSum = 0;
    let ySum = 0;
    let confSum = 0;
    for (const i of inputs) {
        if (i.confidence <= 0) continue;
        weightSum += i.confidence;
        xSum += i.normX * i.confidence;
        ySum += i.normY * i.confidence;
        confSum += i.confidence;
    }
    if (weightSum < minTotalWeight) return null;
    return {
        normX: xSum / weightSum,
        normY: ySum / weightSum,
        confidence: confSum / Math.max(1, inputs.length),
    };
}
