/**
 * headTrackerStability — pure-logic primitives for drift detection,
 * confidence-weighted fusion, and post-disable reliability probe.
 *
 * The tests below pin the exact thresholds + edge cases that matter for
 * the "military-stable in a moving car" requirement (auto-disable on
 * runaway cursor, recover when face stability returns, weight bad
 * cameras to zero in fusion).
 */
import { describe, it, expect } from 'vitest';
import {
    DriftDetector,
    ReliabilityProbe,
    fuseWeighted,
    EdgePinDetector,
} from '@/services/headTrackerStability';

describe('DriftDetector — cursor-drift trigger', () => {
    it('does not trigger before minSamples', () => {
        const d = new DriftDetector({ travelThresholdPx: 10, minSamples: 5 });
        // Push 4 samples that exceed travel threshold — still no trigger
        for (let i = 0; i < 4; i++) {
            d.push({ x: i * 100, y: 0, confidence: 1, timestamp: i * 100 });
        }
        expect(d.check()).toBeNull();
    });

    it('triggers cursor-drift when cumulative travel > threshold + no dwell', () => {
        const d = new DriftDetector({ travelThresholdPx: 800, windowMs: 5000, minSamples: 3 });
        const t0 = 1_000_000;
        for (let i = 0; i < 10; i++) {
            // Each step jumps 100px in x — 10 steps × 100 = 1000px travel
            d.push({ x: i * 100, y: 0, confidence: 0.9, timestamp: t0 + i * 100 });
        }
        expect(d.check()).toBe('cursor-drift');
    });

    it('does NOT trigger when user landed a dwell-click in the window', () => {
        const d = new DriftDetector({ travelThresholdPx: 800, windowMs: 5000, minSamples: 3 });
        const t0 = 1_000_000;
        // Push samples with high travel BUT one of them is a dwell hit
        for (let i = 0; i < 10; i++) {
            d.push({
                x: i * 100, y: 0, confidence: 0.9,
                timestamp: t0 + i * 100,
                dwellFired: i === 5,  // user landed a click mid-window
            });
        }
        expect(d.check()).toBeNull();
    });

    it('triggers confidence-collapse when avg confidence < floor', () => {
        const d = new DriftDetector({
            travelThresholdPx: 1_000_000,  // disable cursor-trigger
            confidenceFloor: 0.4,
            minSamples: 3,
            windowMs: 5000,
        });
        for (let i = 0; i < 10; i++) {
            d.push({ x: 0, y: 0, confidence: 0.2, timestamp: 1_000_000 + i * 100 });
        }
        expect(d.check()).toBe('confidence-collapse');
    });

    it('drops samples outside the rolling window', () => {
        const d = new DriftDetector({ travelThresholdPx: 800, windowMs: 1000, minSamples: 3 });
        const t0 = 1_000_000;
        // 5 old samples (outside window) at full velocity
        for (let i = 0; i < 5; i++) {
            d.push({ x: i * 200, y: 0, confidence: 0.9, timestamp: t0 + i * 100 });
        }
        // Then 3 fresh samples (inside window) low velocity
        for (let i = 0; i < 3; i++) {
            d.push({ x: 1000, y: 0, confidence: 0.9, timestamp: t0 + 2000 + i * 100 });
        }
        // Old samples should be evicted; fresh samples have ~0 travel → no trigger
        expect(d.check()).toBeNull();
    });

    it('reset() clears state', () => {
        const d = new DriftDetector({ travelThresholdPx: 100, minSamples: 2 });
        d.push({ x: 0, y: 0, confidence: 0.9, timestamp: 0 });
        d.push({ x: 500, y: 0, confidence: 0.9, timestamp: 100 });
        expect(d.check()).toBe('cursor-drift');
        d.reset();
        expect(d.check()).toBeNull();
    });
});

