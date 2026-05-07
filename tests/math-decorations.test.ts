/**
 * Math Decoration helpers — Phase 2B.
 *
 * Each helper is the bridge between "user tapped a high-level button"
 * (e.g., Open Fraction Box) and the cell-grid + decorations state
 * mutations that follow. Tests pin the cursor placement, the
 * decoration anchor, and the toggle semantics for summation lines.
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyState,
  setCursor,
  setCell,
  commitGlyph,
} from '@/engine/mathGrid';
import {
  openFractionBox,
  moveToFractionDenominator,
  openLongDivisionHouse,
  addRootBar,
  toggleSummationLine,
} from '@/engine/decorations';

describe('decorations: openFractionBox', () => {
  it('adds a fraction-bar decoration anchored at the cursor', () => {
    const s = openFractionBox(setCursor(createEmptyState(), 2, 5));
    expect(s.decorations).toHaveLength(1);
    expect(s.decorations[0]).toEqual({ type: 'fraction-bar', anchor: { r: 2, c: 5 }, length: 1 });
    expect(s.cursor).toEqual({ r: 2, c: 5 });            // numerator row, same column
  });

  it('honors a custom length for multi-digit fractions', () => {
    const s = openFractionBox(setCursor(createEmptyState(), 0, 0), 3);
    expect(s.decorations[0].length).toBe(3);
  });
});

describe('decorations: moveToFractionDenominator', () => {
  it('drops the cursor from numerator to denominator within a fraction', () => {
    let s = openFractionBox(setCursor(createEmptyState(), 4, 7), 2);
    s = setCursor(s, 4, 8);                                // somewhere in numerator
    s = moveToFractionDenominator(s);
    expect(s.cursor).toEqual({ r: 5, c: 7 });              // anchor.r + 1, anchor.c
  });

  it('is a no-op when the cursor is not inside any fraction', () => {
    const s = setCursor(createEmptyState(), 0, 0);
    expect(moveToFractionDenominator(s)).toBe(s);
  });
});

describe('decorations: openLongDivisionHouse', () => {
  it('adds the bar + tick decorations and drops cursor into dividend row', () => {
    const s = openLongDivisionHouse(setCursor(createEmptyState(), 1, 2), 4);
    expect(s.decorations).toHaveLength(2);
    expect(s.decorations.find((d) => d.type === 'long-division-bar')).toBeDefined();
    expect(s.decorations.find((d) => d.type === 'long-division-tick')).toBeDefined();
    expect(s.cursor).toEqual({ r: 2, c: 2 });              // anchor.r + 1, anchor.c
  });

  it('default length is 3', () => {
    const s = openLongDivisionHouse(setCursor(createEmptyState(), 0, 0));
    const bar = s.decorations.find((d) => d.type === 'long-division-bar');
    expect(bar?.length).toBe(3);
  });
});

describe('decorations: addRootBar', () => {
  it('adds a root-bar decoration anchored at cursor', () => {
    const s = addRootBar(setCursor(createEmptyState(), 0, 5), 4);
    expect(s.decorations).toHaveLength(1);
    expect(s.decorations[0]).toEqual({ type: 'root-bar', anchor: { r: 0, c: 5 }, length: 4 });
  });

  it('cursor is unchanged — caller advances on next glyph commit', () => {
    const before = setCursor(createEmptyState(), 0, 5);
    const after = addRootBar(before, 3);
    expect(after.cursor).toEqual(before.cursor);
  });
});

describe('decorations: toggleSummationLine', () => {
  it('adds a summation line covering the contiguous filled span on cursor row', () => {
    let s = createEmptyState();
    s = commitGlyph(s, '4');                                // (0,0), cursor (0,1)
    s = commitGlyph(s, '5');                                // (0,1), cursor (0,2)
    s = commitGlyph(s, '6');                                // (0,2), cursor (0,3)
    s = setCursor(s, 0, 1);                                 // cursor inside the contiguous span
    s = toggleSummationLine(s);
    expect(s.decorations).toHaveLength(1);
    expect(s.decorations[0]).toEqual({ type: 'summation-line', anchor: { r: 0, c: 0 }, length: 3 });
  });

  it('toggling twice removes the existing line at the same anchor', () => {
    let s = createEmptyState();
    s = commitGlyph(s, '4');
    s = commitGlyph(s, '5');
    s = setCursor(s, 0, 0);
    s = toggleSummationLine(s);
    expect(s.decorations).toHaveLength(1);
    s = toggleSummationLine(s);
    expect(s.decorations).toHaveLength(0);
  });

  it('does nothing on an empty row', () => {
    const s = setCursor(createEmptyState(), 5, 5);
    expect(toggleSummationLine(s)).toBe(s);
  });

  it('finds leftmost-contiguous when there are gaps', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 0, 'a');
    s = setCell(s, 0, 1, 'b');                              // a-b contiguous from 0
    s = setCell(s, 0, 4, 'c');                              // gap, then c at 4
    s = setCursor(s, 0, 4);
    s = toggleSummationLine(s);
    expect(s.decorations[0]).toEqual({ type: 'summation-line', anchor: { r: 0, c: 4 }, length: 1 });
  });
});
