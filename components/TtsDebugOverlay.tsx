'use client';

/**
 * TtsDebugOverlay — telemetry-driven debug panel for the TTS fallback
 * chain. Surfaces which tier (Inworld → Azure → Web Speech →
 * Native iOS) is actually firing, with latency + reason for each
 * fallback. Mirrors components/TrackingDebugOverlay.tsx.
 *
 * Hidden by default. Activates via:
 *   - URL query: ?debug=tts
 *   - localStorage: prism-tts-debug = "1"
 *
 * Mounted high in the React tree (PrismApp). When inactive, returns
 * null so end users see nothing — no DOM cost, no listeners.
 *
 * Plan ref: synalux-private/docs/CUSTOMER_FEEDBACK_ENHANCEMENTS.md § #1.
 */

import { useEffect, useState } from 'react';
import {
    subscribeTtsHealth,
    type TtsHealthEvent,
} from '@/services/ttsHealthBus';

const MAX_EVENTS = 20;
const STORAGE_KEY = 'prism-tts-debug';
const QUERY_KEY = 'debug';
const QUERY_VALUE = 'tts';

/** Pure helper — true iff the debug flag is set in either localStorage or URL. */
export function shouldShowTtsDebug(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        if (localStorage.getItem(STORAGE_KEY) === '1') return true;
    } catch { /* SecurityError */ }
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.get(QUERY_KEY) === QUERY_VALUE) return true;
    } catch { /* */ }
    return false;
}

/** Format a TtsHealthEvent as a one-line string. */
export function formatTtsEvent(e: TtsHealthEvent): string {
    const time = new Date(e.timestamp).toLocaleTimeString();
    switch (e.type) {
        case 'tts-attempt':
            return `${time}  ATTEMPT  ${e.tier.padEnd(11)} [${e.lang}] "${e.text.slice(0, 40)}${e.text.length > 40 ? '…' : ''}"`;
        case 'tts-success':
            return `${time}  ✓ OK     ${e.tier.padEnd(11)} latency=${e.latencyMs}ms duration=${e.durationMs}ms`;
        case 'tts-fallback':
            return `${time}  ↪ FALL   ${e.fromTier} → ${e.toTier}  reason="${e.reason}"`;
        case 'tts-give-up':
            return `${time}  ✗ GAVE UP after [${e.triedTiers.join(' → ')}]  reason="${e.reason}"`;
    }
}

export default function TtsDebugOverlay() {
    const [visible, setVisible] = useState(false);
    const [events, setEvents] = useState<TtsHealthEvent[]>([]);

    useEffect(() => {
        setVisible(shouldShowTtsDebug());
    }, []);

    useEffect(() => {
        if (!visible) return;
        const off = subscribeTtsHealth((event) => {
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
                left: 8,
                top: 8,
                width: 460,
                maxHeight: '60vh',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.85)',
                color: '#0ff',
                font: '11px ui-monospace, "SF Mono", Menlo, monospace',
                padding: 8,
                borderRadius: 6,
                zIndex: 99998,
                pointerEvents: 'auto',
            }}
            role="log"
            aria-live="polite"
            aria-label="TTS health debug log"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong>TTS health</strong>
                <button
                    type="button"
                    onClick={() => {
                        try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
                        setVisible(false);
                    }}
                    style={{
                        background: 'transparent',
                        color: '#0ff',
                        border: '1px solid #0ff',
                        borderRadius: 4,
                        padding: '0 6px',
                        cursor: 'pointer',
                    }}
                    aria-label="Close TTS debug overlay"
                >
                    ✕
                </button>
            </div>
            {events.length === 0 ? (
                <div style={{ opacity: 0.5 }}>(no TTS events yet — try Speak)</div>
            ) : (
                events.map((e, i) => (
                    <div key={i} style={{ whiteSpace: 'pre' }}>{formatTtsEvent(e)}</div>
                ))
            )}
        </div>
    );
}
