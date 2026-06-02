'use client';

/**
 * Sparkline — Inline SVG mini-chart for caregiver dashboard.
 * Zero dependencies. ~200 bytes per render.
 */

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
}

export default function Sparkline({ data, width = 120, height = 32, color = '#4CAF50' }: SparklineProps) {
    if (data.length < 2) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const pad = 2;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - pad * 2) - pad;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            style={{ display: 'block' }}
        >
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
