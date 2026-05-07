/**
 * Math Grid engine tests — pure logic, no React.
 *
 * The engine is the foundation everything else stands on. Lock these
 * behaviors hard so future predictive-cursor / decoration / lock
 * features can build on a known-stable core.
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyState,
  cellKey,
  parseCellKey,
  setCell,
  clearCell,
  getCell,
  setCursor,
  advanceCursorRight,
  moveCursorBy,
  returnToNextRow,
  backspaceAtCursor,
  commitGlyph,
  setSelection,
  clearSelection,
  isCellInSelection,
  lockSelection,
  unlockSelection,
  panBy,
  zoomTo,
  screenToCell,
  cellToScreen,
  addDecoration,
  removeDecoration,
  serialize,
  deserialize,
  MIN_SCALE,
  MAX_SCALE,
  DEFAULT_CELL_SIZE_PX,
} from '@/engine/mathGrid';

describe('mathGrid: cell key round-trip', () => {
  it('serializes negative + positive coords correctly', () => {
    expect(cellKey(0, 0)).toBe('0,0');
    expect(cellKey(-3, 7)).toBe('-3,7');
    expect(parseCellKey(cellKey(-3, 7))).toEqual({ r: -3, c: 7 });
  });

  it('coerces non-integers to ints', () => {
    expect(cellKey(1.7, 2.9)).toBe('1,2');
  });
});

describe('mathGrid: setCell / clearCell / getCell', () => {
  it('writes a glyph and reads it back', () => {
    const s = setCell(createEmptyState(), 0, 0, '5');
    expect(getCell(s, 0, 0)?.glyph).toBe('5');
  });

  it('overwrites an existing glyph', () => {
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = setCell(s, 0, 0, '7');
    expect(getCell(s, 0, 0)?.glyph).toBe('7');
  });

  it('setCell with empty string clears', () => {
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = setCell(s, 0, 0, '');
    expect(getCell(s, 0, 0)).toBeUndefined();
  });

  it('clearCell removes the cell', () => {
    let s = setCell(createEmptyState(), 1, 2, 'x');
    s = clearCell(s, 1, 2);
    expect(getCell(s, 1, 2)).toBeUndefined();
  });

  it('refuses to write to a locked cell', () => {
    // Lock via selection lock.
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = setSelection(s, { r: 0, c: 0 }, { r: 0, c: 0 });
    s = lockSelection(s);
    const after = setCell(s, 0, 0, '9');
    expect(after).toBe(s);          // identity returned (no-op)
    expect(getCell(after, 0, 0)?.glyph).toBe('5');
  });

  it('storage is sparse (empty cells take no space)', () => {
    const s = setCell(createEmptyState(), 100000, 200000, '!');
    expect(s.cells.size).toBe(1);
  });
});

describe('mathGrid: cursor', () => {
  it('moves to a target', () => {
    const s = setCursor(createEmptyState(), 3, 4);
    expect(s.cursor).toEqual({ r: 3, c: 4 });
  });

  it('advances right one cell', () => {
    const s = advanceCursorRight(createEmptyState());
    expect(s.cursor).toEqual({ r: 0, c: 1 });
  });

  it('moveCursorBy honors deltas', () => {
    const s = moveCursorBy(setCursor(createEmptyState(), 5, 5), -2, 3);
    expect(s.cursor).toEqual({ r: 3, c: 8 });
  });

  it('returnToNextRow drops cursor down + back to a column', () => {
    const s = returnToNextRow(setCursor(createEmptyState(), 0, 5), 0);
    expect(s.cursor).toEqual({ r: 1, c: 0 });
  });
});

describe('mathGrid: commitGlyph (write + advance combined)', () => {
  it('writes a digit and advances', () => {
    const s = commitGlyph(createEmptyState(), '7');
    expect(getCell(s, 0, 0)?.glyph).toBe('7');
    expect(s.cursor).toEqual({ r: 0, c: 1 });
  });

  it('refuses to write into a locked cell AND does not advance', () => {
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = setSelection(s, { r: 0, c: 0 }, { r: 0, c: 0 });
    s = lockSelection(s);
    const after = commitGlyph(s, '9');
    expect(getCell(after, 0, 0)?.glyph).toBe('5');
    expect(after.cursor).toEqual({ r: 0, c: 0 });
  });
});

describe('mathGrid: backspace', () => {
  it('clears the cell at cursor when filled', () => {
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = backspaceAtCursor(s);
    expect(getCell(s, 0, 0)).toBeUndefined();
  });

  it('on empty cell, moves cursor left and clears that cell', () => {
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = setCursor(s, 0, 1);
    s = backspaceAtCursor(s);
    expect(getCell(s, 0, 0)).toBeUndefined();
    expect(s.cursor).toEqual({ r: 0, c: 0 });
  });

  it('refuses to delete a locked cell', () => {
    let s = setCell(createEmptyState(), 0, 0, '5');
    s = setSelection(s, { r: 0, c: 0 }, { r: 0, c: 0 });
    s = lockSelection(s);
    const after = backspaceAtCursor(s);
    expect(getCell(after, 0, 0)?.glyph).toBe('5');
  });
});

describe('mathGrid: selection + lock', () => {
  it('normalizes from/to so from is top-left', () => {
    const s = setSelection(createEmptyState(), { r: 5, c: 7 }, { r: 1, c: 2 });
    expect(s.selection).toEqual({ from: { r: 1, c: 2 }, to: { r: 5, c: 7 } });
  });

  it('isCellInSelection reads inclusive bounds', () => {
    const s = setSelection(createEmptyState(), { r: 0, c: 0 }, { r: 2, c: 2 });
    expect(isCellInSelection(s.selection, 0, 0)).toBe(true);
    expect(isCellInSelection(s.selection, 2, 2)).toBe(true);
    expect(isCellInSelection(s.selection, 1, 1)).toBe(true);
    expect(isCellInSelection(s.selection, 3, 0)).toBe(false);
    expect(isCellInSelection(s.selection, -1, 0)).toBe(false);
    expect(isCellInSelection(null, 0, 0)).toBe(false);
  });

  it('clearSelection removes the selection', () => {
    const s = clearSelection(setSelection(createEmptyState(), { r: 0, c: 0 }, { r: 1, c: 1 }));
    expect(s.selection).toBeNull();
  });

  it('lockSelection marks every cell in the rectangle as locked', () => {
    let s = createEmptyState();
    s = setCell(s, 0, 0, 'a');
    s = setCell(s, 0, 1, 'b');
    s = setCell(s, 1, 0, 'c');
    s = setCell(s, 1, 1, 'd');
    s = setCell(s, 2, 2, 'e');                              // outside selection
    s = setSelection(s, { r: 0, c: 0 }, { r: 1, c: 1 });
    s = lockSelection(s);
    expect(getCell(s, 0, 0)?.locked).toBe(true);
    expect(getCell(s, 0, 1)?.locked).toBe(true);
    expect(getCell(s, 1, 0)?.locked).toBe(true);
    expect(getCell(s, 1, 1)?.locked).toBe(true);
    expect(getCell(s, 2, 2)?.locked).toBeFalsy();          // outside, untouched
  });

  it('unlockSelection inverse-undoes lock', () => {
    let s = setCell(createEmptyState(), 0, 0, 'x');
    s = setSelection(s, { r: 0, c: 0 }, { r: 0, c: 0 });
    s = lockSelection(s);
    expect(getCell(s, 0, 0)?.locked).toBe(true);
    s = unlockSelection(s);
    expect(getCell(s, 0, 0)?.locked).toBe(false);
  });
});

describe('mathGrid: viewport (pan + zoom)', () => {
  it('panBy accumulates deltas', () => {
    let s = panBy(createEmptyState(), 10, 20);
    s = panBy(s, -3, 5);
    expect(s.viewport.panX).toBe(7);
    expect(s.viewport.panY).toBe(25);
  });

  it('zoomTo clamps to MIN_SCALE..MAX_SCALE', () => {
    expect(zoomTo(createEmptyState(), 0).viewport.scale).toBe(MIN_SCALE);
    expect(zoomTo(createEmptyState(), 99).viewport.scale).toBe(MAX_SCALE);
    expect(zoomTo(createEmptyState(), 1.5).viewport.scale).toBe(1.5);
  });

  it('screenToCell + cellToScreen are inverses at scale=1, pan=0', () => {
    const s = createEmptyState();
    const p = cellToScreen(s.viewport, 3, 4);
    expect(p.x).toBe(4 * DEFAULT_CELL_SIZE_PX);
    expect(p.y).toBe(3 * DEFAULT_CELL_SIZE_PX);
    const back = screenToCell(s.viewport, p.x, p.y);
    expect(back).toEqual({ r: 3, c: 4 });
  });

  it('screenToCell honors pan offset', () => {
    let s = panBy(createEmptyState(), 100, 50);
    // Tap at screen (100, 50) — that's cell (0,0) after offset.
    expect(screenToCell(s.viewport, 100, 50)).toEqual({ r: 0, c: 0 });
  });

  it('screenToCell honors scale (zoom)', () => {
    let s = zoomTo(createEmptyState(), 2);
    // At scale 2, cell size becomes 2× so cell (0,0) covers (0..2*size).
    const p = cellToScreen(s.viewport, 1, 1);
    expect(p.size).toBe(DEFAULT_CELL_SIZE_PX * 2);
    expect(screenToCell(s.viewport, p.x, p.y)).toEqual({ r: 1, c: 1 });
  });
});

describe('mathGrid: decorations', () => {
  it('addDecoration appends', () => {
    const s = addDecoration(createEmptyState(), {
      type: 'fraction-bar', anchor: { r: 0, c: 0 }, length: 3,
    });
    expect(s.decorations).toHaveLength(1);
    expect(s.decorations[0].type).toBe('fraction-bar');
  });

  it('removeDecoration filters by predicate', () => {
    let s = createEmptyState();
    s = addDecoration(s, { type: 'fraction-bar', anchor: { r: 0, c: 0 }, length: 3 });
    s = addDecoration(s, { type: 'root-bar', anchor: { r: 0, c: 5 }, length: 2 });
    s = removeDecoration(s, (d) => d.type === 'fraction-bar');
    expect(s.decorations).toHaveLength(1);
    expect(s.decorations[0].type).toBe('root-bar');
  });
});

describe('mathGrid: serialize round-trip', () => {
  it('preserves cells, cursor, decorations, viewport (selection is dropped on purpose)', () => {
    let s = createEmptyState();
    s = commitGlyph(s, '5');
    s = commitGlyph(s, '+');
    s = commitGlyph(s, '7');
    s = addDecoration(s, { type: 'summation-line', anchor: { r: 0, c: 0 }, length: 3 });
    s = setSelection(s, { r: 0, c: 0 }, { r: 0, c: 2 });
    s = panBy(s, 25, -10);
    s = zoomTo(s, 1.5);

    const round = deserialize(serialize(s));
    expect(round.cells.get('0,0')?.glyph).toBe('5');
    expect(round.cells.get('0,1')?.glyph).toBe('+');
    expect(round.cells.get('0,2')?.glyph).toBe('7');
    expect(round.cursor).toEqual({ r: 0, c: 3 });
    expect(round.decorations).toEqual(s.decorations);
    expect(round.viewport).toEqual(s.viewport);
    expect(round.selection).toBeNull();
  });
});
