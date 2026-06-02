'use client';

import { useMemo } from 'react';
import InsightCard from './InsightCard';
import { useMetricsStore, type MetricsBucket } from '@/store/metricsStore';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function bucketsInRange(buckets: MetricsBucket[], hoursBack: number): MetricsBucket[] {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    return buckets.filter(b => b.ts >= cutoff);
}

function safeRate(num: number, den: number): number {
    return den > 0 ? num / den : 0;
}

function trend(recent: number, prior: number): 'up' | 'down' | 'flat' {
    const diff = recent - prior;
    if (Math.abs(diff) < 0.02) return 'flat';
    return diff > 0 ? 'up' : 'down';
}

function pct(v: number): string {
    return `${Math.round(v * 100)}%`;
}

export default function CaregiverInsightsTab() {
    const buckets = useMetricsStore(s => s.buckets);

    const last24h = useMemo(() => bucketsInRange(buckets, 24), [buckets]);
    const last48h = useMemo(() => bucketsInRange(buckets, 48), [buckets]);
    const prior24h = useMemo(() => {
        const cutoff48 = Date.now() - 48 * 60 * 60 * 1000;
        const cutoff24 = Date.now() - 24 * 60 * 60 * 1000;
        return buckets.filter(b => b.ts >= cutoff48 && b.ts < cutoff24);
    }, [buckets]);

    // ── Widget 1: Prediction Effectiveness ───────────────────────────
    const predData = useMemo(() => last24h.map(b =>
        safeRate(b.prediction.hits, b.prediction.hits + b.prediction.misses)
    ), [last24h]);
    const predHits24 = last24h.reduce((s, b) => s + b.prediction.hits, 0);
    const predTotal24 = last24h.reduce((s, b) => s + b.prediction.hits + b.prediction.misses, 0);
    const predRate24 = safeRate(predHits24, predTotal24);
    const predHitsPrior = prior24h.reduce((s, b) => s + b.prediction.hits, 0);
    const predTotalPrior = prior24h.reduce((s, b) => s + b.prediction.hits + b.prediction.misses, 0);
    const predRatePrior = safeRate(predHitsPrior, predTotalPrior);

    // ── Widget 2: Vocabulary Adoption ────────────────────────────────
    const vocabData = useMemo(() => last24h.map(b => b.vocabulary.activePhrases), [last24h]);
    const latestVocab = last24h.length > 0 ? last24h[last24h.length - 1].vocabulary : null;

    // ── Widget 3: Communication Topics ───────────────────────────────
    const latestTopics = useMemo(() => {
        if (last24h.length === 0) return [];
        const latest = last24h[last24h.length - 1].topics;
        return Object.entries(latest)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [last24h]);
    const topicData = useMemo(() => {
        if (latestTopics.length === 0) return [];
        const topCat = latestTopics[0]?.[0];
        if (!topCat) return [];
        return last24h.map(b => b.topics[topCat] || 0);
    }, [last24h, latestTopics]);

    // ── Widget 4: Motor Trend ────────────────────────────────────────
    const dwellData = useMemo(() => last24h.map(b => b.motor.dwellMs).filter(v => v > 0), [last24h]);
    const speedData = useMemo(() => last24h.map(b => b.motor.moveSpeed).filter(v => v > 0), [last24h]);
    const latestDwell = dwellData.length > 0 ? dwellData[dwellData.length - 1] : 0;
    const priorDwell = useMemo(() => {
        const d = prior24h.map(b => b.motor.dwellMs).filter(v => v > 0);
        return d.length > 0 ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    }, [prior24h]);

    // ── Widget 5: Tracking Reliability ───────────────────────────────
    const trackingData = useMemo(() => last24h.map(b => b.tracking.driftEvents), [last24h]);
    const driftCount24 = last24h.reduce((s, b) => s + b.tracking.driftEvents, 0);
    const totalBuckets24 = last24h.length;
    const trackingUptime = totalBuckets24 > 0
        ? safeRate(totalBuckets24 - last24h.filter(b => b.tracking.driftEvents > 0).length, totalBuckets24)
        : 0;

    // ── Widget 6: Voice Reliability ──────────────────────────────────
    const ttsData = useMemo(() => last24h.map(b =>
        safeRate(b.tts.successes, b.tts.attempts)
    ), [last24h]);
    const ttsAttempts24 = last24h.reduce((s, b) => s + b.tts.attempts, 0);
    const ttsSuccesses24 = last24h.reduce((s, b) => s + b.tts.successes, 0);
    const ttsFallbacks24 = last24h.reduce((s, b) => s + b.tts.fallbacks, 0);
    const ttsRate24 = safeRate(ttsSuccesses24, ttsAttempts24);

    // ── Widget 7: Correction Burden ──────────────────────────────────
    const correctionData = useMemo(() => last24h.map(b => b.corrections.total), [last24h]);
    const latestCorrections = last24h.length > 0 ? last24h[last24h.length - 1].corrections.total : 0;
    const priorCorrections = prior24h.length > 0 ? prior24h[prior24h.length - 1]?.corrections.total ?? 0 : 0;

    return (
        <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
        }}>
            <InsightCard
                title="Prediction Effectiveness"
                value={predTotal24 > 0 ? `${pct(predRate24)} hit rate` : 'No predictions yet'}
                trend={predTotal24 > 0 && predTotalPrior > 0 ? trend(predRate24, predRatePrior) : undefined}
                trendLabel="vs prior 24h"
                sparklineData={predData}
                color={predRate24 > 0.6 ? '#4CAF50' : predRate24 > 0.4 ? '#FF9800' : '#f44336'}
            />

            <InsightCard
                title="Vocabulary Adoption"
                value={latestVocab
                    ? `${latestVocab.activePhrases} active · ${latestVocab.newPhrases} new · ${latestVocab.total} total`
                    : 'No data'}
                sparklineData={vocabData}
                color="#2196F3"
                emptyMessage="Phrase usage data will appear after first session"
            />

            <InsightCard
                title="Communication Topics"
                value={latestTopics.length > 0
                    ? latestTopics.slice(0, 3).map(([cat, count]) => `${cat} (${count})`).join(', ')
                    : 'No topics yet'}
                sparklineData={topicData}
                color="#9C27B0"
                emptyMessage="Topic data builds as the user communicates"
            />

            <InsightCard
                title="Motor Trend"
                value={latestDwell > 0 ? `Dwell ${Math.round(latestDwell)}ms` : 'No motor data'}
                trend={latestDwell > 0 && priorDwell > 0
                    ? trend(priorDwell, latestDwell) // lower dwell = improvement → show as 'up'
                    : undefined}
                trendLabel={latestDwell < priorDwell ? 'improving' : latestDwell > priorDwell ? 'declining' : ''}
                sparklineData={dwellData}
                color="#FF9800"
                emptyMessage="Enable head tracking to see motor trends"
            />

            <InsightCard
                title="Tracking Reliability"
                value={totalBuckets24 > 0
                    ? `${driftCount24} drift${driftCount24 !== 1 ? 's' : ''} · ${pct(trackingUptime)} uptime`
                    : 'No tracking data'}
                sparklineData={trackingData}
                color={trackingUptime > 0.95 ? '#4CAF50' : '#f44336'}
                emptyMessage="Head tracking not active"
            />

            <InsightCard
                title="Voice Reliability"
                value={ttsAttempts24 > 0
                    ? `${pct(ttsRate24)} success · ${ttsFallbacks24} fallback${ttsFallbacks24 !== 1 ? 's' : ''}`
                    : 'No voice data'}
                sparklineData={ttsData}
                color={ttsRate24 > 0.95 ? '#4CAF50' : ttsRate24 > 0.8 ? '#FF9800' : '#f44336'}
                emptyMessage="Voice data appears after first spoken phrase"
            />

            <InsightCard
                title="Correction Burden"
                value={latestCorrections > 0
                    ? `${latestCorrections} total corrections`
                    : 'No corrections yet'}
                trend={latestCorrections > 0 && priorCorrections > 0
                    ? trend(latestCorrections, priorCorrections)
                    : undefined}
                trendLabel={latestCorrections > priorCorrections ? 'increasing' : 'decreasing'}
                sparklineData={correctionData}
                color="#795548"
                emptyMessage="Corrections appear when caregiver adds notes"
            />

            <div style={{ fontSize: 10, opacity: 0.3, textAlign: 'center', padding: '4px 0' }}>
                {buckets.length} data points · last 7 days · updates every 5 min
            </div>
        </div>
    );
}
