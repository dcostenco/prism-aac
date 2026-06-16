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
 *   4. DIRECTIONAL RATIO FILTER (NEW) — children with CP/tremor accumulate
 *      large cumulative travel but the cursor stays near-center (random walk).
 *      Real calibration drift is monotonic — net displacement is high relative
 *      to total travel. The ratio filter separates these two cases and prevents
 *      tremor from false-triggering the drift alarm.
 *
 *   5. ADAPTIVE THRESHOLD (NEW) — fixed 800px assumed zero tremor. The
 *      computeAdaptiveTravelThreshold() helper derives a per-child threshold
 *      from their measured tremorAmplPx and the screen diagonal so the
 *      detector self-calibrates to each user's motor profile.
 *
 *   6. CONFIDENCE SLOPE PRE-WARNING (NEW) — fires 'confidence-degrading'
 *      via checkWarning() when confidence is dropping rapidly (slope < -0.05/s)
 *      before it reaches the collapse floor. Lets the UI warn the caregiver
 *      about lighting/positioning before tracking fully stops.
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
    /**
     * Directional ratio floor: net displacement / cumulative travel.
     * When the ratio is BELOW this value the motion is a random walk
     * (tremor/CP spasm) — NOT calibration drift. Values below this floor
     * suppress the cursor-drift trigger.
     *
     * Range 0..1. Default 0 (disabled — backward compat).
     * Recommended for motor-impaired users: 0.15.
     *
     * Why 0.15: random walks achieve ratio ~0 over many steps; real drift
     * (cursor sliding toward one corner) achieves ratio ~0.5–0.9. 0.15 is
     * a conservative threshold that lets all random-walk profiles through
     * while still catching monotonic calibration breaks.
     */
    minDirectionalRatio?: number;
    /**
     * Confidence slope threshold (per-ms) below which checkWarning() emits
     * 'confidence-degrading'. Default -0.00005 (= -5%/s = dropping 5 points
     * per second). Set to 0 to disable.
     */
    confidenceSlopeWarnThreshold?: number;
}

export type DriftReason =
    | 'cursor-drift'         // travel exceeded threshold without dwell-click
    | 'confidence-collapse'; // average confidence below floor

/** Non-critical stability warning — does NOT trigger auto-disable by itself.
 *  Consumers may show a HUD hint (e.g. "Move to better lighting"). */
export type DriftWarning =
    | 'confidence-degrading'; // confidence trending downward before collapse

export class DriftDetector {
    private samples: DriftSample[] = [];
    private readonly windowMs: number;
    private readonly travelThresholdPx: number;
    private readonly confidenceFloor: number;
    private readonly minSamples: number;
    private readonly minDirectionalRatio: number;
    private readonly confidenceSlopeWarnThreshold: number;
    private lastDwellTs = 0;

    constructor(opts: DriftDetectorOptions = {}) {
        this.windowMs = opts.windowMs ?? 5000;
        this.travelThresholdPx = opts.travelThresholdPx ?? 800;
        this.confidenceFloor = opts.confidenceFloor ?? 0.4;
        this.minSamples = opts.minSamples ?? 10;
        this.minDirectionalRatio = opts.minDirectionalRatio ?? 0;
        this.confidenceSlopeWarnThreshold = opts.confidenceSlopeWarnThreshold ?? -0.00005;
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

        // Cumulative cursor travel + directional ratio filter
        const first = this.samples[0];
        let travel = 0;
        for (let i = 1; i < this.samples.length; i++) {
            const dx = this.samples[i].x - this.samples[i - 1].x;
            const dy = this.samples[i].y - this.samples[i - 1].y;
            travel += Math.hypot(dx, dy);
        }
        if (travel > this.travelThresholdPx) {
            // Directional ratio: net displacement / cumulative travel.
            // A random walk (tremor, CP spasm) keeps the cursor near its
            // starting point → ratio ~0. Real calibration drift is monotonic
            // → ratio approaches 1. Filter out tremor when minDirectionalRatio
            // is non-zero.
            if (this.minDirectionalRatio > 0) {
                const netDx = newest.x - first.x;
                const netDy = newest.y - first.y;
                const netDisplacement = Math.hypot(netDx, netDy);
                const ratio = travel > 0 ? netDisplacement / travel : 0;
                if (ratio < this.minDirectionalRatio) return null;
            }
            return 'cursor-drift';
        }

        return null;
    }

