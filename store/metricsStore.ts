/**
 * metricsStore — 7-day rolling time-series for caregiver dashboard.
 *
 * Accumulates operational metrics (prediction hits, TTS success, drift events,
 * motor signals, correction counts) into 5-minute buckets. Read by the
 * CaregiverInsightsTab to render sparklines.
 *
 * No PHI — all values are aggregate counts and averages.
 * Persisted to localStorage. Works offline. ~400KB for 7 days.
 *
 * The metricsCollector service calls flushBucket() every 5 minutes.
 * PredictionBar and MessageBar call recordPredictionHit/Miss via dynamic import.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeJSONStorage } from '@/lib/safeStorage';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MetricsBucket {
    ts: number;
    prediction: { hits: number; misses: number };
    motor: { dwellMs: number; moveSpeed: number };
    tts: { attempts: number; successes: number; fallbacks: number; giveUps: number };
    tracking: { driftEvents: number; avgConfidence: number; probeRecoveries: number };
    corrections: { total: number };
    vocabulary: { newPhrases: number; activePhrases: number; total: number };
    topics: Record<string, number>;
}

interface Accumulators {
    prediction: { hits: number; misses: number };
    tts: { attempts: number; successes: number; fallbacks: number; giveUps: number };
    tracking: { driftEvents: number; confidenceSum: number; confidenceCount: number; probeRecoveries: number };
}

interface MetricsState {
    buckets: MetricsBucket[];
    accum: Accumulators;

    recordPredictionHit: () => void;
    recordPredictionMiss: () => void;
    recordTtsEvent: (type: 'attempt' | 'success' | 'fallback' | 'give-up') => void;
    recordTrackingEvent: (type: 'drift' | 'recovery' | 'confidence', confidence?: number) => void;
    flushBucket: (motor?: { dwellMs: number; moveSpeed: number }, corrections?: { total: number }, vocabulary?: { newPhrases: number; activePhrases: number; total: number }, topics?: Record<string, number>) => void;
    trimOldBuckets: () => void;
    resetAccumulators: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_BUCKETS = 2016; // 7 days × 288 per day (5-min intervals)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'prism-aac-metrics';

function emptyAccumulators(): Accumulators {
    return {
        prediction: { hits: 0, misses: 0 },
        tts: { attempts: 0, successes: 0, fallbacks: 0, giveUps: 0 },
        tracking: { driftEvents: 0, confidenceSum: 0, confidenceCount: 0, probeRecoveries: 0 },
    };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMetricsStore = create<MetricsState>()(
    persist(
        (set, get) => ({
            buckets: [],
            accum: emptyAccumulators(),

            recordPredictionHit: () => set(state => ({
                accum: {
                    ...state.accum,
                    prediction: { ...state.accum.prediction, hits: state.accum.prediction.hits + 1 },
                },
            })),

            recordPredictionMiss: () => set(state => ({
                accum: {
                    ...state.accum,
                    prediction: { ...state.accum.prediction, misses: state.accum.prediction.misses + 1 },
                },
            })),

            recordTtsEvent: (type) => set(state => {
                const tts = { ...state.accum.tts };
                switch (type) {
                    case 'attempt': tts.attempts++; break;
                    case 'success': tts.successes++; break;
                    case 'fallback': tts.fallbacks++; break;
                    case 'give-up': tts.giveUps++; break;
                }
                return { accum: { ...state.accum, tts } };
            }),

            recordTrackingEvent: (type, confidence) => set(state => {
                const tracking = { ...state.accum.tracking };
                switch (type) {
                    case 'drift': tracking.driftEvents++; break;
                    case 'recovery': tracking.probeRecoveries++; break;
                    case 'confidence':
                        if (typeof confidence === 'number' && Number.isFinite(confidence)) {
                            tracking.confidenceSum += confidence;
                            tracking.confidenceCount++;
                        }
                        break;
                }
                return { accum: { ...state.accum, tracking } };
            }),

            flushBucket: (motor, corrections, vocabulary, topics) => {
                const state = get();
                const a = state.accum;
                const now = Date.now();

                const bucket: MetricsBucket = {
                    ts: now - (now % (5 * 60 * 1000)), // round to 5-min boundary
                    prediction: { ...a.prediction },
                    motor: motor ?? { dwellMs: 0, moveSpeed: 0 },
                    tts: { ...a.tts },
                    tracking: {
                        driftEvents: a.tracking.driftEvents,
                        avgConfidence: a.tracking.confidenceCount > 0
                            ? a.tracking.confidenceSum / a.tracking.confidenceCount
                            : 0,
                        probeRecoveries: a.tracking.probeRecoveries,
                    },
                    corrections: corrections ?? { total: 0 },
                    vocabulary: vocabulary ?? { newPhrases: 0, activePhrases: 0, total: 0 },
                    topics: topics ?? {},
                };

                set({
                    buckets: [...state.buckets, bucket],
                    accum: emptyAccumulators(),
                });
            },

            trimOldBuckets: () => set(state => {
                const cutoff = Date.now() - SEVEN_DAYS_MS;
                let buckets = state.buckets.filter(b => b.ts >= cutoff);
                if (buckets.length > MAX_BUCKETS) {
                    buckets = buckets.slice(buckets.length - MAX_BUCKETS);
                }
                return { buckets };
            }),

            resetAccumulators: () => set({ accum: emptyAccumulators() }),
        }),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => safeJSONStorage({
                name: STORAGE_KEY,
                onQuotaExceeded: () => {
                    const state = useMetricsStore.getState();
                    const half = Math.floor(state.buckets.length / 2);
                    useMetricsStore.setState({ buckets: state.buckets.slice(half) });
                },
            })),
            partialize: (state) => ({
                buckets: state.buckets,
            }),
        },
    ),
);
