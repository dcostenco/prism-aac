/**
 * Math Grid — cell-grid model.
 *
 * Reference design (extracted from third-party math-paper-style apps):
 * every glyph occupies one cell on an unbounded grid. Fractions, long
 * division houses, summation underlines, root bars are DECORATIONS
 * layered on the grid — not LaTeX/typeset expressions.
 *
 * Storage is sparse: only filled cells live in the map. Decorations
 * are addressable by their anchor cell. Cursor + selection are single
 * state values on the store.
 *
 * This file is the PURE engine — no React, no zustand, no DOM. The
 * store wraps these helpers; the React component reads from the store.
 *
 * Naming convention: every cell is keyed `r,c` (row,col) where r and
 * c are signed 32-bit integers. The grid extends infinitely in both
 * directions; (0,0) is the user's first focused cell when a doc is
 * created.
 */

export type CellKey = `${number},${number}`;

export interface Cell {
  /** The glyph rendered in this cell — a single character or short token. */
  glyph: string;
  /** When true, the cell is part of a locked region (rendered green-tinted, ignores key entry). */
  locked?: boolean;
}

export type DecorationType =
  | 'fraction-bar'        // horizontal rule between numerator span and denominator span
  | 'long-division-bar'   // top horizontal bar of a division "house", anchored above the dividend
  | 'long-division-tick'  // vertical bar to the left of a long-division dividend
  | 'root-bar'            // overline above the radicand, extends as digits are added
  | 'summation-line';     // horizontal rule under a contiguous span of filled cells

export interface Decoration {
  type: DecorationType;
  /** The anchor cell. Decoration extents are derived from `length`. */
  anchor: { r: number; c: number };
  /** How many cells the decoration spans horizontally. Always ≥ 1. */
  length: number;
}

export interface Cursor {
  r: number;
  c: number;
}

export interface Selection {
  /** Top-left of the selection rectangle (inclusive). */
  from: { r: number; c: number };
  /** Bottom-right of the selection rectangle (inclusive). */
  to: { r: number; c: number };
}

export interface Viewport {
  /** Cell size in CSS pixels at scale=1. */
  cellSizePx: number;
  /** Multiplier applied to cellSizePx for pinch-zoom. */
  scale: number;
  /** Translation in CSS pixels (NOT cell coords). */
  panX: number;
  panY: number;
}

export interface MathGridState {
  cells: Map<CellKey, Cell>;
  decorations: Decoration[];
  cursor: Cursor;
  selection: Selection | null;
  viewport: Viewport;
}

// ── Defaults ──────────────────────────────────────────────────────

export const DEFAULT_CELL_SIZE_PX = 56;
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3.0;

export function createEmptyState(): MathGridState {
  return {
    cells: new Map(),
    decorations: [],
    cursor: { r: 0, c: 0 },
    selection: null,
    viewport: {
      cellSizePx: DEFAULT_CELL_SIZE_PX,
      scale: 1,
      panX: 0,
      panY: 0,
    },
  };
}

// ── Cell key helpers ──────────────────────────────────────────────

export function cellKey(r: number, c: number): CellKey {
  return `${r | 0},${c | 0}`;
}

export function parseCellKey(k: CellKey): { r: number; c: number } {
  const [r, c] = k.split(',').map((s) => parseInt(s, 10));
  return { r, c };
}

// ── Cell ops (return new state; pure) ─────────────────────────────

export function setCell(s: MathGridState, r: number, c: number, glyph: string): MathGridState {
  if (!glyph) return clearCell(s, r, c);
  const cell = s.cells.get(cellKey(r, c));
  if (cell?.locked) return s;
  const next = new Map(s.cells);
  next.set(cellKey(r, c), { ...cell, glyph });
  return { ...s, cells: next };
}

export function clearCell(s: MathGridState, r: number, c: number): MathGridState {
  const k = cellKey(r, c);
  const cell = s.cells.get(k);
  if (!cell) return s;
  if (cell.locked) return s;
  const next = new Map(s.cells);
  next.delete(k);
  return { ...s, cells: next };
}

export function getCell(s: MathGridState, r: number, c: number): Cell | undefined {
  return s.cells.get(cellKey(r, c));
}

// ── Cursor ops ────────────────────────────────────────────────────

export function setCursor(s: MathGridState, r: number, c: number): MathGridState {
  return { ...s, cursor: { r: r | 0, c: c | 0 } };
}

/** Default predictive-cursor advance: move one cell right after a glyph
 *  is committed. The Phase 1A fallback — Phase 3B replaces this with
 *  the full rules engine (column arithmetic, long-division, etc.). */
export function advanceCursorRight(s: MathGridState): MathGridState {
  return setCursor(s, s.cursor.r, s.cursor.c + 1);
}

export function moveCursorBy(s: MathGridState, dr: number, dc: number): MathGridState {
  return setCursor(s, s.cursor.r + dr, s.cursor.c + dc);
}

/** Move cursor to the leftmost contiguous filled cell on the next row.
 *  Used by Return / new-line in column arithmetic. */
export function returnToNextRow(s: MathGridState, fromCol?: number): MathGridState {
  const startCol = fromCol ?? s.cursor.c;
  // For Phase 1A we just drop the cursor to (cursor.r + 1, startCol).
  // The "find leftmost contiguous" logic moves to Phase 3B.
  return setCursor(s, s.cursor.r + 1, startCol);
}

