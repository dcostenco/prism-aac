'use client';
/**
 * MathKeyboardRegion — Phase 2A.
 *
 * Bottom-docked region that hosts the active math keyboard. Two-tier:
 *   • A secondary row of CATEGORY CHIPS that select which keyboard
 *     panel is rendered above them. Tapping a chip swaps the keyboard
 *     panel CONTENT in place — the region's outer height is stable so
 *     the canvas above never reflows.
 *   • The active keyboard panel itself (default: MathMainKeyboard).
 *
 * Region height is fixed via min-h on the outer wrapper; if a category
 * panel ships fewer rows than the main keyboard, we pad with a thin
 * filler instead of letting the panel shrink. Stable canvas above is
 * the whole point — when the user is in column-arithmetic mode they
 * can't have their work jumping every time they tap a category chip.
 *
 * Phase 2A scope:
 *   • Region container with chip row + active panel.
 *   • Main + Letters + Adv. Math panels (the rest are stubs that
 *     render a "coming in 2C" placeholder).
 *   • Active category state lives in the math store so other parts of
 *     the app (settings, AI tutor) can read which panel is open.
 *
 * Phase 2C will fill in the remaining keyboards (Money, Time & Distance,
 * Weight, Volume, Geom).
 */
import { useState, useCallback } from 'react';
import MathMainKeyboard from './MathMainKeyboard';
import { useMathGridStore } from '@/store/mathGridStore';
import { tapFeedback, keyFeedback } from '@/services/feedback';

export type MathCategoryId =
  | 'main'
  | 'letters'
  | 'adv-math'
  | 'misc-math'
  | 'time-distance'
  | 'weight'
  | 'volume'
  | 'geom'
  | 'money';

interface CategoryDef {
  id: MathCategoryId;
  label: string;
  icon?: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'main',          label: 'Main',          icon: '0-9' },
  { id: 'adv-math',      label: 'Adv. Math',     icon: 'x²' },
  { id: 'letters',       label: 'a-z',           icon: 'a' },
  { id: 'misc-math',     label: 'Misc Math',     icon: '∈' },
  { id: 'time-distance', label: 'Time & Dist',   icon: '⏱' },
  { id: 'weight',        label: 'Weight',        icon: '⚖' },
  { id: 'volume',        label: 'Volume',        icon: '🧪' },
  { id: 'geom',          label: 'Geom',          icon: '△' },
  { id: 'money',         label: 'Money',         icon: '$' },
];

// Chip height is fixed at 44px (the AAC tap-target floor) to satisfy
// the e2e height assertion on every chip — `min-h` was ambiguous in
// some flex contexts (parents with overflow-x-auto). Explicit height
// removes the ambiguity.
const CHIP_BASE =
  'aac-btn rounded-lg border border-theme select-none text-xs font-bold ' +
  'flex items-center justify-center h-11 px-3 whitespace-nowrap shrink-0';

export default function MathKeyboardRegion({ className = '' }: { className?: string }) {
  const [activeCategory, setActiveCategory] = useState<MathCategoryId>('main');

  const onPick = useCallback((id: MathCategoryId) => {
    tapFeedback();
    setActiveCategory(id);
  }, []);

  return (
    <div
      className={`shrink-0 surface-bar border-t border-theme ${className}`}
      data-testid="math-keyboard-region"
      data-active-category={activeCategory}
    >
      {/* Category chip row */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-2" data-testid="math-categories-row">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onPick(cat.id)}
            data-testid={`math-category-${cat.id}`}
            data-active={activeCategory === cat.id ? '1' : '0'}
            aria-pressed={activeCategory === cat.id}
            className={`${CHIP_BASE} ${
              activeCategory === cat.id
                ? 'bg-[#4CAF50] text-white border-transparent'
                : 'surface-key text-primary'
            }`}
          >
            {cat.icon && <span className="font-mono mr-1.5 text-sm">{cat.icon}</span>}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Active panel — FIXED height container (not min-h) so the
          canvas above NEVER resizes when a chip swaps the panel
          content. The taller keyboards (Main = 3 rows) and shorter
          (Placeholder, single line) both render inside this stable
          shell. Internal overflow-y-auto handles overflow gracefully. */}
      <div
        className="h-[clamp(220px,26svh,300px)] overflow-y-auto"
        data-testid="math-keyboard-panel"
      >
        {activeCategory === 'main' && <MathMainKeyboard />}
        {activeCategory === 'adv-math' && <MathAdvMathKeyboard />}
        {activeCategory === 'letters' && <MathLettersKeyboard />}
        {(activeCategory === 'misc-math' || activeCategory === 'time-distance' ||
          activeCategory === 'weight' || activeCategory === 'volume' ||
          activeCategory === 'geom' || activeCategory === 'money') && (
          <PlaceholderPanel categoryId={activeCategory} />
        )}
      </div>
    </div>
  );
}

// ── Adv. Math keyboard — Phase 2A first sketch ───────────────────