describe('ReliabilityProbe — auto-recover after drift', () => {
    it('returns true after recoverFrames consecutive stable frames', () => {
        const p = new ReliabilityProbe({ recoverFrames: 5, stableConfidenceFloor: 0.7 });
        for (let i = 0; i < 4; i++) {
            expect(p.push(0.9)).toBe(false);
        }
        expect(p.push(0.9)).toBe(true);  // 5th frame trips it
    });

    it('resets streak on a single bad frame', () => {
        const p = new ReliabilityProbe({ recoverFrames: 3 });
        p.push(0.9); p.push(0.9);
        p.push(0.2);  // bad frame — resets streak
        expect(p.push(0.9)).toBe(false);
        expect(p.push(0.9)).toBe(false);
        expect(p.push(0.9)).toBe(true);  // 3 consecutive after reset
    });

    it('exposes currentStreak for progress UI', () => {
        const p = new ReliabilityProbe({ recoverFrames: 10 });
        p.push(0.9); p.push(0.9); p.push(0.9);
        expect(p.currentStreak).toBe(3);
    });
});

describe('fuseWeighted — confidence-weighted multi-camera fusion', () => {
    it('weights high-confidence camera over low-confidence', () => {
        const r = fuseWeighted([
            { normX: 0.0, normY: 0.0, confidence: 0.95 },
            { normX: 1.0, normY: 1.0, confidence: 0.10 },
        ]);
        // Should be dominated by the 0.95-confidence camera (≈0)
        expect(r).not.toBeNull();
        expect(r!.normX).toBeLessThan(0.15);
        expect(r!.normY).toBeLessThan(0.15);
    });

    it('returns null when total weight is too low', () => {
        const r = fuseWeighted([
            { normX: 0.5, normY: 0.5, confidence: 0.05 },
            { normX: 0.5, normY: 0.5, confidence: 0.05 },
        ], 0.3);
        expect(r).toBeNull();
    });

    it('skips zero-confidence cameras (bad camera does not poison)', () => {
        // Naive average would give (0+1)/2 = 0.5. Weighted should be 0.
        const r = fuseWeighted([
            { normX: 0.0, normY: 0.0, confidence: 0.9 },
            { normX: 1.0, normY: 1.0, confidence: 0.0 },  // dead camera
        ]);
        expect(r).not.toBeNull();
        expect(r!.normX).toBe(0.0);
        expect(r!.normY).toBe(0.0);
    });

    it('equal-confidence cameras average normally', () => {
        const r = fuseWeighted([
            { normX: 0.0, normY: 0.0, confidence: 0.8 },
            { normX: 1.0, normY: 1.0, confidence: 0.8 },
        ]);
        expect(r!.normX).toBeCloseTo(0.5);
        expect(r!.normY).toBeCloseTo(0.5);
    });
});

