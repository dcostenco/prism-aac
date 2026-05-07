/**
 * Predictive Cursor — Phase 1C.
 *
 * Locks the column-arithmetic alignment helpers and the
 * inferContext() rules engine. Future phases (decorations,
 * fraction/long-div cursor) extend these — keep these green so we
 * always have a known-good baseline.
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyState,
  commitGlyph,
  setCursor,
  setCell,
  addDecoration,
} from '@/engine/mathGrid';
import {
  findRowSpan,
  returnSmartLeft,
  returnSmartRight,
  inferContext,
} from '@/engine/predictiveCursor';

describe('predictiveCursor: findRowSpan', () => {
  it('returns null on an empty row', () => {
    expect(findRowSpan(createEmptyState(), 0)).toBeNull();
  });

  it('returns the leftmost + rightmost filled cells on a populated row', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 2, '5');
    s = setCell(s, 0, 5, '8');
    s = setCell(s, 0, 7, '3');
    s = setCell(s, 1, 0, '!');                 // different row, ignored
    expect(findRowSpan(s, 0)).toEqual({ leftCol: 2, rightCol: 7, count: 3 });
    expect(findRowSpan(s, 1)).toEqual({ leftCol: 0, rightCol: 0, count: 1 });
    expect(findRowSpan(s, 2)).toBeNull();
  });

  it('handles a single filled cell', () => {
    const s = setCell(createEmptyState(), 4, -3, 'x');
    expect(findRowSpan(s, 4)).toEqual({ leftCol: -3, rightCol: -3, count: 1 });
  });
});

describe('predictiveCursor: returnSmartLeft', () => {
  it('drops cursor to (r+1, 0) on empty row', () => {
    const s = returnSmartLeft(setCursor(createEmptyState(), 5, 7));
    expect(s.cursor).toEqual({ r: 6, c: 0 });
  });

  it('drops cursor to (r+1, leftmost-filled-col) on a populated row', () => {
    let s = createEmptyState();
    s = commitGlyph(s, '2');                      // (0,0) → cursor (0,1)
    s = commitGlyph(s, '3');                      // (0,1) → cursor (0,2)
    s = setCursor(s, 0, 5);                       // jump cursor right
    const r2 = returnSmartLeft(s);
    expect(r2.cursor, 'aligned to leftmost filled col on row 0 (=0)').toEqual({ r: 1, c: 0 });
  });

  it('aligns to a leftmost-col != 0 when the row is offset', () => {
    let s = createEmptyState();
    s = setCursor(s, 0, 4);
    s = commitGlyph(s, '2');                      // (0,4) filled, cursor (0,5)
    s = commitGlyph(s, '3');                      // (0,5) filled, cursor (0,6)
    const r2 = returnSmartLeft(s);
    expect(r2.cursor, 'leftmost col on row 0 is 4').toEqual({ r: 1, c: 4 });
  });
});

describe('predictiveCursor: returnSmartRight', () => {
  it('drops cursor to (r+1, 0) on empty row', () => {
    const s = returnSmartRight(setCursor(createEmptyState(), 5, 7));
    expect(s.cursor).toEqual({ r: 6, c: 0 });
  });

  it('drops cursor to (r+1, rightmost-filled+1) — i.e., one cell past the last digit', () => {
    let s = createEmptyState();
    s = setCursor(s, 0, 4);
    s = commitGlyph(s, '2');                      // (0,4)
    s = commitGlyph(s, '3');                      // (0,5)
    const r2 = returnSmartRight(s);
    expect(r2.cursor).toEqual({ r: 1, c: 6 });
  });
});

describe('predictiveCursor: inferContext', () => {
  it('returns "default" on an empty grid at (0,0)', () => {
    expect(inferContext(createEmptyState())).toBe('default');
  });

  it('returns "column-add" when cell directly above is +', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 3, '+');
    s = setCursor(s, 1, 3);
    expect(inferContext(s)).toBe('column-add');
  });

  it('returns "column-add" when cell directly above is − (Unicode minus)', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 3, '−');
    s = setCursor(s, 1, 3);
    expect(inferContext(s)).toBe('column-add');
  });

  it('returns "column-add" when cell directly above is ASCII -', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 3, '-');
    s = setCursor(s, 1, 3);
    expect(inferContext(s)).toBe('column-add');
  });

  it('returns "column-mul" when cell directly above is ×', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 3, '×');
    s = setCursor(s, 1, 3);
    expect(inferContext(s)).toBe('column-mul');
  });

  it('returns "long-div" when cursor is below a long-division-bar decoration', () => {
    let s = createEmptyState();
    s = addDecoration(s, { type: 'long-division-bar', anchor: { r: 0, c: 2 }, length: 4 });
    s = setCursor(s, 1, 3);                      // inside the bar's span, below anchor
    expect(inferContext(s)).toBe('long-div');
  });

  it('returns "fraction-num" when cursor is in the numerator row of a fraction-bar', () => {
    let s = createEmptyState();
    s = addDecoration(s, { type: 'fraction-bar', anchor: { r: 5, c: 2 }, length: 3 });
    s = setCursor(s, 5, 3);
    expect(inferContext(s)).toBe('fraction-num');
  });

  it('returns "fraction-den" when cursor is in the denominator row (anchor.r + 1)', () => {
    let s = createEmptyState();
    s = addDecoration(s, { type: 'fraction-bar', anchor: { r: 5, c: 2 }, length: 3 });
    s = setCursor(s, 6, 3);
    expect(inferContext(s)).toBe('fraction-den');
  });

  it('returns "default" outside the decoration span', () => {
    let s = createEmptyState();
    s = addDecoration(s, { type: 'fraction-bar', anchor: { r: 5, c: 2 }, length: 3 });
    s = setCursor(s, 6, 10);                     // outside x range
    expect(inferContext(s)).toBe('default');
  });

  it('decoration rules win over operator-above rules when both apply', () => {
    let s = createEmptyState();
    s = setCell(s, 4, 3, '+');                   // would normally trigger column-add
    s = addDecoration(s, { type: 'long-division-bar', anchor: { r: 4, c: 2 }, length: 4 });
    s = setCursor(s, 5, 3);
    expect(inferContext(s)).toBe('long-div');
  });
});
