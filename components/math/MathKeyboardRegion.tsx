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
import { useMathGridStore, type MathCategoryId } from '@/store/mathGridStore';
import { useSettingsStore } from '@/store/settingsStore';
import { tapFeedback, keyFeedback } from '@/services/feedback';
import { eventsForRegion } from '@/engine/historyRegions';

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
  // Phase 6 — universal-engine domains. The AI tutor reads
  // activeMathCategory from the store and routes the prompt by
  // domain (chemistry / physics / programming-python / programming-java).
  { id: 'chemistry',         label: 'Chem',   icon: '🧪' },
  { id: 'physics',           label: 'Phys',   icon: 'Φ'  },
  { id: 'programming-python', label: 'Python', icon: 'py' },
  { id: 'programming-java',   label: 'Java',   icon: 'J'  },
  // Phase 7 — full high-school curriculum coverage for AAC users.
  { id: 'biology',      label: 'Bio',   icon: '🧬' },
  { id: 'statistics',   label: 'Stats', icon: 'σ'  },
  { id: 'music',        label: 'Music', icon: '𝄞' },
  { id: 'earth-science', label: 'Earth', icon: '🌍' },
  // Phase 8 — humanities surfaces. The cell-grid hosts dates +
  // era markers (history) and parts-of-speech tagging
  // (language-arts); free-form prose still lives on the AAC main
  // qwerty keyboard.
  { id: 'history',       label: 'Hist',  icon: '📜' },
  { id: 'language-arts', label: 'Lang',  icon: '📖' },
];

// Re-export so older imports (`import { MathCategoryId } from '@/components/math/MathKeyboardRegion'`)
// keep working — the canonical source is now the store.
export type { MathCategoryId };

// Chip height is fixed at 44px (the AAC tap-target floor) to satisfy
// the e2e height assertion on every chip — `min-h` was ambiguous in
// some flex contexts (parents with overflow-x-auto). Explicit height
// removes the ambiguity.
const CHIP_BASE =
  'aac-btn rounded-lg border border-theme select-none text-sm font-bold ' +
  'flex items-center justify-center h-11 px-3 whitespace-nowrap shrink-0';

export default function MathKeyboardRegion({ className = '' }: { className?: string }) {
  const activeCategory = useMathGridStore((s) => s.activeMathCategory);
  const setActiveCategory = useMathGridStore((s) => s.setActiveMathCategory);

  const onPick = useCallback((id: MathCategoryId) => {
    tapFeedback();
    setActiveCategory(id);
  }, [setActiveCategory]);

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
        // Programming chip's row layout (after the keywords were
        // packed into a 14-col grid in commit 2026-05-08):
        //   ops × 2 + keywords × 2 + letters × 2 + digits × 1 = 7 rows
        // After the 2026-05-08 button-size bump (min-h 44 → 52-56 px,
        // text-xs → text-sm/lg per user "make math buttons bigger"),
        // each row is ~58 px → 7 × 58 + 6 × 6 gap = ~440 px. Floor
        // 420 / max 540 keeps the canvas at ≥ ~35 % of the viewport
        // on every device while letting the bigger keys fit without
        // overflow-hidden clipping the bottom row.
        className="h-[clamp(300px,38svh,440px)] overflow-y-auto"
        data-testid="math-keyboard-panel"
      >
        {activeCategory === 'main' && <MathMainKeyboard />}
        {activeCategory === 'adv-math' && <MathAdvMathKeyboard />}
        {activeCategory === 'letters' && <MathLettersKeyboard />}
        {activeCategory === 'misc-math' && <MathMiscMathKeyboard />}
        {activeCategory === 'time-distance' && <MathTimeDistanceKeyboard />}
        {activeCategory === 'weight' && <MathWeightKeyboard />}
        {activeCategory === 'volume' && <MathVolumeKeyboard />}
        {activeCategory === 'geom' && <MathGeomKeyboard />}
        {activeCategory === 'money' && <MathMoneyKeyboard />}
        {activeCategory === 'chemistry' && <MathChemistryKeyboard />}
        {activeCategory === 'physics' && <MathPhysicsKeyboard />}
        {activeCategory === 'programming-python' && <MathProgrammingKeyboard lang="python" />}
        {activeCategory === 'programming-java' && <MathProgrammingKeyboard lang="java" />}
        {activeCategory === 'biology' && <MathBiologyKeyboard />}
        {activeCategory === 'statistics' && <MathStatisticsKeyboard />}
        {activeCategory === 'music' && <MathMusicKeyboard />}
        {activeCategory === 'earth-science' && <MathEarthScienceKeyboard />}
        {activeCategory === 'history' && <MathHistoryKeyboard />}
        {activeCategory === 'language-arts' && <MathLanguageArtsKeyboard />}
      </div>
    </div>
  );
}

// ── Adv. Math keyboard — Phase 2A first sketch ───────────────────

// Symbols mirror the Math Paper iPad app's "More Keyboard" reference
// (IMG_0567 / IMG_0568 / IMG_0557 / IMG_0568): the original ADV_MATH
// 16-key set is preserved at the front, then we append the reference-
// only glyphs (subscript marker, cube-root, comma, period, additional
// variables d/p/r, parentheses companions) so order stays stable for
// any user that has muscle memory on the first two rows.
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
  // Reference additions — Math Paper "More Keyboard" (IMG_0568 lower
  // right). Each entry committed on its own writes a single cell on
  // the math grid; users compose ³√x by tapping ³√ then x.
  { glyph: '∛', label: 'cube root' },
  { glyph: '_', label: 'subscript marker' },
  { glyph: '.', label: 'decimal point' },
  { glyph: ',', label: 'comma' },
  { glyph: 'd', label: 'variable d' },
  { glyph: 'p', label: 'variable p' },
  { glyph: 'r', label: 'variable r' },
  { glyph: 'm', label: 'variable m' },
  { glyph: 'n', label: 'variable n' },
  { glyph: '±', label: 'plus minus' },
  { glyph: '≈', label: 'approximately equal' },
  { glyph: '≡', label: 'identical to' },
  { glyph: '|', label: 'absolute bar' },
  { glyph: '!', label: 'factorial' },
  { glyph: 'log', label: 'logarithm' },
  { glyph: 'ln', label: 'natural log' },
  // v2 audit additions (REPORT.md Algebra/Geometry Pre-Calc): mensuration
  // and kinematics word problems lean on lowercase variable names that
  // were previously letters-only — `w` width, `l` length, `h` height,
  // `t` time. Adding them here removes a chip switch mid-equation.
  { glyph: 'w', label: 'variable w' },
  { glyph: 'l', label: 'variable l' },
  { glyph: 'h', label: 'variable h' },
  { glyph: 't', label: 'variable t' },
];

// v2 audit Pre-Calc Grade 12 priority 1: trig functions absent from
// every panel. A dedicated trig sub-row on Adv-Math unblocks the bulk
// of grade-12 / physics-trig problems.
const ADV_MATH_TRIG: Array<{ glyph: string; label: string }> = [
  { glyph: 'sin',   label: 'sine' },
  { glyph: 'cos',   label: 'cosine' },
  { glyph: 'tan',   label: 'tangent' },
  { glyph: 'csc',   label: 'cosecant' },
  { glyph: 'sec',   label: 'secant' },
  { glyph: 'cot',   label: 'cotangent' },
  { glyph: 'sin⁻¹', label: 'arcsine' },
  { glyph: 'cos⁻¹', label: 'arccosine' },
  { glyph: 'tan⁻¹', label: 'arctangent' },
];

// v2 audit Pre-Calc Grade 12 priority 2: limit + differential primitives.
// `→` here is the LIMIT-arrow (x → ∞); the misc-math `⇒`/`→` is the
// logic implication arrow — the audit calls these out as visually
// distinct categories, so we keep both reachable from their natural
// chips without aliasing the testid.
const ADV_MATH_CALC: Array<{ glyph: string; label: string }> = [
  { glyph: 'lim',  label: 'limit' },
  { glyph: '→',    label: 'limit arrow' },
  { glyph: 'dx',   label: 'differential x' },
  { glyph: 'dy',   label: 'differential y' },
  { glyph: 'f(x)', label: 'function f of x' },
  { glyph: 'g(x)', label: 'function g of x' },
];

// v2 audit Pre-Calc Grade 12 priority 3: subscript digits + n / i for
// sequence indexing (a₁, aₙ, a₁₀). `₂ ₃ ₄` already live on Chemistry —
// the cross-cutting decorations row also surfaces those; here we add
// the *missing* subscript digits so the full 0-9 set is reachable on
// the algebra chip.
const ADV_MATH_SUBSCRIPTS: Array<{ glyph: string; label: string }> = [
  { glyph: '₀', label: 'subscript 0' },
  { glyph: '₁', label: 'subscript 1' },
  { glyph: '₅', label: 'subscript 5' },
  { glyph: '₆', label: 'subscript 6' },
  { glyph: '₇', label: 'subscript 7' },
  { glyph: '₈', label: 'subscript 8' },
  { glyph: '₉', label: 'subscript 9' },
  { glyph: 'ₙ', label: 'subscript n' },
  { glyph: 'ᵢ', label: 'subscript i' },
];

// Cross-cutting decorations row (v2 audit "Cross-cutting findings"):
// `² ³ ₂ ₃ ₄ Δ ≈` are split across Adv-Math (² ³ ≈), Chemistry (₂ ₃ ₄),
// Physics (Δ). Surfacing the union on every numeric subject (Main,
// Adv-Math, Chemistry, Physics, Earth Science) removes ~40 % of chip-
// switching keystrokes measured across the 84 generated workflows.
// The per-subject decorations stay in their original rows (muscle
// memory preserved); this row is purely additive.
const SHARED_DECOR: Array<{ glyph: string; label: string }> = [
  { glyph: '²', label: 'squared shared' },
  { glyph: '³', label: 'cubed shared' },
  { glyph: '₂', label: 'subscript 2 shared' },
  { glyph: '₃', label: 'subscript 3 shared' },
  { glyph: '₄', label: 'subscript 4 shared' },
  { glyph: 'Δ', label: 'delta shared' },
  { glyph: '≈', label: 'approximately shared' },
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
    'flex items-center justify-center min-h-[56px] active:translate-y-px';
  const TOOL_BASE =
    'aac-btn rounded-lg font-bold border border-transparent select-none ' +
    'flex items-center justify-center min-h-[56px] active:translate-y-px ' +
    'bg-[#2196F3] text-white';
  return (
    <div className="p-2 space-y-2" data-testid="math-adv-math-keyboard">
      <SharedDecorRow prefix="math-adv-decor" />
      <div className="grid grid-cols-8 gap-1.5">
        {ADV_MATH_KEYS.map(({ glyph, label }) => (
          <button
            key={glyph}
            onClick={() => { keyFeedback(); commitGlyph(glyph); }}
            data-testid={`math-key-adv-${label.replace(/ /g, '-')}`}
            data-glyph={glyph}
            aria-label={label}
            className={`${KEY_BASE} py-3 text-2xl`}
          >
            {glyph}
          </button>
        ))}
      </div>
      {/* v2 audit additions — trig functions, calc primitives, and the
          subscript digit gap. Each row uses the GlyphGrid testid pattern
          (`math-adv-{group}-{slug}`) so the e2e _glyphMap can reach
          them without a chip switch. */}
      <GlyphGrid testid="math-adv-trig" glyphs={ADV_MATH_TRIG} cols={9} textSize="text-base" />
      <GlyphGrid testid="math-adv-calc" glyphs={ADV_MATH_CALC} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-adv-subscripts" glyphs={ADV_MATH_SUBSCRIPTS} cols={9} textSize="text-2xl" />
      {/* Decoration tools — these don't write a single glyph; they
          insert a structural decoration (fraction bar, long-division
          house, root bar) and reposition the cursor. */}
      <div className="grid grid-cols-5 gap-1.5">
        <button
          onClick={() => { tapFeedback(); openFractionBox(); }}
          data-testid="math-tool-fraction-box"
          aria-label="Open fraction box"
          className={`${TOOL_BASE} py-3 text-lg`}
        >
          a/b
        </button>
        <button
          onClick={() => { tapFeedback(); moveToFractionDenominator(); }}
          data-testid="math-tool-fraction-to-denominator"
          aria-label="Move cursor to denominator"
          className={`${TOOL_BASE} py-3 text-lg`}
        >
          ⤓ den
        </button>
        <button
          onClick={() => { tapFeedback(); openLongDivisionHouse(); }}
          data-testid="math-tool-long-division"
          aria-label="Open long-division house"
          className={`${TOOL_BASE} py-3 text-lg`}
        >
          ÷⎴
        </button>
        <button
          onClick={() => { tapFeedback(); addRootBar(); }}
          data-testid="math-tool-root-bar"
          aria-label="Add root bar above cursor"
          className={`${TOOL_BASE} py-3 text-lg`}
        >
          √‾
        </button>
        <button
          onClick={() => { tapFeedback(); toggleSummationLine(); }}
          data-testid="math-tool-summation-line"
          aria-label="Toggle summation line"
          className={`${TOOL_BASE} py-3 text-lg`}
        >
          ___
        </button>
      </div>
    </div>
  );
}