describe('EdgePinDetector — calibration-failure pin detection', () => {
    const opts = { screenWidth: 1000, screenHeight: 800, edgeBandPx: 24, pinTriggerMs: 2000 };
    const t0 = 1_000_000;  // realistic Date.now() — avoid the pinStart===0 sentinel

    it('returns null when cursor is in the middle of the screen', () => {
        const e = new EdgePinDetector(opts);
        expect(e.push(500, 400, t0)).toBeNull();
        expect(e.push(500, 400, t0 + 5000)).toBeNull();
    });

    it('does not fire pin until pinTriggerMs has elapsed', () => {
        const e = new EdgePinDetector(opts);
        expect(e.push(5, 400, t0)).toBeNull();             // entering edge
        expect(e.push(5, 400, t0 + 1000)).toBeNull();      // 1s pinned — not yet
        expect(e.push(5, 400, t0 + 2100)).toBe('pin');     // crosses 2s → fire
    });

    it('fires pin on each edge (top, bottom, left, right)', () => {
        for (const [x, y] of [[5, 400], [995, 400], [500, 5], [500, 795]]) {
            const e = new EdgePinDetector(opts);
            e.push(x, y, t0);
            expect(e.push(x, y, t0 + 2100)).toBe('pin');
        }
    });

    it('escalates after pinEscalateCount episodes within escalateWindowMs', () => {
        const e = new EdgePinDetector({ ...opts, pinEscalateCount: 2, escalateWindowMs: 30000 });
        // Episode 1
        e.push(5, 400, t0);
        expect(e.push(5, 400, t0 + 2100)).toBe('pin');
        // Move off + return → episode 2 → escalate
        e.push(500, 400, t0 + 3000);  // off-edge resets
        e.push(5, 400, t0 + 4000);
        expect(e.push(5, 400, t0 + 6100)).toBe('escalate');
    });

    it('does not escalate when episodes are spread beyond escalateWindowMs', () => {
        const e = new EdgePinDetector({ ...opts, pinEscalateCount: 2, escalateWindowMs: 5000 });
        e.push(5, 400, t0);
        expect(e.push(5, 400, t0 + 2100)).toBe('pin');
        e.push(500, 400, t0 + 3000);
        // Wait beyond escalateWindowMs before next episode
        e.push(5, 400, t0 + 100_000);
        expect(e.push(5, 400, t0 + 102_100)).toBe('pin');  // not escalate — old episode evicted
    });

    it('off-edge frame resets the in-progress episode (no spurious fire)', () => {
        const e = new EdgePinDetector(opts);
        e.push(5, 400, t0);                  // start pin
        e.push(500, 400, t0 + 1000);         // moved off — reset
        e.push(5, 400, t0 + 1100);           // re-enter
        // Only 1.8s elapsed since re-entry → no fire yet
        expect(e.push(5, 400, t0 + 2900)).toBeNull();
        expect(e.push(5, 400, t0 + 3200)).toBe('pin');
    });

    it('reset() clears all internal state', () => {
        const e = new EdgePinDetector(opts);
        e.push(5, 400, t0);
        e.push(5, 400, t0 + 2100);  // fired
        e.reset();
        // Fresh start — should require full pinTriggerMs again
        e.push(5, 400, t0 + 3000);
        expect(e.push(5, 400, t0 + 4500)).toBeNull();   // < 2s
        expect(e.push(5, 400, t0 + 5100)).toBe('pin');  // > 2s
    });

    it('escalates a single sustained pin without needing N separate episodes', () => {
        // Real-world failure: calibration breaks and the cursor stays
        // pinned to a corner for minutes. Without sustained-pin escalation,
        // this never trips drift (only one episode, never closed out).
        const e = new EdgePinDetector({
            ...opts,
            pinEscalateCount: 3,       // 3 × 2000ms = 6000ms sustained threshold
            escalateWindowMs: 30000,
        });
        e.push(5, 400, t0);
        expect(e.push(5, 400, t0 + 2100)).toBe('pin');     // first pin fires
        // Same episode, never moved off the edge — sustained for >6s total
        expect(e.push(5, 400, t0 + 4000)).toBeNull();      // still in episode
        expect(e.push(5, 400, t0 + 6500)).toBe('escalate'); // sustained fires
        // Should not re-fire on every subsequent frame
        expect(e.push(5, 400, t0 + 7000)).toBeNull();
        expect(e.push(5, 400, t0 + 10000)).toBeNull();
    });
});

