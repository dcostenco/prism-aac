import { describe, it, expect, beforeEach } from 'vitest';
import {
    recordDriftEvent,
    isSafeMode,
    clearDriftHistory,
    readHistory,
    freshEvents,
    applySafeModeCaps,
    SAFE_MODE_EFFECTS,
} from '@/services/safeMode';

beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('safeMode — drift-history bookkeeping', () => {
    it('starts with an empty history', () => {
        expect(readHistory()).toEqual([]);
        expect(isSafeMode()).toBe(false);
    });

    it('does NOT activate after a single drift event', () => {
        recordDriftEvent(1_000_000);
        expect(isSafeMode(1_000_000)).toBe(false);
    });

    it('activates after triggerCount events within windowMs', () => {
        recordDriftEvent(1_000_000);
        recordDriftEvent(1_000_500);  // 0.5s later
        expect(isSafeMode(1_001_000)).toBe(true);
    });

    it('does NOT activate when events are spread beyond the window', () => {
        // 6-min default window — 7-min spread should not count
        recordDriftEvent(1_000_000);
        recordDriftEvent(1_000_000 + 7 * 60 * 1000);
        // From the perspective of the second event, only one event is in-window.
        expect(isSafeMode(1_000_000 + 7 * 60 * 1000)).toBe(false);
    });

    it('clearDriftHistory unlocks safe mode', () => {
        recordDriftEvent(1_000_000);
        recordDriftEvent(1_000_500);
        expect(isSafeMode(1_001_000)).toBe(true);
        clearDriftHistory();
        expect(isSafeMode(1_001_000)).toBe(false);
        expect(readHistory()).toEqual([]);
    });

    it('honors a custom triggerCount + windowMs', () => {
        const opts = { triggerCount: 3, windowMs: 60_000 };
        recordDriftEvent(1_000_000, opts);
        recordDriftEvent(1_000_500, opts);
        expect(isSafeMode(1_001_000, opts)).toBe(false);  // only 2/3
        recordDriftEvent(1_001_000, opts);
        expect(isSafeMode(1_001_500, opts)).toBe(true);   // 3/3
    });

    it('evicts old events when recording new ones', () => {
        recordDriftEvent(1_000_000);
        recordDriftEvent(1_000_000 + 10 * 60 * 1000);  // 10 minutes later — old one evicted
        expect(readHistory().length).toBe(1);
    });
});

describe('freshEvents — pure window filter', () => {
    it('returns only events within window', () => {
        const history = [100, 200, 300, 400, 500];
        expect(freshEvents(history, 500, 200)).toEqual([300, 400, 500]);
    });

    it('returns empty for stale history', () => {
        expect(freshEvents([100], 1_000_000, 1000)).toEqual([]);
    });
});

describe('applySafeModeCaps — config gating', () => {
    const config = {
        sensitivity: 5,
        dwellMs: 800,
        gesturesEnabled: true,
        cameraIds: ['cam-a', 'cam-b'] as const,
    };

    it('is a no-op when safe mode is inactive', () => {
        expect(applySafeModeCaps(config, false)).toEqual(config);
    });

    it('caps sensitivity at the safe ceiling', () => {
        const out = applySafeModeCaps(config, true);
        expect(out.sensitivity).toBe(SAFE_MODE_EFFECTS.sensitivityCap);
    });

    it('does not raise sensitivity if user already chose a low value', () => {
        const out = applySafeModeCaps({ ...config, sensitivity: 0.8 }, true);
        expect(out.sensitivity).toBe(0.8);
    });

    it('doubles dwellMs', () => {
        const out = applySafeModeCaps(config, true);
        expect(out.dwellMs).toBe(1600);
    });

    it('disables gestures', () => {
        expect(applySafeModeCaps(config, true).gesturesEnabled).toBe(false);
    });

    it('keeps only the first camera', () => {
        const out = applySafeModeCaps(config, true);
        expect(out.cameraIds).toEqual(['cam-a']);
    });

    it('does not mutate the input', () => {
        const input = { ...config, cameraIds: [...config.cameraIds] as string[] };
        applySafeModeCaps(input, true);
        expect(input.sensitivity).toBe(5);
        expect(input.dwellMs).toBe(800);
        expect(input.gesturesEnabled).toBe(true);
        expect(input.cameraIds).toEqual(['cam-a', 'cam-b']);
    });
});
