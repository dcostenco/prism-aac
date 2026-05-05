import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    magnitude,
    nextMotionState,
    pushAndTrimMagnitudes,
    peakOf,
    requestMotionPermission,
    startMotionMonitor,
} from '@/services/deviceMotion';

describe('magnitude — pure 3D euclidean', () => {
    it('returns 0 for the origin', () => {
        expect(magnitude({ x: 0, y: 0, z: 0 })).toBe(0);
    });

    it('handles unit vectors correctly', () => {
        expect(magnitude({ x: 1, y: 0, z: 0 })).toBeCloseTo(1);
        expect(magnitude({ x: 3, y: 4, z: 0 })).toBeCloseTo(5);
        expect(magnitude({ x: 1, y: 2, z: 2 })).toBeCloseTo(3);
    });

    it('treats null/undefined as zero (partial samples)', () => {
        expect(magnitude({ x: 3, y: null, z: 4 })).toBeCloseTo(5);
        expect(magnitude({ x: 5, y: undefined, z: undefined })).toBeCloseTo(5);
    });

    it('treats NaN/Infinity as zero (sensor glitch)', () => {
        expect(magnitude({ x: Number.NaN, y: 0, z: 0 })).toBe(0);
        expect(magnitude({ x: Number.POSITIVE_INFINITY, y: 0, z: 0 })).toBe(0);
        expect(magnitude({ x: 3, y: 4, z: Number.NaN })).toBeCloseTo(5);
    });

    it('returns 0 for fully empty input', () => {
        expect(magnitude({})).toBe(0);
    });
});

describe('nextMotionState — hysteresis state machine', () => {
    const opts = { shakeThreshold: 3, idleHysteresis: 0.5 };

    it('idle stays idle below threshold', () => {
        expect(nextMotionState({ prev: 'idle', peak: 2.9, ...opts })).toBe('idle');
    });

    it('idle transitions to shaking above threshold (strict >)', () => {
        expect(nextMotionState({ prev: 'idle', peak: 3.01, ...opts })).toBe('shaking');
    });

    it('idle at exact threshold stays idle (strict > prevents borderline trip)', () => {
        expect(nextMotionState({ prev: 'idle', peak: 3, ...opts })).toBe('idle');
    });

    it('shaking holds even at threshold (hysteresis prevents flap)', () => {
        expect(nextMotionState({ prev: 'shaking', peak: 3, ...opts })).toBe('shaking');
    });

    it('shaking returns to idle only below idleFloor (= 1.5 at hysteresis 0.5)', () => {
        // idleFloor = 3 * (1 - 0.5) = 1.5
        // At 1.5 exactly, strict < prevents transition
        expect(nextMotionState({ prev: 'shaking', peak: 1.5, ...opts })).toBe('shaking');
        // Below: transition
        expect(nextMotionState({ prev: 'shaking', peak: 1.49, ...opts })).toBe('idle');
    });

    it('idleHysteresis = 0 means immediate idle (no sticky)', () => {
        // idleFloor = 3 * 1 = 3 — anything below threshold returns to idle
        const o = { shakeThreshold: 3, idleHysteresis: 0 };
        expect(nextMotionState({ prev: 'shaking', peak: 2.99, ...o })).toBe('idle');
        expect(nextMotionState({ prev: 'shaking', peak: 3, ...o })).toBe('shaking');
    });

    it('idleHysteresis = 1 is degenerate sticky (never returns to idle)', () => {
        // idleFloor = 3 * 0 = 0 — peak < 0 is never true
        const o = { shakeThreshold: 3, idleHysteresis: 1 };
        expect(nextMotionState({ prev: 'shaking', peak: 0, ...o })).toBe('shaking');
        expect(nextMotionState({ prev: 'shaking', peak: 1.49, ...o })).toBe('shaking');
    });
});