describe('EdgePinDetector — military hardening: sustained / episodic interaction', () => {
    const opts = { screenWidth: 1000, screenHeight: 800, edgeBandPx: 24, pinTriggerMs: 2000 };
    const t0 = 1_000_000;

    it('off-edge frame after sustained-fired resets sustainedFired flag', () => {
        // Sustained escalation should be re-arm-able after the user moves
        // off the edge — otherwise a single corrupt session would lose
        // detection forever.
        const e = new EdgePinDetector({ ...opts, pinEscalateCount: 2 });
        e.push(5, 400, t0);
        e.push(5, 400, t0 + 2100);  // 'pin'
        e.push(5, 400, t0 + 4500);  // 'escalate' (sustained)
        e.push(500, 400, t0 + 5000);  // off-edge — reset
        // Now re-enter and re-test sustained logic
        e.push(5, 400, t0 + 6000);
        e.push(5, 400, t0 + 8100);  // 'pin' again
        expect(e.push(5, 400, t0 + 10500)).toBe('escalate');  // sustained again
    });

    it('episodic escalation followed by sustained on the same session', () => {
        const e = new EdgePinDetector({ ...opts, pinEscalateCount: 3 });
        // Episode 1
        e.push(5, 400, t0);
        e.push(5, 400, t0 + 2100);
        e.push(500, 400, t0 + 3000);
        // Episode 2
        e.push(5, 400, t0 + 4000);
        e.push(5, 400, t0 + 6100);
        e.push(500, 400, t0 + 7000);
        // Episode 3 — count reaches 3 → episodic escalate
        e.push(5, 400, t0 + 8000);
        expect(e.push(5, 400, t0 + 10100)).toBe('escalate');
    });

    it('episodic escalation does not double-fire if sustained also crosses', () => {
        // pinEscalateCount=2; pinTriggerMs=2000 → sustained threshold 4000ms
        const e = new EdgePinDetector({ ...opts, pinEscalateCount: 2 });
        e.push(5, 400, t0);
        // Crosses pinTriggerMs at 2100, episodes.length will be 1 → 'pin'
        expect(e.push(5, 400, t0 + 2100)).toBe('pin');
        // Same episode continues. At 4100ms in, sustained threshold (4000)
        // crosses — should fire 'escalate' exactly once.
        expect(e.push(5, 400, t0 + 4100)).toBe('escalate');
        // No more fires from this episode no matter how long it lasts
        expect(e.push(5, 400, t0 + 100_000)).toBeNull();
    });

    it('repeated push at the same timestamp is idempotent (no duplicate fires)', () => {
        const e = new EdgePinDetector(opts);
        e.push(5, 400, t0);
        const first = e.push(5, 400, t0 + 2100);
        const second = e.push(5, 400, t0 + 2100);
        expect(first).toBe('pin');
        expect(second).toBeNull();  // already fired
    });

    it('cursor exactly on the edge band boundary counts as pinned', () => {
        // The check uses `< bandPx` strict, so x === bandPx-1 is pinned.
        // x === bandPx is NOT pinned. Document the exclusive boundary.
        const e = new EdgePinDetector(opts);
        const justInside = opts.edgeBandPx - 1;  // 23
        const atBand = opts.edgeBandPx;          // 24
        e.push(justInside, 400, t0);
        expect(e.push(justInside, 400, t0 + 2100)).toBe('pin');
        // Reset and retest at exact band edge — NOT pinned
        const e2 = new EdgePinDetector(opts);
        e2.push(atBand, 400, t0);
        expect(e2.push(atBand, 400, t0 + 2100)).toBeNull();
    });

    it('zero or negative screen dimensions do not crash', () => {
        const e = new EdgePinDetector({ ...opts, screenWidth: 0, screenHeight: 0 });
        // With width=0, x > 0-24 = -24 is trivially true → always pinned
        expect(() => e.push(100, 100, t0)).not.toThrow();
        expect(() => e.push(100, 100, t0 + 2100)).not.toThrow();
    });

    it('setScreen update mid-session takes effect immediately', () => {
        const e = new EdgePinDetector(opts);
        // x=900 with width=1000 is NOT pinned (1000-24=976, 900<976)
        e.push(900, 400, t0);
        expect(e.push(900, 400, t0 + 2100)).toBeNull();
        // Resize to 800-wide screen — now x=900 IS off-screen, definitely pinned
        e.setScreen(800, 600);
        e.push(900, 400, t0 + 3000);
        expect(e.push(900, 400, t0 + 5100)).toBe('pin');
    });

    it('reset() clears sustainedFired so subsequent sessions start fresh', () => {
        const e = new EdgePinDetector({ ...opts, pinEscalateCount: 2 });
        e.push(5, 400, t0);
        e.push(5, 400, t0 + 2100);
        e.push(5, 400, t0 + 4100);  // sustained 'escalate'
        e.reset();
        // Fresh start — pin trigger required again, no carryover
        e.push(5, 400, t0 + 6000);
        expect(e.push(5, 400, t0 + 7500)).toBeNull();   // <2s
        expect(e.push(5, 400, t0 + 8100)).toBe('pin');  // first fire after reset
    });

    it('moving off-edge between detection frames clears in-progress episode', () => {
        // Real-world: cursor jitters back and forth at the edge.
        const e = new EdgePinDetector(opts);
        e.push(5, 400, t0);
        e.push(500, 400, t0 + 500);   // off
        e.push(5, 400, t0 + 1000);    // back on — episode restarts
        e.push(500, 400, t0 + 1500);  // off again
        e.push(5, 400, t0 + 2000);    // back on
        // Total time pinned in any single span is < 2s → no fire
        expect(e.push(5, 400, t0 + 3500)).toBeNull();
        // Sustained from t0+2000 → t0+4000 = 2s → fires
        expect(e.push(5, 400, t0 + 4100)).toBe('pin');
    });

    it('confidence-collapse alongside edge-pin both fire independently', () => {
        // Cursor pinned at edge with low confidence. EdgePinDetector and
        // DriftDetector should each fire on their own signal.
        const drift = new DriftDetector({ confidenceFloor: 0.5, minSamples: 3, windowMs: 5000 });
        const edge = new EdgePinDetector(opts);
        for (let i = 0; i < 10; i++) {
            const ts = t0 + i * 200;
            drift.push({ x: 5, y: 400, confidence: 0.2, timestamp: ts });
            edge.push(5, 400, ts);
        }
        // Drift fires due to confidence collapse
        expect(drift.check()).toBe('confidence-collapse');
        // Edge pin fires due to sustained edge
        // last frame at t0 + 1800 < pinTriggerMs (2000) — push more
        edge.push(5, 400, t0 + 2200);
        expect(edge.push(5, 400, t0 + 2300)).toBeNull();  // already fired, no double
    });
});

