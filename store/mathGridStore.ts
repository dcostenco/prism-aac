/**
 * Math Grid store — zustand wrapper around the pure engine in
 * engine/mathGrid.ts. The store is the single source of truth for
 * cells, cursor, selection, decorations, and viewport. React
 * components subscribe via useMathGridStore selectors; pure helpers
 * stay in the engine so they're trivially unit-testable.
 *
 * The store is NOT persisted by default — math docs are saved
 * explicitly via the (forthcoming) services/mathDocService.
 */
import { create } from 'zustand';
import {
  type MathGridState,
  type Cell,
  type Decoration,
  type Cursor,
  type Selection,
  type Viewport,
  type CellKey,
  createEmptyState,
  setCell as setCellPure,
  clearCell as clearCellPure,
  getCell as getCellPure,
  setCursor as setCursorPure,
  advanceCursorRight as advanceCursorRightPure,
  moveCursorBy as moveCursorByPure,
  returnToNextRow as returnToNextRowPure,
  backspaceAtCursor as backspaceAtCursorPure,
  commitGlyph as commitGlyphPure,
  setSelection as setSelectionPure,
  clearSelection as clearSelectionPure,
  lockSelection as lockSelectionPure,
  unlockSelection as unlockSelectionPure,
  panBy as panByPure,
  zoomTo as zoomToPure,
  addDecoration as addDecorationPure,
  removeDecoration as removeDecorationPure,
  serialize as serializePure,
  deserialize as deserializePure,
  type SerializedMathGrid,
} from '@/engine/mathGrid';
import {
  returnSmartLeft as returnSmartLeftPure,
  returnSmartRight as returnSmartRightPure,
  inferContext,
  type CursorContext,
} from '@/engine/predictiveCursor';
import {
  openFractionBox as openFractionBoxPure,
  moveToFractionDenominator as moveToFractionDenominatorPure,
  openLongDivisionHouse as openLongDivisionHousePure,
  addRootBar as addRootBarPure,
  toggleSummationLine as toggleSummationLinePure,
} from '@/engine/decorations';

/** Identifier of the active keyboard panel inside the math module.
 *  The 9 original keyboards are all in the `'math'` domain (algebra,
 *  arithmetic, units, geometry, money). Phase 6 adds three subject
 *  keyboards that route the AI tutor through different prompt
 *  templates. */
export type MathCategoryId =
  | 'main' | 'letters' | 'adv-math' | 'misc-math'
  | 'time-distance' | 'weight' | 'volume' | 'geom' | 'money'
  | 'chemistry' | 'physics' | 'programming-python' | 'programming-java';

/** Domain group used by the AI tutor. Multiple categories can share
 *  one domain (e.g. all 9 math keyboards → 'math'). */
export type MathDomain = 'math' | 'chemistry' | 'physics' | 'programming-python' | 'programming-java';

export function domainForCategory(cat: MathCategoryId): MathDomain {
  switch (cat) {
    case 'chemistry':           return 'chemistry';
    case 'physics':             return 'physics';
    case 'programming-python':  return 'programming-python';
    case 'programming-java':    return 'programming-java';
    default:                    return 'math';
  }
}

export interface MathGridStore extends MathGridState {
  /** Currently-active keyboard category. Read by MathTutorTool to
   *  pick a domain-specific prompt template. */
  activeMathCategory: MathCategoryId;
  setActiveMathCategory: (id: MathCategoryId) => void;
  // Cell ops
  setCell: (r: number, c: number, glyph: string) => void;
  clearCell: (r: number, c: number) => void;
  getCell: (r: number, c: number) => Cell | undefined;