// ── Backspace ─────────────────────────────────────────────────────

/** Delete the cell at the cursor. If the cell was already empty, move
 *  cursor one cell left and delete that one (matches the real keyboard
 *  feel — backspace eats backwards). */
export function backspaceAtCursor(s: MathGridState): MathGridState {
  const here = getCell(s, s.cursor.r, s.cursor.c);
  if (here && !here.locked) {
    return clearCell(s, s.cursor.r, s.cursor.c);
  }
  if (s.cursor.c <= Number.MIN_SAFE_INTEGER + 1) return s;
  const left = moveCursorBy(s, 0, -1);
  return clearCell(left, left.cursor.r, left.cursor.c);
}

// ── Glyph commit (combines write + advance) ───────────────────────

export function commitGlyph(s: MathGridState, glyph: string): MathGridState {
  const written = setCell(s, s.cursor.r, s.cursor.c, glyph);
  // If the write was rejected (locked cell), don't advance.
  if (written === s) return s;
  return advanceCursorRight(written);
}

// ── Selection ────────────────────────────────────────────────────

export function setSelection(s: MathGridState, from: { r: number; c: number }, to: { r: number; c: number }): MathGridState {
  // Normalize so `from` is top-left and `to` is bottom-right.
  const f = { r: Math.min(from.r, to.r), c: Math.min(from.c, to.c) };
  const t = { r: Math.max(from.r, to.r), c: Math.max(from.c, to.c) };
  return { ...s, selection: { from: f, to: t } };
}

export function clearSelection(s: MathGridState): MathGridState {
  return { ...s, selection: null };
}

export function isCellInSelection(sel: Selection | null, r: number, c: number): boolean {
  if (!sel) return false;
  return r >= sel.from.r && r <= sel.to.r && c >= sel.from.c && c <= sel.to.c;
}

/** Lock every cell in the current selection. Locked cells render green-tinted
 *  and ignore further glyph commits — protects motor-overshoot from
 *  destroying finished work. Mirrors the reference's "Lock Equation" feature. */
export function lockSelection(s: MathGridState): MathGridState {
  if (!s.selection) return s;
  const next = new Map(s.cells);
  for (let r = s.selection.from.r; r <= s.selection.to.r; r++) {
    for (let c = s.selection.from.c; c <= s.selection.to.c; c++) {
      const k = cellKey(r, c);
      const cell = next.get(k);
      if (cell) next.set(k, { ...cell, locked: true });
    }
  }
  return { ...s, cells: next };
}

export function unlockSelection(s: MathGridState): MathGridState {
  if (!s.selection) return s;
  const next = new Map(s.cells);
  for (let r = s.selection.from.r; r <= s.selection.to.r; r++) {
    for (let c = s.selection.from.c; c <= s.selection.to.c; c++) {
      const k = cellKey(r, c);
      const cell = next.get(k);
      if (cell) next.set(k, { ...cell, locked: false });
    }
  }
  return { ...s, cells: next };
}

// ── Viewport (pan + zoom) ─────────────────────────────────────────

export function panBy(s: MathGridState, dx: number, dy: number): MathGridState {
  return { ...s, viewport: { ...s.viewport, panX: s.viewport.panX + dx, panY: s.viewport.panY + dy } };
}

export function zoomTo(s: MathGridState, scale: number): MathGridState {
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  return { ...s, viewport: { ...s.viewport, scale: clamped } };
}

/** Resolve a screen-space (x,y) to its (row, col) cell. The transform is:
 *    cell.x = (screenX - panX) / (cellSizePx * scale)
 *    cell.y = (screenY - panY) / (cellSizePx * scale)
 *  Rows and cols are floor()'d. */
export function screenToCell(v: Viewport, screenX: number, screenY: number): { r: number; c: number } {
  const eff = v.cellSizePx * v.scale;
  const c = Math.floor((screenX - v.panX) / eff);
  const r = Math.floor((screenY - v.panY) / eff);
  return { r, c };
}

export function cellToScreen(v: Viewport, r: number, c: number): { x: number; y: number; size: number } {
  const eff = v.cellSizePx * v.scale;
  return {
    x: c * eff + v.panX,
    y: r * eff + v.panY,
    size: eff,
  };
}

// ── Decorations ───────────────────────────────────────────────────

export function addDecoration(s: MathGridState, d: Decoration): MathGridState {
  return { ...s, decorations: [...s.decorations, d] };
}

export function removeDecoration(s: MathGridState, predicate: (d: Decoration) => boolean): MathGridState {
  return { ...s, decorations: s.decorations.filter((d) => !predicate(d)) };
}

// ── Serialization (round-trips through JSON) ──────────────────────

export interface SerializedMathGrid {
  cells: Array<[CellKey, Cell]>;
  decorations: Decoration[];
  cursor: Cursor;
  viewport: Viewport;
}

export function serialize(s: MathGridState): SerializedMathGrid {
  return {
    cells: Array.from(s.cells.entries()),
    decorations: s.decorations,
    cursor: s.cursor,
    viewport: s.viewport,
  };
}

export function deserialize(raw: SerializedMathGrid): MathGridState {
  return {
    cells: new Map(raw.cells),
    decorations: raw.decorations,
    cursor: raw.cursor,
    selection: null,
    viewport: raw.viewport,
  };
}