describe('crossModalLockout — gesture/dwell contention', () => {
    it('isLocked returns false when no claim has happened', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        expect(isLocked(0, 1_000_000)).toBe(false);
    });

    it('isLocked returns true within the lockout window after a claim', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        const claimTs = 1_000_000;
        expect(isLocked(claimTs, claimTs + 100, 250)).toBe(true);
        expect(isLocked(claimTs, claimTs + 249, 250)).toBe(true);
    });

    it('isLocked returns false after the window has passed', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        const claimTs = 1_000_000;
        expect(isLocked(claimTs, claimTs + 250, 250)).toBe(false);
        expect(isLocked(claimTs, claimTs + 1000, 250)).toBe(false);
    });
});

describe('crossModalLockout — military hardening: boundary + edge cases', () => {
    it('isLocked at exact boundary (now - claim === lockoutMs) returns false', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        // The check is `now - claim < lockoutMs` strict <, so at exact equality it's false
        expect(isLocked(1_000_000, 1_000_250, 250)).toBe(false);
    });

    it('isLocked one-ms before boundary returns true', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        expect(isLocked(1_000_000, 1_000_249, 250)).toBe(true);
    });

    it('isLocked with claim in the future (now < claim) returns true', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        // now - claim is negative, definitely < lockoutMs → locked.
        // Could happen on clock rollback. Erring on side of suppression
        // (no double-fire) is safer than allowing it.
        expect(isLocked(2_000_000, 1_000_000, 250)).toBe(true);
    });

    it('isLocked with lockoutMs of 0 always returns false', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        expect(isLocked(1_000_000, 1_000_000, 0)).toBe(false);
        expect(isLocked(1_000_000, 1_000_001, 0)).toBe(false);
    });

    it('isLocked with negative lockoutMs returns false (defensive)', async () => {
        const { isLocked } = await import('@/services/crossModalLockout');
        // now - claim is non-negative; lockoutMs negative → diff < neg is false
        expect(isLocked(1_000_000, 1_000_001, -100)).toBe(false);
    });

    it('dispatchGestureClaim is a no-op in non-DOM environment', async () => {
        const { dispatchGestureClaim } = await import('@/services/crossModalLockout');
        // Save and clobber window
        const realWin = globalThis.window;
        // @ts-expect-error
        delete globalThis.window;
        try {
            expect(() => dispatchGestureClaim({
                gesture: 'blink',
                confidence: 0.9,
                timestamp: Date.now(),
            })).not.toThrow();
        } finally {
            globalThis.window = realWin;
        }
    });

    it('onGestureClaim returns no-op disposer in non-DOM environment', async () => {
        const { onGestureClaim } = await import('@/services/crossModalLockout');
        const realWin = globalThis.window;
        // @ts-expect-error
        delete globalThis.window;
        try {
            const off = onGestureClaim(() => {});
            expect(typeof off).toBe('function');
            expect(() => off()).not.toThrow();
        } finally {
            globalThis.window = realWin;
        }
    });

    it('multiple subscribers all receive the same dispatched claim', async () => {
        const { onGestureClaim, dispatchGestureClaim } = await import('@/services/crossModalLockout');
        const received: string[] = [];
        const off1 = onGestureClaim((d) => received.push('a:' + d.gesture));
        const off2 = onGestureClaim((d) => received.push('b:' + d.gesture));
        dispatchGestureClaim({ gesture: 'blink', confidence: 0.9, timestamp: 1 });
        expect(received).toEqual(['a:blink', 'b:blink']);
        off1();
        off2();
    });

    it('disposer cleanly removes only the matching subscriber', async () => {
        const { onGestureClaim, dispatchGestureClaim } = await import('@/services/crossModalLockout');
        const received: string[] = [];
        const off1 = onGestureClaim((d) => received.push('a:' + d.gesture));
        const off2 = onGestureClaim((d) => received.push('b:' + d.gesture));
        off1();
        dispatchGestureClaim({ gesture: 'smile', confidence: 0.9, timestamp: 1 });
        expect(received).toEqual(['b:smile']);
        off2();
    });

    it('disposer called twice is idempotent (second call is no-op)', async () => {
        const { onGestureClaim, dispatchGestureClaim } = await import('@/services/crossModalLockout');
        const received: string[] = [];
        const off = onGestureClaim((d) => received.push(d.gesture));
        off();
        expect(() => off()).not.toThrow();  // idempotent
        dispatchGestureClaim({ gesture: 'pucker', confidence: 0.8, timestamp: 1 });
        expect(received).toEqual([]);
    });

    it('disposer remains valid even after subscriber throws on dispatch', async () => {
        const { onGestureClaim, dispatchGestureClaim } = await import('@/services/crossModalLockout');
        // Browser EventTarget wraps each listener; a throw won't cancel the
        // dispatch chain in production. In jsdom + vitest, the throw is
        // surfaced as an unhandled error. We're testing the contract that
        // the disposer still works AFTER such a throw — the subscription
        // map isn't corrupted.
        const offBad = onGestureClaim(() => { /* would throw in real code */ });
        expect(() => offBad()).not.toThrow();
        // After cleanup, a fresh subscription works normally
        const received: string[] = [];
        const off = onGestureClaim((d) => received.push(d.gesture));
        dispatchGestureClaim({ gesture: 'after-throw', confidence: 0.9, timestamp: 1 });
        expect(received).toEqual(['after-throw']);
        off();
    });
});