describe('pushAndTrimMagnitudes / peakOf — rolling window', () => {
    it('appends and keeps within window', () => {
        const buf: { ts: number; mag: number }[] = [];
        pushAndTrimMagnitudes(buf, { ts: 0, mag: 1 }, 100);
        pushAndTrimMagnitudes(buf, { ts: 50, mag: 2 }, 100);
        pushAndTrimMagnitudes(buf, { ts: 100, mag: 3 }, 100);
        expect(buf.length).toBe(3);
        expect(peakOf(buf)).toBe(3);
    });

    it('evicts samples older than window', () => {
        const buf: { ts: number; mag: number }[] = [];
        pushAndTrimMagnitudes(buf, { ts: 0, mag: 5 }, 100);   // peak so far
        pushAndTrimMagnitudes(buf, { ts: 50, mag: 1 }, 100);
        pushAndTrimMagnitudes(buf, { ts: 200, mag: 2 }, 100);  // evicts ts:0 + ts:50
        expect(buf.length).toBe(1);
        expect(peakOf(buf)).toBe(2);
    });

    it('peakOf is 0 for empty buffer', () => {
        expect(peakOf([])).toBe(0);
    });

    it('window of 0 immediately evicts everything except current', () => {
        const buf: { ts: number; mag: number }[] = [];
        pushAndTrimMagnitudes(buf, { ts: 100, mag: 5 }, 0);
        // ts:100 < cutoff (100-0=100)? 100 < 100 is false → kept
        expect(buf.length).toBe(1);
        pushAndTrimMagnitudes(buf, { ts: 200, mag: 3 }, 0);
        // first sample ts:100 < 200 → evicted
        expect(buf.length).toBe(1);
        expect(buf[0].mag).toBe(3);
    });

    it('survives 10000 pushes without unbounded growth', () => {
        const buf: { ts: number; mag: number }[] = [];
        for (let i = 0; i < 10000; i++) {
            pushAndTrimMagnitudes(buf, { ts: i, mag: Math.random() }, 100);
        }
        // Window of 100ms with samples 1ms apart → at most ~100 retained
        expect(buf.length).toBeLessThanOrEqual(101);
    });
});

describe('requestMotionPermission — feature detection + iOS flow', () => {
    afterEach(() => {
        // Restore any DeviceMotionEvent mock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).DeviceMotionEvent;
    });

    it('returns "unsupported" when DeviceMotionEvent is undefined', async () => {
        // jsdom does not define DeviceMotionEvent by default
        const result = await requestMotionPermission();
        expect(['unsupported', 'not-required', 'granted', 'denied']).toContain(result);
        // In our environment this is unsupported
        if (typeof DeviceMotionEvent === 'undefined') {
            expect(result).toBe('unsupported');
        }
    });

    it('returns "not-required" when API exists without requestPermission', async () => {
        // Mock a non-iOS DeviceMotionEvent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).DeviceMotionEvent = function () { /* noop ctor */ };
        const result = await requestMotionPermission();
        expect(result).toBe('not-required');
    });

    it('returns "granted" when iOS requestPermission resolves "granted"', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).DeviceMotionEvent = Object.assign(
            function () {},
            { requestPermission: vi.fn().mockResolvedValue('granted') }
        );
        const result = await requestMotionPermission();
        expect(result).toBe('granted');
    });

    it('returns "denied" when iOS requestPermission resolves "denied"', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).DeviceMotionEvent = Object.assign(
            function () {},
            { requestPermission: vi.fn().mockResolvedValue('denied') }
        );
        const result = await requestMotionPermission();
        expect(result).toBe('denied');
    });

    it('returns "denied" when iOS requestPermission throws (called outside user gesture)', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).DeviceMotionEvent = Object.assign(
            function () {},
            { requestPermission: vi.fn().mockRejectedValue(new Error('NotAllowed')) }
        );
        const result = await requestMotionPermission();
        expect(result).toBe('denied');
    });
});

