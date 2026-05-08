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
  'aac-btn rounded-lg border border-theme select-none text-xs font-bold ' +
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
        // At ~46 px per row + ~6 px gaps = ~340 px. Floor 340 / max
        // 460 leaves the canvas ≥ ~40 % of the viewport on every
        // device. Earlier 520 px ceiling ate too much canvas (user
        // report Image #27 "it introduces more bugs" — the keyboard
        // dominated and the canvas was a sliver).
        className="h-[clamp(340px,38svh,460px)] overflow-hidden"
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

// ── Letters keyboard — full a-z, no pagination ──────────────────
//
// User report 2026-05-08 (Image #25): "a-z should be full a-z - fix
// it". The earlier paginated layout (16 letters + "q-z →" toggle)
// forced the user through an extra tap to reach q-z; on Programming
// chips the same paginated identifier row meant typing a name like
// `quack` or `xyz` was a multi-tap dance. Full 26 letters in a 13×2
// grid fits in ~100 px and removes the toggle entirely.

const LETTERS_AZ = 'abcdefghijklmnopqrstuvwxyz'.split('');
// Kept for callers that still want to address the historical halves
// (test fixtures, etc.). Not used by the keyboard itself anymore.
const LETTERS_AP = LETTERS_AZ.slice(0, 16);
const LETTERS_QZ = LETTERS_AZ.slice(16);

function MathLettersKeyboard() {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[40px] active:translate-y-px';
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
            className={`${KEY_BASE} py-2 text-lg sm:text-xl`}
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
  'flex items-center justify-center min-h-[44px] active:translate-y-px';

interface GlyphGridProps {
  testid: string;
  glyphs: Array<{ glyph: string; label: string }>;
  cols?: number;
  /** Defaults to text-xl. Pass smaller (text-base) for unit symbols
   *  that include 2-3 chars. */
  textSize?: string;
}

function GlyphGrid({ testid, glyphs, cols = 8, textSize = 'text-xl' }: GlyphGridProps) {
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
            className={`${GLYPH_KEY_BASE} py-2.5 ${textSize} whitespace-nowrap`}
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  return <GlyphGrid testid="math-time-distance-keyboard" glyphs={TIME_DISTANCE_GLYPHS} cols={6} textSize="text-base" />;
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
  return <GlyphGrid testid="math-weight-keyboard" glyphs={WEIGHT_GLYPHS} cols={4} textSize="text-base" />;
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
  return <GlyphGrid testid="math-volume-keyboard" glyphs={VOLUME_GLYPHS} cols={4} textSize="text-base" />;
}

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
];
function MathGeomKeyboard() {
  return <GlyphGrid testid="math-geom-keyboard" glyphs={GEOM_GLYPHS} cols={6} />;
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
];

function MathChemistryKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-chemistry-keyboard">
      <GlyphGrid testid="math-chemistry-elements" glyphs={CHEMISTRY_ELEMENTS} cols={8} textSize="text-lg" />
      <GlyphGrid testid="math-chemistry-ops" glyphs={CHEMISTRY_OPS} cols={10} textSize="text-base" />
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
];

function MathPhysicsKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-physics-keyboard">
      <GlyphGrid testid="math-physics-greek" glyphs={PHYSICS_GREEK} cols={11} textSize="text-lg" />
      <GlyphGrid testid="math-physics-units" glyphs={PHYSICS_UNITS} cols={8} textSize="text-base" />
      <GlyphGrid testid="math-physics-ops" glyphs={PHYSICS_OPS} cols={9} textSize="text-base" />
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

