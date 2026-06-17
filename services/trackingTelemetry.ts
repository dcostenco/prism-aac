/**
 * trackingTelemetry — unified pub/sub for reliability events.
 *
 * The tracking stack now emits at least eight distinct lifecycle events
 * (drift trip, probe recovery, safe-mode entry, ego-motion suppression,
 * edge-pin warn, edge-pin escalate, recalibration applied, IMU state
 * change). Without a unified bus, each consumer (analytics, debug
 * overlay, support log) wires up callbacks individually — the tracker's
 * options surface bloats and consumers diverge.
 *
 * This module is the single shared bus: tracking primitives `emit()`,
 * consumers `subscribe()` once and route to wherever they need.
 *
 * Pure pub/sub: no DOM dependency, no localStorage, no side effects on
 * the tracker. Subscribers can fan out to console, network, IndexedDB,
 * or React state. Errors in subscribers are caught so one bad listener
 * can't break the bus.
 *
 * Event taxonomy is deliberately small + flat — not a hierarchy. Add a
 * new event type by extending the discriminated union; consumers narrow
 * via the `type` field.
 */

export interface DriftTripEvent {
    type: 'drift';
    reason: 'cursor-drift' | 'confidence-collapse' | 'edge-pin-escalate';
    timestamp: number;
}

export interface SafeModeEnterEvent {
    type: 'safe-mode-enter';
    /** How many drift events triggered the entry. */
    driftCount: number;
    timestamp: number;
}

export interface SafeModeExitEvent {
    type: 'safe-mode-exit';
    /** Always 0 on exit (history was cleared). */
    driftCount: 0;
    timestamp: number;
}

export interface ProbeStartEvent {
    type: 'probe-start';
    progress: 0;
    timestamp: number;
}

export interface ProbeRecoverEvent {
    type: 'probe-recover';
    /** Always 1 — full streak. */
    progress: 1;
    timestamp: number;
}

export interface ProbeStopEvent {
    type: 'probe-stop';
    progress: 0;
    timestamp: number;
}

export interface EgoMotionEvent {
    type: 'ego-motion-suppress';
    /** Magnitude of the suppressed centroid delta (normalized units). */
    deltaMagnitude: number;
    timestamp: number;
}

export interface EdgePinWarnEvent {
    type: 'edge-pin-warn';
    timestamp: number;
}

export interface EdgePinEscalateEvent {
    type: 'edge-pin-escalate';
    timestamp: number;
}

export interface RecalibrationEvent {
    type: 'recalibration-applied';
    kind: 'offset' | 'scale' | 'anchor';
    /** Delta magnitude or scale ratio depending on kind. Useful for log lines. */
    magnitude: number;
    timestamp: number;
}

export interface MotionShakingEvent {
    type: 'imu-shaking';
    peakMagnitude: number;
    timestamp: number;
}

export interface MotionIdleEvent {
    type: 'imu-idle';
    peakMagnitude: number;
    timestamp: number;
}

// T-6: gesture + calibration telemetry for caregiver visibility
export interface GestureFiredEvent {
    type: 'gesture-fired';
    gesture: string;
    confidence: number;
    timestamp: number;
}

export interface GestureFalsePositiveEvent {
    type: 'gesture-false-positive';
    gesture: string;
    reason: 'fatigue' | 'cough' | 'conversation' | 'unknown';
    timestamp: number;
}

export interface CalibrationResetEvent {
    type: 'calibration-reset';
    reason: 'corrupt-data' | 'narrow-range' | 'manual';
    rangeX: number;
    rangeY: number;
    timestamp: number;
}

export interface CalibrationLearnedEvent {
    type: 'calibration-learned';
    mode: 'bootstrap' | 'expand-only';
    rangeX: number;
    rangeY: number;
    timestamp: number;
}

export interface DtwFallbackEvent {
    type: 'dtw-fallback';
    reason: 'no-templates' | 'corrupt-templates' | 'load-error';
    timestamp: number;
}

export interface AutoRecoverEvent {
    type: 'auto-recover';
    timestamp: number;
}

export interface AutoRecoverTimeoutEvent {
    type: 'auto-recover-timeout';
    timestamp: number;
}

export type TrackingEvent =
    | DriftTripEvent
    | SafeModeEnterEvent
    | SafeModeExitEvent
    | ProbeStartEvent
    | ProbeRecoverEvent
    | ProbeStopEvent
    | EgoMotionEvent
    | EdgePinWarnEvent
    | EdgePinEscalateEvent
    | RecalibrationEvent
    | MotionShakingEvent
    | MotionIdleEvent
    | GestureFiredEvent
    | GestureFalsePositiveEvent
    | CalibrationResetEvent
    | CalibrationLearnedEvent
    | DtwFallbackEvent
    | AutoRecoverEvent
    | AutoRecoverTimeoutEvent;

export type TrackingEventListener = (event: TrackingEvent) => void;

/* ── Internal state ────────────────────────────────────────────────── */

const listeners = new Set<TrackingEventListener>();

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Emit an event to all subscribers. Listener errors are swallowed so a
 * single bad consumer can't break the bus or prevent other subscribers
 * from receiving the event.
 */
export function emitTrackingEvent(event: TrackingEvent): void {
    // Iterate over a snapshot so a listener that unsubscribes during
    // dispatch doesn't perturb the iteration order or skip siblings.
    const snapshot = Array.from(listeners);
    for (const listener of snapshot) {
        try { listener(event); } catch { /* swallow — never let a bad listener kill emit */ }
    }
}

/**
 * Subscribe to all tracking events. Returns a disposer; idempotent on
 * second call. The same listener function passed twice is treated as
 * one subscription (Set semantics).
 */
export function subscribeTrackingEvents(listener: TrackingEventListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Subscriber count — for tests + debug. */
export function _listenerCount(): number {
    return listeners.size;
}

/** Drop all listeners — for tests only. */
export function _resetForTests(): void {
    listeners.clear();
}

/* ── Helper: narrow filter ─────────────────────────────────────────── */

/**
 * Subscribe to events of a specific `type` only. Convenience wrapper for
 * the common case of a consumer caring about one signal.
 *
 *   const off = subscribeTrackingEventType('drift', (e) => log(e.reason));
 */
export function subscribeTrackingEventType<T extends TrackingEvent['type']>(
    type: T,
    listener: (event: Extract<TrackingEvent, { type: T }>) => void,
): () => void {
    return subscribeTrackingEvents((event) => {
        if (event.type === type) {
            listener(event as Extract<TrackingEvent, { type: T }>);
        }
    });
}
