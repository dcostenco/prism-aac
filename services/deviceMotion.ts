'use client';

import { emitTrackingEvent } from './trackingTelemetry';

/**
 * deviceMotion — iOS / Android IMU shake detection.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § I.
 *
 * When the laptop / phone is being bounced (moving car, lap-held, walking),
 * MediaPipe landmarks jitter even though the user's face hasn't moved
 * relative to the device. The DeviceMotionEvent API gives us ground-truth
 * "the device IS shaking" — we use that to:
 *
 *   1. Boost the drift detector's confidence floor while shaking, so we
 *      don't auto-disable just because lighting got weird at the same
 *      moment as a bump.
 *   2. Pre-empt camera-shake suppression — the ego-motion classifier in
 *      `egoMotion.ts` works retrospectively (compares last 2 frames). The
 *      IMU is real-time and forward-looking.
 *
 * Browser quirks:
 *   - iOS 13+ requires `DeviceMotionEvent.requestPermission()` after a
 *     user gesture. We expose `requestMotionPermission()` for the host
 *     UI to call from a button click.
 *   - Some browsers fire `devicemotion` without permission (Android,
 *     desktop). We listen unconditionally; permission only matters on iOS.
 *   - Sample rate varies 10–60 Hz. We rolling-window the last 500 ms of
 *     acceleration magnitudes and threshold the peak.
 *
 * API:
 *   const status = await requestMotionPermission();
 *   if (status === 'granted' || status === 'not-required') {
 *     const monitor = startMotionMonitor({ onChange: (s) => ... });
 *     ...later...
 *     monitor.stop();
 *   }
 */

export type MotionPermission = 'granted' | 'denied' | 'not-required' | 'unsupported';
export type MotionState = 'idle' | 'shaking';

export interface MotionMonitorOptions {
    /**
     * Acceleration-magnitude (m/s²) above which we declare "shaking".
     * Default 3.0 — close to the iOS DeviceMotion sample's noise floor
     * for a hand-held device that's actually being moved (gravity ≈ 9.81
     * is excluded by using `accelerationIncludingGravity` minus gravity,
     * or `acceleration` directly which already excludes it).
     */
    shakeThreshold?: number;
    /** Rolling window in ms for peak detection. Default 500. */
    windowMs?: number;
    /**
     * Hysteresis (0..1). Higher = more sticky. The "return to idle"
     * threshold is `shakeThreshold * (1 - idleHysteresis)`.
     *   0  → no hysteresis: return to idle as soon as we drop below shakeThreshold.
     *   0.5 → return to idle below half the shake threshold (default).
     *   1  → sticky: never return to idle (degenerate).
     * Prevents flapping on borderline motion.
     */
    idleHysteresis?: number;
    /** Fired whenever the state transitions. */
    onChange: (state: MotionState) => void;
    /** Fired every sample with the rolling-peak magnitude (telemetry). */
    onSample?: (info: { peakMagnitude: number; state: MotionState }) => void;
}

export interface MotionMonitorHandle {
    stop: () => void;
    /** Read the current state without subscribing. */
    readonly state: MotionState;
}

/* ── Permission flow ──────────────────────────────────────────────── */

interface MotionEventCtorWithPerm {
    requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Probe support and (on iOS 13+) request permission for DeviceMotionEvent.
 * Must be called from a user-gesture handler on iOS.
 *
 * Returns:
 *   - 'granted'      — iOS permission flow accepted.
 *   - 'denied'       — iOS permission flow rejected. Caller should not retry.
 *   - 'not-required' — Browser allows DeviceMotion without explicit consent
 *                      (Android, desktop, older iOS).
 *   - 'unsupported'  — DeviceMotionEvent is not available on this platform.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') {
        return 'unsupported';
    }
    const Ctor = DeviceMotionEvent as unknown as MotionEventCtorWithPerm;
    if (typeof Ctor.requestPermission !== 'function') {
        return 'not-required';
    }
    try {
        const result = await Ctor.requestPermission();
        return result === 'granted' ? 'granted' : 'denied';
    } catch {
        // Older iOS / Safari throw if called outside a user gesture.
        return 'denied';
    }
}

