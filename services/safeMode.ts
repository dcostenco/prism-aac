'use client';

import { emitTrackingEvent } from './trackingTelemetry';

// In-memory authority — cannot be bypassed by localStorage manipulation
let _inMemorySafeModeActive = false;
let _inMemoryDriftEvents: number[] = [];

/**
 * safeMode — degraded-operation mode after repeated drift events.
 *
 * Triggered when drift auto-disable fires more than `triggerCount` times
 * within `windowMs`. Safe mode is the answer to: "auto-disabled twice in
 * three minutes — what should the *next* tracking attempt look like?"
 *
 * Effects (applied by HeadTrackingOverlay when isSafeMode() is true):
 *   - sensitivity capped (default 1.5×) — cursor moves only on big head moves
 *   - dwell time doubled — high false-positive guard
 *   - single camera — no fusion, primary only (`videoCameraIds.slice(0, 1)`)
 *   - gestures disabled — one input channel at a time, less to go wrong
 *
 * Safe mode unlocks when the user manually toggles tracking off → on
 * (which calls clearDriftHistory()), or when the drift-event window
 * empties naturally over time.
 *
 * Persistence: events are stored in localStorage so safe mode survives
 * page reloads — a user who got two drift events in 30s shouldn't lose
 * the lesson when they refresh.
 *
 * Plan ref: docs/TRACKING_RELIABILITY.md § K.
 */

const STORAGE_KEY = 'prism-drift-history';

export interface SafeModeOptions {
    /** Number of drift events within `windowMs` that triggers safe mode. Default 2. */
    triggerCount?: number;
    /** Sliding window in ms for counting events. Default 5 minutes. */
    windowMs?: number;
}

const DEFAULTS: Required<SafeModeOptions> = {
    triggerCount: 2,
    windowMs: 5 * 60 * 1000,
};

/** Effect coefficients applied when safe mode is active. */
export const SAFE_MODE_EFFECTS = {
    /** Hard cap on sensitivity. Even if the user set 5×, we cap at 1.5×. */
    sensitivityCap: 1.5,
    /** Multiplier on the user's chosen dwell time. */
    dwellMultiplier: 2,
} as const;

/** Read persisted drift-event history. Returns ascending-sorted timestamps. */
export function readHistory(): number[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
    } catch { return []; }
}

function writeHistory(arr: number[]): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch { /* */ }
}

/** Pure helper — given a history list and time, return the events still in-window. */
export function freshEvents(history: number[], now: number, windowMs: number): number[] {
    const cutoff = now - windowMs;
    return history.filter(t => t >= cutoff);
}

/** Record a drift auto-disable event. Call from the onDrift handler. */
export function recordDriftEvent(now: number = Date.now(), opts: SafeModeOptions = {}): void {
    const { triggerCount, windowMs } = { ...DEFAULTS, ...opts };
    // Update in-memory state first (H8: cannot be bypassed by localStorage)
    _inMemoryDriftEvents = [..._inMemoryDriftEvents, now]
        .filter(t => now - t < windowMs);
    // Also update localStorage as secondary backup for reload persistence
    try { writeHistory(_inMemoryDriftEvents); } catch {}
    const wasActive = _inMemoryDriftEvents.length - 1 >= triggerCount;
    if (_inMemoryDriftEvents.length >= triggerCount) {
        _inMemorySafeModeActive = true;
    }
    // Telemetry: detect the moment we cross into safe mode and emit
    // exactly once per transition.
    if (!wasActive && _inMemorySafeModeActive) {
        emitTrackingEvent({
            type: 'safe-mode-enter',
            driftCount: _inMemoryDriftEvents.length,
            timestamp: now,
        });
    }
}

/** True iff the user has tripped enough drift events to enter safe mode. */
export function isSafeMode(now: number = Date.now(), opts: SafeModeOptions = {}): boolean {
    // H8: check in-memory first — cannot be bypassed by localStorage manipulation
    if (_inMemorySafeModeActive) return true;
    // Fall back to localStorage only for restore-on-reload
    try {
        const { triggerCount, windowMs } = { ...DEFAULTS, ...opts };
        return freshEvents(readHistory(), now, windowMs).length >= triggerCount;
    } catch { return false; }
}

/** Clear all drift events. Requires confirmed=true to prevent accidental bypass. */
export function clearDriftHistory(confirmed = false): void {
    if (!confirmed) {
        console.warn('[safeMode] clearDriftHistory requires confirmed=true');
        return;
    }
    const wasActive = _inMemorySafeModeActive;
    _inMemorySafeModeActive = false;
    _inMemoryDriftEvents = [];
    try { writeHistory([]); } catch {}
    if (wasActive) {
        emitTrackingEvent({
            type: 'safe-mode-exit',
            driftCount: 0,
            timestamp: Date.now(),
        });
    }
}

/**
 * Apply safe-mode caps to a tracker config snapshot. Returns a NEW object —
 * never mutates input. Caller passes the user's current settings; receives
 * what should actually be sent to the tracker.
 */
export function applySafeModeCaps<T extends {
    sensitivity: number;
    dwellMs: number;
    gesturesEnabled: boolean;
    cameraIds: readonly string[];
}>(input: T, active: boolean): T {
    if (!active) return input;
    return {
        ...input,
        sensitivity: Math.min(input.sensitivity, SAFE_MODE_EFFECTS.sensitivityCap),
        dwellMs: input.dwellMs * SAFE_MODE_EFFECTS.dwellMultiplier,
        gesturesEnabled: false,
        cameraIds: input.cameraIds.slice(0, 1),
    };
}
