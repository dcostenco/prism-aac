/**
 * Math Decorations — Phase 2B helpers.
 *
 * Wraps `engine/mathGrid.addDecoration` with the higher-level
 * "open a fraction box / long-division house / etc." operations
 * that places the decoration AND moves the cursor to the natural
 * starting cell for the user's next input.
 *
 * Each helper is pure — takes a state, returns a new state. The
 * keyboard component uses them via the store; tests can call them
 * directly.
 */
import {
  type MathGridState,
  addDecoration,
  setCursor,
  removeDecoration,
} from './mathGrid';

/** Open a 1×N fraction box at the cursor. The fraction-bar decoration
 *  is anchored at (cursor.r, cursor.c) with span `length`. The cursor
 *  is moved INTO the numerator row (which is the same row as the
 *  anchor, by convention). A subsequent Smart-Right Return would drop
 *  the cursor to the denominator row.
 *
 *  By default a 1-cell numerator + 1-cell denominator fraction box is
 *  opened (length=1). Custom lengths supported for multi-digit
 *  fractions. */
export function openFractionBox(s: MathGridState, length = 1): MathGridState {
  let next = addDecoration(s, {
    type: 'fraction-bar',
    anchor: { r: s.cursor.r, c: s.cursor.c },
    length,
  });
  // Cursor stays at numerator (anchor row).
  next = setCursor(next, s.cursor.r, s.cursor.c);
  return next;
}

/** Move cursor from a fraction's numerator to the denominator. Looks
 *  for the active fraction-bar that contains the current cursor and
 *  drops the cursor to (anchor.r + 1, anchor.c). Idempotent if the
 *  cursor isn't inside any fraction. */
export function moveToFractionDenominator(s: MathGridState): MathGridState {
  const frac = s.decorations.find(
    (d) =>
      d.type === 'fraction-bar' &&
      s.cursor.r === d.anchor.r &&
      s.cursor.c >= d.anchor.c &&
      s.cursor.c < d.anchor.c + d.length,
  );
  if (!frac) return s;
  return setCursor(s, frac.anchor.r + 1, frac.anchor.c);
}

/** Open a long-division "house" at the cursor. Anchors the
 *  long-division-bar (top horizontal bar above the dividend) and a
 *  long-division-tick (vertical bar to the left of the dividend). The
 *  user types divisor → quotient digits above the bar; dividend digits
 *  inside; remainder below. Cursor moves to (anchor.r + 1, anchor.c)
 *  to start typing the dividend.
 *
 *  Default `length` = 3 cells of dividend room; caller can override
 *  for longer dividends. */
export function openLongDivisionHouse(s: MathGridState, length = 3): MathGridState {
  let next = addDecoration(s, {
    type: 'long-division-bar',
    anchor: { r: s.cursor.r, c: s.cursor.c },
    length,
  });
  next = addDecoration(next, {
    type: 'long-division-tick',
    anchor: { r: s.cursor.r, c: s.cursor.c },
    length: 1,
  });
  // Drop into dividend row (one below the bar) at the leftmost column.
  next = setCursor(next, s.cursor.r + 1, s.cursor.c);
  return next;
}

/** Add a root bar above the cursor cell, extending `length` cells to
 *  the right. The user has presumably just placed a √ glyph; this
 *  draws the radicand bar. Cursor stays where it is — caller advances
 *  it on the next glyph commit via the normal predictive cursor. */
export function addRootBar(s: MathGridState, length = 3): MathGridState {
  return addDecoration(s, {
    type: 'root-bar',
    anchor: { r: s.cursor.r, c: s.cursor.c },
    length,
  });
}

/** Toggle a summation line under the contiguous filled cells at the
 *  cursor's row. If a summation-line already exists for that row at
 *  the same anchor, it is REMOVED (toggle); otherwise added.
 *
 *  Span is computed by walking left+right from the cursor while cells
 *  are filled. If the cursor is on an empty cell, no line is added. */
export function toggleSummationLine(s: MathGridState): MathGridState {
  // Find leftmost contiguous filled cell on cursor row, walking left.
  let leftCol = s.cursor.c;
  while (s.cells.has(`${s.cursor.r},${leftCol - 1}`)) leftCol -= 1;
  // Find rightmost.
  let rightCol = s.cursor.c;
  while (s.cells.has(`${s.cursor.r},${rightCol + 1}`)) rightCol += 1;
  // No filled cells anywhere on this row containing or adjacent to cursor.
  if (!s.cells.has(`${s.cursor.r},${leftCol}`)) return s;

  const length = rightCol - leftCol + 1;
  // Already-on detection: a summation-line at the same anchor.
  const existing = s.decorations.find(
    (d) =>
      d.type === 'summation-line' &&
      d.anchor.r === s.cursor.r &&
      d.anchor.c === leftCol &&
      d.length === length,
  );
  if (existing) {
    return removeDecoration(s, (d) => d === existing);
  }
  return addDecoration(s, {
    type: 'summation-line',
    anchor: { r: s.cursor.r, c: leftCol },
    length,
  });
}
