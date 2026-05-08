/**
 * egoMotion — separate camera motion ("ego-motion") from face / body motion.
 *
 * The "moving car" requirement: when the laptop bounces with the road,
 * ALL face landmarks shift by approximately the same (dx, dy). That's
 * camera shake, not user intent — we should NOT move the cursor.
 *
 * Two algorithms ship here:
 *
 *   1. classifyMotion (legacy, 2025) — binary gate on centroid +
 *      per-landmark residual. Catches pure translation but fails on
 *      vehicle ROLL (top landmarks move opposite bottom landmarks
 *      under uniform rotation; centroid stays put; residuals look
 *      like deliberate motion).
 *
 *   2. fitSimilarityTransform / fitSimilarityRansac (May 2026) —
 *      4-DOF (tx, ty, scale, rotation) similarity transform fit
 *      via Umeyama 1991 (closed-form 2D). RANSAC variant picks
 *      inliers so a moving wrist doesn't poison the rigid-body
 *      estimate. The recovered transform is SUBTRACTED CONTINUOUSLY
 *      from the cursor source landmark — graceful degradation
 *      under sustained shake instead of a binary "stuck cursor"
 *      failure mode.
 *
 *      Catches in-plane rotation that classifyMotion misses
 *      (vehicle roll / tilted laptop on lap). The choice is in
 *      docs/TRACKING_RELIABILITY.md item E and aligned with the
 *      May 2026 SOTA research review (see CHANGELOG).
 *
 *  Refs:
 *    Umeyama 1991, "Least-squares estimation of transformation
 *    parameters between two point patterns", IEEE TPAMI 13(4).
 *    Fischler & Bolles 1981, RANSAC, Comm. ACM 24(6).
 *    OpenCV's estimateAffinePartial2D uses the same algorithm.
 *
 *  Plan ref: docs/TRACKING_RELIABILITY.md § E.
 */

export interface Point2D {
    x: number;
    y: number;
}

export interface EgoMotionResult {
    /** True if this frame's centroid shift is pure camera shake. */
    isEgoMotion: boolean;
    /** The estimated ego-motion vector (camera moved by this delta). */
    egoDelta: Point2D;
    /** Maximum per-landmark residual after subtracting ego-motion. */
    maxResidual: number;
}

/** 4-DOF similarity transform: curr = s * R(θ) * prev + t. */
export interface SimilarityTransform {
    tx: number;
    ty: number;
    /** Scale factor (>0). Identity when no scale change. */
    scale: number;
    /** Rotation in radians. Identity when no rotation. */
    theta: number;
}

export const IDENTITY_TRANSFORM: Readonly<SimilarityTransform> = {
    tx: 0, ty: 0, scale: 1, theta: 0,
};

/**
 * Compute centroid of an array of 2D points. Returns (0,0) for empty.
 */
export function centroid(points: ReadonlyArray<Point2D>): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
}

/**
 * Apply a similarity transform to a point: out = s * R(θ) * p + t.
 * Used to predict where each landmark would be if the camera moved
 * by `transform` and the user did not.
 */
export function applyTransform(p: Point2D, t: Readonly<SimilarityTransform>): Point2D {
    const c = Math.cos(t.theta);
    const s = Math.sin(t.theta);
    return {
        x: t.scale * (c * p.x - s * p.y) + t.tx,
        y: t.scale * (s * p.x + c * p.y) + t.ty,
    };
}

/**
 * Closed-form 2D similarity-transform fit (Umeyama 1991, simplified
 * for 2D where the cross-covariance matrix is 2×2). Solves
 *   curr_i ≈ s * R(θ) * prev_i + t  (least squares)
 * over all correspondence pairs.
 *
 * Returns IDENTITY_TRANSFORM if there are < 2 valid points or if
 * the prev set is degenerate (all points coincident → scale
 * undefined).
 */
export function fitSimilarityTransform(
    prev: ReadonlyArray<Point2D>,
    curr: ReadonlyArray<Point2D>,
): SimilarityTransform {
    const n = Math.min(prev.length, curr.length);
    if (n < 2) return { ...IDENTITY_TRANSFORM };

    // Centroids
    let pmx = 0, pmy = 0, cmx = 0, cmy = 0;
    for (let i = 0; i < n; i++) {
        pmx += prev[i].x; pmy += prev[i].y;
        cmx += curr[i].x; cmy += curr[i].y;
    }
    pmx /= n; pmy /= n; cmx /= n; cmy /= n;

    // Cross-products + variance of centered prev
    let numA = 0; // Σ (px·cx + py·cy)
    let numB = 0; // Σ (px·cy - py·cx)
    let denom = 0; // Σ (px² + py²)
    for (let i = 0; i < n; i++) {
        const px = prev[i].x - pmx;
        const py = prev[i].y - pmy;
        const cx = curr[i].x - cmx;
        const cy = curr[i].y - cmy;
        numA += px * cx + py * cy;
        numB += px * cy - py * cx;
        denom += px * px + py * py;
    }
    if (denom < 1e-12) return { ...IDENTITY_TRANSFORM };

    const sCos = numA / denom;
    const sSin = numB / denom;
    const scale = Math.sqrt(sCos * sCos + sSin * sSin);
    const theta = Math.atan2(sSin, sCos);

    // t = curr_centroid - scale * R(θ) * prev_centroid
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const tx = cmx - scale * (c * pmx - s * pmy);
    const ty = cmy - scale * (s * pmx + c * pmy);

    return {
        tx: Number.isFinite(tx) ? tx : 0,
        ty: Number.isFinite(ty) ? ty : 0,
        scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
        theta: Number.isFinite(theta) ? theta : 0,
    };
}

