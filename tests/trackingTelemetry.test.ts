import { describe, it, expect, beforeEach } from 'vitest';
import {
    emitTrackingEvent,
    subscribeTrackingEvents,
    subscribeTrackingEventType,
    _listenerCount,
    _resetForTests,
    type TrackingEvent,
} from '@/services/trackingTelemetry';

beforeEach(() => {
    _resetForTests();
});

describe('trackingTelemetry — basic pub/sub', () => {
    it('starts with no listeners', () => {
        expect(_listenerCount()).toBe(0);
    });

    it('subscribe + emit delivers the event to the listener', () => {
        const received: TrackingEvent[] = [];
        subscribeTrackingEvents((e) => received.push(e));
        emitTrackingEvent({ type: 'drift', reason: 'cursor-drift', timestamp: 100 });
        expect(received).toEqual([{ type: 'drift', reason: 'cursor-drift', timestamp: 100 }]);
    });

    it('disposer removes the listener (no further events)', () => {
        const received: TrackingEvent[] = [];
        const off = subscribeTrackingEvents((e) => received.push(e));
        off();
        emitTrackingEvent({ type: 'drift', reason: 'cursor-drift', timestamp: 100 });
        expect(received).toEqual([]);
        expect(_listenerCount()).toBe(0);
    });

    it('multiple listeners all receive the same event in subscription order', () => {
        const received: string[] = [];
        subscribeTrackingEvents((e) => received.push('a:' + e.type));
        subscribeTrackingEvents((e) => received.push('b:' + e.type));
        emitTrackingEvent({ type: 'imu-shaking', peakMagnitude: 5.2, timestamp: 0 });
        expect(received).toEqual(['a:imu-shaking', 'b:imu-shaking']);
    });
});

describe('trackingTelemetry — military hardening: adversarial subscribers', () => {
    it('listener that throws does not break the bus', () => {
        const received: string[] = [];
        subscribeTrackingEvents(() => { throw new Error('listener boom'); });
        subscribeTrackingEvents((e) => received.push(e.type));
        // The throwing listener should NOT prevent the second listener from running
        expect(() => emitTrackingEvent({
            type: 'drift', reason: 'cursor-drift', timestamp: 0,
        })).not.toThrow();
        expect(received).toEqual(['drift']);
    });

    it('listener unsubscribing during dispatch does not skip siblings', () => {
        // Real-world: a React effect's listener calls its own disposer
        // when it sees a particular event (e.g. on first drift, log it
        // and then stop listening). Other listeners must still fire.
        const received: string[] = [];
        const off1 = subscribeTrackingEvents(() => {
            // First listener removes itself + a sibling listener
            off1();
        });
        subscribeTrackingEvents((e) => received.push('b:' + e.type));
        emitTrackingEvent({ type: 'drift', reason: 'cursor-drift', timestamp: 0 });
        // Even though listener-a removed itself, listener-b still fires
        expect(received).toEqual(['b:drift']);
    });

    it('emit with no listeners is a no-op', () => {
        expect(() => emitTrackingEvent({
            type: 'drift', reason: 'cursor-drift', timestamp: 0,
        })).not.toThrow();
    });

    it('disposer called twice is idempotent (Set semantics)', () => {
        const off = subscribeTrackingEvents(() => {});
        expect(_listenerCount()).toBe(1);
        off();
        off();
        expect(_listenerCount()).toBe(0);
    });

    it('same listener function passed twice is one subscription', () => {
        const fn = () => {};
        subscribeTrackingEvents(fn);
        subscribeTrackingEvents(fn);
        expect(_listenerCount()).toBe(1);
    });

    it('survives 1000 emit calls without slowdown', () => {
        const received: number[] = [];
        subscribeTrackingEvents((e) => {
            if (e.type === 'drift') received.push(e.timestamp);
        });
        const t0 = performance.now();
        for (let i = 0; i < 1000; i++) {
            emitTrackingEvent({ type: 'drift', reason: 'cursor-drift', timestamp: i });
        }
        const elapsed = performance.now() - t0;
        expect(received.length).toBe(1000);
        expect(elapsed).toBeLessThan(100);  // generous budget
    });

    it('handles all event types via the union discriminator', () => {
        const received: TrackingEvent[] = [];
        subscribeTrackingEvents((e) => received.push(e));
        emitTrackingEvent({ type: 'drift', reason: 'confidence-collapse', timestamp: 1 });
        emitTrackingEvent({ type: 'safe-mode-enter', driftCount: 2, timestamp: 2 });
        emitTrackingEvent({ type: 'safe-mode-exit', driftCount: 0, timestamp: 3 });
        emitTrackingEvent({ type: 'probe-start', progress: 0, timestamp: 4 });
        emitTrackingEvent({ type: 'probe-recover', progress: 1, timestamp: 5 });
        emitTrackingEvent({ type: 'ego-motion-suppress', deltaMagnitude: 0.05, timestamp: 6 });
        emitTrackingEvent({ type: 'edge-pin-warn', timestamp: 7 });
        emitTrackingEvent({ type: 'edge-pin-escalate', timestamp: 8 });
        emitTrackingEvent({ type: 'recalibration-applied', kind: 'offset', magnitude: 0.1, timestamp: 9 });
        emitTrackingEvent({ type: 'imu-shaking', peakMagnitude: 7, timestamp: 10 });
        emitTrackingEvent({ type: 'imu-idle', peakMagnitude: 0.5, timestamp: 11 });
        expect(received.length).toBe(11);
    });
});

describe('trackingTelemetry — subscribeTrackingEventType narrowing', () => {
    it('filters to only the specified event type', () => {
        const driftReasons: string[] = [];
        subscribeTrackingEventType('drift', (e) => driftReasons.push(e.reason));
        emitTrackingEvent({ type: 'drift', reason: 'cursor-drift', timestamp: 1 });
        emitTrackingEvent({ type: 'safe-mode-enter', driftCount: 2, timestamp: 2 });
        emitTrackingEvent({ type: 'drift', reason: 'confidence-collapse', timestamp: 3 });
        expect(driftReasons).toEqual(['cursor-drift', 'confidence-collapse']);
    });

    it('disposer cleans up the filtered subscription', () => {
        const off = subscribeTrackingEventType('drift', () => {});
        expect(_listenerCount()).toBe(1);
        off();
        expect(_listenerCount()).toBe(0);
    });

    it('narrows the listener type — TS sees Extract<...> not the union', () => {
        // Compile-time check: this only type-checks if subscribeTrackingEventType
        // narrows the listener parameter to the matching variant.
        subscribeTrackingEventType('safe-mode-enter', (e) => {
            // e.driftCount is only on the safe-mode variant
            expect(typeof e.driftCount).toBe('number');
        });
        emitTrackingEvent({ type: 'safe-mode-enter', driftCount: 3, timestamp: 0 });
    });
});
