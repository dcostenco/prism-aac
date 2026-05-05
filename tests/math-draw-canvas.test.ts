import { describe, it, expect } from 'vitest';
import { snapToGrid, isStraightLine } from '@/components/MathDrawCanvas';

describe('snapToGrid — Panther-style grid alignment', () => {
    it('snaps to the nearest 24px grid line by default', () => {
        expect(snapToGrid(0)).toBe(0);
        expect(snapToGrid(11)).toBe(0);
        expect(snapToGrid(12)).toBe(24); // exactly halfway rounds up
        expect(snapToGrid(13)).toBe(24);
        expect(snapToGrid(23)).toBe(24);
        expect(snapToGrid(24)).toBe(24);
        expect(snapToGrid(36)).toBe(48);
    });
    it('honors a custom grid size', () => {
        expect(snapToGrid(15, 10)).toBe(20);
        expect(snapToGrid(14, 10)).toBe(10);
    });
    it('handles negative values (figures drawn off the visible grid)', () => {
        // Math.round(-11/24) = -0 in JS; both 0 and -0 are visually identical
        // on the SVG coordinate plane, so accept either.
        expect(Math.abs(snapToGrid(-11))).toBe(0);
        expect(snapToGrid(-13)).toBe(-24);
    });
});

describe('isStraightLine — snap-only-when-actually-straight heuristic', () => {
    it('returns true for a perfect straight horizontal line', () => {
        const points = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
        expect(isStraightLine(points)).toBe(true);
    });
    it('returns true for a perfect 45° diagonal', () => {
        const points = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: i * 10 }));
        expect(isStraightLine(points)).toBe(true);
    });
    it('returns false for an obvious arc (circle drawing)', () => {
        const points = Array.from({ length: 20 }, (_, i) => {
            const angle = (i / 20) * Math.PI;
            return { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 };
        });
        expect(isStraightLine(points)).toBe(false);
    });
    it('returns true for tiny shake within the 6px tolerance', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 25, y: 1 },
            { x: 50, y: -2 },
            { x: 75, y: 3 },
            { x: 100, y: 0 },
        ];
        expect(isStraightLine(points)).toBe(true);
    });
    it('returns false for a deliberate triangle wobble (>6px)', () => {
        // Need ≥4 points so the function exits the early-return short-stroke
        // branch and actually evaluates each midpoint's distance to the line.
        const points = [
            { x: 0, y: 0 },
            { x: 20, y: 15 },
            { x: 40, y: 30 },
            { x: 60, y: 15 },
            { x: 80, y: 0 },
        ];
        expect(isStraightLine(points)).toBe(false);
    });
    it('returns true for short strokes (no midpoints to test)', () => {
        expect(isStraightLine([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(true);
        expect(isStraightLine([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }])).toBe(true);
    });
    it('returns false for strokes shorter than one grid unit (taps, accidental marks)', () => {
        const tinyPoints = Array.from({ length: 6 }, (_, i) => ({ x: i, y: 0 }));
        expect(isStraightLine(tinyPoints)).toBe(false);
    });
});
