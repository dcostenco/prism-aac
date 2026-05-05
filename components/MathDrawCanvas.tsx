'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * MathDrawCanvas — SVG overlay for sketching geometric figures on the
 * math grid. Used in pencil mode (step 3 toggle in MathPanel). Strokes
 * are stored as polylines so they snap cleanly to the grid background
 * underneath.
 *
 * Why SVG and not <canvas>: AAC users with motor impairments need to
 * be able to undo individual strokes. SVG keeps each stroke as a
 * separate <path> element, so undo just pops the last path. Canvas
 * would force us to keep a history buffer + repaint on every undo.
 *
 * Snap-to-grid: when the user lifts their finger, if the stroke is
 * roughly straight (start + end far apart, mid points clustered near
 * the line), we replace it with a single grid-aligned line segment.
 * This handles the common geometry case (drawing a triangle side, a
 * chord, an axis) without forcing a separate "ruler" mode.
 */

const GRID_SIZE = 24; // matches the canvas grid in MathPanel step 1
const SNAP_THRESHOLD = 6; // px deviation that still counts as "straight"

export interface DrawStroke {
    points: { x: number; y: number }[];
    color: string;
}

export interface MathDrawCanvasProps {
    /** Total area to draw within (matches the grid canvas). */
    width: number;
    height: number;
    /** Whether the user is currently in pencil mode. Inactive disables pointer events. */
    enabled: boolean;
    /** Strokes are lifted to the parent so they survive panel re-renders. */
    strokes: DrawStroke[];
    onStrokesChange: (next: DrawStroke[]) => void;
    color?: string;
}

/** @internal — exported for tests only. */
export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
    return Math.round(value / gridSize) * gridSize;
}

/** @internal — exported for tests only. */
export function isStraightLine(points: { x: number; y: number }[]): boolean {
    if (points.length < 4) return true;
    const a = points[0];
    const b = points[points.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < GRID_SIZE) return false;
    // Distance from each midpoint to the line a→b
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i];
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
        const proj = { x: a.x + t * dx, y: a.y + t * dy };
        const off = Math.hypot(p.x - proj.x, p.y - proj.y);
        if (off > SNAP_THRESHOLD) return false;
    }
    return true;
}

function pathFromPoints(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    const head = `M ${points[0].x} ${points[0].y}`;
    const tail = points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
    return `${head} ${tail}`;
}

export default function MathDrawCanvas({ width, height, enabled, strokes, onStrokesChange, color = '#1976D2' }: MathDrawCanvasProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [current, setCurrent] = useState<{ x: number; y: number }[]>([]);
    const drawingRef = useRef(false);

    const localPoint = useCallback((e: React.PointerEvent): { x: number; y: number } => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const rect = svg.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) * width) / rect.width,
            y: ((e.clientY - rect.top) * height) / rect.height,
        };
    }, [width, height]);

    const onPointerDown = (e: React.PointerEvent) => {
        if (!enabled) return;
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drawingRef.current = true;
        setCurrent([localPoint(e)]);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!enabled || !drawingRef.current) return;
        e.preventDefault();
        setCurrent((prev) => [...prev, localPoint(e)]);
    };

    const finishStroke = useCallback(() => {
        drawingRef.current = false;
        setCurrent((prev) => {
            if (prev.length < 2) return [];
            // Snap to grid if the stroke is essentially a straight line.
            const finalPoints = isStraightLine(prev)
                ? [{ x: snapToGrid(prev[0].x), y: snapToGrid(prev[0].y) }, { x: snapToGrid(prev[prev.length - 1].x), y: snapToGrid(prev[prev.length - 1].y) }]
                : prev;
            onStrokesChange([...strokes, { points: finalPoints, color }]);
            return [];
        });
    }, [strokes, onStrokesChange, color]);

    const onPointerUp = (e: React.PointerEvent) => {
        if (!enabled) return;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        finishStroke();
    };

    // Cancel mid-stroke (e.g. multi-touch interrupt) — drop the in-progress points
    useEffect(() => {
        if (!enabled && drawingRef.current) {
            drawingRef.current = false;
            setCurrent([]);
        }
    }, [enabled]);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: enabled ? 'auto' : 'none', touchAction: enabled ? 'none' : 'auto' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden={!enabled}
        >
            {strokes.map((s, i) => (
                <path
                    key={i}
                    d={pathFromPoints(s.points)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            {current.length > 1 && (
                <path
                    d={pathFromPoints(current)}
                    fill="none"
                    stroke={color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.7}
                />
            )}
        </svg>
    );
}
