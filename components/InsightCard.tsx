'use client';

import Sparkline from './Sparkline';

interface InsightCardProps {
    title: string;
    value: string;
    trend?: 'up' | 'down' | 'flat';
    trendLabel?: string;
    sparklineData: number[];
    color?: string;
    emptyMessage?: string;
}

const TREND_ARROWS: Record<string, string> = {
    up: '↑',
    down: '↓',
    flat: '→',
};

const TREND_COLORS: Record<string, string> = {
    up: '#4CAF50',
    down: '#f44336',
    flat: '#9e9e9e',
};

export default function InsightCard({
    title,
    value,
    trend,
    trendLabel,
    sparklineData,
    color = '#4CAF50',
    emptyMessage,
}: InsightCardProps) {
    const hasData = sparklineData.length >= 2;

    return (
        <div style={{
            background: 'var(--card-bg, #1e1e2e)',
            borderRadius: 10,
            padding: '10px 14px',
            border: '1px solid var(--border, #333)',
        }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{title}</div>
            {hasData ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 600 }}>{value}</span>
                        {trend && (
                            <span style={{ fontSize: 12, color: TREND_COLORS[trend] }}>
                                {TREND_ARROWS[trend]} {trendLabel}
                            </span>
                        )}
                    </div>
                    <Sparkline data={sparklineData} color={color} width={140} height={28} />
                </>
            ) : (
                <div style={{ fontSize: 12, opacity: 0.4, padding: '8px 0' }}>
                    {emptyMessage || 'No data yet'}
                </div>
            )}
        </div>
    );
}