  // Cursor
  setCursor: (r: number, c: number) => void;
  advanceCursorRight: () => void;
  moveCursorBy: (dr: number, dc: number) => void;
  returnToNextRow: (fromCol?: number) => void;
  /** Drop cursor to next row, aligned with the leftmost filled cell of
   *  the current row. The natural Return for column arithmetic. */
  returnSmartLeft: () => void;
  /** Drop cursor to next row, one cell past the rightmost filled cell. */
  returnSmartRight: () => void;
  /** Read-only context inference: column-add / column-mul / long-div /
   *  fraction-num / fraction-den / exponent / default. Future phases
   *  use this to drive auto-advance behavior. */
  cursorContext: () => CursorContext;

  // Backspace + commit
  backspaceAtCursor: () => void;
  commitGlyph: (glyph: string) => void;

  // Selection + lock
  setSelection: (from: { r: number; c: number }, to: { r: number; c: number }) => void;
  clearSelection: () => void;
  lockSelection: () => void;
  unlockSelection: () => void;

  // Viewport
  panBy: (dx: number, dy: number) => void;
  zoomTo: (scale: number) => void;

  // Decorations
  addDecoration: (d: Decoration) => void;
  removeDecoration: (predicate: (d: Decoration) => boolean) => void;
  // High-level decoration tools (Phase 2B)
  openFractionBox: (length?: number) => void;
  moveToFractionDenominator: () => void;
  openLongDivisionHouse: (length?: number) => void;
  addRootBar: (length?: number) => void;
  toggleSummationLine: () => void;

  // Doc-level
  reset: () => void;
  loadFromSerialized: (raw: SerializedMathGrid) => void;
  toSerialized: () => SerializedMathGrid;
}

export const useMathGridStore = create<MathGridStore>((set, get) => ({
  ...createEmptyState(),
  activeMathCategory: 'main',
  setActiveMathCategory: (id) => set({ activeMathCategory: id }),

  setCell: (r, c, glyph) => set((s) => setCellPure(s, r, c, glyph)),
  clearCell: (r, c) => set((s) => clearCellPure(s, r, c)),
  getCell: (r, c) => getCellPure(get(), r, c),

  setCursor: (r, c) => set((s) => setCursorPure(s, r, c)),
  advanceCursorRight: () => set((s) => advanceCursorRightPure(s)),
  moveCursorBy: (dr, dc) => set((s) => moveCursorByPure(s, dr, dc)),
  returnToNextRow: (fromCol) => set((s) => returnToNextRowPure(s, fromCol)),
  returnSmartLeft: () => set((s) => returnSmartLeftPure(s)),
  returnSmartRight: () => set((s) => returnSmartRightPure(s)),
  cursorContext: () => inferContext(get()),

  backspaceAtCursor: () => set((s) => backspaceAtCursorPure(s)),
  commitGlyph: (glyph) => set((s) => commitGlyphPure(s, glyph)),

  setSelection: (from, to) => set((s) => setSelectionPure(s, from, to)),
  clearSelection: () => set((s) => clearSelectionPure(s)),
  lockSelection: () => set((s) => lockSelectionPure(s)),
  unlockSelection: () => set((s) => unlockSelectionPure(s)),

  panBy: (dx, dy) => set((s) => panByPure(s, dx, dy)),
  zoomTo: (scale) => set((s) => zoomToPure(s, scale)),

  addDecoration: (d) => set((s) => addDecorationPure(s, d)),
  removeDecoration: (predicate) => set((s) => removeDecorationPure(s, predicate)),
  openFractionBox: (length) => set((s) => openFractionBoxPure(s, length)),
  moveToFractionDenominator: () => set((s) => moveToFractionDenominatorPure(s)),
  openLongDivisionHouse: (length) => set((s) => openLongDivisionHousePure(s, length)),
  addRootBar: (length) => set((s) => addRootBarPure(s, length)),
  toggleSummationLine: () => set((s) => toggleSummationLinePure(s)),

  reset: () => set(() => createEmptyState()),
  loadFromSerialized: (raw) => set(() => deserializePure(raw)),
  toSerialized: () => serializePure(get()),
}));

// Re-export types for convenient consumer imports
export type { Cell, Decoration, Cursor, Selection, Viewport, CellKey, MathGridState };
