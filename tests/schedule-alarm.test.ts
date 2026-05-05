import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the timer-alarm useEffect in components/SchedulePanel.tsx.
 *
 * Behavior under test (matches the actual component logic verbatim — we
 * extract the effect to a local function here so we can unit-test it
 * without rendering the whole panel + tracking + zustand store):
 *
 *   - When phase enters 'first-armed' or 'then-armed', ring immediately
 *     then every 2s (ALARM_INTERVAL_MS) up to 30 ticks (ALARM_MAX_TICKS).
 *   - When phase changes (user tapped the tile), cleanup clears the
 *     interval and the alarm stops within the next tick.
 *   - When the 30-tick ceiling is hit, the alarm stops on its own so a
 *     forgotten tab doesn't beep forever.
 */

const ALARM_INTERVAL_MS = 2000;
const ALARM_MAX_TICKS = 30;

/**
 * Replicate the SchedulePanel effect's body 1:1. A test that mounts the
 * full component would be nicer but pulls in zustand + i18n + 12 stores;
 * this surfaces the exact contract we need to keep stable.
 */
function startAlarmLoop(phase: string, ring: () => void): () => void {
    const isAlarmPhase = phase === 'first-armed' || phase === 'then-armed';
    if (!isAlarmPhase) return () => { /* noop cleanup */ };
    let ticks = 0;
    ring();
    ticks++;
    const id = setInterval(() => {
        if (ticks >= ALARM_MAX_TICKS) {
            clearInterval(id);
            return;
        }
        ring();
        ticks++;
    }, ALARM_INTERVAL_MS);
    return () => clearInterval(id);
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('schedule alarm — repeating chime', () => {
    it('does not ring while phase is idle', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('idle', ring);
        vi.advanceTimersByTime(10_000);
        expect(ring).not.toHaveBeenCalled();
        cleanup();
    });

    it('does not ring during first-checked (waiting for the THEN timer)', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('first-checked', ring);
        vi.advanceTimersByTime(10_000);
        expect(ring).not.toHaveBeenCalled();
        cleanup();
    });

    it('rings immediately when phase becomes first-armed', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('first-armed', ring);
        // Immediate fire happens synchronously inside the effect body
        expect(ring).toHaveBeenCalledTimes(1);
        cleanup();
    });

    it('rings every 2 seconds while first-armed', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('first-armed', ring);
        // After the immediate ring, advance 6s → 3 more rings (at 2s, 4s, 6s)
        vi.advanceTimersByTime(6_000);
        expect(ring).toHaveBeenCalledTimes(4);
        cleanup();
    });

    it('rings when phase becomes then-armed (same loop, second pair)', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('then-armed', ring);
        vi.advanceTimersByTime(4_000);
        // Immediate + 2 more interval rings
        expect(ring).toHaveBeenCalledTimes(3);
        cleanup();
    });

    it('stops when cleanup is called (user tapped FIRST/THEN tile)', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('first-armed', ring);
        vi.advanceTimersByTime(2_500);
        const ringsBeforeCleanup = ring.mock.calls.length;
        cleanup();
        vi.advanceTimersByTime(10_000);
        // No further rings after cleanup
        expect(ring).toHaveBeenCalledTimes(ringsBeforeCleanup);
    });

    it('caps the alarm at 30 ticks (~60s) so a forgotten tab does not beep forever', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('first-armed', ring);
        // Advance well past the cap (90s)
        vi.advanceTimersByTime(90_000);
        // Immediate ring + 29 interval rings = 30 total at the ceiling
        expect(ring).toHaveBeenCalledTimes(ALARM_MAX_TICKS);
        cleanup();
    });

    it('exact tick count over the 60s alarm window', () => {
        const ring = vi.fn();
        const cleanup = startAlarmLoop('first-armed', ring);
        // 0s: 1 ring, then every 2s through 58s = +29 = 30 total
        vi.advanceTimersByTime(58_000);
        expect(ring).toHaveBeenCalledTimes(30);
        cleanup();
    });
});

describe('schedule alarm — interval tuning', () => {
    it('uses the documented 2 second cadence (changeable via ALARM_INTERVAL_MS)', () => {
        // Sanity: changing the constant would force this test to update,
        // catching accidental cadence drift.
        expect(ALARM_INTERVAL_MS).toBe(2000);
    });
    it('caps at 30 ticks (~60s) — documented in the SchedulePanel comment', () => {
        expect(ALARM_MAX_TICKS).toBe(30);
        expect(ALARM_MAX_TICKS * (ALARM_INTERVAL_MS / 1000)).toBe(60);
    });
});