    /**
     * Non-critical pre-warning check. Call every frame alongside check().
     * Returns a DriftWarning when confidence is trending downward fast enough
     * to predict imminent collapse, but before the floor is actually hit.
     *
     * Does NOT auto-disable tracking on its own — consumers use this to show
     * a HUD hint ("Move to better lighting") before the hard stop fires.
     */
    checkWarning(): DriftWarning | null {
        if (this.samples.length < this.minSamples) return null;
        if (this.confidenceSlopeWarnThreshold >= 0) return null; // disabled

        const oldest = this.samples[0];
        const newest = this.samples[this.samples.length - 1];
        const dtMs = newest.timestamp - oldest.timestamp;
        if (dtMs < 1000) return null; // need at least 1s of history for a meaningful slope

        const slope = (newest.confidence - oldest.confidence) / dtMs;
        if (slope < this.confidenceSlopeWarnThreshold) return 'confidence-degrading';

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
        this.windowSize = this.recoverFrames;
        this.minGoodFrames = Math.ceil(this.recoverFrames * 0.8);
    }

    // T-3 FIX: sliding window instead of consecutive streak.
    // The old approach reset to 0 on ANY frame below threshold, so
    // flickering light (0.65/0.75 oscillation) kept users stuck in
    // disabled state indefinitely even though tracking was stable.
    // Now: require 8 of last 10 frames above threshold.
    private window: boolean[] = [];
    private readonly windowSize: number;
    private readonly minGoodFrames: number;

    /** Feed one probe frame. Returns true once the recovery threshold is hit. */
    push(confidence: number): boolean {
        this.window.push(confidence >= this.stableConfidenceFloor);
        if (this.window.length > this.windowSize) this.window.shift();
        const good = this.window.filter(Boolean).length;
        this.streak = good;
        return this.window.length >= this.windowSize && good >= this.minGoodFrames;
    }

    /** Manual reset — call when starting a fresh probe session. */
    reset(): void { this.streak = 0; this.window = []; }

    /** Current good-frame count in window (for telemetry / progress UI). */
    get currentStreak(): number { return this.streak; }
}

// ── Pure recovery decision function ───────────────────────────────────
// Extracted so the REAL tick loop and the tests call the SAME code.
// A test that imports this function and asserts on it is actually testing
// the shipped decision logic, not a hand-copied paste of it.

export interface RecoveryInput {
    driftPaused: boolean;
    avgConfidence: number;
    elapsedMs: number;
    timeoutMs: number;
}

export type RecoveryDecision = 'recover' | 'timeout' | 'continue';