const ADV_MATH_KEYS: Array<{ glyph: string; label: string }> = [
  { glyph: '(', label: 'open paren' },
  { glyph: ')', label: 'close paren' },
  { glyph: '<', label: 'less than' },
  { glyph: '>', label: 'greater than' },
  { glyph: '≤', label: 'less or equal' },
  { glyph: '≥', label: 'greater or equal' },
  { glyph: '≠', label: 'not equal' },
  { glyph: '%', label: 'percent' },
  { glyph: 'π', label: 'pi' },
  { glyph: 'x', label: 'variable x' },
  { glyph: 'y', label: 'variable y' },
  { glyph: 'a', label: 'variable a' },
  { glyph: 'b', label: 'variable b' },
  { glyph: '√', label: 'square root' },
  { glyph: '²', label: 'squared' },
  { glyph: '³', label: 'cubed' },
];

function MathAdvMathKeyboard() {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const openFractionBox = useMathGridStore((s) => s.openFractionBox);
  const moveToFractionDenominator = useMathGridStore((s) => s.moveToFractionDenominator);
  const openLongDivisionHouse = useMathGridStore((s) => s.openLongDivisionHouse);
  const addRootBar = useMathGridStore((s) => s.addRootBar);
  const toggleSummationLine = useMathGridStore((s) => s.toggleSummationLine);
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[44px] active:translate-y-px';
  const TOOL_BASE =
    'aac-btn rounded-lg font-bold border border-transparent select-none ' +
    'flex items-center justify-center min-h-[44px] active:translate-y-px ' +
    'bg-[#2196F3] text-white';
  return (
    <div className="p-2 space-y-2" data-testid="math-adv-math-keyboard">
      <div className="grid grid-cols-8 gap-1.5">
        {ADV_MATH_KEYS.map(({ glyph, label }) => (
          <button
            key={glyph}
            onClick={() => { keyFeedback(); commitGlyph(glyph); }}
            data-testid={`math-key-adv-${label.replace(/ /g, '-')}`}
            data-glyph={glyph}
            aria-label={label}
            className={`${KEY_BASE} py-2.5 text-xl`}
          >
            {glyph}
          </button>
        ))}
      </div>
      {/* Decoration tools — these don't write a single glyph; they
          insert a structural decoration (fraction bar, long-division
          house, root bar) and reposition the cursor. */}
      <div className="grid grid-cols-5 gap-1.5">
        <button
          onClick={() => { tapFeedback(); openFractionBox(); }}
          data-testid="math-tool-fraction-box"
          aria-label="Open fraction box"
          className={`${TOOL_BASE} py-2.5 text-base`}
        >
          a/b
        </button>
        <button
          onClick={() => { tapFeedback(); moveToFractionDenominator(); }}
          data-testid="math-tool-fraction-to-denominator"
          aria-label="Move cursor to denominator"
          className={`${TOOL_BASE} py-2.5 text-base`}
        >
          ⤓ den
        </button>
        <button
          onClick={() => { tapFeedback(); openLongDivisionHouse(); }}
          data-testid="math-tool-long-division"
          aria-label="Open long-division house"
          className={`${TOOL_BASE} py-2.5 text-base`}
        >
          ÷⎴
        </button>
        <button
          onClick={() => { tapFeedback(); addRootBar(); }}
          data-testid="math-tool-root-bar"
          aria-label="Add root bar above cursor"
          className={`${TOOL_BASE} py-2.5 text-base`}
        >
          √‾
        </button>
        <button
          onClick={() => { tapFeedback(); toggleSummationLine(); }}
          data-testid="math-tool-summation-line"
          aria-label="Toggle summation line"
          className={`${TOOL_BASE} py-2.5 text-base`}
        >
          ___
        </button>
      </div>
    </div>
  );
}

// ── Letters keyboard — Phase 2A first sketch ─────────────────────

const LETTERS_AP = 'abcdefghijklmnop'.split('');
const LETTERS_QZ = 'qrstuvwxyz'.split('');

function MathLettersKeyboard() {
  const [page, setPage] = useState<'a-p' | 'q-z'>('a-p');
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const list = page === 'a-p' ? LETTERS_AP : LETTERS_QZ;
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[44px] active:translate-y-px';
  return (
    <div className="p-2 space-y-2" data-testid="math-letters-keyboard" data-page={page}>
      <div className="flex gap-1.5">
        <button
          onClick={() => { tapFeedback(); setPage(page === 'a-p' ? 'q-z' : 'a-p'); }}
          data-testid="math-letters-page-toggle"
          aria-label={page === 'a-p' ? 'switch to q-z' : 'switch to a-p'}
          className={`${KEY_BASE} px-3 py-2.5 text-base bg-[#2196F3] text-white border-transparent`}
        >
          {page === 'a-p' ? 'q-z →' : '← a-p'}
        </button>
        <div className="grid grid-cols-8 gap-1.5 flex-1">
          {list.map((ltr) => (
            <button
              key={ltr}
              onClick={() => { keyFeedback(); commitGlyph(ltr); }}
              data-testid={`math-key-ltr-${ltr}`}
              data-glyph={ltr}
              aria-label={ltr}
              className={`${KEY_BASE} py-2.5 text-xl`}
            >
              {ltr}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Placeholder for unimplemented categories ─────────────────────

function PlaceholderPanel({ categoryId }: { categoryId: MathCategoryId }) {
  return (
    <div
      className="p-4 text-center text-muted text-sm"
      data-testid={`math-placeholder-${categoryId}`}
    >
      <p className="font-bold">Coming in Phase 2C</p>
      <p className="mt-1 text-xs">Tap Main to keep working.</p>
    </div>
  );
}