/**
 * RANSAC wrapper around fitSimilarityTransform. Robust to outliers
 * (e.g., a moving wrist among otherwise rigid body landmarks).
 *
 * Strategy:
 *   1. For `iterations` rounds, sample 2 random correspondence pairs
 *      and fit a candidate transform.
 *   2. Score the candidate: count points whose residual after the
 *      transform is below `inlierThreshold` normalized units.
 *   3. Keep the candidate with the most inliers.
 *   4. Re-fit on all inliers for the final transform (consensus).
 *
 * Returns IDENTITY_TRANSFORM if no candidate had ≥ 4 inliers (the
 * data didn't support a rigid model — likely all-deliberate motion).
 */
export function fitSimilarityRansac(
    prev: ReadonlyArray<Point2D>,
    curr: ReadonlyArray<Point2D>,
    opts: {
        iterations?: number;
        inlierThreshold?: number;
        minInliers?: number;
    } = {},
): { transform: SimilarityTransform; inlierCount: number; inlierMask: boolean[] } {
    const n = Math.min(prev.length, curr.length);
    const ITER = opts.iterations ?? 12;
    const THRESHOLD = opts.inlierThreshold ?? 0.01;
    const MIN_INLIERS = opts.minInliers ?? Math.max(4, Math.ceil(n * 0.4));
    const fallback = { transform: { ...IDENTITY_TRANSFORM }, inlierCount: 0, inlierMask: new Array(n).fill(false) };
    if (n < 3) return fallback;

    let bestCount = 0;
    let bestMask: boolean[] = new Array(n).fill(false);

    for (let iter = 0; iter < ITER; iter++) {
        // Sample 2 distinct indices.
        const i = Math.floor(Math.random() * n);
        let j = Math.floor(Math.random() * n);
        if (j === i) j = (j + 1) % n;
        const pPair = [prev[i], prev[j]];
        const cPair = [curr[i], curr[j]];
        const candidate = fitSimilarityTransform(pPair, cPair);

        // Score: count inliers across all points.
        const mask: boolean[] = new Array(n);
        let count = 0;
        for (let k = 0; k < n; k++) {
            const predicted = applyTransform(prev[k], candidate);
            const dx = predicted.x - curr[k].x;
            const dy = predicted.y - curr[k].y;
            const dist = Math.hypot(dx, dy);
            const ok = dist <= THRESHOLD;
            mask[k] = ok;
            if (ok) count++;
        }
        if (count > bestCount) {
            bestCount = count;
            bestMask = mask;
        }
    }

    if (bestCount < MIN_INLIERS) return fallback;

    // Refit on all inliers for the final transform (consensus step).
    const inP: Point2D[] = [];
    const inC: Point2D[] = [];
    for (let k = 0; k < n; k++) {
        if (bestMask[k]) { inP.push(prev[k]); inC.push(curr[k]); }
    }
    const refined = fitSimilarityTransform(inP, inC);
    return { transform: refined, inlierCount: bestCount, inlierMask: bestMask };
}

/**
 * Decide if a frame-to-frame landmark transition is ego-motion.
 *
 * Legacy (kept for backward compatibility). New code should use
 * fitSimilarityRansac and apply the inverse transform to the
 * cursor source landmark continuously — that handles in-plane
 * rotation which this binary gate misses (vehicle roll, tilted
 * laptop) and degrades gracefully under sustained shake.
 *
 * `prev`, `curr`: same-length arrays of corresponding 2D landmarks
 *   (typically MediaPipe normalized [0..1] coords).
 * `headRotationRad`: optional. If the head pose matrix indicates
 *   rotation > rotationThreshold, we treat any centroid shift as
 *   user motion (suppression off). Defaults to 0.
 * `residualThreshold`: per-landmark residual cap below which we
 *   treat the motion as pure camera shake. Default 0.005 normalized
 *   units (≈3.2 px on a 640px frame).
 * `rotationThreshold`: rad/frame above which we never suppress.
 *   Default 0.05 (~2.9°). Real intentional head rotations exceed this.
 */
export function classifyMotion(
    prev: ReadonlyArray<Point2D>,
    curr: ReadonlyArray<Point2D>,
    headRotationRad = 0,
    residualThreshold = 0.005,
    rotationThreshold = 0.05,
): EgoMotionResult {
    const n = Math.min(prev.length, curr.length);
    if (n === 0) {
        return { isEgoMotion: false, egoDelta: { x: 0, y: 0 }, maxResidual: 0 };
    }
    const cPrev = centroid(prev.slice(0, n));
    const cCurr = centroid(curr.slice(0, n));
    const egoDelta: Point2D = { x: cCurr.x - cPrev.x, y: cCurr.y - cPrev.y };

    let maxResidual = 0;
    for (let i = 0; i < n; i++) {
        const dx = (curr[i].x - prev[i].x) - egoDelta.x;
        const dy = (curr[i].y - prev[i].y) - egoDelta.y;
        const r = Math.hypot(dx, dy);
        if (r > maxResidual) maxResidual = r;
    }

    if (Math.abs(headRotationRad) > rotationThreshold) {
        return { isEgoMotion: false, egoDelta, maxResidual };
    }

    return {
        isEgoMotion: maxResidual < residualThreshold && (Math.abs(egoDelta.x) + Math.abs(egoDelta.y)) > 0.001,
        egoDelta,
        maxResidual,
    };
}
