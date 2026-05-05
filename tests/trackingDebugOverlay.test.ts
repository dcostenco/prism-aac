import { describe, it, expect, beforeEach } from 'vitest';
import {
    shouldShowDebugOverlay,
    formatEvent,
} from '@/components/TrackingDebugOverlay';

beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    // Reset the URL to a clean default so tests are deterministic.
    window.history.replaceState({}, '', '/');
});

describe('shouldShowDebugOverlay — activation flags', () => {
    it('returns false by default', () => {
        expect(shouldShowDebugOverlay()).toBe(false);
    });

    it('returns true when localStorage flag is "1"', () => {
        localStorage.setItem('prism-tracking-debug', '1');
        expect(shouldShowDebugOverlay()).toBe(true);
    });

    it('returns false when localStorage flag is anything else', () => {
        localStorage.setItem('prism-tracking-debug', 'true');
        expect(shouldShowDebugOverlay()).toBe(false);
        localStorage.setItem('prism-tracking-debug', 'on');
        expect(shouldShowDebugOverlay()).toBe(false);
        localStorage.setItem('prism-tracking-debug', '0');
        expect(shouldShowDebugOverlay()).toBe(false);
    });

    it('returns true when URL has ?debug=tracking', () => {
        window.history.replaceState({}, '', '/?debug=tracking');
        expect(shouldShowDebugOverlay()).toBe(true);
    });

    it('returns false when URL has ?debug=anything-else', () => {
        window.history.replaceState({}, '', '/?debug=other');
        expect(shouldShowDebugOverlay()).toBe(false);
    });

    it('returns true when both flags are set (either is sufficient)', () => {
        localStorage.setItem('prism-tracking-debug', '1');
        window.history.replaceState({}, '', '/?debug=tracking');
        expect(shouldShowDebugOverlay()).toBe(true);
    });

    it('does not throw when localStorage.getItem throws', () => {
        const original = localStorage.getItem.bind(localStorage);
        localStorage.getItem = () => { throw new Error('SecurityError'); };
        try {
            expect(() => shouldShowDebugOverlay()).not.toThrow();
        } finally {
            localStorage.getItem = original;
        }
    });
});

describe('formatEvent — one-line render for each event type', () => {
    const ts = new Date('2026-05-05T14:23:10Z').getTime();

    it('formats drift events with reason', () => {
        const line = formatEvent({ type: 'drift', reason: 'cursor-drift', timestamp: ts });
        expect(line).toContain('drift');
        expect(line).toContain('cursor-drift');
    });

    it('formats safe-mode-enter with drift count', () => {
        const line = formatEvent({ type: 'safe-mode-enter', driftCount: 3, timestamp: ts });
        expect(line).toContain('safe-mode-enter');
        expect(line).toContain('drifts=3');
    });

    it('formats safe-mode-exit', () => {
        const line = formatEvent({ type: 'safe-mode-exit', driftCount: 0, timestamp: ts });
        expect(line).toContain('safe-mode-exit');
    });

    it('formats probe lifecycle events', () => {
        expect(formatEvent({ type: 'probe-start', progress: 0, timestamp: ts })).toContain('probe-start');
        expect(formatEvent({ type: 'probe-recover', progress: 1, timestamp: ts })).toContain('probe-recover');
        expect(formatEvent({ type: 'probe-stop', progress: 0, timestamp: ts })).toContain('probe-stop');
    });

    it('formats ego-motion with delta magnitude truncated', () => {
        const line = formatEvent({ type: 'ego-motion-suppress', deltaMagnitude: 0.071234, timestamp: ts });
        expect(line).toContain('ego-motion');
        // toFixed(3) → '0.071'
        expect(line).toContain('0.071');
        expect(line).not.toContain('0.071234');
    });

    it('formats edge-pin events', () => {
        expect(formatEvent({ type: 'edge-pin-warn', timestamp: ts })).toContain('edge-pin-warn');
        expect(formatEvent({ type: 'edge-pin-escalate', timestamp: ts })).toContain('edge-pin-escalate');
    });

    it('formats recalibration with kind + magnitude', () => {
        const line = formatEvent({
            type: 'recalibration-applied',
            kind: 'offset',
            magnitude: 0.123,
            timestamp: ts,
        });
        expect(line).toContain('recal');
        expect(line).toContain('offset');
        expect(line).toContain('0.123');
    });

    it('formats IMU events with peak magnitude in m/s²', () => {
        const shaking = formatEvent({ type: 'imu-shaking', peakMagnitude: 7.823, timestamp: ts });
        expect(shaking).toContain('imu-shaking');
        expect(shaking).toContain('7.82');
        const idle = formatEvent({ type: 'imu-idle', peakMagnitude: 0.5, timestamp: ts });
        expect(idle).toContain('imu-idle');
        expect(idle).toContain('0.50');
    });

    it('every event variant produces a non-empty line', () => {
        const events = [
            { type: 'drift', reason: 'confidence-collapse', timestamp: ts },
            { type: 'safe-mode-enter', driftCount: 2, timestamp: ts },
            { type: 'safe-mode-exit', driftCount: 0 as const, timestamp: ts },
            { type: 'probe-start', progress: 0 as const, timestamp: ts },
            { type: 'probe-recover', progress: 1 as const, timestamp: ts },
            { type: 'probe-stop', progress: 0 as const, timestamp: ts },
            { type: 'ego-motion-suppress', deltaMagnitude: 0.04, timestamp: ts },
            { type: 'edge-pin-warn', timestamp: ts },
            { type: 'edge-pin-escalate', timestamp: ts },
            { type: 'recalibration-applied', kind: 'scale' as const, magnitude: 0.7, timestamp: ts },
            { type: 'imu-shaking', peakMagnitude: 5, timestamp: ts },
            { type: 'imu-idle', peakMagnitude: 0.1, timestamp: ts },
        ] as const;
        for (const e of events) {
            const line = formatEvent(e);
            expect(typeof line).toBe('string');
            expect(line.length).toBeGreaterThan(0);
        }
    });

    it('starts each line with a wall-clock time string', () => {
        const line = formatEvent({ type: 'drift', reason: 'cursor-drift', timestamp: ts });
        // Should contain a colon-separated time (HH:MM:SS) somewhere near start.
        expect(line).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
});