describe('startMotionMonitor — live subscriber lifecycle', () => {
    let dispatchedEvents: ((e: Event) => void)[] = [];

    beforeEach(() => {
        dispatchedEvents = [];
        const realAdd = window.addEventListener.bind(window);
        const realRemove = window.removeEventListener.bind(window);
        vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, listener: EventListener) => {
            if (type === 'devicemotion') {
                dispatchedEvents.push(listener as (e: Event) => void);
            } else {
                realAdd(type, listener);
            }
        }) as typeof window.addEventListener);
        vi.spyOn(window, 'removeEventListener').mockImplementation(((type: string, listener: EventListener) => {
            if (type === 'devicemotion') {
                dispatchedEvents = dispatchedEvents.filter(l => l !== listener);
            } else {
                realRemove(type, listener);
            }
        }) as typeof window.removeEventListener);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function fireMotion(accel: { x: number; y: number; z: number }, ts: number) {
        const evt = { acceleration: accel, timeStamp: ts } as unknown as DeviceMotionEvent;
        for (const listener of dispatchedEvents) listener(evt);
    }

    it('fires onChange when peak crosses threshold', () => {
        const states: string[] = [];
        const m = startMotionMonitor({
            shakeThreshold: 3,
            onChange: (s) => states.push(s),
        });
        fireMotion({ x: 5, y: 0, z: 0 }, 0);  // |a| = 5 > 3
        expect(states).toEqual(['shaking']);
        m.stop();
    });

    it('returns to idle after sustained calm (with hysteresis)', () => {
        const states: string[] = [];
        const m = startMotionMonitor({
            shakeThreshold: 3,
            idleHysteresis: 0.5,
            windowMs: 100,
            onChange: (s) => states.push(s),
        });
        fireMotion({ x: 5, y: 0, z: 0 }, 0);   // shaking
        fireMotion({ x: 0.1, y: 0, z: 0 }, 200);  // peak in window now 0.1 < 1.5 → idle
        expect(states).toEqual(['shaking', 'idle']);
        m.stop();
    });

    it('does not fire onChange when state is unchanged', () => {
        const states: string[] = [];
        const m = startMotionMonitor({ shakeThreshold: 10, onChange: (s) => states.push(s) });
        fireMotion({ x: 1, y: 0, z: 0 }, 0);
        fireMotion({ x: 2, y: 0, z: 0 }, 100);
        fireMotion({ x: 1, y: 0, z: 0 }, 200);
        // Always idle — no onChange fires
        expect(states).toEqual([]);
        m.stop();
    });

    it('stop() removes the listener and silences subsequent events', () => {
        const states: string[] = [];
        const m = startMotionMonitor({ shakeThreshold: 3, onChange: (s) => states.push(s) });
        m.stop();
        fireMotion({ x: 100, y: 0, z: 0 }, 0);
        expect(states).toEqual([]);
    });

    it('stop() called twice is idempotent', () => {
        const m = startMotionMonitor({ shakeThreshold: 3, onChange: () => {} });
        m.stop();
        expect(() => m.stop()).not.toThrow();
    });

    it('handles event with null acceleration (some browsers)', () => {
        const states: string[] = [];
        const m = startMotionMonitor({ shakeThreshold: 3, onChange: (s) => states.push(s) });
        const evt = { acceleration: null, timeStamp: 0 } as unknown as DeviceMotionEvent;
        for (const l of dispatchedEvents) l(evt);
        expect(states).toEqual([]);
        m.stop();
    });

    it('exposes current state via getter', () => {
        const m = startMotionMonitor({ shakeThreshold: 3, onChange: () => {} });
        expect(m.state).toBe('idle');
        fireMotion({ x: 5, y: 0, z: 0 }, 0);
        expect(m.state).toBe('shaking');
        m.stop();
    });

    it('listener errors do not break the dispatch loop', () => {
        const m = startMotionMonitor({
            shakeThreshold: 3,
            onChange: () => { throw new Error('listener boom'); },
        });
        // Should not propagate the throw
        expect(() => fireMotion({ x: 5, y: 0, z: 0 }, 0)).not.toThrow();
        m.stop();
    });

    it('onSample callback fires every event with telemetry', () => {
        const samples: { peakMagnitude: number; state: string }[] = [];
        const m = startMotionMonitor({
            shakeThreshold: 3,
            onChange: () => {},
            onSample: (s) => samples.push(s),
        });
        fireMotion({ x: 1, y: 0, z: 0 }, 0);
        fireMotion({ x: 5, y: 0, z: 0 }, 100);
        expect(samples.length).toBe(2);
        expect(samples[0].state).toBe('idle');
        expect(samples[1].state).toBe('shaking');
        expect(samples[1].peakMagnitude).toBeCloseTo(5);
        m.stop();
    });
});
