'use client';
/**
 * MathLockTool — Phase 3A.
 *
 * The "Lock Equation" UX:
 *   1. User taps the Lock button → mode becomes "select-start";
 *      a small status banner appears explaining "Tap top-left and
 *      bottom-right of the region to lock".
 *   2. User taps a cell on the canvas → that's the first corner of
 *      the rectangle. Mode advances to "select-end".
 *   3. User taps another cell → second corner. Mode commits the
 *      selection AND locks every cell inside it; mode resets to
 *      "idle". Rendered with green tint via the engine's existing
 *      `locked: true` cell flag.
 *
 * Locking protects motor-overshoot from destroying finished work.
 * The engine already rejects glyph commits and backspaces on locked
 * cells (Phase 1A behavior) — this tool just provides the user
 * affordance for entering lock mode.
 *
 * Implementation note: this component is INTENTIONALLY a thin
 * controller — it owns only the `mode` state machine and a couple
 * of pending coords. All cell mutations route through the existing
 * mathGridStore actions (setSelection, lockSelection, clearSelection).
 *
 * Phase 3A delivers the lock + unlock buttons. The unlock button
 * inverts: select 2 corners → unlock that region. AAC users with
 * caregiver assistance will use this most.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMathGridStore } from '@/store/mathGridStore';
import { tapFeedback, keyFeedback } from '@/services/feedback';

type LockMode = 'idle' | 'lock-start' | 'lock-end' | 'unlock-start' | 'unlock-end';

export default function MathLockTool() {
  const [mode, setMode] = useState<LockMode>('idle');
  const [pendingCorner, setPendingCorner] = useState<{ r: number; c: number } | null>(null);
  // Baseline cursor at mode entry. We DON'T consume the cursor that
  // already exists when the user clicks Lock — only cursor CHANGES
  // after that count as user taps.
  const baselineCursor = useRef<{ r: number; c: number } | null>(null);

  const cursor = useMathGridStore((s) => s.cursor);
  const setSelection = useMathGridStore((s) => s.setSelection);
  const clearSelection = useMathGridStore((s) => s.clearSelection);
  const lockSelection = useMathGridStore((s) => s.lockSelection);
  const unlockSelection = useMathGridStore((s) => s.unlockSelection);

  // Whenever cursor changes AND we're in a lock-* or unlock-* mode,
  // treat it as a user tap on the canvas (the canvas's tap-to-focus
  // is what moves the cursor). Two-step state machine:
  //   lock-start    → first tap: record corner, advance to lock-end
  //   lock-end      → second tap: build rect, lockSelection, reset
  // Same for unlock-*. Idle? Effect bails.
  useEffect(() => {
    if (mode === 'idle') return;
    // Skip the baseline cursor — we want only NEW cursor positions
    // that happened AFTER the mode switch (i.e., real user taps).
    const baseline = baselineCursor.current;
    if (baseline && baseline.r === cursor.r && baseline.c === cursor.c) return;

    if (mode === 'lock-start' || mode === 'unlock-start') {
      // First corner — record and advance.
      setPendingCorner({ r: cursor.r, c: cursor.c });
      setMode(mode === 'lock-start' ? 'lock-end' : 'unlock-end');
      baselineCursor.current = { r: cursor.r, c: cursor.c };
      return;
    }
    if (mode === 'lock-end' || mode === 'unlock-end') {
      if (!pendingCorner) return;
      const from = pendingCorner;
      const to = { r: cursor.r, c: cursor.c };
      setSelection(from, to);
      if (mode === 'lock-end') lockSelection(); else unlockSelection();
      const timer = setTimeout(() => {
        clearSelection();
        setMode('idle');
        setPendingCorner(null);
        baselineCursor.current = null;
      }, 600);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const startLock = useCallback(() => {
    tapFeedback();
    setPendingCorner(null);
    baselineCursor.current = { r: cursor.r, c: cursor.c };
    setMode('lock-start');
  }, [cursor]);

  const startUnlock = useCallback(() => {
    tapFeedback();
    setPendingCorner(null);
    baselineCursor.current = { r: cursor.r, c: cursor.c };
    setMode('unlock-start');
  }, [cursor]);

  const cancel = useCallback(() => {
    keyFeedback();
    clearSelection();
    setPendingCorner(null);
    baselineCursor.current = null;
    setMode('idle');
  }, [clearSelection]);

  const STATUS: Record<LockMode, string> = {
    idle: '',
    'lock-start':   '🔒 Tap a corner of the region to lock',
    'lock-end':     '🔒 Tap the OTHER corner to lock',
    'unlock-start': '🔓 Tap a corner of the region to unlock',
    'unlock-end':   '🔓 Tap the OTHER corner to unlock',
  };

  return (
    <div data-testid="math-lock-tool" data-mode={mode} className="flex items-center gap-1.5">
      <button
        onClick={startLock}
        disabled={mode !== 'idle'}
        data-testid="math-lock-start"
        aria-label="Lock equation"
        className={`aac-btn rounded-lg px-3 py-2 text-sm font-bold border border-transparent
                    bg-[#4CAF50] text-white disabled:opacity-40 min-h-[44px]`}
      >
        🔒 Lock
      </button>
      <button
        onClick={startUnlock}
        disabled={mode !== 'idle'}
        data-testid="math-lock-unlock"
        aria-label="Unlock equation"
        className={`aac-btn rounded-lg px-3 py-2 text-sm font-bold border border-theme
                    surface-key text-primary disabled:opacity-40 min-h-[44px]`}
      >
        🔓 Unlock
      </button>
      {mode !== 'idle' && (
        <>
          <span
            className="text-sm font-semibold text-[#4CAF50] px-2"
            role="status"
            aria-live="polite"
            data-testid="math-lock-status"
          >
            {STATUS[mode]}
          </span>
          <button
            onClick={cancel}
            data-testid="math-lock-cancel"
            aria-label="Cancel"
            className="aac-btn rounded-lg px-3 py-2 text-sm border border-theme surface-key text-primary min-h-[44px]"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
