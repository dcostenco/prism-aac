/**
 * metricsCollector — Background metrics aggregation service.
 *
 * Subscribes to TTS health bus + tracking telemetry, polls adaptive engine
 * and gotcha recorder every 5 minutes, flushes accumulated data into
 * metricsStore buckets.
 *
 * NEVER runs on the AAC keystroke path. Starts lazily via dynamic import
 * in PrismApp.tsx. Returns a disposer for cleanup.
 *
 * Pattern: same as adaptiveEngine.ts — module-scoped state, debounced flush.
 */

import { useMetricsStore } from '@/store/metricsStore';
import { subscribeTtsHealth, type TtsHealthEvent } from '@/services/ttsHealthBus';
import { subscribeTrackingEvents, type TrackingEvent } from '@/services/trackingTelemetry';

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _started = false;
let _tickTimer: ReturnType<typeof setInterval> | null = null;
let _unsubTts: (() => void) | null = null;
let _unsubTracking: (() => void) | null = null;

async function tick() {
    const store = useMetricsStore.getState();

    // Pull motor signals from adaptive engine (lazy import to avoid circular deps)
    let motor = { dwellMs: 0, moveSpeed: 0 };
    try {
        const { getAdaptiveSignals } = await import('@/services/adaptiveEngine');
        const signals = getAdaptiveSignals();
        motor = { dwellMs: signals.dwellMs, moveSpeed: signals.moveSpeed };
    } catch { /* adaptive engine not available */ }

    // Pull correction count from gotcha recorder
    let corrections = { total: 0 };
    try {
        const { corpusHealth } = await import('@/services/aacGotchaRecorder');
        const health = await corpusHealth();
        corrections = { total: health.total };
    } catch { /* recorder not available */ }

    // Pull vocabulary stats from phrase usage store
    let vocabulary = { newPhrases: 0, activePhrases: 0, total: 0 };
    try {
        const { usePhraseUsageStore } = await import('@/store/phraseUsageStore');
        const usage = usePhraseUsageStore.getState().usage;
        const ids = Object.keys(usage);
        const now = Math.floor(Date.now() / 1000);
        const oneWeekSec = 7 * 24 * 60 * 60;
        let active = 0;
        let newCount = 0;
        for (const id of ids) {
            const ts = usage[id]?.timestamps;
            if (!ts || ts.length === 0) continue;
            const last = ts[ts.length - 1];
            if (now - last < oneWeekSec) active++;
            if (ts.length === 1 && now - last < oneWeekSec) newCount++;
        }
        vocabulary = { newPhrases: newCount, activePhrases: active, total: ids.length };
    } catch { /* usage store not available */ }

    // Pull topic distribution from adaptive engine profile
    let topics: Record<string, number> = {};
    try {
        const { loadProfile } = await import('@/services/adaptiveEngine');
        const profile = loadProfile();
        if (profile.categories) {
            for (const [cat, stat] of Object.entries(profile.categories)) {
                topics[cat] = (stat as { count: number }).count || 0;
            }
        }
    } catch { /* profile not available */ }

    store.flushBucket(motor, corrections, vocabulary, topics);
    store.trimOldBuckets();
}

function onTtsEvent(event: TtsHealthEvent) {
    const store = useMetricsStore.getState();
    switch (event.type) {
        case 'tts-attempt': store.recordTtsEvent('attempt'); break;
        case 'tts-success': store.recordTtsEvent('success'); break;
        case 'tts-fallback': store.recordTtsEvent('fallback'); break;
        case 'tts-give-up': store.recordTtsEvent('give-up'); break;
    }
}

function onTrackingEvent(event: TrackingEvent) {
    const store = useMetricsStore.getState();
    if (event.type === 'drift') {
        store.recordTrackingEvent('drift');
    } else if (event.type === 'recalibration-applied') {
        store.recordTrackingEvent('recovery');
    } else if (event.type === 'ego-motion-suppress') {
        // Not a drift event — skip
    }
}

function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        tick().catch(() => {});
    }
}

/**
 * Start the background metrics collector.
 * Returns a cleanup function to stop collection and unsubscribe from all buses.
 *
 * Safe to call multiple times — subsequent calls return the same disposer.
 */
export function startMetricsCollector(): () => void {
    if (_started) return stopMetricsCollector;

    _started = true;
    _unsubTts = subscribeTtsHealth(onTtsEvent);
    _unsubTracking = subscribeTrackingEvents(onTrackingEvent);
    _tickTimer = setInterval(() => { tick().catch(() => {}); }, FLUSH_INTERVAL_MS);

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return stopMetricsCollector;
}

function stopMetricsCollector(): void {
    _started = false;
    if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }
    if (_unsubTts) { _unsubTts(); _unsubTts = null; }
    if (_unsubTracking) { _unsubTracking(); _unsubTracking = null; }
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }
}
