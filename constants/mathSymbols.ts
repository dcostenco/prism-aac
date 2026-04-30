import { MathItem } from '@/types';

/**
 * Math symbols organized by category. The Math panel renders these as a
 * full-screen grid alongside the keyboard so a student can compose any
 * arithmetic, algebra, geometry, calculus, or logic expression covered in
 * a K–12 + introductory college curriculum without leaving the AAC app.
 *
 * `category` controls grouping in the panel:
 *   - basic         → arithmetic operators, comparison, digits, decimal
 *   - algebra       → variables, fraction, power, root, parens
 *   - constants     → π, e, i, ∞
 *   - greek         → α β θ λ μ σ Σ Δ ∇ Ω
 *   - calculus      → ∫ ∂ ∑ ∏ lim ′ dx
 *   - logic-sets    → ∈ ∉ ⊂ ⊃ ∪ ∩ ∅ ∀ ∃ ∧ ∨ ¬ → ↔
 *   - trig          → sin cos tan ° (kept short — chained as text)
 *   - misc          → ! ± ∓ ≈ ≠ ≤ ≥ ≪ ≫ ‰
 */
export const MATH_ITEMS: MathItem[] = [
  // ── Basic arithmetic + comparison ───────────────────────────────────────
  { id: 'math-plus',       symbol: '+',  label: 'Plus',          ttsText: 'plus',           category: 'basic', sortOrder: 0 },
  { id: 'math-minus',      symbol: '−',  label: 'Minus',         ttsText: 'minus',          category: 'basic', sortOrder: 1 },
  { id: 'math-times',      symbol: '×',  label: 'Times',         ttsText: 'times',          category: 'basic', sortOrder: 2 },
  { id: 'math-divide',     symbol: '÷',  label: 'Divide',        ttsText: 'divided by',     category: 'basic', sortOrder: 3 },
  { id: 'math-equals',     symbol: '=',  label: 'Equals',        ttsText: 'equals',         category: 'basic', sortOrder: 4 },
  { id: 'math-not-equal',  symbol: '≠',  label: 'Not equal',     ttsText: 'not equal to',   category: 'basic', sortOrder: 5 },
  { id: 'math-approx',     symbol: '≈',  label: 'Approximately', ttsText: 'approximately',  category: 'basic', sortOrder: 6 },
  { id: 'math-less',       symbol: '<',  label: 'Less than',     ttsText: 'less than',      category: 'basic', sortOrder: 7 },
  { id: 'math-greater',    symbol: '>',  label: 'Greater than',  ttsText: 'greater than',   category: 'basic', sortOrder: 8 },
  { id: 'math-le',         symbol: '≤',  label: 'Less or equal', ttsText: 'less than or equal to',    category: 'basic', sortOrder: 9 },
  { id: 'math-ge',         symbol: '≥',  label: 'Greater or eq', ttsText: 'greater than or equal to', category: 'basic', sortOrder: 10 },
  { id: 'math-plus-minus', symbol: '±',  label: 'Plus minus',    ttsText: 'plus or minus',  category: 'basic', sortOrder: 11 },
  { id: 'math-dot',        symbol: '·',  label: 'Dot',           ttsText: 'point',          category: 'basic', sortOrder: 12 },
  { id: 'math-decimal',    symbol: '.',  label: 'Decimal',       ttsText: 'point',          category: 'basic', sortOrder: 13 },
  { id: 'math-comma',      symbol: ',',  label: 'Comma',         ttsText: 'comma',          category: 'basic', sortOrder: 14 },
  { id: 'math-percent',    symbol: '%',  label: 'Percent',       ttsText: 'percent',        category: 'basic', sortOrder: 15 },
  { id: 'math-permille',   symbol: '‰',  label: 'Per mille',     ttsText: 'per mille',      category: 'basic', sortOrder: 16 },

  // ── Digits ──────────────────────────────────────────────────────────────
  { id: 'math-0', symbol: '0', label: '0', ttsText: 'zero',  category: 'digits', sortOrder: 20 },
  { id: 'math-1', symbol: '1', label: '1', ttsText: 'one',   category: 'digits', sortOrder: 21 },
  { id: 'math-2', symbol: '2', label: '2', ttsText: 'two',   category: 'digits', sortOrder: 22 },
  { id: 'math-3', symbol: '3', label: '3', ttsText: 'three', category: 'digits', sortOrder: 23 },
  { id: 'math-4', symbol: '4', label: '4', ttsText: 'four',  category: 'digits', sortOrder: 24 },
  { id: 'math-5', symbol: '5', label: '5', ttsText: 'five',  category: 'digits', sortOrder: 25 },
  { id: 'math-6', symbol: '6', label: '6', ttsText: 'six',   category: 'digits', sortOrder: 26 },
  { id: 'math-7', symbol: '7', label: '7', ttsText: 'seven', category: 'digits', sortOrder: 27 },
  { id: 'math-8', symbol: '8', label: '8', ttsText: 'eight', category: 'digits', sortOrder: 28 },
  { id: 'math-9', symbol: '9', label: '9', ttsText: 'nine',  category: 'digits', sortOrder: 29 },

  // ── Algebra ─────────────────────────────────────────────────────────────
  { id: 'math-x',           symbol: 'x',  label: 'Variable x',     ttsText: 'x',                   category: 'algebra', sortOrder: 40 },
  { id: 'math-y',           symbol: 'y',  label: 'Variable y',     ttsText: 'y',                   category: 'algebra', sortOrder: 41 },
  { id: 'math-n',           symbol: 'n',  label: 'Variable n',     ttsText: 'n',                   category: 'algebra', sortOrder: 42 },
  { id: 'math-fraction',    symbol: '⁄',  label: 'Fraction',       ttsText: 'over',                category: 'algebra', sortOrder: 43 },
  { id: 'math-power',       symbol: '^',  label: 'Power',          ttsText: 'to the power of',     category: 'algebra', sortOrder: 44 },
  { id: 'math-superscript', symbol: '²',  label: 'Squared',        ttsText: 'squared',             category: 'algebra', sortOrder: 45 },
  { id: 'math-cubed',       symbol: '³',  label: 'Cubed',          ttsText: 'cubed',               category: 'algebra', sortOrder: 46 },
  { id: 'math-sub-n',       symbol: 'ₙ',  label: 'Subscript n',    ttsText: 'sub n',               category: 'algebra', sortOrder: 47 },
  { id: 'math-sqrt',        symbol: '√',  label: 'Square root',    ttsText: 'square root of',      category: 'algebra', sortOrder: 48 },
  { id: 'math-cbrt',        symbol: '∛',  label: 'Cube root',      ttsText: 'cube root of',        category: 'algebra', sortOrder: 49 },
  { id: 'math-paren-open',  symbol: '(',  label: 'Open paren',     ttsText: 'open parenthesis',    category: 'algebra', sortOrder: 50 },
  { id: 'math-paren-close', symbol: ')',  label: 'Close paren',    ttsText: 'close parenthesis',   category: 'algebra', sortOrder: 51 },
  { id: 'math-bracket-open',  symbol: '[',  label: 'Open bracket',  ttsText: 'open bracket',       category: 'algebra', sortOrder: 52 },
  { id: 'math-bracket-close', symbol: ']',  label: 'Close bracket', ttsText: 'close bracket',      category: 'algebra', sortOrder: 53 },
  { id: 'math-brace-open',  symbol: '{',  label: 'Open brace',     ttsText: 'open brace',          category: 'algebra', sortOrder: 54 },
  { id: 'math-brace-close', symbol: '}',  label: 'Close brace',    ttsText: 'close brace',         category: 'algebra', sortOrder: 55 },
  { id: 'math-abs',         symbol: '|',  label: 'Absolute value', ttsText: 'absolute value of',   category: 'algebra', sortOrder: 56 },
  { id: 'math-factorial',   symbol: '!',  label: 'Factorial',      ttsText: 'factorial',           category: 'algebra', sortOrder: 57 },

  // ── Constants ───────────────────────────────────────────────────────────
  { id: 'math-pi',       symbol: 'π',  label: 'Pi',         ttsText: 'pi',         category: 'constants', sortOrder: 70 },
  { id: 'math-e',        symbol: 'e',  label: "Euler's e",  ttsText: 'e',          category: 'constants', sortOrder: 71 },
  { id: 'math-i',        symbol: 'i',  label: 'Imaginary',  ttsText: 'i',          category: 'constants', sortOrder: 72 },
  { id: 'math-infinity', symbol: '∞',  label: 'Infinity',   ttsText: 'infinity',   category: 'constants', sortOrder: 73 },
  { id: 'math-degree',   symbol: '°',  label: 'Degree',     ttsText: 'degrees',    category: 'constants', sortOrder: 74 },

  // ── Trigonometry ────────────────────────────────────────────────────────
  { id: 'math-sin',  symbol: 'sin',  label: 'Sine',     ttsText: 'sine of',     category: 'trig', sortOrder: 80 },
  { id: 'math-cos',  symbol: 'cos',  label: 'Cosine',   ttsText: 'cosine of',   category: 'trig', sortOrder: 81 },
  { id: 'math-tan',  symbol: 'tan',  label: 'Tangent',  ttsText: 'tangent of',  category: 'trig', sortOrder: 82 },
  { id: 'math-log',  symbol: 'log',  label: 'Log',      ttsText: 'log of',      category: 'trig', sortOrder: 83 },
  { id: 'math-ln',   symbol: 'ln',   label: 'Natural log', ttsText: 'natural log of', category: 'trig', sortOrder: 84 },

  // ── Calculus ────────────────────────────────────────────────────────────
  { id: 'math-integral', symbol: '∫',  label: 'Integral',     ttsText: 'integral of',          category: 'calculus', sortOrder: 90 },
  { id: 'math-partial',  symbol: '∂',  label: 'Partial',      ttsText: 'partial derivative',   category: 'calculus', sortOrder: 91 },
  { id: 'math-sum',      symbol: '∑',  label: 'Sum',          ttsText: 'sum of',               category: 'calculus', sortOrder: 92 },
  { id: 'math-product',  symbol: '∏',  label: 'Product',      ttsText: 'product of',           category: 'calculus', sortOrder: 93 },
  { id: 'math-limit',    symbol: 'lim', label: 'Limit',       ttsText: 'limit',                category: 'calculus', sortOrder: 94 },
  { id: 'math-prime',    symbol: '′',  label: 'Prime',        ttsText: 'prime',                category: 'calculus', sortOrder: 95 },
  { id: 'math-nabla',    symbol: '∇',  label: 'Nabla',        ttsText: 'nabla',                category: 'calculus', sortOrder: 96 },

  // ── Greek letters (most common in math) ─────────────────────────────────
  { id: 'math-alpha',  symbol: 'α', label: 'Alpha',  ttsText: 'alpha',  category: 'greek', sortOrder: 110 },
  { id: 'math-beta',   symbol: 'β', label: 'Beta',   ttsText: 'beta',   category: 'greek', sortOrder: 111 },
  { id: 'math-gamma',  symbol: 'γ', label: 'Gamma',  ttsText: 'gamma',  category: 'greek', sortOrder: 112 },
  { id: 'math-delta',  symbol: 'δ', label: 'Delta',  ttsText: 'delta',  category: 'greek', sortOrder: 113 },
  { id: 'math-DELTA',  symbol: 'Δ', label: 'Delta cap',  ttsText: 'capital delta',  category: 'greek', sortOrder: 114 },
  { id: 'math-theta',  symbol: 'θ', label: 'Theta',  ttsText: 'theta',  category: 'greek', sortOrder: 115 },
  { id: 'math-lambda', symbol: 'λ', label: 'Lambda', ttsText: 'lambda', category: 'greek', sortOrder: 116 },
  { id: 'math-mu',     symbol: 'μ', label: 'Mu',     ttsText: 'mu',     category: 'greek', sortOrder: 117 },
  { id: 'math-sigma',  symbol: 'σ', label: 'Sigma',  ttsText: 'sigma',  category: 'greek', sortOrder: 118 },
  { id: 'math-phi',    symbol: 'φ', label: 'Phi',    ttsText: 'phi',    category: 'greek', sortOrder: 119 },
  { id: 'math-omega',  symbol: 'ω', label: 'Omega',  ttsText: 'omega',  category: 'greek', sortOrder: 120 },
  { id: 'math-OMEGA',  symbol: 'Ω', label: 'Omega cap',  ttsText: 'capital omega',  category: 'greek', sortOrder: 121 },

  // ── Logic / sets ────────────────────────────────────────────────────────
  { id: 'math-elem',     symbol: '∈',  label: 'Element of',      ttsText: 'is an element of',     category: 'logic-sets', sortOrder: 140 },
  { id: 'math-not-elem', symbol: '∉',  label: 'Not element of',  ttsText: 'is not an element of', category: 'logic-sets', sortOrder: 141 },
  { id: 'math-subset',   symbol: '⊂',  label: 'Subset',          ttsText: 'subset of',            category: 'logic-sets', sortOrder: 142 },
  { id: 'math-superset', symbol: '⊃',  label: 'Superset',        ttsText: 'superset of',          category: 'logic-sets', sortOrder: 143 },
  { id: 'math-union',    symbol: '∪',  label: 'Union',           ttsText: 'union',                category: 'logic-sets', sortOrder: 144 },
  { id: 'math-intersect',symbol: '∩',  label: 'Intersection',    ttsText: 'intersect',            category: 'logic-sets', sortOrder: 145 },
  { id: 'math-empty',    symbol: '∅',  label: 'Empty set',       ttsText: 'empty set',            category: 'logic-sets', sortOrder: 146 },
  { id: 'math-forall',   symbol: '∀',  label: 'For all',         ttsText: 'for all',              category: 'logic-sets', sortOrder: 147 },
  { id: 'math-exists',   symbol: '∃',  label: 'There exists',    ttsText: 'there exists',         category: 'logic-sets', sortOrder: 148 },
  { id: 'math-and',      symbol: '∧',  label: 'And',             ttsText: 'and',                  category: 'logic-sets', sortOrder: 149 },
  { id: 'math-or',       symbol: '∨',  label: 'Or',              ttsText: 'or',                   category: 'logic-sets', sortOrder: 150 },
  { id: 'math-not',      symbol: '¬',  label: 'Not',             ttsText: 'not',                  category: 'logic-sets', sortOrder: 151 },
  { id: 'math-implies',  symbol: '→',  label: 'Implies',         ttsText: 'implies',              category: 'logic-sets', sortOrder: 152 },
  { id: 'math-iff',      symbol: '↔',  label: 'If and only if',  ttsText: 'if and only if',       category: 'logic-sets', sortOrder: 153 },
  { id: 'math-therefore', symbol: '∴', label: 'Therefore',       ttsText: 'therefore',            category: 'logic-sets', sortOrder: 154 },
];
