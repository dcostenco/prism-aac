/**
 * ttsHealthBus — unified pub/sub for TTS lifecycle events.
 *
 * Mirrors the pattern of `trackingTelemetry.ts` for the tracking stack.
 * The TTS service has accumulated four fallback layers (Inworld → Azure
 * → Web Speech → Native iOS) without an authoritative state
 * machine. Every recent regression in the chain (`94b2e93`, `c6d56b4`,
 * `f0c18f6`, `9df7875`, `c217473`) traces back to a different layer
 * making assumptions about whose turn it is.
 *
 * This bus does NOT replace the fallback chain. It instruments it:
 * every tier emits attempt / success / fallback / give-up so a debug
 * overlay (and CI canaries) can see exactly which layer fired and why.
 *
 * Listener errors are caught so one bad subscriber can't break the bus.
 *
 * Plan ref: synalux-platform/docs/CUSTOMER_FEEDBACK_ENHANCEMENTS.md § #1.
 */

export type TtsTier = 'inworld' | 'azure' | 'web-speech' | 'native-ios';

export interface TtsAttemptEvent {
    type: 'tts-attempt';
    tier: TtsTier;
    /** First 80 chars of utterance — for debug, NOT logged. */
    text: string;
    /** Resolved language tag (e.g. en-US, ru-RU). */
    lang: string;
    timestamp: number;
}

export interface TtsSuccessEvent {
    type: 'tts-success';
    tier: TtsTier;
    /** Time in ms from attempt → audible audio start. */
    latencyMs: number;
    /** Total utterance duration in ms (end − start). */
    durationMs: number;
    timestamp: number;
}

export interface TtsFallbackEvent {
    type: 'tts-fallback';
    /** Tier that failed. */
    fromTier: TtsTier;
    /** Tier we're trying next. */
    toTier: TtsTier;
    /** Short reason — "401 unauthorized", "voice not in catalog", "audio context suspended". */
    reason: string;
    timestamp: number;
}

export interface TtsGiveUpEvent {
    type: 'tts-give-up';
    /** Last tier we tried before giving up. */
    lastTier: TtsTier;
    /** Tiers tried in order before giving up. */
    triedTiers: TtsTier[];
    /** Why we stopped (e.g. "all tiers exhausted", "user navigated away"). */
    reason: string;
    timestamp: number;
}

export type TtsHealthEvent =
    | TtsAttemptEvent
    | TtsSuccessEvent
    | TtsFallbackEvent
    | TtsGiveUpEvent;

export type TtsHealthListener = (event: TtsHealthEvent) => void;

/* ── Internal state ────────────────────────────────────────────────── */

const listeners = new Set<TtsHealthListener>();

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Emit an event to all subscribers. Listener errors are swallowed so a
 * single bad consumer (e.g. a debug overlay that throws on render)
 * cannot break the bus or prevent siblings from receiving the event.
 */
export function emitTtsHealthEvent(event: TtsHealthEvent): void {
    // Iterate over a snapshot so a listener that unsubscribes during
    // dispatch doesn't perturb the iteration.
    const snapshot = Array.from(listeners);
    for (const listener of snapshot) {
        try { listener(event); } catch { /* swallow */ }
    }
}

/**
 * Subscribe to all TTS-health events. Returns a disposer; idempotent
 * on second call. Same listener function passed twice is treated as
 * one subscription (Set semantics).
 */
export function subscribeTtsHealth(listener: TtsHealthListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/**
 * Subscribe to events of a specific `type` only — TS narrows the
 * listener parameter to the matching variant.
 */
export function subscribeTtsHealthType<T extends TtsHealthEvent['type']>(
    type: T,
    listener: (event: Extract<TtsHealthEvent, { type: T }>) => void,
): () => void {
    return subscribeTtsHealth((event) => {
        if (event.type === type) {
            listener(event as Extract<TtsHealthEvent, { type: T }>);
        }
    });
}

/* ── Test helpers ──────────────────────────────────────────────────── */

/** Subscriber count — for tests + debug. */
export function _listenerCount(): number {
    return listeners.size;
}

/** Drop all listeners — for tests only. */
export function _resetForTests(): void {
    listeners.clear();
}
