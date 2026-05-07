'use client';
/**
 * MathMainKeyboard — Phase 1B.
 *
 * The default keyboard for the math module. Three rows:
 *   Row 1 — digits 0–9
 *   Row 2 — basic operators + comma/decimal
 *   Row 3 — ⌫ Backspace, ⏎ Next row, space, = , (
 *
 * Wired to the math grid store: every keypress commits a glyph at
 * the cursor (or moves the cursor for ⌫ ⏎). Same keyboard works
 * across all skins — visual style is paint-by-CSS only.
 *
 * AAC tap-target floor: 44px (matches WCAG AAA + Apple HIG). Buttons
 * scale up on wider viewports via clamp(). Each key has data-glyph
 * for test probing and aria-label for screen reader.
 *
 * No reach into anything outside useMathGridStore + tapFeedback —
 * the keyboard is a thin command-emitter, the store is the model.
 */
import { useCallback } from 'react';
import { useMathGridStore } from '@/store/mathGridStore';
import { tapFeedback, deleteFeedback, keyFeedback } from '@/services/feedback';

export interface MathMainKeyboardProps {
  /** Optional className for outer wrapper sizing. */
  className?: string;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const OPERATORS: Array<{ glyph: string; label: string }> = [
  { glyph: '+', label: 'plus' },
  { glyph: '−', label: 'minus' },
  { glyph: '×', label: 'times' },
  { glyph: '÷', label: 'divided by' },
  { glyph: '=', label: 'equals' },
  { glyph: '.', label: 'decimal point' },
  { glyph: ',', label: 'comma' },
  { glyph: '(', label: 'open parenthesis' },
  { glyph: ')', label: 'close parenthesis' },
];

const KEY_BASE =
  'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
  'flex items-center justify-center min-h-[44px] active:translate-y-px';

export default function MathMainKeyboard({ className = '' }: MathMainKeyboardProps) {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const backspaceAtCursor = useMathGridStore((s) => s.backspaceAtCursor);
  const returnToNextRow = useMathGridStore((s) => s.returnToNextRow);

  const onGlyph = useCallback((g: string) => {
    keyFeedback();
    commitGlyph(g);
  }, [commitGlyph]);

  const onBackspace = useCallback(() => {
    deleteFeedback();
    backspaceAtCursor();
  }, [backspaceAtCursor]);

  const onReturn = useCallback(() => {
    tapFeedback();
    // Default Return: drop one row, snap to leftmost contiguous (Phase 1B
    // simplification: just snap to col 0). Phase 3B will add the
    // smarter rules-engine version.
    returnToNextRow(0);
  }, [returnToNextRow]);

  return (
    <div
      className={`p-2 space-y-2 surface-bar border-t border-theme ${className}`}
      data-testid="math-main-keyboard"
    >
      {/* Row 1: digits */}
      <div className="flex gap-1.5">
        {DIGITS.map((d) => (
          <button
            key={d}
            onClick={() => onGlyph(d)}
            data-testid={`math-key-${d}`}
            data-glyph={d}
            aria-label={d}
            className={`${KEY_BASE} flex-1 py-2.5 text-2xl`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Row 2: operators */}
      <div className="flex gap-1.5">
        {OPERATORS.map(({ glyph, label }) => (
          <button
            key={glyph}
            onClick={() => onGlyph(glyph)}
            data-testid={`math-key-${label.replace(/ /g, '-')}`}
            data-glyph={glyph}
            aria-label={label}
            className={`${KEY_BASE} flex-1 py-2.5 text-2xl`}
          >
            {glyph}
          </button>
        ))}
      </div>

      {/* Row 3: utility row */}
      <div className="flex gap-1.5">
        <button
          onClick={onReturn}
          data-testid="math-key-return"
          data-glyph="return"
          aria-label="Next row"
          className={`${KEY_BASE} flex-1 py-2.5 text-xl`}
        >
          ⏎
        </button>
        <button
          onClick={() => onGlyph(' ')}
          data-testid="math-key-space"
          data-glyph=" "
          aria-label="Space"
          className={`${KEY_BASE} flex-[3] py-2.5 text-base`}
        >
          space
        </button>
        <button
          onClick={onBackspace}
          data-testid="math-key-backspace"
          data-glyph="backspace"
          aria-label="Backspace"
          className={`${KEY_BASE} flex-1 py-2.5 text-xl`}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