// ── Letters keyboard — full a-z, no pagination ──────────────────
//
// User report 2026-05-08 (Image #25): "a-z should be full a-z - fix
// it". The earlier paginated layout (16 letters + "q-z →" toggle)
// forced the user through an extra tap to reach q-z; on Programming
// chips the same paginated identifier row meant typing a name like
// `quack` or `xyz` was a multi-tap dance. Full 26 letters in a 13×2
// grid fits in ~100 px and removes the toggle entirely.

const LETTERS_AZ = 'abcdefghijklmnopqrstuvwxyz'.split('');

function MathLettersKeyboard() {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[56px] active:translate-y-px';
  return (
    <div className="p-2" data-testid="math-letters-keyboard">
      <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1 sm:gap-1.5">
        {LETTERS_AZ.map((ltr) => (
          <button
            key={ltr}
            onClick={() => { keyFeedback(); commitGlyph(ltr); }}
            data-testid={`math-key-ltr-${ltr}`}
            data-glyph={ltr}
            aria-label={ltr}
            className={`${KEY_BASE} py-3 text-xl sm:text-2xl`}
          >
            {ltr}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Phase 2C — glyph-grid keyboards ──────────────────────────────

const GLYPH_KEY_BASE =
  'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
  'flex items-center justify-center min-h-[56px] active:translate-y-px';

interface GlyphGridProps {
  testid: string;
  glyphs: Array<{ glyph: string; label: string }>;
  cols?: number;
  /** Defaults to text-2xl. Pass smaller (text-base / text-lg) for unit
   *  symbols that include 2-3 chars (mph, mol, etc.). Bumped from
   *  text-xl after the 2026-05-08 user request "make math buttons
   *  bigger" — the original tile size was hard to hit on a tablet. */
  textSize?: string;
}

function GlyphGrid({ testid, glyphs, cols = 8, textSize = 'text-2xl' }: GlyphGridProps) {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  return (
    <div className="p-2" data-testid={testid}>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {glyphs.map(({ glyph, label }) => (
          <button
            key={`${testid}-${label}`}
            onClick={() => { keyFeedback(); commitGlyph(glyph); }}
            data-testid={`${testid}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
            data-glyph={glyph}
            aria-label={label}
            className={`${GLYPH_KEY_BASE} py-3 ${textSize} whitespace-nowrap`}
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

// SharedDecorRow — renders the cross-cutting `² ³ ₂ ₃ ₄ Δ ≈` row on
// every numeric subject (Main, Adv-Math, Chemistry, Physics, Earth).
// Each subject passes a unique `prefix` so the data-testids don't
// collide and e2e specs can target them per-panel. The row uses the
// same GlyphGrid styling as other glyph rows.
function SharedDecorRow({ prefix }: { prefix: string }) {
  return <GlyphGrid testid={prefix} glyphs={SHARED_DECOR} cols={7} textSize="text-2xl" />;
}

// Set / logic ops + the Math Paper "Equality Folder" reference set
// (IMG_0568 lower-left). Existing 16 set/logic glyphs stay first, then
// brackets / equality / interval punctuation that the reference shows.
const MISC_MATH_GLYPHS: Array<{ glyph: string; label: string }> = [
  { glyph: '∈', label: 'element of' },
  { glyph: '∉', label: 'not element of' },
  { glyph: '⊂', label: 'subset of' },
  { glyph: '⊆', label: 'subset or equal' },
  { glyph: '∪', label: 'union' },
  { glyph: '∩', label: 'intersection' },
  { glyph: '∅', label: 'empty set' },
  { glyph: '∀', label: 'for all' },
  { glyph: '∃', label: 'there exists' },
  { glyph: '¬', label: 'not' },
  { glyph: '∧', label: 'and' },
  { glyph: '∨', label: 'or' },
  { glyph: '∞', label: 'infinity' },
  { glyph: '∂', label: 'partial derivative' },
  { glyph: '∇', label: 'nabla' },
  { glyph: '∝', label: 'proportional to' },
  // Equality Folder additions (IMG_0568): brackets, equality variants,
  // colon (interval / ratio), forward slash, plus-or-minus, identical,
  // approximately, therefore / because logic punctuation.
  { glyph: '≡', label: 'identical to' },
  { glyph: '≅', label: 'congruent' },
  { glyph: '≈', label: 'approximately' },
  { glyph: '±', label: 'plus or minus' },
  { glyph: '∓', label: 'minus or plus' },
  { glyph: '[', label: 'open bracket misc' },
  { glyph: ']', label: 'close bracket misc' },
  { glyph: '{', label: 'open brace misc' },
  { glyph: '}', label: 'close brace misc' },
  { glyph: ':', label: 'ratio colon' },
  { glyph: '/', label: 'slash misc' },
  { glyph: '∴', label: 'therefore' },
  { glyph: '∵', label: 'because' },
  { glyph: '⊥', label: 'perpendicular misc' },
  { glyph: '∥', label: 'parallel misc' },
  { glyph: '⇒', label: 'implies' },
  { glyph: '⇔', label: 'iff' },
];
function MathMiscMathKeyboard() {
  return <GlyphGrid testid="math-misc-keyboard" glyphs={MISC_MATH_GLYPHS} cols={8} />;
}

const TIME_DISTANCE_GLYPHS: Array<{ glyph: string; label: string }> = [
  { glyph: 's',  label: 'second' },
  { glyph: 'min', label: 'minute' },
  { glyph: 'hr', label: 'hour' },
  { glyph: 'day', label: 'day' },
  { glyph: 'mm', label: 'millimeter' },
  { glyph: 'cm', label: 'centimeter' },
  { glyph: 'm',  label: 'meter' },
  { glyph: 'km', label: 'kilometer' },
  { glyph: 'in', label: 'inch' },
  { glyph: 'ft', label: 'foot' },
  { glyph: 'yd', label: 'yard' },
  { glyph: 'mi', label: 'mile' },
];
function MathTimeDistanceKeyboard() {
  return <GlyphGrid testid="math-time-distance-keyboard" glyphs={TIME_DISTANCE_GLYPHS} cols={6} textSize="text-lg" />;
}

const WEIGHT_GLYPHS: Array<{ glyph: string; label: string }> = [
  { glyph: 'mg', label: 'milligram' },
  { glyph: 'g',  label: 'gram' },
  { glyph: 'kg', label: 'kilogram' },
  { glyph: 't',  label: 'metric ton' },
  { glyph: 'oz', label: 'ounce' },
  { glyph: 'lb', label: 'pound' },
  { glyph: 'st', label: 'stone' },
  { glyph: 'ton', label: 'ton' },
];
function MathWeightKeyboard() {
  return <GlyphGrid testid="math-weight-keyboard" glyphs={WEIGHT_GLYPHS} cols={4} textSize="text-lg" />;
}

const VOLUME_GLYPHS: Array<{ glyph: string; label: string }> = [
  { glyph: 'mL', label: 'milliliter' },
  { glyph: 'L',  label: 'liter' },
  { glyph: 'tsp', label: 'teaspoon' },
  { glyph: 'tbsp', label: 'tablespoon' },
  { glyph: 'cup', label: 'cup' },
  { glyph: 'pt', label: 'pint' },
  { glyph: 'qt', label: 'quart' },
  { glyph: 'gal', label: 'gallon' },
];
function MathVolumeKeyboard() {
  return <GlyphGrid testid="math-volume-keyboard" glyphs={VOLUME_GLYPHS} cols={4} textSize="text-lg" />;
}

// Geom shapes — original 12-key set kept first (preserves muscle
// memory). Reference IMG_0556 (Math Paper Geom keyboard) shows
// construction primitives: corner brackets to build rectangles /
// parallelograms, half-circle arcs, vertical / horizontal segments,
// 3D cone + cylinder. Anything that has clean BMP Unicode is added;
// 3D solids use letter labels because Unicode 3D-shape codepoints are
// SMP and tofu on stock fonts (same rationale as Music keyboard).
const GEOM_GLYPHS: Array<{ glyph: string; label: string }> = [
  { glyph: '△', label: 'triangle' },
  { glyph: '▲', label: 'filled triangle' },
  { glyph: '□', label: 'square' },
  { glyph: '◯', label: 'circle' },
  { glyph: '◇', label: 'diamond' },
  { glyph: '∠', label: 'angle' },
  { glyph: '⟂', label: 'perpendicular' },
  { glyph: '∥', label: 'parallel' },
  { glyph: '°', label: 'degree' },
  { glyph: '≅', label: 'congruent to' },
  { glyph: '≈', label: 'approximately equal' },
  { glyph: '↔', label: 'left-right arrow' },
  // Reference additions (IMG_0556).
  { glyph: '▢', label: 'rectangle' },
  { glyph: '▱', label: 'parallelogram' },
  { glyph: '⬠', label: 'pentagon' },
  { glyph: '⬡', label: 'hexagon' },
  { glyph: '⌒', label: 'arc' },
  { glyph: '⌓', label: 'segment' },
  { glyph: '◐', label: 'half circle left' },
  { glyph: '◑', label: 'half circle right' },
  { glyph: '◔', label: 'quarter circle' },
  { glyph: '─', label: 'horizontal line' },
  { glyph: '│', label: 'vertical line' },
  { glyph: '⌐', label: 'corner upper left' },
  { glyph: '¬', label: 'corner upper right' },
  { glyph: '└', label: 'corner lower left' },
  { glyph: '┘', label: 'corner lower right' },
  { glyph: '⊿', label: 'right triangle' },
  { glyph: '◊', label: 'lozenge' },
  { glyph: 'cone',     label: 'cone' },
  { glyph: 'cyl',      label: 'cylinder' },
  { glyph: 'sphere',   label: 'sphere' },
  { glyph: 'cube',     label: 'cube' },
  { glyph: 'prism',    label: 'prism' },
  { glyph: 'pyramid',  label: 'pyramid' },
  { glyph: '↑', label: 'arrow up' },
  { glyph: '↓', label: 'arrow down' },
  { glyph: '←', label: 'arrow left' },
  { glyph: '→', label: 'arrow right' },
  { glyph: 'π',  label: 'pi-geom' },
  { glyph: 'r',  label: 'radius' },
  { glyph: 'd',  label: 'diameter' },
  { glyph: 'A',  label: 'area' },
  { glyph: 'V',  label: 'volume-geom' },
  { glyph: 'P',  label: 'perimeter' },
  // v2 audit Geometry priority 1: `~` (tilde / similar, U+007E) — every
  // similar-triangles problem uses it. Geom panel already has `≅`
  // (congruent); textbooks pair `~` with `≅` for similarity vs.
  // congruence so both must be reachable from the same chip.
  { glyph: '~', label: 'similar tilde' },
  // v2 audit Geometry priority 3: cube exponent for volume problems
  // (cm³, m³). `³` already lives on Adv-Math but the chip switch
  // mid-equation is what the audit calls out as a workflow blocker.
  { glyph: '³', label: 'cubed geom' },
  // v2 audit Geometry priority 2: mensuration vocabulary (length /
  // width / height / side). r and d already live on this panel.
  { glyph: 'l', label: 'length-geom' },
  { glyph: 'w', label: 'width-geom' },
  { glyph: 'h', label: 'height-geom' },
  { glyph: 's', label: 'side-geom' },
];
function MathGeomKeyboard() {
  return <GlyphGrid testid="math-geom-keyboard" glyphs={GEOM_GLYPHS} cols={8} />;
}

const MONEY_GLYPHS: Array<{ glyph: string; label: string }> = [
  { glyph: '$', label: 'dollar' },
  { glyph: '¢', label: 'cent' },
  { glyph: '€', label: 'euro' },
  { glyph: '£', label: 'pound sterling' },
  { glyph: '¥', label: 'yen' },
  { glyph: '₹', label: 'rupee' },
  { glyph: '₽', label: 'ruble' },
  { glyph: '₩', label: 'won' },
];
function MathMoneyKeyboard() {
  return <GlyphGrid testid="math-money-keyboard" glyphs={MONEY_GLYPHS} cols={4} />;
}

// ── Phase 6 — Chemistry keyboard ─────────────────────────────────
//
// Element symbols are split into rows so multi-char glyphs (Na, Cl,
// etc.) get their own slot — they commit as a single cell because
// commitGlyph is glyph-agnostic. Reaction arrows + charges + phase
// markers + common units round out a typical school-chemistry
// expression like "2H₂ + O₂ → 2H₂O".

const CHEMISTRY_ELEMENTS: Array<{ glyph: string; label: string }> = [
  { glyph: 'H',  label: 'hydrogen' },
  { glyph: 'C',  label: 'carbon' },
  { glyph: 'N',  label: 'nitrogen' },
  { glyph: 'O',  label: 'oxygen' },
  { glyph: 'F',  label: 'fluorine' },
  { glyph: 'Na', label: 'sodium' },
  { glyph: 'Mg', label: 'magnesium' },
  { glyph: 'Al', label: 'aluminium' },
  { glyph: 'Si', label: 'silicon' },
  { glyph: 'P',  label: 'phosphorus' },
  { glyph: 'S',  label: 'sulfur' },
  { glyph: 'Cl', label: 'chlorine' },
  { glyph: 'K',  label: 'potassium' },
  { glyph: 'Ca', label: 'calcium' },
  { glyph: 'Fe', label: 'iron' },
  { glyph: 'Cu', label: 'copper' },
  { glyph: 'Zn', label: 'zinc' },
  { glyph: 'Ag', label: 'silver' },
  { glyph: 'Au', label: 'gold' },
  { glyph: 'Hg', label: 'mercury' },
  { glyph: 'Pb', label: 'lead' },
  { glyph: 'Br', label: 'bromine' },
  { glyph: 'I',  label: 'iodine' },
  { glyph: 'He', label: 'helium' },
];

const CHEMISTRY_OPS: Array<{ glyph: string; label: string }> = [
  { glyph: '→',   label: 'yields' },
  { glyph: '⇌',   label: 'equilibrium' },
  { glyph: '↑',   label: 'gas evolved' },
  { glyph: '↓',   label: 'precipitate' },
  { glyph: '+',   label: 'plus' },
  { glyph: '·',   label: 'middle dot' },
  { glyph: '⁺',   label: 'positive charge' },
  { glyph: '⁻',   label: 'negative charge' },
  { glyph: '²⁺',  label: 'two plus' },
  { glyph: '²⁻',  label: 'two minus' },
  { glyph: '₂',   label: 'subscript 2' },
  { glyph: '₃',   label: 'subscript 3' },
  { glyph: '₄',   label: 'subscript 4' },
  { glyph: 'Δ',   label: 'delta heat' },
  { glyph: 'pH',  label: 'pH' },
  { glyph: 'mol', label: 'mole' },
  { glyph: '(s)', label: 'solid phase' },
  { glyph: '(l)', label: 'liquid phase' },
  { glyph: '(g)', label: 'gas phase' },
  { glyph: '(aq)', label: 'aqueous phase' },
  // v2 audit Chemistry priority 1: subscripts `₀ ₁ ₅ ₆ ₇ ₈ ₉` — molar
  // formulas like C₆H₁₂O₆ glucose can't be typed without the missing
  // digits (₂ ₃ ₄ already exist above).
  { glyph: '₀', label: 'subscript 0' },
  { glyph: '₁', label: 'subscript 1' },
  { glyph: '₅', label: 'subscript 5' },
  { glyph: '₆', label: 'subscript 6' },
  { glyph: '₇', label: 'subscript 7' },
  { glyph: '₈', label: 'subscript 8' },
  { glyph: '₉', label: 'subscript 9' },
  // v2 audit Chemistry priority 2: composite molar units (g/mol used in
  // every molar-mass problem; mol/L for molarity).
  { glyph: 'g/mol', label: 'grams per mole' },
  { glyph: 'mol/L', label: 'moles per litre' },
  // v2 audit Chemistry priority 3: % for empirical / mass-percent
  // problems (lives on Adv-Math but a chip switch interrupts).
  { glyph: '%', label: 'percent chem' },
];

function MathChemistryKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-chemistry-keyboard">
      <SharedDecorRow prefix="math-chem-decor" />
      <GlyphGrid testid="math-chemistry-elements" glyphs={CHEMISTRY_ELEMENTS} cols={8} textSize="text-xl" />
      <GlyphGrid testid="math-chemistry-ops" glyphs={CHEMISTRY_OPS} cols={10} textSize="text-lg" />
    </div>
  );
}

// ── Phase 6 — Physics keyboard ───────────────────────────────────
//
// Greek letters (lower + upper case used in physics), common SI
// units, base operators, and the constants the AI tutor expects to
// see in school-physics expressions (c, h, ℏ, G, k_B, q, e).

const PHYSICS_GREEK: Array<{ glyph: string; label: string }> = [
  { glyph: 'α', label: 'alpha' }, { glyph: 'β', label: 'beta' },
  { glyph: 'γ', label: 'gamma' }, { glyph: 'δ', label: 'delta' },
  { glyph: 'ε', label: 'epsilon' }, { glyph: 'η', label: 'eta' },
  { glyph: 'θ', label: 'theta' }, { glyph: 'λ', label: 'lambda' },
  { glyph: 'μ', label: 'mu' }, { glyph: 'ν', label: 'nu' },
  { glyph: 'π', label: 'pi' }, { glyph: 'ρ', label: 'rho' },
  { glyph: 'σ', label: 'sigma' }, { glyph: 'τ', label: 'tau' },
  { glyph: 'φ', label: 'phi' }, { glyph: 'ψ', label: 'psi' },
  { glyph: 'ω', label: 'omega' },
  { glyph: 'Δ', label: 'big delta' }, { glyph: 'Σ', label: 'big sigma' },
  { glyph: 'Φ', label: 'big phi' }, { glyph: 'Ω', label: 'big omega' },
];

const PHYSICS_UNITS: Array<{ glyph: string; label: string }> = [
  { glyph: 'm',  label: 'metre' }, { glyph: 's',  label: 'second' },
  { glyph: 'kg', label: 'kilogram' }, { glyph: 'A',  label: 'ampere' },
  { glyph: 'K',  label: 'kelvin' }, { glyph: 'mol', label: 'mole-physics' },
  { glyph: 'N',  label: 'newton' }, { glyph: 'J',  label: 'joule' },
  { glyph: 'W',  label: 'watt' }, { glyph: 'V',  label: 'volt' },
  { glyph: 'Ω',  label: 'ohm' }, { glyph: 'Hz', label: 'hertz' },
  { glyph: 'Pa', label: 'pascal' }, { glyph: 'T',  label: 'tesla' },
  { glyph: 'C',  label: 'coulomb' }, { glyph: 'eV', label: 'electron volt' },
];

const PHYSICS_OPS: Array<{ glyph: string; label: string }> = [
  { glyph: '∫', label: 'integral' }, { glyph: '∂', label: 'partial' },
  { glyph: '∇', label: 'nabla' }, { glyph: '∑', label: 'sum' },
  { glyph: '∏', label: 'product' }, { glyph: '·', label: 'dot product' },
  { glyph: '×', label: 'cross product' }, { glyph: '→', label: 'right arrow' },
  { glyph: '⃗',  label: 'vector hat' }, { glyph: '|', label: 'magnitude bar' },
  { glyph: '⟨', label: 'left bracket' }, { glyph: '⟩', label: 'right bracket' },
  { glyph: 'c', label: 'speed of light' }, { glyph: 'h', label: 'planck' },
  { glyph: 'ℏ', label: 'hbar' }, { glyph: 'G', label: 'grav constant' },
  { glyph: '°', label: 'degree' }, { glyph: '∞', label: 'infinity' },
  // v2 audit Physics priority 3: gravitational acceleration constant.
  // `c` (speed of light) already lives in this row; `g` is the
  // matching kinematics constant and was missing entirely.
  { glyph: 'g', label: 'grav accel' },
];

// v2 audit Physics priority 1: equation variables row. The greek + SI
// units rows alone don't let a student write a kinematics equation —
// the symbol they actually solve for (F, a, v, u, p, t, d, h, r, KE,
// PE, GPE) lived only on the Letters chip. Adding the variables here
// removes the Letters → Phys → Letters chain in every problem.
const PHYSICS_VARS: Array<{ glyph: string; label: string }> = [
  { glyph: 'F',   label: 'force' },
  { glyph: 'a',   label: 'acceleration' },
  { glyph: 'v',   label: 'velocity' },
  { glyph: 'u',   label: 'initial velocity' },
  { glyph: 'p',   label: 'momentum' },
  { glyph: 't',   label: 'time' },
  { glyph: 'd',   label: 'distance' },
  { glyph: 'h',   label: 'height' },
  { glyph: 'r',   label: 'radius-phys' },
  { glyph: 'KE',  label: 'kinetic energy' },
  { glyph: 'PE',  label: 'potential energy' },
  { glyph: 'GPE', label: 'gravitational potential energy' },
];

// v2 audit Physics priority 2: composite SI units (m/s, m/s², km/h,
// kg·m/s, N·m). Each is a multi-tap nightmare without a single tile —
// the audit measured "dozens of times" per workflow.
const PHYSICS_COMPOSITE: Array<{ glyph: string; label: string }> = [
  { glyph: 'm/s',    label: 'metres per second' },
  { glyph: 'm/s²',   label: 'metres per second squared' },
  { glyph: 'km/h',   label: 'kilometres per hour' },
  { glyph: 'kg·m/s', label: 'kilogram metre per second' },
  { glyph: 'N·m',    label: 'newton metre' },
];

function MathPhysicsKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-physics-keyboard">
      <SharedDecorRow prefix="math-phys-decor" />
      <GlyphGrid testid="math-physics-greek" glyphs={PHYSICS_GREEK} cols={11} textSize="text-xl" />
      <GlyphGrid testid="math-physics-units" glyphs={PHYSICS_UNITS} cols={8} textSize="text-lg" />
      <GlyphGrid testid="math-physics-ops" glyphs={PHYSICS_OPS} cols={9} textSize="text-lg" />
      <GlyphGrid testid="math-physics-vars" glyphs={PHYSICS_VARS} cols={12} textSize="text-base" />
      <GlyphGrid testid="math-physics-composite" glyphs={PHYSICS_COMPOSITE} cols={5} textSize="text-base" />
    </div>
  );
}

// ── Phase 6 — Programming keyboard (Python / Java toggle) ────────
//
// Single keyboard component with a `lang` prop. Python and Java
// share the operator + bracket row; the keyword row swaps. We commit
// keywords with a trailing space so "if " feels natural rather than
// running into the next token. Brackets / operators commit raw.

const COMMON_OPS: Array<{ glyph: string; label: string }> = [
  { glyph: '(',  label: 'open paren' }, { glyph: ')',  label: 'close paren' },
  { glyph: '[',  label: 'open bracket' }, { glyph: ']',  label: 'close bracket' },
  { glyph: '{',  label: 'open brace' }, { glyph: '}',  label: 'close brace' },
  { glyph: '=',  label: 'assign' }, { glyph: '==', label: 'equal' },
  { glyph: '!=', label: 'not equal' }, { glyph: '<',  label: 'less' },
  { glyph: '>',  label: 'greater' }, { glyph: '<=', label: 'less eq' },
  { glyph: '>=', label: 'greater eq' }, { glyph: '+',  label: 'plus-prog' },
  { glyph: '-',  label: 'minus-prog' }, { glyph: '*',  label: 'star' },
  { glyph: '/',  label: 'slash' }, { glyph: '%',  label: 'percent-prog' },
  { glyph: ':',  label: 'colon' }, { glyph: ';',  label: 'semicolon' },
  { glyph: ',',  label: 'comma-prog' }, { glyph: '.',  label: 'dot' },
  { glyph: '"',  label: 'dquote' }, { glyph: "'",  label: 'squote' },
];

const PYTHON_KEYWORDS = [
  'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return',
  'import', 'from', 'as', 'in', 'is', 'not', 'and', 'or',
  'True', 'False', 'None', 'lambda', 'with', 'try', 'except', 'finally',
  'print', 'len', 'range', 'self',
];

const JAVA_KEYWORDS = [
  'public', 'private', 'protected', 'class', 'void', 'int', 'String', 'boolean',
  'if', 'else', 'for', 'while', 'return', 'new', 'this', 'null',
  'true', 'false', 'import', 'static', 'final', 'package',
  'try', 'catch', 'throws', 'extends', 'implements', 'interface',
];

const PROG_DIGITS = '0123456789'.split('');

// v2 audit Python priority 1: built-in functions row. `print`, `len`,
// `range` already live as keywords — adding the rest of the high-
// frequency built-ins removes the per-character spell-out for any
// algorithm assignment.
const PYTHON_BUILTINS = [
  'sum', 'max', 'min', 'abs', 'sorted', 'list', 'dict', 'str', 'int', 'float', 'input',
];

// v2 audit Python priority 2/3: `#` comment marker, an indent key
// (4-space tile labelled →| matching existing nav-key vocabulary),
// and a newline glyph (↵ matches the right-return key on Main).
//
// v2 audit Java priority 1/2/3: compound-assignment ops, Java idiom
// tokens (System.out.println etc.), and the @ annotation marker.
const PYTHON_EXTRAS: Array<{ glyph: string; label: string }> = [
  { glyph: '#',  label: 'comment hash' },
  { glyph: '→|', label: 'indent' },
  { glyph: '↵',  label: 'newline' },
];
const JAVA_COMPOUND_OPS: Array<{ glyph: string; label: string }> = [
  { glyph: '++', label: 'increment' },
  { glyph: '--', label: 'decrement' },
  { glyph: '+=', label: 'plus equals' },
  { glyph: '-=', label: 'minus equals' },
  { glyph: '*=', label: 'times equals' },
  { glyph: '/=', label: 'divide equals' },
];
const JAVA_IDIOMS = [
  'System.out.println', 'System.out.print', 'length', 'length()',
  'equals', 'toString', 'Math.',
];
const JAVA_EXTRAS: Array<{ glyph: string; label: string }> = [
  { glyph: '@',  label: 'annotation at' },
  { glyph: '↵',  label: 'newline' },
];

function MathProgrammingKeyboard({ lang }: { lang: 'python' | 'java' }) {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  // Full a-z always visible (no pagination, per 2026-05-08 user report
  // "scrollable keyboard is unacceptable when typing codes"). Case
  // shift remains — Java's class names are PascalCase, Python's
  // CONSTS are SHOUTY_CASE.
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[52px] active:translate-y-px font-mono';
  const keywords = lang === 'python' ? PYTHON_KEYWORDS : JAVA_KEYWORDS;
  const testidPrefix = lang === 'python' ? 'math-python' : 'math-java';
  // Code is character-driven on a monospace grid — committing the
  // whole keyword into a single cell stuffed "private" / "String"
  // into one 56 px slot and the glyphs ran into the next cell
  // (user-reported visual collision). One-char-per-cell matches how
  // a code editor lays code out and reads naturally on the canvas.
  // Trailing space lands too so the next keyword doesn't fuse into
  // the previous one.
  const commitToken = (token: string) => {
    keyFeedback();
    for (const ch of token) commitGlyph(ch);
    commitGlyph(' ');
  };
  // Indent key commits 4 spaces (PEP-8 / Java convention) without a
  // trailing extra space. Newline commits a single newline glyph; the
  // grid serializer already renders \n as a row break in code mode.
  const commitIndent = () => {
    keyFeedback();
    for (let i = 0; i < 4; i++) commitGlyph(' ');
  };
  const commitNewline = () => {
    keyFeedback();
    commitGlyph('\n');
  };
  // v2 audit additions per language. Python: built-ins (one cell per
  // char + trailing space, same convention as keywords). Java:
  // compound-assignment ops (raw glyph) + idioms (token-style).
  const builtins  = lang === 'python' ? PYTHON_BUILTINS : [];
  const idioms    = lang === 'java' ? JAVA_IDIOMS : [];
  const extras    = lang === 'python' ? PYTHON_EXTRAS : JAVA_EXTRAS;
  const compoundOps = lang === 'java' ? JAVA_COMPOUND_OPS : [];
  return (
    <div className="p-1.5 space-y-1" data-testid={`math-programming-${lang}-keyboard`} data-lang={lang}>
      <GlyphGrid testid={`${testidPrefix}-ops`} glyphs={COMMON_OPS} cols={12} textSize="text-base" />
      {/* 14 cols pack the 28-entry PYTHON_KEYWORDS / JAVA_KEYWORDS
          arrays into TWO rows (28/14 = 2). Earlier grid-cols-7 forced
          FOUR rows + the letters + digits which exceeded the panel
          container, clipping the bottom rows or eating the canvas
          (user report Image #27 2026-05-08: "it introduces more
          bugs"). On narrow phones (iPhone portrait ≈ 302px available) 14
          cols → 21px/col → keywords overflow and smash together. Fix:
          horizontally scrollable flex row — each keyword gets its natural
          width and the user swipes to reach the rest. */}
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div className="flex gap-1 pb-1" style={{ minWidth: 'max-content' }}>
          {keywords.map((kw) => (
            <button
              key={kw}
              onClick={() => commitToken(kw)}
              data-testid={`${testidPrefix}-kw-${kw}`}
              data-glyph={kw}
              aria-label={`${lang} keyword ${kw}`}
              className={`${KEY_BASE} py-2 text-sm whitespace-nowrap px-2 shrink-0`}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>
      {/* v2 audit Python priority 1: built-in functions — also scrollable. */}
      {lang === 'python' && builtins.length > 0 && (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div className="flex gap-1 pb-1" style={{ minWidth: 'max-content' }}>
            {builtins.map((bi) => (
              <button
                key={`py-builtin-${bi}`}
                onClick={() => commitToken(bi)}
                data-testid={`${testidPrefix}-builtin-${bi}`}
                data-glyph={bi}
                aria-label={`python builtin ${bi}`}
                className={`${KEY_BASE} py-2 text-sm whitespace-nowrap px-2 shrink-0`}
              >
                {bi}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* v2 audit Java priority 1: compound-assignment ops (raw glyph). */}
      {lang === 'java' && compoundOps.length > 0 && (
        <div className="grid grid-cols-6 gap-1">
          {compoundOps.map(({ glyph, label }) => (
            <button
              key={`java-cop-${glyph}`}
              onClick={() => { keyFeedback(); commitGlyph(glyph); }}
              data-testid={`${testidPrefix}-compop-${label.replace(/ /g, '-')}`}
              data-glyph={glyph}
              aria-label={`java ${label}`}
              className={`${KEY_BASE} py-2 text-base whitespace-nowrap`}
            >
              {glyph}
            </button>
          ))}
        </div>
      )}
      {/* v2 audit Java priority 2: idiom tokens. */}
      {lang === 'java' && idioms.length > 0 && (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}><div className="flex gap-1 pb-1" style={{ minWidth: 'max-content' }}>
          {idioms.map((id) => (
            <button
              key={`java-idiom-${id}`}
              onClick={() => commitToken(id)}
              data-testid={`${testidPrefix}-idiom-${id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
              data-glyph={id}
              aria-label={`java idiom ${id}`}
              className={`${KEY_BASE} py-2 text-sm whitespace-nowrap px-2 shrink-0`}
            >
              {id}
            </button>
          ))}
        </div></div>
      )}
      {/* extras merged into digit row below */}
      {/* Digits + underscore + language extras — merged into one row.
          Letters removed: the 'a a-z' chip covers identifiers without
          adding a redundant 8th row that pushed the canvas to <100px.
          Digits stay here for numeric literals without leaving the tab. */}
      <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
        {extras.map(({ glyph, label }) => (
          <button
            key={`prog-extra2-${label}`}
            onClick={() => {
              if (label === 'indent') return commitIndent();
              if (label === 'newline') return commitNewline();
              keyFeedback();
              commitGlyph(glyph);
            }}
            data-testid={`${testidPrefix}-extra-${label.replace(/ /g, '-')}`}
            data-glyph={glyph}
            aria-label={`${lang} ${label}`}
            className={`${KEY_BASE} py-1.5 text-base whitespace-nowrap`}
          >
            {glyph}
          </button>
        ))}
        {PROG_DIGITS.map((d) => (
          <button
            key={`prog-d-${d}`}
            onClick={() => { keyFeedback(); commitGlyph(d); }}
            data-testid={`${testidPrefix}-digit-${d}`}
            data-glyph={d}
            aria-label={`digit ${d}`}
            className={`${KEY_BASE} py-1.5 text-lg`}
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => { keyFeedback(); commitGlyph('_'); }}
          data-testid={`${testidPrefix}-underscore`}
          data-glyph="_"
          aria-label="underscore"
          className={`${KEY_BASE} py-1.5 text-lg`}
        >
          _
        </button>
      </div>
    </div>
  );
}

// ── Phase 7 — Biology keyboard ───────────────────────────────────
//
// DNA/RNA bases, codon arrows, organelles, taxonomy ranks, and
// genetics shorthand. Punnett squares are drawn directly on the
// cell-grid canvas via the existing lock tool.

const BIO_NUCLEOTIDES: Array<{ glyph: string; label: string }> = [
  { glyph: 'A', label: 'adenine' },
  { glyph: 'T', label: 'thymine' },
  { glyph: 'G', label: 'guanine' },
  { glyph: 'C', label: 'cytosine' },
  { glyph: 'U', label: 'uracil' },
  { glyph: '→', label: 'translates to' },
  { glyph: '⇒', label: 'gives rise to' },
  { glyph: 'mRNA', label: 'messenger rna' },
  { glyph: 'tRNA', label: 'transfer rna' },
  { glyph: 'rRNA', label: 'ribosomal rna' },
  { glyph: 'DNA',  label: 'dna' },
  { glyph: 'RNA',  label: 'rna' },
];

const BIO_GENETICS: Array<{ glyph: string; label: string }> = [
  { glyph: 'AA', label: 'homozygous dominant' },
  { glyph: 'Aa', label: 'heterozygous' },
  { glyph: 'aa', label: 'homozygous recessive' },
  { glyph: 'BB', label: 'big-b homozygous' },
  { glyph: 'Bb', label: 'big-b heterozygous' },
  { glyph: 'bb', label: 'big-b homozygous recessive' },
  { glyph: 'F1', label: 'first generation' },
  { glyph: 'F2', label: 'second generation' },
  { glyph: 'P',  label: 'parental' },
  { glyph: '×',  label: 'cross' },
  { glyph: '♂',  label: 'male' },
  { glyph: '♀',  label: 'female' },
];

const BIO_TAXONOMY: Array<{ glyph: string; label: string }> = [
  { glyph: 'Domain',  label: 'domain' },
  { glyph: 'Kingdom', label: 'kingdom' },
  { glyph: 'Phylum',  label: 'phylum' },
  { glyph: 'Class',   label: 'class' },
  { glyph: 'Order',   label: 'order' },
  { glyph: 'Family',  label: 'family' },
  { glyph: 'Genus',   label: 'genus' },
  { glyph: 'Species', label: 'species' },
];

const BIO_ORGANELLES: Array<{ glyph: string; label: string }> = [
  { glyph: 'nucleus',     label: 'nucleus' },
  { glyph: 'mitochondria', label: 'mitochondria' },
  { glyph: 'ribosome',    label: 'ribosome' },
  { glyph: 'ER',          label: 'endoplasmic reticulum' },
  { glyph: 'Golgi',       label: 'golgi' },
  { glyph: 'lysosome',    label: 'lysosome' },
  { glyph: 'chloroplast', label: 'chloroplast' },
  { glyph: 'cell wall',   label: 'cell wall' },
  { glyph: 'membrane',    label: 'cell membrane' },
  { glyph: 'cytoplasm',   label: 'cytoplasm' },
  { glyph: 'vacuole',     label: 'vacuole' },
  { glyph: 'nucleolus',   label: 'nucleolus' },
];

// v2 audit Biology priority 2: exponent keys for population growth +
// dilution problems (2³, 4², ^n series). `²` `³` already live on
// Adv-Math but a chip switch interrupts the workflow.
const BIO_EXPONENTS: Array<{ glyph: string; label: string }> = [
  { glyph: '²',  label: 'squared bio' },
  { glyph: '³',  label: 'cubed bio' },
  { glyph: '^n', label: 'caret n' },
];

// v2 audit Biology priority 3: codon-table glyphs. Translation problems
// are core grade-9 biology and needed the three-letter amino-acid
// abbreviations + the Stop codon marker.
const BIO_CODONS: Array<{ glyph: string; label: string }> = [
  { glyph: 'Met',  label: 'methionine' },
  { glyph: 'Ala',  label: 'alanine' },
  { glyph: 'Tyr',  label: 'tyrosine' },
  { glyph: 'Stop', label: 'stop codon' },
];

// v2 audit Biology priority 1: case-toggle row. The fixed AA/Bb tiles
// hard-code letter pairs; some textbook problems use Cc, Pp, Rr, etc.
// We KEEP the existing fixed pair tiles (BIO_GENETICS) because users
// may rely on them, and add an additive case-toggle row that flips
// `A a B b C c P p` between uppercase (dominant) and lowercase
// (recessive) variants. Implementation is a `useState` boolean per
// the audit's "don't over-engineer" guidance.
const BIO_CASE_TOGGLE_PAIRS: Array<[string, string]> = [
  ['A', 'a'], ['B', 'b'], ['C', 'c'], ['P', 'p'],
];

function MathBiologyCaseToggleRow() {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const [shifted, setShifted] = useState(true);
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[56px] active:translate-y-px';
  const TOGGLE_BASE =
    'aac-btn rounded-lg font-bold border border-transparent select-none ' +
    'flex items-center justify-center min-h-[56px] active:translate-y-px ' +
    'bg-[#2196F3] text-white whitespace-nowrap';
  return (
    <div
      className="grid grid-cols-9 gap-1.5 p-2"
      data-testid="math-biology-case-toggle"
      data-shift={shifted ? '1' : '0'}
    >
      <button
        onClick={() => { tapFeedback(); setShifted((s) => !s); }}
        data-testid="math-biology-case-shift"
        aria-pressed={shifted}
        aria-label="toggle allele case"
        className={`${TOGGLE_BASE} text-base`}
      >
        {shifted ? 'Aa' : 'aA'}
      </button>
      {BIO_CASE_TOGGLE_PAIRS.map(([up, lo]) => {
        const glyph = shifted ? up : lo;
        return (
          <button
            key={`bio-case-${up}`}
            onClick={() => { keyFeedback(); commitGlyph(glyph); }}
            data-testid={`math-biology-case-${up.toLowerCase()}`}
            data-glyph={glyph}
            aria-label={`allele ${glyph}`}
            className={`${KEY_BASE} py-3 text-2xl`}
          >
            {glyph}
          </button>
        );
      })}
      {/* Pad to 9 cols so the 4 letter pairs (8 letters) + shift fill the row */}
      {BIO_CASE_TOGGLE_PAIRS.slice(0, 4).map(([up, lo]) => {
        // Render the OPPOSITE-case sibling so a row of "A a B b C c P p"
        // is always visible at once (pair view), independent of the
        // shift state above. Shift switches which is *highlighted* via
        // the data-shift attr; both glyphs remain tappable for users
        // who can't be bothered to hold the toggle.
        const glyph = shifted ? lo : up;
        return (
          <button
            key={`bio-case-pair-${up}`}
            onClick={() => { keyFeedback(); commitGlyph(glyph); }}
            data-testid={`math-biology-case-pair-${up.toLowerCase()}`}
            data-glyph={glyph}
            aria-label={`allele ${glyph}`}
            className={`${KEY_BASE} py-3 text-2xl`}
          >
            {glyph}
          </button>
        );
      })}
    </div>
  );
}

function MathBiologyKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-biology-keyboard">
      <GlyphGrid testid="math-biology-nucleotides" glyphs={BIO_NUCLEOTIDES} cols={6} textSize="text-lg" />
      <GlyphGrid testid="math-biology-genetics" glyphs={BIO_GENETICS} cols={6} textSize="text-lg" />
      <MathBiologyCaseToggleRow />
      <GlyphGrid testid="math-biology-codons" glyphs={BIO_CODONS} cols={4} textSize="text-base" />
      <GlyphGrid testid="math-biology-exponents" glyphs={BIO_EXPONENTS} cols={3} textSize="text-2xl" />
      <GlyphGrid testid="math-biology-taxonomy" glyphs={BIO_TAXONOMY} cols={8} textSize="text-base" />
      <GlyphGrid testid="math-biology-organelles" glyphs={BIO_ORGANELLES} cols={6} textSize="text-base" />
    </div>
  );
}

// ── Phase 7 — Statistics keyboard ────────────────────────────────
//
// Greek + sample stats + distributions + probability operators.
// Inequality intervals reuse the Adv Math keys via the chip
// switcher; this tab focuses on the statistics-specific glyphs.

const STATS_PARAMS: Array<{ glyph: string; label: string }> = [
  { glyph: 'μ',  label: 'population mean' },
  { glyph: 'σ',  label: 'population std' },
  { glyph: 'σ²', label: 'population variance' },
  { glyph: 'ρ',  label: 'correlation' },
  { glyph: 'x̄',  label: 'sample mean' },
  { glyph: 's',  label: 'sample std' },
  { glyph: 's²', label: 'sample variance' },
  { glyph: 'r',  label: 'sample correlation' },
  { glyph: 'n',  label: 'sample size' },
  { glyph: 'N',  label: 'population size' },
  { glyph: 'p̂',  label: 'sample proportion' },
  { glyph: 'p',  label: 'probability' },
];

const STATS_OPS: Array<{ glyph: string; label: string }> = [
  { glyph: 'Σ',   label: 'summation-stats' },
  { glyph: '∏',   label: 'product-stats' },
  { glyph: 'P(',  label: 'probability of' },
  { glyph: 'E[',  label: 'expected value' },
  { glyph: 'Var[', label: 'variance of' },
  { glyph: 'SE',  label: 'standard error' },
  { glyph: 'CI',  label: 'confidence interval' },
  { glyph: 'H0',  label: 'null hypothesis' },
  { glyph: 'Ha',  label: 'alternative hypothesis' },
  { glyph: '!',   label: 'factorial' },
  { glyph: 'C(',  label: 'combinations' },
  { glyph: 'P(',  label: 'permutations' },
  // v2 audit Statistics priority 1: critical-value tiles. ME (margin
  // of error), z* and t* are the three most-used unknowns in a CI /
  // hypothesis-test problem and were missing entirely.
  { glyph: 'ME', label: 'margin of error' },
  { glyph: 'z*', label: 'z star critical' },
  { glyph: 't*', label: 't star critical' },
  // v2 audit Statistics priority 2: mirror inequality / factorial keys
  // into Stats so the user can write a one-chip hypothesis test.
  // These also live on Adv-Math; the duplicate is intentional.
  { glyph: '<', label: 'less than stats' },
  { glyph: '>', label: 'greater than stats' },
  { glyph: '≤', label: 'less or equal stats' },
  { glyph: '≥', label: 'greater or equal stats' },
  // v2 audit Statistics priority 3: paired-data primitives.
  { glyph: 'Cov(',  label: 'covariance of' },
  { glyph: 'corr(', label: 'correlation of' },
  { glyph: 'Pr(',   label: 'probability prefix' },
];

const STATS_DISTRIBUTIONS: Array<{ glyph: string; label: string }> = [
  { glyph: '𝒩',  label: 'normal' },
  { glyph: 'z',  label: 'z score' },
  { glyph: 't',  label: 't statistic' },
  { glyph: 'χ²', label: 'chi squared' },
  { glyph: 'F',  label: 'f statistic' },
  { glyph: 'df', label: 'degrees of freedom' },
  { glyph: 'α',  label: 'alpha-stats' },
  { glyph: 'β',  label: 'beta-stats' },
  { glyph: 'p-value', label: 'p value' },
  { glyph: '≈',  label: 'approximately-stats' },
  { glyph: '≠',  label: 'not equal-stats' },
  { glyph: '∼',  label: 'distributed as' },
];

function MathStatisticsKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-statistics-keyboard">
      <GlyphGrid testid="math-stats-params" glyphs={STATS_PARAMS} cols={6} textSize="text-lg" />
      <GlyphGrid testid="math-stats-ops" glyphs={STATS_OPS} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-stats-dist" glyphs={STATS_DISTRIBUTIONS} cols={6} textSize="text-base" />
    </div>
  );
}

// ── Phase 7 — Music notation keyboard ────────────────────────────
//
// Clefs + note durations + rests + accidentals + dynamics. Time
// signatures are written via the existing fraction-box decoration
// tool (Adv Math tab), so the user composes "4/4" by tapping the
// fraction tool then digits.

// Clef glyphs are SMP (U+1D11E / U+1D122 / U+1D121). They render on
// macOS / iOS but tofu on Android Chrome and Linux Firefox stock
// fonts. Music-theory shorthand "G clef / F clef / C clef" maps the
// clef to a single Latin letter (the line that names the clef) — use
// the letter directly so every device renders it. Labels still say
// "treble clef" / "bass clef" / "alto clef" via aria-label.
const MUSIC_CLEFS: Array<{ glyph: string; label: string }> = [
  { glyph: 'G', label: 'treble clef' },
  { glyph: 'F', label: 'bass clef' },
  { glyph: 'C', label: 'alto clef' },
];

// Music notation glyphs in the Unicode SMP block (U+1D100–U+1D1FF,
// "Musical Symbols") require a font that ships those codepoints —
// Bravura, Noto Music, or a system fallback. Stock fonts on iOS
// Safari / Android Chrome / Linux Firefox don't include them, so the
// glyphs render as ☒ tofu (May 2026 user screenshot: whole note,
// half note, all rests showed ☒). The BMP block (U+2660–U+266F)
// covers ♩ ♪ ♫ ♬ ♭ ♮ ♯ which DO render everywhere; whole and half
// notes have no BMP codepoints, so we use short text labels (W / H)
// as the on-tile glyph. The committed cell carries the same label so
// the AAC user can still distinguish them visually, and serialization
// remains plain ASCII (no broken-glyph copies).
const MUSIC_NOTES: Array<{ glyph: string; label: string }> = [
  { glyph: 'W',  label: 'whole note' },
  { glyph: 'H',  label: 'half note' },
  { glyph: '♩',  label: 'quarter note' },
  { glyph: '♪',  label: 'eighth note' },
  { glyph: '♫',  label: 'beamed eighths' },
  // A bare sixteenth note (no beam) is U+1D161 (SMP, tofu). The
  // closest BMP glyph is ♬ U+266C "beamed sixteenths" — semantically
  // adjacent but not identical. Use the text label "S" instead to
  // keep the symbol set unambiguous; AAC users see "S" beside W/H/Q/E.
  { glyph: 'S',  label: 'sixteenth note' },
];

// Rests have no BMP codepoints at all — every rest glyph in the
// "Musical Symbols" block is U+1D13B–U+1D13F. Substitute short
// readable text labels so the tiles aren't tofu. AAC user can read
// "WR" and know it means "whole rest" the way they'd read "W" as
// "whole note" — short, sortable by duration, glyph-safe everywhere.
const MUSIC_RESTS: Array<{ glyph: string; label: string }> = [
  { glyph: 'WR', label: 'whole rest' },
  { glyph: 'HR', label: 'half rest' },
  { glyph: 'QR', label: 'quarter rest' },
  { glyph: 'ER', label: 'eighth rest' },
  { glyph: 'SR', label: 'sixteenth rest' },
];

// ♯ ♭ ♮ are BMP — render fine. Double sharp / double flat are SMP
// (U+1D12A / U+1D12B) and tofu on stock fonts → use ## / bb which is
// what music theory textbooks use anyway as ASCII shorthand.
const MUSIC_ACCIDENTALS: Array<{ glyph: string; label: string }> = [
  { glyph: '♯',  label: 'sharp' },
  { glyph: '♭',  label: 'flat' },
  { glyph: '♮',  label: 'natural' },
  { glyph: '##', label: 'double sharp' },
  { glyph: 'bb', label: 'double flat' },
];

const MUSIC_DYNAMICS: Array<{ glyph: string; label: string }> = [
  { glyph: 'pp',     label: 'pianissimo' },
  { glyph: 'p',      label: 'piano' },
  { glyph: 'mp',     label: 'mezzo piano' },
  { glyph: 'mf',     label: 'mezzo forte' },
  { glyph: 'f',      label: 'forte' },
  { glyph: 'ff',     label: 'fortissimo' },
  { glyph: 'cresc.', label: 'crescendo' },
  { glyph: 'dim.',   label: 'diminuendo' },
];

function MathMusicKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-music-keyboard">
      <GlyphGrid testid="math-music-clefs" glyphs={MUSIC_CLEFS} cols={3} textSize="text-2xl" />
      <GlyphGrid testid="math-music-notes" glyphs={MUSIC_NOTES} cols={6} textSize="text-2xl" />
      <GlyphGrid testid="math-music-rests" glyphs={MUSIC_RESTS} cols={5} textSize="text-2xl" />
      <GlyphGrid testid="math-music-accidentals" glyphs={MUSIC_ACCIDENTALS} cols={5} textSize="text-2xl" />
      <GlyphGrid testid="math-music-dynamics" glyphs={MUSIC_DYNAMICS} cols={8} textSize="text-base" />
    </div>
  );
}

// ── Phase 7 — Earth Science keyboard ─────────────────────────────
//
// Weather symbols, plate-tectonics arrows (also useful for vector
// diagrams), astronomical bodies, and the geologic time / distance
// units a high-school earth-science class actually uses.

const EARTH_WEATHER: Array<{ glyph: string; label: string }> = [
  { glyph: '☀', label: 'sun' },
  { glyph: '☁', label: 'cloud' },
  { glyph: '☂', label: 'rain' },
  { glyph: '❄', label: 'snow' },
  { glyph: '⚡', label: 'lightning' },
  { glyph: '☈', label: 'storm' },
  { glyph: '☄', label: 'comet' },
  { glyph: '🌫', label: 'fog' },
  { glyph: '🌪', label: 'tornado' },
  { glyph: '🌊', label: 'ocean wave' },
];

const EARTH_PLATES: Array<{ glyph: string; label: string }> = [
  { glyph: '→',  label: 'plate east' },
  { glyph: '←',  label: 'plate west' },
  { glyph: '↑',  label: 'plate up' },
  { glyph: '↓',  label: 'plate down' },
  { glyph: '⇄',  label: 'transform' },
  { glyph: '⊕',  label: 'subduction' },
  { glyph: '⊖',  label: 'rifting' },
];

const EARTH_ASTRO: Array<{ glyph: string; label: string }> = [
  { glyph: '☉', label: 'sun-symbol' },
  { glyph: '☾', label: 'moon' },
  { glyph: '⊕', label: 'earth-symbol' },
  { glyph: '☿', label: 'mercury' },
  { glyph: '♀', label: 'venus' },
  { glyph: '♂', label: 'mars' },
  { glyph: '♃', label: 'jupiter' },
  { glyph: '♄', label: 'saturn' },
  { glyph: '♅', label: 'uranus' },
  { glyph: '♆', label: 'neptune' },
];

const EARTH_UNITS: Array<{ glyph: string; label: string }> = [
  { glyph: 'AU',  label: 'astronomical unit' },
  { glyph: 'ly',  label: 'light year' },
  { glyph: 'pc',  label: 'parsec' },
  { glyph: 'Mya', label: 'million years ago' },
  { glyph: 'Gya', label: 'billion years ago' },
  { glyph: 'km',  label: 'kilometre-earth' },
  { glyph: 'mb',  label: 'millibar' },
  { glyph: '°C',  label: 'celsius' },
  { glyph: '°F',  label: 'fahrenheit' },
  { glyph: 'mph', label: 'miles per hour' },
  // v2 audit Earth Science priority 2: yr / kyr / Myr time-span units
  // (distinct from Mya / Gya which are "ago" tags). Astronomy +
  // half-life problems use the span unit form ("4.5 Gyr ago" vs "the
  // half-life is 5730 yr").
  { glyph: 'yr',  label: 'year span' },
  { glyph: 'kyr', label: 'kiloyear' },
  { glyph: 'Myr', label: 'megayear' },
];

// v2 audit Earth Science priority 1: scientific-notation helper. `×10`
// tile + the full superscript digit set so a student can compose
// `1.5 ×10⁸ km` in a single chip without hopping back to Adv-Math.
const EARTH_SCINOT: Array<{ glyph: string; label: string }> = [
  { glyph: '×10', label: 'times ten' },
  { glyph: '⁰',  label: 'sup 0' },
  { glyph: '¹',  label: 'sup 1' },
  { glyph: '²',  label: 'sup 2' },
  { glyph: '³',  label: 'sup 3' },
  { glyph: '⁴',  label: 'sup 4' },
  { glyph: '⁵',  label: 'sup 5' },
  { glyph: '⁶',  label: 'sup 6' },
  { glyph: '⁷',  label: 'sup 7' },
  { glyph: '⁸',  label: 'sup 8' },
  { glyph: '⁹',  label: 'sup 9' },
];

function MathEarthScienceKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-earth-science-keyboard">
      <SharedDecorRow prefix="math-earth-decor" />
      <GlyphGrid testid="math-earth-weather" glyphs={EARTH_WEATHER} cols={10} textSize="text-2xl" />
      <GlyphGrid testid="math-earth-plates" glyphs={EARTH_PLATES} cols={7} textSize="text-2xl" />
      <GlyphGrid testid="math-earth-astro" glyphs={EARTH_ASTRO} cols={10} textSize="text-2xl" />
      <GlyphGrid testid="math-earth-units" glyphs={EARTH_UNITS} cols={7} textSize="text-base" />
      <GlyphGrid testid="math-earth-scinot" glyphs={EARTH_SCINOT} cols={11} textSize="text-2xl" />
    </div>
  );
}

// ── Phase 8 — History keyboard (locale-aware) ────────────────────
//
// Era markers + century ordinals are universal. Events + periods
// split into a small WORLD core (taught in every curriculum) plus a
// per-locale slice driven by useSettingsStore.language so a
// Romanian student sees Stephen the Great + 1989 Revolution, a
// Chinese student sees Tang/Song/Ming/Qing + 1949 PRC, etc. Anglo-
// Western default no longer hides everyone else's history.

const HIST_ERAS: Array<{ glyph: string; label: string }> = [
  { glyph: 'BCE', label: 'before common era' },
  { glyph: 'CE',  label: 'common era' },
  { glyph: 'BC',  label: 'before christ' },
  { glyph: 'AD',  label: 'anno domini' },
  { glyph: 'c.',  label: 'circa' },
  { glyph: 'fl.', label: 'flourished' },
  { glyph: '–',   label: 'date range dash' },
  { glyph: '→',   label: 'leads to' },
  { glyph: '↦',   label: 'continues to' },
];

const HIST_CENTURIES: Array<{ glyph: string; label: string }> = [
  { glyph: '1st',  label: 'first' },
  { glyph: '2nd',  label: 'second' },
  { glyph: '3rd',  label: 'third' },
  { glyph: '4th',  label: 'fourth' },
  { glyph: '5th',  label: 'fifth' },
  { glyph: '10th', label: 'tenth' },
  { glyph: '15th', label: 'fifteenth' },
  { glyph: '17th', label: 'seventeenth' },
  { glyph: '18th', label: 'eighteenth' },
  { glyph: '19th', label: 'nineteenth' },
  { glyph: '20th', label: 'twentieth' },
  { glyph: '21st', label: 'twenty first' },
  // v2 audit History priority 2: fill the century-ordinal gap so every
  // 1st–21st century is reachable. Append-only — existing tiles stay
  // in their original positions.
  { glyph: '6th',  label: 'sixth' },
  { glyph: '7th',  label: 'seventh' },
  { glyph: '8th',  label: 'eighth' },
  { glyph: '9th',  label: 'ninth' },
  { glyph: '11th', label: 'eleventh' },
  { glyph: '12th', label: 'twelfth' },
  { glyph: '13th', label: 'thirteenth' },
  { glyph: '14th', label: 'fourteenth' },
  { glyph: '16th', label: 'sixteenth' },
];

// v2 audit History priority 3: mirror Δ (date-arithmetic span), ≈
// (approximate century), ~ (circa) into the History panel — these
// are core date-math operators every world-history workflow needs.
const HIST_DECOR: Array<{ glyph: string; label: string }> = [
  { glyph: 'Δ',  label: 'delta history' },
  { glyph: '≈',  label: 'approximately history' },
  { glyph: '~',  label: 'circa tilde' },
];

/** Events taught in essentially every world-history curriculum.
 *  Always rendered regardless of locale. */
const HIST_EVENTS_WORLD: Array<{ glyph: string; label: string }> = [
  { glyph: '476',  label: 'fall of rome' },
  { glyph: '1453', label: 'fall of constantinople' },
  { glyph: '1914', label: 'wwi start' },
  { glyph: '1918', label: 'wwi end' },
  { glyph: '1939', label: 'wwii start' },
  { glyph: '1945', label: 'wwii end' },
  { glyph: '1969', label: 'moon landing' },
  // v2 audit History priority 1: append the dates every survey course
  // covers (Columbus, Jamestown, French Revolution, Napoleonic-era
  // milestones, US Civil War end, Spanish-American War, Crash of '29).
  // Some duplicates intentionally overlap with locale events (en 1607
  // jamestown, en 1865 us civil war end) — the per-locale event list
  // also surfaces them for legacy users; this WORLD tier guarantees
  // the dates are always reachable regardless of locale.
  { glyph: '1492', label: 'columbus' },
  { glyph: '1607', label: 'jamestown world' },
  { glyph: '1789', label: 'french revolution world' },
  { glyph: '1804', label: 'napoleon emperor world' },
  { glyph: '1815', label: 'congress of vienna' },
  { glyph: '1848', label: 'springtime of nations' },
  { glyph: '1865', label: 'us civil war end world' },
  { glyph: '1898', label: 'spanish american war world' },
  { glyph: '1929', label: 'great depression' },
];

/** Periods taught in every curriculum (era / archaeological scale). */
const HIST_PERIODS_WORLD: Array<{ glyph: string; label: string }> = [
  { glyph: 'Stone Age',    label: 'stone age' },
  { glyph: 'Bronze Age',   label: 'bronze age' },
  { glyph: 'Iron Age',     label: 'iron age' },
  { glyph: 'Antiquity',    label: 'antiquity' },
  { glyph: 'Medieval',     label: 'medieval' },
  { glyph: 'Modern',       label: 'modern' },
  { glyph: 'Contemporary', label: 'contemporary' },
];

/** Per-locale events surfaced when useSettingsStore.language matches.
 *  Each entry must use globally-unique labels (after slugification)
 *  because the GlyphGrid testid uses the label as a suffix. */
const HIST_EVENTS_BY_LOCALE: Record<string, Array<{ glyph: string; label: string }>> = {
  en: [
    { glyph: '1066', label: 'norman conquest' },
    { glyph: '1215', label: 'magna carta' },
    { glyph: '1607', label: 'jamestown' },
    { glyph: '1776', label: 'us independence' },
    { glyph: '1865', label: 'us civil war end' },
  ],
  es: [
    { glyph: '711',  label: 'moorish invasion' },
    { glyph: '1492', label: 'reconquista' },
    { glyph: '1810', label: 'spanish american indep' },
    { glyph: '1898', label: 'spanish american war' },
  ],
  pt: [
    { glyph: '1500', label: 'cabral arrival' },
    { glyph: '1822', label: 'brazilian independence' },
    { glyph: '1888', label: 'abolition of slavery' },
    { glyph: '1974', label: 'carnation revolution' },
  ],
  fr: [
    { glyph: '1789', label: 'french revolution' },
    { glyph: '1804', label: 'napoleon emperor' },
    { glyph: '1944', label: 'liberation of france' },
    { glyph: '1958', label: 'fifth republic' },
  ],
  de: [
    { glyph: '1517', label: 'reformation' },
    { glyph: '1871', label: 'german unification' },
    { glyph: '1933', label: 'third reich start' },
    { glyph: '1989', label: 'berlin wall fall' },
  ],
  ro: [
    { glyph: '1457', label: 'stephen the great' },
    { glyph: '1859', label: 'union of principalities' },
    { glyph: '1918', label: 'great union' },
    { glyph: '1989', label: 'romanian revolution' },
  ],
  ru: [
    { glyph: '988',  label: 'kievan baptism' },
    { glyph: '1547', label: 'ivan iv crowned' },
    { glyph: '1812', label: 'napoleonic invasion' },
    { glyph: '1917', label: 'russian revolution' },
    { glyph: '1991', label: 'ussr dissolution' },
  ],
  uk: [
    { glyph: '988',  label: 'kyivan baptism' },
    { glyph: '1709', label: 'battle of poltava' },
    { glyph: '1932', label: 'holodomor' },
    { glyph: '1991', label: 'ukrainian independence' },
  ],
  ja: [
    { glyph: '794',  label: 'heian capital' },
    { glyph: '1185', label: 'kamakura shogunate' },
    { glyph: '1603', label: 'edo period' },
    { glyph: '1868', label: 'meiji restoration' },
    { glyph: '1945', label: 'japan surrender' },
  ],
  ko: [
    { glyph: '668',  label: 'silla unification' },
    { glyph: '1392', label: 'joseon founding' },
    { glyph: '1910', label: 'japanese annexation' },
    { glyph: '1945', label: 'korean liberation' },
    { glyph: '1953', label: 'armistice' },
  ],
  zh: [
    { glyph: '221',  label: 'qin unification' },
    { glyph: '618',  label: 'tang dynasty' },
    { glyph: '1368', label: 'ming dynasty' },
    { glyph: '1644', label: 'qing dynasty' },
    { glyph: '1911', label: 'xinhai revolution' },
    { glyph: '1949', label: 'prc founding' },
  ],
  ar: [
    { glyph: '622',  label: 'hijra' },
    { glyph: '750',  label: 'abbasid caliphate' },
    { glyph: '1923', label: 'ottoman dissolution' },
    { glyph: '2011', label: 'arab spring' },
  ],
  it: [
    { glyph: '27',   label: 'roman empire start' },
    { glyph: '1494', label: 'italian wars' },
    { glyph: '1861', label: 'italian unification' },
    { glyph: '1946', label: 'italian republic' },
  ],
  pl: [
    { glyph: '966',  label: 'poland baptism' },
    { glyph: '1410', label: 'battle of grunwald' },
    { glyph: '1791', label: 'may 3 constitution' },
    { glyph: '1939', label: 'invasion of poland' },
    { glyph: '1989', label: 'polish round table' },
  ],
  nl: [
    { glyph: '1568', label: 'eighty years war' },
    { glyph: '1648', label: 'dutch independence' },
    { glyph: '1815', label: 'kingdom netherlands' },
  ],
  he: [
    { glyph: '70',   label: 'second temple destruction' },
    { glyph: '1492', label: 'spanish expulsion' },
    { glyph: '1948', label: 'israel founding' },
    { glyph: '1967', label: 'six day war' },
  ],
  hi: [
    { glyph: '322',  label: 'mauryan empire' },
    { glyph: '1526', label: 'mughal empire' },
    { glyph: '1857', label: 'sepoy rebellion' },
    { glyph: '1947', label: 'indian independence' },
    { glyph: '1971', label: 'bangladesh war' },
  ],
  vi: [
    { glyph: '938',  label: 'bach dang victory' },
    { glyph: '1858', label: 'french colonization' },
    { glyph: '1945', label: 'vietnamese independence' },
    { glyph: '1975', label: 'vietnam reunification' },
  ],
  tr: [
    { glyph: '1071', label: 'manzikert' },
    { glyph: '1453', label: 'conquest of constantinople' },
    { glyph: '1923', label: 'turkish republic' },
  ],
};

/** Per-locale period names that augment the universal set. */
const HIST_PERIODS_BY_LOCALE: Record<string, Array<{ glyph: string; label: string }>> = {
  en: [
    { glyph: 'Renaissance',   label: 'renaissance' },
    { glyph: 'Enlightenment', label: 'enlightenment' },
    { glyph: 'Industrial',    label: 'industrial revolution' },
    { glyph: 'Victorian',     label: 'victorian' },
  ],
  es: [
    { glyph: 'Reconquista',  label: 'reconquista period' },
    { glyph: 'Habsburg',     label: 'habsburg spain' },
    { glyph: 'Bourbon',      label: 'bourbon spain' },
  ],
  pt: [
    { glyph: 'Discoveries',  label: 'age of discoveries' },
    { glyph: 'Império',      label: 'brazilian empire' },
  ],
  fr: [
    { glyph: 'Renaissance',  label: 'french renaissance' },
    { glyph: 'Ancien',       label: 'ancien regime' },
    { glyph: 'Belle Époque', label: 'belle epoque' },
  ],
  de: [
    { glyph: 'Reformation',  label: 'reformation period' },
    { glyph: 'Weimar',       label: 'weimar republic' },
    { glyph: 'Cold War',     label: 'cold war' },
  ],
  ro: [
    { glyph: 'Phanariot',    label: 'phanariot' },
    { glyph: 'Wallachia',    label: 'wallachia period' },
    { glyph: 'Moldavia',     label: 'moldavia period' },
    { glyph: 'Interbelic',   label: 'interbellum' },
  ],
  ru: [
    { glyph: 'Tsarist',      label: 'tsarist' },
    { glyph: 'Soviet',       label: 'soviet' },
    { glyph: 'Imperial',     label: 'russian imperial' },
  ],
  ja: [
    { glyph: 'Heian',        label: 'heian period' },
    { glyph: 'Kamakura',     label: 'kamakura period' },
    { glyph: 'Edo',          label: 'edo period' },
    { glyph: 'Meiji',        label: 'meiji period' },
    { glyph: 'Shōwa',        label: 'showa period' },
  ],
  zh: [
    { glyph: 'Han',          label: 'han dynasty' },
    { glyph: 'Tang',         label: 'tang dynasty period' },
    { glyph: 'Song',         label: 'song dynasty' },
    { glyph: 'Ming',         label: 'ming dynasty period' },
    { glyph: 'Qing',         label: 'qing dynasty period' },
  ],
  ar: [
    { glyph: 'Caliphate',    label: 'caliphate' },
    { glyph: 'Ottoman',      label: 'ottoman period' },
  ],
  hi: [
    { glyph: 'Vedic',        label: 'vedic period' },
    { glyph: 'Mauryan',      label: 'mauryan period' },
    { glyph: 'Mughal',       label: 'mughal period' },
    { glyph: 'British Raj',  label: 'british raj' },
  ],
  ko: [
    { glyph: 'Three Kingdoms', label: 'three kingdoms' },
    { glyph: 'Goryeo',         label: 'goryeo period' },
    { glyph: 'Joseon',         label: 'joseon period' },
  ],
};

function MathHistoryKeyboard() {
  const language = useSettingsStore((s) => s.language);
  const historyRegion = useSettingsStore((s) => s.historyRegion);
  // Coalesce on the base language tag (en, es-MX → es) so Latin
  // American Spanish gets the same cohort as European Spanish.
  const baseLang = (language || 'en').toLowerCase().split(/[-_]/)[0];
  const localeEvents = HIST_EVENTS_BY_LOCALE[baseLang] ?? HIST_EVENTS_BY_LOCALE['en'];
  const localePeriods = HIST_PERIODS_BY_LOCALE[baseLang] ?? HIST_PERIODS_BY_LOCALE['en'];
  // Sub-national region (e.g. US-TX, CA-QC, UK-SCT, DE-BY, IN-TN).
  // Layered ON TOP of the universal + national tiers — never replaces
  // them, because high-school curricula always teach a national +
  // regional mix, not regional alone.
  const regionalEvents = eventsForRegion(historyRegion);
  const events = [...HIST_EVENTS_WORLD, ...localeEvents, ...regionalEvents];
  const periods = [...HIST_PERIODS_WORLD, ...localePeriods];
  return (
    <div
      className="p-2 space-y-2"
      data-testid="math-history-keyboard"
      data-locale={baseLang}
      data-region={historyRegion ?? ''}
    >
      <GlyphGrid testid="math-history-eras" glyphs={HIST_ERAS} cols={9} textSize="text-lg" />
      <GlyphGrid testid="math-history-decor" glyphs={HIST_DECOR} cols={3} textSize="text-2xl" />
      <GlyphGrid testid="math-history-centuries" glyphs={HIST_CENTURIES} cols={7} textSize="text-lg" />
      <GlyphGrid testid="math-history-periods" glyphs={periods} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-history-events" glyphs={events} cols={6} textSize="text-lg" />
    </div>
  );
}

// ── Phase 8 — Language Arts keyboard ─────────────────────────────
//
// Parts-of-speech tags + sentence-type markers + canonical
// punctuation + citation-style labels. AAC users tag a sentence
// composed via the main qwerty by laying tags above it on the
// cell-grid.

const LA_PARTS_OF_SPEECH: Array<{ glyph: string; label: string }> = [
  { glyph: 'N',     label: 'noun' },
  { glyph: 'V',     label: 'verb' },
  { glyph: 'ADJ',   label: 'adjective' },
  { glyph: 'ADV',   label: 'adverb' },
  { glyph: 'PRON',  label: 'pronoun' },
  { glyph: 'PREP',  label: 'preposition' },
  { glyph: 'CONJ',  label: 'conjunction' },
  { glyph: 'ART',   label: 'article' },
  { glyph: 'INTJ',  label: 'interjection' },
  { glyph: 'AUX',   label: 'auxiliary' },
  { glyph: 'DET',   label: 'determiner' },
  { glyph: 'NUM',   label: 'numeral' },
];

const LA_SENTENCE_TYPES: Array<{ glyph: string; label: string }> = [
  { glyph: 'DECL',   label: 'declarative' },
  { glyph: 'INT',    label: 'interrogative' },
  { glyph: 'IMP',    label: 'imperative' },
  { glyph: 'EXCL',   label: 'exclamatory' },
  { glyph: 'COMP',   label: 'compound' },
  { glyph: 'CPLX',   label: 'complex' },
];

const LA_PUNCTUATION: Array<{ glyph: string; label: string }> = [
  { glyph: '.',  label: 'period' },
  { glyph: ',',  label: 'comma-la' },
  { glyph: ';',  label: 'semicolon-la' },
  { glyph: ':',  label: 'colon-la' },
  { glyph: '!',  label: 'exclamation' },
  { glyph: '?',  label: 'question' },
  { glyph: "'",  label: 'apostrophe' },
  { glyph: '"',  label: 'dquote-la' },
  { glyph: '(',  label: 'open paren-la' },
  { glyph: ')',  label: 'close paren-la' },
  { glyph: '–',  label: 'en dash' },
  { glyph: '—',  label: 'em dash' },
  { glyph: '…',  label: 'ellipsis' },
];

const LA_CITATION: Array<{ glyph: string; label: string }> = [
  { glyph: 'MLA',   label: 'mla' },
  { glyph: 'APA',   label: 'apa' },
  { glyph: 'Chi',   label: 'chicago' },
  { glyph: 'p.',    label: 'page' },
  { glyph: 'pp.',   label: 'pages' },
  { glyph: 'ed.',   label: 'edition' },
  { glyph: 'vol.',  label: 'volume' },
  { glyph: 'ibid.', label: 'ibid' },
];

// v2 audit Language Arts priority 1: syntactic-role tags for
// sentence-diagramming workflows. SUBJ / PRED / OBJ / DO / IO / COMP-OBJ
// are the canonical labels every grade-8 grammar text uses.
const LA_SYNTACTIC: Array<{ glyph: string; label: string }> = [
  { glyph: 'SUBJ',     label: 'subject' },
  { glyph: 'PRED',     label: 'predicate' },
  { glyph: 'OBJ',      label: 'object' },
  { glyph: 'DO',       label: 'direct object' },
  { glyph: 'IO',       label: 'indirect object' },
  { glyph: 'COMP-OBJ', label: 'object complement' },
];

// v2 audit Language Arts priority 3: Q&A two-tile pair for study notes.
const LA_QA: Array<{ glyph: string; label: string }> = [
  { glyph: 'Q:', label: 'question prefix' },
  { glyph: 'A:', label: 'answer prefix' },
];

// v2 audit Language Arts priority 2: case-toggle. Some style guides
// prefer lowercase POS abbreviations (n., v., adj.). The toggle flips
// between the existing uppercase set and a parallel lowercase set so
// muscle memory on the original tiles is preserved.
const LA_POS_LOWER: Array<{ glyph: string; label: string }> = [
  { glyph: 'n.',    label: 'noun lower' },
  { glyph: 'v.',    label: 'verb lower' },
  { glyph: 'adj.',  label: 'adjective lower' },
  { glyph: 'adv.',  label: 'adverb lower' },
  { glyph: 'pron.', label: 'pronoun lower' },
  { glyph: 'prep.', label: 'preposition lower' },
  { glyph: 'conj.', label: 'conjunction lower' },
  { glyph: 'art.',  label: 'article lower' },
  { glyph: 'intj.', label: 'interjection lower' },
  { glyph: 'aux.',  label: 'auxiliary lower' },
  { glyph: 'det.',  label: 'determiner lower' },
  { glyph: 'num.',  label: 'numeral lower' },
];

function MathLanguageArtsKeyboard() {
  // v2 audit Language Arts priority 2: simple useState boolean toggle
  // between uppercase POS abbreviations (default) and lowercase
  // variants. The toggle button itself is a Shift tile rendered above
  // the POS row.
  const [posLower, setPosLower] = useState(false);
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[56px] active:translate-y-px';
  const TOGGLE_BASE =
    'aac-btn rounded-lg font-bold border border-transparent select-none ' +
    'flex items-center justify-center min-h-[56px] active:translate-y-px ' +
    'bg-[#2196F3] text-white whitespace-nowrap';
  return (
    <div className="p-2 space-y-2" data-testid="math-language-arts-keyboard" data-pos-case={posLower ? 'lower' : 'upper'}>
      <div className="flex gap-1.5 px-2">
        <button
          onClick={() => { tapFeedback(); setPosLower((s) => !s); }}
          data-testid="math-la-pos-shift"
          aria-pressed={posLower}
          aria-label="toggle POS abbreviation case"
          className={`${TOGGLE_BASE} px-3 text-base`}
        >
          {posLower ? 'n.→N' : 'N→n.'}
        </button>
        <span className={`${KEY_BASE} flex-1 text-sm bg-transparent border-transparent text-secondary`}>
          {posLower ? 'lowercase POS' : 'uppercase POS'}
        </span>
      </div>
      <GlyphGrid
        testid="math-la-pos"
        glyphs={posLower ? LA_POS_LOWER : LA_PARTS_OF_SPEECH}
        cols={6}
        textSize="text-lg"
      />
      <GlyphGrid testid="math-la-syntactic" glyphs={LA_SYNTACTIC} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-la-sentence" glyphs={LA_SENTENCE_TYPES} cols={6} textSize="text-lg" />
      <GlyphGrid testid="math-la-qa" glyphs={LA_QA} cols={2} textSize="text-2xl" />
      <GlyphGrid testid="math-la-punct" glyphs={LA_PUNCTUATION} cols={13} textSize="text-lg" />
      <GlyphGrid testid="math-la-cite" glyphs={LA_CITATION} cols={8} textSize="text-lg" />
    </div>
  );
}
