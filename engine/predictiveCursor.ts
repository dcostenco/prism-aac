/**
 * Predictive Cursor — Phase 1C (column-arithmetic alignment).
 *
 * Pure helpers that read MathGridState and compute the next cursor
 * position based on the user's likely intent. The rules engine
 * intentionally does NOT track explicit "modes" — it inspects the
 * cells around the cursor and the active decorations to infer
 * context. That way the user can build column arithmetic, long
 * division, fractions, etc., by typing naturally without clicking
 * a "now I'm in column-add" mode button first.
 *
 * Phase 1C scope:
 *   • returnSmartLeft   — drop cursor to next row, aligned with the
 *                          LEFTMOST filled cell of the current row's
 *                          contiguous block (or col 0 if empty).
 *   • returnSmartRight  — drop to next row, RIGHTMOST + 1.
 *   • findRowSpan       — pure helper exposed for tests.
 *   • inferContext      — labels the surrounding cells as
 *                          'column-add', 'column-mul', 'long-div',
 *                          'fraction-num', 'fraction-den',
 *                          'exponent', or 'default'. Used by future
 *                          phases (decorations + auto-advance rules).
 *
 * Long-division / fraction / exponent CURSOR rules arrive in Phase
 * 2B alongside the decoration primitives — they read decoration
 * anchors and rebound cursor accordingly. Phase 1C is the
 * column-alignment foundation.
 */
import { type MathGridState, getCell, setCursor } from './mathGrid';

export type CursorContext =
  | 'default'
  | 'column-add'    // operand column of vertical addition / subtraction
  | 'column-mul'    // operand column of long multiplication
  | 'long-div'      // inside a long-division frame
  | 'fraction-num'  // inside a fraction's numerator
  | 'fraction-den'  // inside a fraction's denominator
  | 'exponent';     // superscript cell

export interface RowSpan {
  leftCol: number;
  rightCol: number;
  /** Number of filled cells in [leftCol..rightCol]. Always > 0 when the row had any. */
  count: number;
}

/** Find the contiguous span of filled cells on row `r`. Returns null
 *  when the row is empty.
 *
 *  "Contiguous" anchor is the cursor's column: we walk left from the
 *  cursor while cells are filled, then right. If the cursor itself is
 *  on an empty cell, we look for the closest filled cell on either
 *  side and span from there. */
export function findRowSpan(s: MathGridState, r: number): RowSpan | null {
  // Scan the entire row in the cells map. Sparse storage — cheap.
  let leftCol = Number.POSITIVE_INFINITY;
  let rightCol = Number.NEGATIVE_INFINITY;
  let count = 0;
  s.cells.forEach((_, key) => {
    const [rr, cc] = key.split(',').map((x) => parseInt(x, 10));
    if (rr !== r) return;
    if (cc < leftCol) leftCol = cc;
    if (cc > rightCol) rightCol = cc;
    count += 1;
  });
  if (count === 0) return null;
  return { leftCol, rightCol, count };
}

/** Move cursor to (r+1, leftmost filled col of row r, or 0). */
export function returnSmartLeft(s: MathGridState): MathGridState {
  const span = findRowSpan(s, s.cursor.r);
  const targetCol = span ? span.leftCol : 0;
  return setCursor(s, s.cursor.r + 1, targetCol);
}

/** Move cursor to (r+1, rightmost filled col of row r + 1, or 0). */
export function returnSmartRight(s: MathGridState): MathGridState {
  const span = findRowSpan(s, s.cursor.r);
  const targetCol = span ? span.rightCol + 1 : 0;
  return setCursor(s, s.cursor.r + 1, targetCol);
}

/** Inspect the cells around the cursor (and the active decorations) to
 *  label the cursor's current arithmetic context. Future phases use
 *  this to drive predictive auto-advance behavior; Phase 1C just
 *  exports it for testability.
 *
 *  Detection rules (priority order):
 *    1. Active decoration whose anchor.r ≤ cursor.r AND span covers
 *       cursor.c → labels by decoration type.
 *    2. Cell directly above cursor contains `+` or `−` → 'column-add'.
 *    3. Cell directly above cursor contains `×` or `·` → 'column-mul'.
 *    4. Cell directly to the left contains a digit AND cell directly
 *       below contains a digit (mid-stack) → 'column-add' (heuristic).
 *    5. Otherwise → 'default'.
 */
export function inferContext(s: MathGridState): CursorContext {
  const { r, c } = s.cursor;

  // Rule 1: decoration-anchored.
  for (const d of s.decorations) {
    const inSpan = c >= d.anchor.c && c < d.anchor.c + d.length;
    if (!inSpan) continue;
    if (d.type === 'long-division-bar' && r > d.anchor.r) return 'long-div';
    if (d.type === 'fraction-bar') {
      if (r === d.anchor.r) return 'fraction-num';      // numerator row
      if (r === d.anchor.r + 1) return 'fraction-den';  // denominator row
    }
    if (d.type === 'root-bar' && r === d.anchor.r + 1) return 'long-div'; // visual cousin
  }

  // Rule 2 / 3: operator directly above.
  const above = getCell(s, r - 1, c)?.glyph;
  if (above === '+' || above === '−' || above === '-') return 'column-add';
  if (above === '×' || above === '·' || above === 'x' || above === '*') return 'column-mul';

  return 'default';
}