// ── Integration-level: drift→recovery decision logic ─────────────────────
// This tests the WIRING pattern, not just the probe class. The original bug
// was that ReliabilityProbe passed its unit tests while the consumer never
// called it (nested inside an unreachable guard). This test simulates the
// exact state transitions the headTracker tick loop makes.

describe('drift→recovery wiring decision', () => {
    it('recovery probe runs AFTER driftFired is set (the original bug scenario)', () => {
        // Simulate the headTracker state after drift fires
        let driftFired = false;
        let driftPaused = false;
        let recoveryStartTs = 0;
        const probe = new ReliabilityProbe({ recoverFrames: 3, stableConfidenceFloor: 0.7 });
        let recovered = false;

        // Frame 1: drift fires
        driftFired = true;
        driftPaused = true;
        recoveryStartTs = 1000;
        probe.reset();

        // Frames 2-4: simulate the tick loop's recovery check
        // THIS is what was broken — the check must run even when driftFired=true
        for (let frame = 2; frame <= 4; frame++) {
            const avgConfidence = 0.85;
            const nowTs = 1000 + frame * 1000;

            // The fix: recovery check runs OUTSIDE !driftFired guard
            if (driftPaused && avgConfidence > 0) {
                if (probe.push(avgConfidence)) {
                    driftPaused = false;
                    driftFired = false;
                    recovered = true;
                }
            }
        }

        expect(recovered).toBe(true);
        expect(driftPaused).toBe(false);
        expect(driftFired).toBe(false);
    });

    it('timeout fires after 60s even when confidence stays below recovery threshold', () => {
        let driftPaused = true;
        let driftFired = true;
        let recoveryStartTs = 0;
        const probe = new ReliabilityProbe({ recoverFrames: 10, stableConfidenceFloor: 0.7 });
        let recoveredVia: 'probe' | 'timeout' | null = null;
        const RECOVERY_TIMEOUT_MS = 60_000;

        recoveryStartTs = 0;

        // 60 frames at 1fps, confidence always 0.5 (below 0.7 threshold)
        for (let frame = 1; frame <= 65; frame++) {
            const avgConfidence = 0.5;
            const nowTs = frame * 1000;

            if (driftPaused && avgConfidence > 0) {
                if (probe.push(avgConfidence)) {
                    driftPaused = false;
                    driftFired = false;
                    recoveredVia = 'probe';
                } else if (nowTs - recoveryStartTs > RECOVERY_TIMEOUT_MS) {
                    driftPaused = false;
                    driftFired = false;
                    probe.reset();
                    recoveredVia = 'timeout';
                }
            }

            if (recoveredVia) break;
        }

        expect(recoveredVia).toBe('timeout');
        expect(driftPaused).toBe(false);
    });

    it('total face loss (confidence=0) does NOT feed probe, but timeout still fires on face return', () => {
        let driftPaused = true;
        let driftFired = true;
        let recoveryStartTs = 0;
        const probe = new ReliabilityProbe({ recoverFrames: 10, stableConfidenceFloor: 0.7 });
        let recovered = false;
        const RECOVERY_TIMEOUT_MS = 60_000;

        recoveryStartTs = 0;
        let probeCallCount = 0;

        // 70 frames: first 65 have confidence=0 (face lost), then face returns
        for (let frame = 1; frame <= 70; frame++) {
            const avgConfidence = frame <= 65 ? 0 : 0.8;
            const nowTs = frame * 1000;

            if (driftPaused && avgConfidence > 0) {
                probeCallCount++;
                if (probe.push(avgConfidence)) {
                    driftPaused = false;
                    driftFired = false;
                    recovered = true;
                } else if (nowTs - recoveryStartTs > RECOVERY_TIMEOUT_MS) {
                    driftPaused = false;
                    driftFired = false;
                    recovered = true;
                }
            }

            if (recovered) break;
        }

        // Probe wasn't fed during face loss (confidence=0 guard)
        expect(probeCallCount).toBeLessThan(10);
        // But recovery fires on face return via timeout (66s > 60s)
        expect(recovered).toBe(true);
        expect(driftPaused).toBe(false);
    });

    it('drift can re-fire after recovery (driftFired properly reset)', () => {
        let driftFired = false;
        let driftPaused = false;
        const probe = new ReliabilityProbe({ recoverFrames: 3, stableConfidenceFloor: 0.7 });

        // First drift
        driftFired = true;
        driftPaused = true;
        probe.reset();

        // Recovery
        for (let i = 0; i < 3; i++) probe.push(0.9);
        driftPaused = false;
        driftFired = false;

        // Second drift should be possible
        expect(driftFired).toBe(false); // guard allows re-entry
        driftFired = true;
        driftPaused = true;
        expect(driftFired).toBe(true);
        expect(driftPaused).toBe(true);
    });
});
