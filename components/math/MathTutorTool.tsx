'use client';
/**
 * MathTutorTool — Phase 5C + 5D + 6 hardening.
 *
 * Hint / Check / Solve over the cell-grid expression. Streamed via
 * askAI; auto-collapses when the user types more cells.
 *
 * Phase 6 hardening (driven by user reports of "Thinking…" sticking
 * indefinitely on PROD):
 *   • Hard 15 s tutor-side timeout via Promise.race. The askAI service
 *     has its own 30+ s timeouts, but the local Ollama fallback chains
 *     them serially and a CORS-blocked Synalux POST on top of a
 *     mixed-content-blocked Ollama call could keep the overlay in
 *     "Thinking…" for ~40 s. 15 s is the user-patience floor.
 *   • Friendlier error messages — distinguish auth, network, and
 *     timeout so the child / caregiver knows what to do next.
 *   • Retry button — recovers without retyping the expression.
 *   • Always lands in a deterministic terminal state (response shown
 *     OR error shown). Never leaves loading=true after Promise.race.
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
const TUTOR_HARD_TIMEOUT_MS = 15_000;

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

/** Map the askAI error message into a child-friendly explanation. The
 *  service-layer messages are technical ("Session expired", "No AI
 *  available — check internet…"). We translate so the AAC user sees
 *  one of three categorical states with an actionable next step. */
function friendlyError(err: unknown): { kind: 'auth' | 'network' | 'timeout' | 'other'; msg: string } {
  const raw = err instanceof Error ? err.message : '';
  if (raw === '__tutor_timeout__') return { kind: 'timeout', msg: 'The AI tutor is taking too long. Tap retry to try again.' };
  if (/expired|sign in/i.test(raw)) return { kind: 'auth', msg: 'Sign in to Synalux at synalux.ai/auth to use the tutor.' };
  if (/no ai available|failed to fetch|network|offline/i.test(raw)) {
    return { kind: 'network', msg: "Couldn't reach the tutor. Check your internet, then tap retry." };
  }
  return { kind: 'other', msg: raw || 'Could not reach the math helper right now.' };
}

const TOOL_BTN =
  'aac-btn rounded-lg px-3 py-2 text-sm font-bold border border-transparent ' +
  'flex items-center justify-center min-h-[44px] disabled:opacity-40';

export default function MathTutorTool() {
  const cells = useMathGridStore((s) => s.cells);
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [response, setResponse] = useState<string>('');
  const [errorKind, setErrorKind] = useState<'auth' | 'network' | 'timeout' | 'other' | null>(null);
  const [mode, setMode] = useState<TutorMode | null>(null);
  const [loading, setLoading] = useState(false);
  const lastCellCount = useRef(cells.size);
  // Used to cancel an in-flight tutor request when the user taps a
  // different mode or dismisses. The actual askAI fetch can't be
  // aborted cleanly without threading a signal through every call
  // site, but we CAN ignore late chunks via this ref.
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (cells.size > lastCellCount.current && (response || errorKind)) {
      setResponse('');
      setErrorKind(null);
      setMode(null);
    }
    lastCellCount.current = cells.size;
  }, [cells.size, response, errorKind]);

  const ask = useCallback(async (which: TutorMode) => {
    const expression = serializeAsExpression(cells);
    if (!expression || loading) return;
    tapFeedback();
    setMode(which);
    setLoading(true);
    setResponse('');
    setErrorKind(null);
    const mySeq = ++requestSeqRef.current;

    const prompts: Record<TutorMode, string> = {
      help:  `The child wrote this math expression: "${expression}". They need help understanding what to do next. Give a gentle hint — don't solve it, just guide them to the next step. Use simple words. Be encouraging. Max 2 sentences.`,
      check: `The child wrote: "${expression}". Check if this is correct. If there's an error, explain what went wrong gently and show how to fix it. If it's correct, celebrate! Use simple words. Max 2 sentences.`,
      solve: `The child wrote: "${expression}". Show the solution step by step. Use simple language a child can understand. Use math symbols. Be encouraging — say "Great job trying!" or similar. Max 4 short steps.`,
    };

    let buffer = '';
    try {
      const askPromise = askAI(prompts[which], MATH_TUTOR_CONTEXT, (delta) => {
        if (mySeq !== requestSeqRef.current) return; // user moved on
        buffer += delta;
        setResponse(buffer);
      }, language);
      // Hard tutor-side timeout. askAI's internal timeouts can chain to
      // ~40s in the worst case (Synalux 30s + Ollama 10s). 15s is what
      // an AAC user will tolerate before hitting back.
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('__tutor_timeout__')), TUTOR_HARD_TIMEOUT_MS);
      });
      await Promise.race([askPromise, timeoutPromise]);
      if (mySeq !== requestSeqRef.current) return;
      setResponse(buffer);
      if (buffer) aacSpeak(buffer, speechRate, speechVolume);
    } catch (e) {
      if (mySeq !== requestSeqRef.current) return;
      const f = friendlyError(e);
      setErrorKind(f.kind);
      setResponse(`⚠️ ${f.msg}`);
    } finally {
      if (mySeq === requestSeqRef.current) setLoading(false);
    }
  }, [cells, loading, language, speechRate, speechVolume]);

  const dismiss = useCallback(() => {
    tapFeedback();
    requestSeqRef.current++; // invalidate any in-flight request
    setResponse('');
    setErrorKind(null);
    setMode(null);
    setLoading(false);
  }, []);

  const retry = useCallback(() => {
    if (!mode) return;
    void ask(mode);
  }, [ask, mode]);

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
          data-error-kind={errorKind ?? ''}
          data-loading={loading ? '1' : '0'}
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
          {errorKind && !loading && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                onClick={retry}
                data-testid="math-tutor-retry"
                aria-label="Retry"
                className="aac-btn rounded-md px-3 py-1.5 text-xs font-bold bg-[#4CAF50] text-white"
              >
                ↻ Retry
              </button>
            </div>
          )}
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
