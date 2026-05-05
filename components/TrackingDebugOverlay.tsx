'use client';

/**
 * TrackingDebugOverlay — telemetry-driven event log for QA / support.
 *
 * Subscribes to the unified tracking-telemetry bus and renders the most
 * recent events as a small floating panel. NOT for end users — hidden
 * behind one of:
 *   - localStorage["prism-tracking-debug"] === "1"
 *   - URL query string `?debug=tracking`
 *
 * The component is intended to be mounted unconditionally somewhere
 * high in the tree (e.g. app root); it returns null when neither flag
 * is set. This keeps the activation path query-driven so a support
 * engineer can ask the user to "open this URL with ?debug=tracking
 * appended" — no app rebuild required.
 *
 * Visual:
 *   ┌──────────────────────────────────────┐
 *   │ Tracking events  (last 20)        ✕  │
 *   ├──────────────────────────────────────┤
 *   │ 14:23:10  drift          cursor-drift │
 *   │ 14:23:11  probe-start                 │
 *   │ 14:23:21  probe-recover               │
 *   │ 14:24:02  ego-motion-suppress  0.071  │
 *   │ ...                                   │
 *   └──────────────────────────────────────┘
 *
 * No production dependencies beyond the telemetry bus + React.
 */

import { useEffect, useState } from 'react';
import {
    subscribeTrackingEvents,
    type TrackingEvent,
} from '@/services/trackingTelemetry';

const MAX_EVENTS = 20;
const STORAGE_KEY = 'prism-tracking-debug';
const QUERY_KEY = 'debug';
const QUERY_VALUE = 'tracking';

/** Pure helper — true iff the debug flag is set in either localStorage or URL. */
export function shouldShowDebugOverlay(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        if (localStorage.getItem(STORAGE_KEY) === '1') return true;
    } catch { /* */ }
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.get(QUERY_KEY) === QUERY_VALUE) return true;
    } catch { /* */ }
    return false;
}

/** Format a TrackingEvent as a one-line string for the panel. */
export function formatEvent(event: TrackingEvent): string {
    const time = new Date(event.timestamp).toLocaleTimeString();
    switch (event.type) {
        case 'drift':
            return `${time}  drift           ${event.reason}`;
        case 'safe-mode-enter':
            return `${time}  safe-mode-enter   drifts=${event.driftCount}`;
        case 'safe-mode-exit':
            return `${time}  safe-mode-exit`;
        case 'probe-start':
            return `${time}  probe-start`;
        case 'probe-recover':
            return `${time}  probe-recover`;
        case 'probe-stop':
            return `${time}  probe-stop`;
        case 'ego-motion-suppress':
            return `${time}  ego-motion       Δ=${event.deltaMagnitude.toFixed(3)}`;
        case 'edge-pin-warn':
            return `${time}  edge-pin-warn`;
        case 'edge-pin-escalate':
            return `${time}  edge-pin-escalate`;
        case 'recalibration-applied':
            return `${time}  recal            ${event.kind}  mag=${event.magnitude.toFixed(3)}`;
        case 'imu-shaking':
            return `${time}  imu-shaking      peak=${event.peakMagnitude.toFixed(2)}m/s²`;
        case 'imu-idle':
            return `${time}  imu-idle         peak=${event.peakMagnitude.toFixed(2)}m/s²`;
    }
}

export default function TrackingDebugOverlay() {
    const [visible, setVisible] = useState(false);
    const [events, setEvents] = useState<TrackingEvent[]>([]);

    // Decide visibility on mount; not reactive to URL changes (debug
    // overlay is meant to be turned on at session start).
    useEffect(() => {
        setVisible(shouldShowDebugOverlay());
    }, []);

    // Subscribe to the bus; cap the buffer at MAX_EVENTS so a long
    // session doesn't grow the array unbounded.
    useEffect(() => {
        if (!visible) return;
        const off = subscribeTrackingEvents((event) => {
            setEvents((prev) => {
                const next = [...prev, event];
                if (next.length > MAX_EVENTS) next.splice(0, next.length - MAX_EVENTS);
                return next;
            });
        });
        return off;
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                right: 8,
                top: 8,
                width: 360,
                maxHeight: '60vh',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.85)',
                color: '#0f0',
                font: '11px ui-monospace, "SF Mono", Menlo, monospace',
                padding: 8,
                borderRadius: 6,
                zIndex: 99999,
                pointerEvents: 'auto',
            }}
            role="log"
            aria-live="polite"
            aria-label="Tracking telemetry debug log"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong>Tracking events</strong>
                <button
                    type="button"
                    onClick={() => {
                        try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
                        setVisible(false);
                    }}
                    style={{
                        background: 'transparent',
                        color: '#0f0',
                        border: '1px solid #0f0',
                        borderRadius: 4,
                        padding: '0 6px',
                        cursor: 'pointer',
                    }}
                    aria-label="Close debug overlay"
                >
                    ✕
                </button>
            </div>
            {events.length === 0 ? (
                <div style={{ opacity: 0.5 }}>(no events yet)</div>
            ) : (
                events.map((e, i) => (
                    <div key={i} style={{ whiteSpace: 'pre' }}>{formatEvent(e)}</div>
                ))
            )}
        </div>
    );
}
