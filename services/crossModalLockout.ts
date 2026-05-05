/**
 * crossModalLockout — pacify gesture/dwell click contention.
 *
 * Problem: when a user enables both gestures (e.g. "intentional blink
 * → speak last word") AND head tracking dwell, an intentional blink
 * over a button can fire BOTH the gesture click AND the dwell click,
 * yielding double-action.
 *
 * Solution: gestureService dispatches a `gesture-claim` window event
 * the moment it commits to a gesture. The headTracker subscribes and
 * suppresses dwell-click for `lockoutMs` afterward. Dwell counter also
 * resets so the user must re-acquire the target.
 *
 * The reverse direction is intentionally NOT done — dwell does NOT
 * suspend gestures. Gestures should always be available as an
 * interrupt (e.g. "I want to stop right now" via blink).
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § H.
 */

const EVENT = 'prism-gesture-claim';

export interface GestureClaimDetail {
    gesture: string;
    confidence: number;
    timestamp: number;
}

/** Fire from gestureService when a gesture is being committed. */
export function dispatchGestureClaim(detail: GestureClaimDetail): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<GestureClaimDetail>(EVENT, { detail }));
}

/** Subscribe (e.g. from headTracker) to lockout claims. Returns disposer. */
export function onGestureClaim(handler: (d: GestureClaimDetail) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const wrapped = (e: Event) => handler((e as CustomEvent<GestureClaimDetail>).detail);
    window.addEventListener(EVENT, wrapped);
    return () => window.removeEventListener(EVENT, wrapped);
}

/**
 * Pure-logic helper for the headTracker tick(): returns true while a
 * recent gesture-claim is still within the lockout window. Caller
 * tracks `lastClaimTs` (set in the onGestureClaim handler).
 */
export function isLocked(lastClaimTs: number, now: number, lockoutMs = 250): boolean {
    if (lastClaimTs === 0) return false;
    return now - lastClaimTs < lockoutMs;
}
