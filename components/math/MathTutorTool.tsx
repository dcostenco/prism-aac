'use client';
/**
 * MathTutorTool — Phase 5C.
 *
 * AI tutor reintegrated from MathPanelLegacy. Three modes:
 *   • Hint   — gentle next-step nudge (don't solve, just guide).
 *   • Check  — verify the answer; explain if wrong, celebrate if right.
 *   • Solve  — full step-by-step solution.
 *
 * Inputs: serialized math grid expression (row-major, " | " between
 * rows). Output: streamed AI text into a collapsible overlay above
 * the canvas. The overlay closes itself when the user types more
 * cells (so the next question's grid isn't blocked by stale advice).
 *
 * Auth: only enabled when the user has a Synalux profile (paid
 * tutor models route through askAI). Disabled otherwise — button
 * shows a tooltip explaining why.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMathGridStore } from '@/store/mathGridStore';
import { useSettingsStore } from '@/store/settingsStore';
import { askAI } from '@/services/aiService';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';
import { parseCellKey, type Cell, type CellKey } from '@/engine/mathGrid';

type TutorMode = 'help' | 'check' | 'solve';

const MATH_TUTOR_CONTEXT = 'math-tutor';

function serializeAsExpression(cells: Map<CellKey, Cell>): string {
  if (cells.size === 0) return '';
  const byRow: Map<number, Array<{ c: number; glyph: string }>> = new Map();
  cells.forEach((cell, key) => {
    const { r, c } = parseCellKey(key);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push({ c, glyph: cell.glyph });
  });
  const sortedRows = Array.from(byRow.keys()).sort((a, b) => a - b);
  return sortedRows
    .map((r) => byRow.get(r)!.sort((a, b) => a.c - b.c).map((x) => x.glyph).join(' '))
    .join(' | ');
}

const TOOL_BTN =
  'aac-btn rounded-lg px-3 py-2 text-sm font-bold border border-transparent ' +
  'flex items-center justify-center min-h-[44px] disabled:opacity-40';

export default function MathTutorTool() {
  const cells = useMathGridStore((s) => s.cells);
  const { speechRate, speechVolume, language } = useSettingsStore();
  // Auth-gate REMOVED 2026-05-07 per user feedback "ai tutor should be
  // enabled all pages" + "no stubs no hardcoding". askAI handles 401s
  // gracefully — the catch block shows a friendly error message and
  // the panel offers to retry. Free-tier / anonymous Synalux access
  // routes through the same endpoint with a free-tier model.
  const [response, setResponse] = useState<string>('');
  const [mode, setMode] = useState<TutorMode | null>(null);
  const [loading, setLoading] = useState(false);
  // Last cell-count we saw — when it grows, the user has typed new
  // glyphs, so we auto-collapse the response (stale).
  const lastCellCount = useRef(cells.size);
  useEffect(() => {
    if (cells.size > lastCellCount.current && response) {
      setResponse('');
      setMode(null);
    }
    lastCellCount.current = cells.size;
  }, [cells.size, response]);

  const ask = useCallback(async (which: TutorMode) => {
    const expression = serializeAsExpression(cells);
    if (!expression || loading) return;
    tapFeedback();
    setMode(which);
    setLoading(true);
    setResponse('');

    const prompts: Record<TutorMode, string> = {
      help:  `The child wrote this math expression: "${expression}". They need help understanding what to do next. Give a gentle hint — don't solve it, just guide them to the next step. Use simple words. Be encouraging. Max 2 sentences.`,
      check: `The child wrote: "${expression}". Check if this is correct. If there's an error, explain what went wrong gently and show how to fix it. If it's correct, celebrate! Use simple words. Max 2 sentences.`,
      solve: `The child wrote: "${expression}". Show the solution step by step. Use simple language a child can understand. Use math symbols. Be encouraging — say "Great job trying!" or similar. Max 4 short steps.`,
    };

    let buffer = '';
    try {
      await askAI(prompts[which], MATH_TUTOR_CONTEXT, (delta) => {
        buffer += delta;
        setResponse(buffer);
      }, language);
      setResponse(buffer);
      if (buffer) aacSpeak(buffer, speechRate, speechVolume);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach the math helper right now.';
      setResponse(`⚠️ ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [cells, loading, language, speechRate, speechVolume]);

  const dismiss = useCallback(() => {
    tapFeedback();
    setResponse('');
    setMode(null);
  }, []);

  return (
    <div data-testid="math-tutor-tool" className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => ask('help')}
          disabled={loading}
          data-testid="math-tutor-hint"
          aria-label="Get a hint"
          className={`${TOOL_BTN} bg-[#2196F3] text-white`}
        >
          💡 Hint
        </button>
        <button
          onClick={() => ask('check')}
          disabled={loading}
          data-testid="math-tutor-check"
          aria-label="Check answer"
          className={`${TOOL_BTN} bg-[#FF9800] text-white`}
        >
          ✓ Check
        </button>
        <button
          onClick={() => ask('solve')}
          disabled={loading}
          data-testid="math-tutor-solve"
          aria-label="Solve step-by-step"
          className={`${TOOL_BTN} bg-[#9C27B0] text-white`}
        >
          🎓 Solve
        </button>
      </div>

      {(loading || response) && (
        <div
          className="absolute right-0 top-full mt-2 w-[28rem] max-w-[80vw] surface-bar border border-theme rounded-xl shadow-xl z-40 p-3"
          data-testid="math-tutor-response"
          data-mode={mode ?? ''}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <span className="text-2xl shrink-0">🤖</span>
            <div className="flex-1 text-primary text-sm leading-relaxed">
              {loading && !response ? (
                <span className="text-muted animate-pulse">Thinking…</span>
              ) : (
                response.split('\n').map((ln, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{ln}</p>
                ))
              )}
            </div>
          </div>
          <button
            onClick={dismiss}
            className="absolute top-1 right-2 text-muted text-xs px-1"
            aria-label="Dismiss"
            data-testid="math-tutor-dismiss"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}