function MathProgrammingKeyboard({ lang }: { lang: 'python' | 'java' }) {
  const commitGlyph = useMathGridStore((s) => s.commitGlyph);
  // Full a-z always visible (no pagination, per 2026-05-08 user report
  // "scrollable keyboard is unacceptable when typing codes"). Case
  // shift remains — Java's class names are PascalCase, Python's
  // CONSTS are SHOUTY_CASE.
  const [shifted, setShifted] = useState(false);
  const KEY_BASE =
    'aac-btn surface-key text-primary rounded-lg font-bold border border-theme select-none ' +
    'flex items-center justify-center min-h-[44px] active:translate-y-px font-mono';
  const TOGGLE_BASE =
    'aac-btn rounded-lg font-bold border border-transparent select-none ' +
    'flex items-center justify-center min-h-[44px] px-3 active:translate-y-px ' +
    'bg-[#2196F3] text-white text-sm whitespace-nowrap font-mono';
  const keywords = lang === 'python' ? PYTHON_KEYWORDS : JAVA_KEYWORDS;
  const testidPrefix = lang === 'python' ? 'math-python' : 'math-java';
  // Full a-z (no pagination — see comment above on the user report).
  const letters = shifted ? LETTERS_AZ.map((l) => l.toUpperCase()) : LETTERS_AZ;
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
  return (
    <div className="p-1.5 space-y-1" data-testid={`math-programming-${lang}-keyboard`} data-lang={lang}>
      <GlyphGrid testid={`${testidPrefix}-ops`} glyphs={COMMON_OPS} cols={12} textSize="text-sm" />
      {/* 14 cols pack the 28-entry PYTHON_KEYWORDS / JAVA_KEYWORDS
          arrays into TWO rows (28/14 = 2). Earlier grid-cols-7 forced
          FOUR rows + the letters + digits which exceeded the panel
          container, clipping the bottom rows or eating the canvas
          (user report Image #27 2026-05-08: "it introduces more
          bugs"). 14 cols at 1280 px viewport ≈ 91 px per cell — fits
          "finally" / "implements" / "protected" comfortably. */}
      <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
        {keywords.map((kw) => (
          <button
            key={kw}
            onClick={() => commitToken(kw)}
            data-testid={`${testidPrefix}-kw-${kw}`}
            data-glyph={kw}
            aria-label={`${lang} keyword ${kw}`}
            className={`${KEY_BASE} py-1 text-xs whitespace-nowrap`}
          >
            {kw}
          </button>
        ))}
      </div>
      {/* Identifier row — full a-z + case shift, no pagination so the
          user can type any class / variable name without leaving the
          programming chip or scrolling. Each tap commits one char. */}
      <div
        className="flex gap-1.5"
        data-testid={`${testidPrefix}-letters-row`}
        data-shift={shifted ? '1' : '0'}
      >
        <button
          onClick={() => { tapFeedback(); setShifted((s) => !s); }}
          data-testid={`${testidPrefix}-letters-shift`}
          aria-pressed={shifted}
          aria-label="toggle letter case"
          className={TOGGLE_BASE}
        >
          {shifted ? 'AA' : 'aa'}
        </button>
        <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1 sm:gap-1.5 flex-1">
          {letters.map((ltr) => (
            <button
              key={ltr}
              onClick={() => { keyFeedback(); commitGlyph(ltr); }}
              data-testid={`${testidPrefix}-ltr-${ltr.toLowerCase()}`}
              data-glyph={ltr}
              aria-label={`letter ${ltr}`}
              className={`${KEY_BASE} py-1.5 text-base`}
            >
              {ltr}
            </button>
          ))}
        </div>
      </div>
      {/* Digits + underscore — needed for identifiers like var2,
          snake_case, __init__. Digits also live in the main chip but
          duplicating here keeps the user in programming mode. */}
      <div className="grid grid-cols-11 gap-1.5">
        {PROG_DIGITS.map((d) => (
          <button
            key={`prog-d-${d}`}
            onClick={() => { keyFeedback(); commitGlyph(d); }}
            data-testid={`${testidPrefix}-digit-${d}`}
            data-glyph={d}
            aria-label={`digit ${d}`}
            className={`${KEY_BASE} py-2 text-base`}
          >
            {d}
          </button>
        ))}
        <button
          key="prog-underscore"
          onClick={() => { keyFeedback(); commitGlyph('_'); }}
          data-testid={`${testidPrefix}-underscore`}
          data-glyph="_"
          aria-label="underscore"
          className={`${KEY_BASE} py-2 text-base`}
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

function MathBiologyKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-biology-keyboard">
      <GlyphGrid testid="math-biology-nucleotides" glyphs={BIO_NUCLEOTIDES} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-biology-genetics" glyphs={BIO_GENETICS} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-biology-taxonomy" glyphs={BIO_TAXONOMY} cols={8} textSize="text-sm" />
      <GlyphGrid testid="math-biology-organelles" glyphs={BIO_ORGANELLES} cols={6} textSize="text-sm" />
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
      <GlyphGrid testid="math-stats-params" glyphs={STATS_PARAMS} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-stats-ops" glyphs={STATS_OPS} cols={6} textSize="text-sm" />
      <GlyphGrid testid="math-stats-dist" glyphs={STATS_DISTRIBUTIONS} cols={6} textSize="text-sm" />
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
      <GlyphGrid testid="math-music-accidentals" glyphs={MUSIC_ACCIDENTALS} cols={5} textSize="text-xl" />
      <GlyphGrid testid="math-music-dynamics" glyphs={MUSIC_DYNAMICS} cols={8} textSize="text-sm" />
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
];

function MathEarthScienceKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-earth-science-keyboard">
      <GlyphGrid testid="math-earth-weather" glyphs={EARTH_WEATHER} cols={10} textSize="text-xl" />
      <GlyphGrid testid="math-earth-plates" glyphs={EARTH_PLATES} cols={7} textSize="text-xl" />
      <GlyphGrid testid="math-earth-astro" glyphs={EARTH_ASTRO} cols={10} textSize="text-xl" />
      <GlyphGrid testid="math-earth-units" glyphs={EARTH_UNITS} cols={6} textSize="text-sm" />
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
      <GlyphGrid testid="math-history-eras" glyphs={HIST_ERAS} cols={9} textSize="text-base" />
      <GlyphGrid testid="math-history-centuries" glyphs={HIST_CENTURIES} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-history-periods" glyphs={periods} cols={6} textSize="text-sm" />
      <GlyphGrid testid="math-history-events" glyphs={events} cols={6} textSize="text-base" />
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

function MathLanguageArtsKeyboard() {
  return (
    <div className="p-2 space-y-2" data-testid="math-language-arts-keyboard">
      <GlyphGrid testid="math-la-pos" glyphs={LA_PARTS_OF_SPEECH} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-la-sentence" glyphs={LA_SENTENCE_TYPES} cols={6} textSize="text-base" />
      <GlyphGrid testid="math-la-punct" glyphs={LA_PUNCTUATION} cols={13} textSize="text-base" />
      <GlyphGrid testid="math-la-cite" glyphs={LA_CITATION} cols={8} textSize="text-base" />
    </div>
  );
}
