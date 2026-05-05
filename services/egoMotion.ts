/**
 * egoMotion — separate camera motion ("ego-motion") from face motion.
 *
 * The "moving car" requirement: when the laptop bounces with the road,
 * ALL face landmarks shift by approximately the same (dx, dy). That's
 * camera shake, not user intent — we should NOT move the cursor.
 *
 * Algorithm:
 *   1. Compute frame-to-frame centroid delta = candidate ego-motion.
 *   2. Compute residual landmark motion AFTER subtracting that delta.
 *   3. If max residual < threshold (landmarks didn't move relative
 *      to each other), the centroid delta IS pure ego-motion → return
 *      isEgoMotion=true so caller suppresses the cursor update.
 *   4. Otherwise, return the corrected (residual-only) motion the
 *      caller applies to the cursor.
 *
 * Edge case (rigid head shake = head moved but landmarks all shift
 * uniformly relative to the camera): solved by combining with the
 * head-pose matrix from MediaPipe. If rotation is non-trivial,
 * head moved → don't suppress. If rotation is zero AND centroid
 * shifted, it's ego-motion → suppress.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § E.
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
 * Decide if a frame-to-frame landmark transition is ego-motion.
 *
 * `prev`, `curr`: same-length arrays of corresponding 2D landmarks
 *   (typically MediaPipe FaceLandmarker normalized [0..1] coords).
 * `headRotationRad`: optional. If the head pose matrix indicates
 *   rotation > rotationThreshold, we treat any centroid shift as
 *   user motion (suppression off). Defaults to 0.
 * `residualThreshold`: per-landmark residual cap below which we
 *   treat the motion as pure camera shake. Default 0.005 normalized
 *   units (≈3.2 px on a 640px frame). Tunable.
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

    // Compute per-landmark residual after subtracting the centroid delta.
    let maxResidual = 0;
    for (let i = 0; i < n; i++) {
        const dx = (curr[i].x - prev[i].x) - egoDelta.x;
        const dy = (curr[i].y - prev[i].y) - egoDelta.y;
        const r = Math.hypot(dx, dy);
        if (r > maxResidual) maxResidual = r;
    }

    // If head clearly rotated, never claim ego-motion (avoid suppressing
    // an intentional head shake/nod). The MediaPipe transformation matrix
    // already gives us pitch/yaw/roll in radians.
    if (Math.abs(headRotationRad) > rotationThreshold) {
        return { isEgoMotion: false, egoDelta, maxResidual };
    }

    return {
        isEgoMotion: maxResidual < residualThreshold && (Math.abs(egoDelta.x) + Math.abs(egoDelta.y)) > 0.001,
        egoDelta,
        maxResidual,
    };
}