export function recoveryStep(
    input: RecoveryInput,
    probe: ReliabilityProbe,
): RecoveryDecision {
    if (!input.driftPaused) return 'continue';
    if (input.avgConfidence <= 0) return 'continue';
    if (probe.push(input.avgConfidence)) return 'recover';
    if (input.elapsedMs > input.timeoutMs) return 'timeout';
    return 'continue';
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

/* ── EdgePin detector — gap J ───────────────────────────────────────────
 *
 * When calibration fails, the cursor pins to a screen edge. Without
 * detection, dwell still fires on whatever button is closest to the pin
 * point — accidental clicks. This counter rolls a window of "is cursor
 * within `edgeBandPx` of any edge?" samples. After `pinTriggerMs` of
 * sustained pin, fire `onPin()`. After `pinEscalateCount` consecutive
 * pin episodes within `escalateWindowMs`, escalate to drift.
 */

export interface EdgePinOptions {
    /** Pixels from any edge that count as "pinned". Default 24. */
    edgeBandPx?: number;
    /** Time pinned before firing first warn. Default 2000ms. */
    pinTriggerMs?: number;
    /** Pin episodes within escalateWindowMs that escalate. Default 3. */
    pinEscalateCount?: number;
    /** Window for pin-episode counting. Default 30000ms. */
    escalateWindowMs?: number;
    /** Screen width for edge calc (caller-supplied so we work in tests). */
    screenWidth: number;
    /** Screen height for edge calc. */
    screenHeight: number;
}

export class EdgePinDetector {
    private readonly bandPx: number;
    private readonly pinTriggerMs: number;
    private readonly pinEscalateCount: number;
    private readonly escalateWindowMs: number;
    private screenWidth: number;
    private screenHeight: number;
    private pinStart = 0;        // when current pin episode began (0 = not pinned)
    private pinFired = false;    // already warned on this episode?
    private sustainedFired = false; // already escalated on a single long episode?
    private episodes: number[] = []; // timestamps of past escalation triggers

    constructor(opts: EdgePinOptions) {
        this.bandPx = opts.edgeBandPx ?? 24;
        this.pinTriggerMs = opts.pinTriggerMs ?? 2000;
        this.pinEscalateCount = opts.pinEscalateCount ?? 3;
        this.escalateWindowMs = opts.escalateWindowMs ?? 30000;
        this.screenWidth = opts.screenWidth;
        this.screenHeight = opts.screenHeight;
    }

    /** Update screen dims when window resizes. */
    setScreen(w: number, h: number): void {
        this.screenWidth = w;
        this.screenHeight = h;
    }

    /** Returns 'pin' if currently pinned this frame fires the warn,
     *  'escalate' if pin-episode count exceeds the threshold,
     *  null if the cursor is operating normally. */
    push(x: number, y: number, timestamp: number): 'pin' | 'escalate' | null {
        const isPinned =
            x < this.bandPx ||
            x > this.screenWidth - this.bandPx ||
            y < this.bandPx ||
            y > this.screenHeight - this.bandPx;

        if (!isPinned) {
            // Cursor moved off the edge — close out any open episode
            this.pinStart = 0;
            this.pinFired = false;
            this.sustainedFired = false;
            return null;
        }

        if (this.pinStart === 0) {
            // Just entered an edge band
            this.pinStart = timestamp;
            return null;
        }

        const pinDuration = timestamp - this.pinStart;
        if (!this.pinFired && pinDuration >= this.pinTriggerMs) {
            this.pinFired = true;
            // Record this episode + evict old ones outside the window
            this.episodes.push(timestamp);
            const cutoff = timestamp - this.escalateWindowMs;
            while (this.episodes.length && this.episodes[0] < cutoff) {
                this.episodes.shift();
            }
            return this.episodes.length >= this.pinEscalateCount ? 'escalate' : 'pin';
        }

        // Sustained-pin escalation (NEW): if the cursor is stuck on an edge
        // for the full episode-budget worth of time without ever leaving,
        // that's just as bad as N separate episodes — escalate even though
        // no off-edge frame ever closed an episode out. Without this, a
        // calibration-broken cursor pinned to a corner for 10 minutes would
        // never trigger drift because pinFired stays true.
        if (this.pinFired && !this.sustainedFired) {
            const sustainedThresholdMs = this.pinTriggerMs * this.pinEscalateCount;
            if (pinDuration >= sustainedThresholdMs) {
                this.sustainedFired = true;
                return 'escalate';
            }
        }
        return null;
    }

    reset(): void {
        this.pinStart = 0;
        this.pinFired = false;
        this.sustainedFired = false;
        this.episodes.length = 0;
    }
}

/**
 * Compute a per-child drift travel threshold from their motor profile.
 *
 * Background: the hardcoded 800 px default assumed near-zero tremor.
 * A child with 5 px RMS tremor amplitude at 15 fps accumulates
 * ~530 px of legitimate random-walk travel over a 5 s window, leaving
 * only 270 px of headroom before a false positive. This helper derives
 * a threshold that is always above the expected tremor noise floor by a
 * 1.5× safety margin, and also never less than 30% of the screen diagonal
 * so it remains meaningful on any device.
 *
 * @param tremorAmplPx  RMS tremor amplitude in pixels (from HandProfile).
 *                      0 = no measured tremor — falls back to screen-diagonal rule.
 * @param windowMs      Detection window in ms (must match DriftDetectorOptions.windowMs).
 * @param screenDiagonal  sqrt(width² + height²) in pixels.
 * @param fps           Expected tracking frame rate. Default 15.
 * @returns Threshold in pixels, clamped to [200, 4000].
 */
export function computeAdaptiveTravelThreshold(
    tremorAmplPx: number,
    windowMs: number,
    screenDiagonal: number,
    fps = 15,
): number {
    const frames = (windowMs / 1000) * fps;
    // Expected cumulative travel from a random walk with step size ≈ tremorAmplPx * √2
    // (each frame moves tremorAmplPx in a random 2-D direction).
    const tremorBaseline = frames * tremorAmplPx * Math.SQRT2;
    const tremorThreshold = tremorBaseline * 1.5; // 50% margin above noise

    // Minimum: 30% of screen diagonal keeps sensitivity proportional to display size.
    const screenThreshold = screenDiagonal * 0.3;

    return Math.max(200, Math.min(4000, Math.max(tremorThreshold, screenThreshold)));
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