/* ── Pure helpers (testable without DeviceMotion API) ──────────────── */

/**
 * Compute |a| from an acceleration triple. Treats null/undefined components
 * as 0 (some devices report partial samples). Returns 0 for fully-null.
 */
export function magnitude(a: { x?: number | null; y?: number | null; z?: number | null }): number {
    const x = Number.isFinite(a.x) ? a.x as number : 0;
    const y = Number.isFinite(a.y) ? a.y as number : 0;
    const z = Number.isFinite(a.z) ? a.z as number : 0;
    return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Pure state machine: given the previous state, current peak, and
 * thresholds, decide the next state. Used both by `startMotionMonitor`
 * and tested directly.
 */
export function nextMotionState(opts: {
    prev: MotionState;
    peak: number;
    shakeThreshold: number;
    idleHysteresis: number;
}): MotionState {
    // Higher hysteresis = lower idle floor = harder to return to idle.
    // hysteresis=0 → idleFloor = shakeThreshold (immediate, no sticky).
    // hysteresis=1 → idleFloor = 0 (never returns to idle).
    const idleFloor = opts.shakeThreshold * (1 - opts.idleHysteresis);
    if (opts.prev === 'idle') {
        return opts.peak > opts.shakeThreshold ? 'shaking' : 'idle';
    }
    // currently shaking — only return to idle when below the lower threshold
    return opts.peak < idleFloor ? 'idle' : 'shaking';
}

/**
 * Push a sample into a rolling buffer; return the buffer trimmed to
 * `windowMs` of history. Pure — caller maintains the array.
 */
export function pushAndTrimMagnitudes(
    buffer: { ts: number; mag: number }[],
    sample: { ts: number; mag: number },
    windowMs: number,
): { ts: number; mag: number }[] {
    buffer.push(sample);
    const cutoff = sample.ts - windowMs;
    while (buffer.length > 0 && buffer[0].ts < cutoff) buffer.shift();
    return buffer;
}

/** Peak magnitude in a buffer; 0 for empty. */
export function peakOf(buffer: { ts: number; mag: number }[]): number {
    let max = 0;
    for (const s of buffer) if (s.mag > max) max = s.mag;
    return max;
}

/* ── Live monitor (DOM listener) ──────────────────────────────────── */

export function startMotionMonitor(opts: MotionMonitorOptions): MotionMonitorHandle {
    const shakeThreshold = opts.shakeThreshold ?? 3.0;
    const windowMs = opts.windowMs ?? 500;
    const idleHysteresis = opts.idleHysteresis ?? 0.5;
    const buffer: { ts: number; mag: number }[] = [];
    let state: MotionState = 'idle';
    let stopped = false;

    const handler = (e: DeviceMotionEvent) => {
        if (stopped) return;
        const a = e.acceleration;
        if (!a) return;
        const mag = magnitude({ x: a.x, y: a.y, z: a.z });
        const ts = e.timeStamp ?? performance.now();
        pushAndTrimMagnitudes(buffer, { ts, mag }, windowMs);
        const peak = peakOf(buffer);
        const nextState = nextMotionState({ prev: state, peak, shakeThreshold, idleHysteresis });
        if (nextState !== state) {
            state = nextState;
            emitTrackingEvent(state === 'shaking'
                ? { type: 'imu-shaking', peakMagnitude: peak, timestamp: Date.now() }
                : { type: 'imu-idle', peakMagnitude: peak, timestamp: Date.now() });
            try { opts.onChange(state); } catch { /* swallow listener errors */ }
        }
        if (opts.onSample) {
            try { opts.onSample({ peakMagnitude: peak, state }); } catch { /* */ }
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('devicemotion', handler);
    }

    return {
        stop: () => {
            if (stopped) return;
            stopped = true;
            if (typeof window !== 'undefined') {
                window.removeEventListener('devicemotion', handler);
            }
        },
        get state() { return state; },
    };
}
