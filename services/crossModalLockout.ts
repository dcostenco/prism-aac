/**
 * crossModalLockout — pacify gesture/dwell click contention.
 *
 * Problem: when a user enables both gestures (e.g. "intentional blink
 * → speak last word") AND head tracking dwell, an intentional blink
 * over a button can fire BOTH the gesture click AND the dwell click,
 * yielding double-action.
 *
 * Solution: gestureService calls dispatchGestureClaim() the moment it
 * commits to a gesture. The headTracker subscribes via onGestureClaim()
 * and suppresses dwell-click for `lockoutMs` afterward. Dwell counter
 * also resets so the user must re-acquire the target.
 *
 * The reverse direction is intentionally NOT done — dwell does NOT
 * suspend gestures. Gestures should always be available as an
 * interrupt (e.g. "I want to stop right now" via blink).
 *
 * M19 fix: biometric gesture data must NOT be broadcast to all window
 * listeners. Replaced window.dispatchEvent / window.addEventListener
 * with a module-internal pub/sub so only explicit subscribers receive it.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § H.
 */

export interface GestureClaimDetail {
    gesture: string;
    confidence: number;
    timestamp: number;
}

// Internal pub/sub — biometric gesture data must not be broadcast to all window listeners
const _gestureListeners = new Set<(detail: GestureClaimDetail) => void>();

/** Fire from gestureService when a gesture is being committed. */
export function dispatchGestureClaim(detail: GestureClaimDetail): void {
    for (const fn of _gestureListeners) { try { fn(detail); } catch {} }
}

/** Subscribe (e.g. from headTracker) to lockout claims. Returns disposer. */
export function onGestureClaim(handler: (d: GestureClaimDetail) => void): () => void {
    _gestureListeners.add(handler);
    return () => _gestureListeners.delete(handler);
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
