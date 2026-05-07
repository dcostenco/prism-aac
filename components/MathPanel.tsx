'use client';
/**
 * MathPanel — Phase 4 integration.
 *
 * The new math module wired into the AAC shell. Built on top of:
 *   • MathGrid (the cell-grid canvas, Phase 1A)
 *   • MathKeyboardRegion (chip row + 9 keyboards, Phase 2A + 2C)
 *   • MathLockTool (motor-overshoot protection, Phase 3A)
 *   • engine/decorations (fraction box, long-division, root, summation,
 *     Phase 2B) and engine/predictiveCursor (column alignment, Phase 1C)
 *
 * The legacy single-string MathPanel is preserved at MathPanelLegacy.tsx
 * during this transition. To roll back the AAC shell to legacy, swap
 * the import in PrismApp.tsx.
 *
 * AAC integration:
 *   • Done button serializes the cell grid into a "row 0 row 1 ..."
 *     string and appends it to the shared MessageBar via appendText.
 *   • Close button clears the cell grid (next session starts fresh) and
 *     closes the panel.
 *   • TTS / AI tutor are stubs in this phase — Phase 4B fills them in.
 *
 * The cell grid lives in useMathGridStore (zustand, not persisted).
 * Closing the panel clears the store so opening Math next time starts
 * at (0,0) on an empty grid — which matches what AAC users expect from
 * a "calculator-like" surface.
 */
import { useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useMathGridStore } from '@/store/mathGridStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import MathGrid from './math/MathGrid';
import MathKeyboardRegion from './math/MathKeyboardRegion';
import MathLockTool from './math/MathLockTool';
import MathDocsTool from './math/MathDocsTool';
import MathTutorTool from './math/MathTutorTool';
import { parseCellKey } from '@/engine/mathGrid';
import type { Cell, CellKey } from '@/engine/mathGrid';

/** Walk the cell grid and produce a single-line expression string by
 *  joining cells row-by-row with spaces. Multiple rows separated by
 *  " | " so subsequent display can preserve the visual break.
 *
 *  Example: cells {(0,0):'5',(0,1):'+',(0,2):'7'} → "5 + 7".
 *  Multi-row example: row 0 "23", row 1 "+45" → "23 | + 4 5".
 *
 *  Caller is the AAC MessageBar; the AAC user can tap Speak afterwards
 *  to TTS the expression. */
function serializeAsExpression(cells: Map<CellKey, Cell>): string {
  if (cells.size === 0) return '';
  // Group cells by row.
  const byRow: Map<number, Array<{ c: number; glyph: string }>> = new Map();
  cells.forEach((cell, key) => {
    const { r, c } = parseCellKey(key);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push({ c, glyph: cell.glyph });
  });
  const sortedRows = Array.from(byRow.keys()).sort((a, b) => a - b);
  const rowStrings = sortedRows.map((r) => {
    const cells = byRow.get(r)!.sort((a, b) => a.c - b.c);
    return cells.map((x) => x.glyph).join(' ');
  });
  return rowStrings.join(' | ');
}

export default function MathPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { appendText } = useMessageStore();
  const cells = useMathGridStore((s) => s.cells);
  const reset = useMathGridStore((s) => s.reset);
  const { t } = useT();

  const handleDone = useCallback(() => {
    tapFeedback();
    const expr = serializeAsExpression(cells);
    if (expr) appendText(expr);
    reset();
    closeSidePanel();
  }, [cells, appendText, reset, closeSidePanel]);

  const handleClose = useCallback(() => {
    tapFeedback();
    reset();
    closeSidePanel();
  }, [reset, closeSidePanel]);

  if (sidePanel !== 'math') return null;

  return (
    <section
      aria-label={t('math')}
      data-testid="math-panel"
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      <header className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0 gap-3">
        <span className="text-primary font-bold text-xl">{t('math')}</span>
        <div className="flex items-center gap-2">
          <MathTutorTool />
          <MathDocsTool />
          <MathLockTool />
          <button
            onClick={handleDone}
            data-testid="math-panel-done"
            className="aac-btn bg-[#4CAF50] text-white rounded-lg px-4 py-2 font-bold text-base min-h-[44px]"
          >
            ✓ {t('done')}
          </button>
          <button
            onClick={handleClose}
            data-testid="math-panel-close"
            aria-label={t('close_panel')}
            className="aac-btn w-10 h-10 rounded-lg surface-key text-muted text-xl flex items-center justify-center border border-theme"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <MathGrid />
      </div>

      <MathKeyboardRegion />
    </section>
  );
}
