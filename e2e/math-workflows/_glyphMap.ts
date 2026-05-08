/**
 * Glyph → keyboard-key lookup for math-workflow e2e specs.
 *
 * Each subject's workflow spec types problems step-by-step by tapping
 * keys on the math panel. To stay aligned with the keyboard arrays in
 * `components/math/MathKeyboardRegion.tsx` and `MathMainKeyboard.tsx`,
 * we mirror the (label → glyph) entries here as a flat (glyph →
 * `data-testid` selector) lookup keyed by category. The arrays in
 * MathKeyboardRegion are the source of truth — these tables follow
 * them. If the keyboard adds a glyph, surface it here too.
 *
 * Selector convention follows the components:
 *   • `MathMainKeyboard`           → `[data-testid="math-key-${digit}"]`
 *     for digits, `math-key-${slug}` for operators (slug = label with
 *     spaces → dashes).
 *   • `MathAdvMathKeyboard`        → `[data-testid="math-key-adv-${slug}"]`
 *   • `MathLettersKeyboard`        → `[data-testid="math-key-ltr-${a}"]`
 *   • `GlyphGrid` (every other kb) → `[data-testid="${testid}-${slug}"]`
 *     where slug = `label.replace(/[^a-z0-9]+/g, '-').toLowerCase()`.
 *   • `MathProgrammingKeyboard`    → `[data-testid="math-${lang}-kw-${kw}"]`
 *     for keywords, `math-${lang}-ltr-${a}` for letters,
 *     `math-${lang}-digit-${d}` for digits, `math-${lang}-underscore`,
 *     and the ops grid uses `math-${lang}-ops-${slug}`.
 *
 * Workflow specs DON'T crash when a glyph is missing — they call
 * `lookup(glyph)` which returns `null`, then `test.skip()` with a
 * reason. The COVERAGE.md in tests/workflows is regenerated from the
 * same source.
 */

export interface KeyRef {
  /** Math category chip the user must select first. */
  category:
    | 'main' | 'adv-math' | 'letters' | 'misc-math'
    | 'time-distance' | 'weight' | 'volume' | 'geom' | 'money'
    | 'chemistry' | 'physics' | 'programming-python' | 'programming-java'
    | 'biology' | 'statistics' | 'music' | 'earth-science'
    | 'history' | 'language-arts';
  /** `data-testid` of the on-screen key. */
  testid: string;
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

// ── Main keyboard (MathMainKeyboard.tsx) ────────────────────────────
const MAIN_OPERATORS: Record<string, string> = {
  '+': 'plus',
  '−': 'minus',
  '×': 'times',
  '÷': 'divided-by',
  '=': 'equals',
  '.': 'decimal-point',
  ',': 'comma',
  '(': 'open-parenthesis',
  ')': 'close-parenthesis',
};
const MAIN: Record<string, KeyRef> = {};
for (const d of '0123456789') MAIN[d] = { category: 'main', testid: `math-key-${d}` };
for (const [g, label] of Object.entries(MAIN_OPERATORS)) {
  MAIN[g] = { category: 'main', testid: `math-key-${label}` };
}
MAIN[' '] = { category: 'main', testid: 'math-key-space' };

// ── Adv Math keyboard (label list mirrors MathKeyboardRegion.ADV_MATH_KEYS) ─
const ADV: Array<[string, string]> = [
  ['(', 'open paren'], [')', 'close paren'],
  ['<', 'less than'], ['>', 'greater than'],
  ['≤', 'less or equal'], ['≥', 'greater or equal'],
  ['≠', 'not equal'], ['%', 'percent'],
  ['π', 'pi'], ['x', 'variable x'], ['y', 'variable y'],
  ['a', 'variable a'], ['b', 'variable b'],
  ['√', 'square root'], ['²', 'squared'], ['³', 'cubed'],
  ['∛', 'cube root'], ['_', 'subscript marker'],
  ['.', 'decimal point'], [',', 'comma'],
  ['d', 'variable d'], ['p', 'variable p'], ['r', 'variable r'],
  ['m', 'variable m'], ['n', 'variable n'],
  ['±', 'plus minus'], ['≈', 'approximately equal'],
  ['≡', 'identical to'], ['|', 'absolute bar'], ['!', 'factorial'],
  ['log', 'logarithm'], ['ln', 'natural log'],
];
const ADV_MAP: Record<string, KeyRef> = {};
for (const [g, label] of ADV) {
  ADV_MAP[g] = { category: 'adv-math', testid: `math-key-adv-${label.replace(/ /g, '-')}` };
}

// ── Letters keyboard (a-z) ──────────────────────────────────────────
const LTR_MAP: Record<string, KeyRef> = {};
for (const c of 'abcdefghijklmnopqrstuvwxyz') {
  LTR_MAP[c] = { category: 'letters', testid: `math-key-ltr-${c}` };
}

// ── GlyphGrid keyboards: testid prefix per array ────────────────────
//
// Each tuple is [grid testid prefix, label list]. Workflow specs only
// need the glyph→testid map; the chip category is the second column.

interface Grid {
  category: KeyRef['category'];
  prefix: string;
  pairs: Array<[string, string]>;
}

const GRIDS: Grid[] = [
  // Misc math
  {
    category: 'misc-math',
    prefix: 'math-misc-keyboard',
    pairs: [
      ['∈', 'element of'], ['∉', 'not element of'],
      ['⊂', 'subset of'], ['⊆', 'subset or equal'],
      ['∪', 'union'], ['∩', 'intersection'],
      ['∅', 'empty set'], ['∀', 'for all'], ['∃', 'there exists'],
      ['¬', 'not'], ['∧', 'and'], ['∨', 'or'],
      ['∞', 'infinity'], ['∂', 'partial derivative'],
      ['∇', 'nabla'], ['∝', 'proportional to'],
      ['≡', 'identical to'], ['≅', 'congruent'], ['≈', 'approximately'],
      ['±', 'plus or minus'], ['∓', 'minus or plus'],
      ['[', 'open bracket misc'], [']', 'close bracket misc'],
      ['{', 'open brace misc'], ['}', 'close brace misc'],
      [':', 'ratio colon'], ['/', 'slash misc'],
      ['∴', 'therefore'], ['∵', 'because'],
      ['⊥', 'perpendicular misc'], ['∥', 'parallel misc'],
      ['⇒', 'implies'], ['⇔', 'iff'],
    ],
  },
  // Geom
  {
    category: 'geom',
    prefix: 'math-geom-keyboard',
    pairs: [
      ['△', 'triangle'], ['▲', 'filled triangle'], ['□', 'square'],
      ['◯', 'circle'], ['◇', 'diamond'], ['∠', 'angle'],
      ['⟂', 'perpendicular'], ['∥', 'parallel'], ['°', 'degree'],
      ['≅', 'congruent to'], ['≈', 'approximately equal'],
      ['↔', 'left-right arrow'],
      ['▢', 'rectangle'], ['▱', 'parallelogram'],
      ['⬠', 'pentagon'], ['⬡', 'hexagon'],
      ['⌒', 'arc'], ['⌓', 'segment'],
      ['◐', 'half circle left'], ['◑', 'half circle right'],
      ['◔', 'quarter circle'], ['─', 'horizontal line'], ['│', 'vertical line'],
      ['⌐', 'corner upper left'], ['¬', 'corner upper right'],
      ['└', 'corner lower left'], ['┘', 'corner lower right'],
      ['⊿', 'right triangle'], ['◊', 'lozenge'],
      ['cone', 'cone'], ['cyl', 'cylinder'], ['sphere', 'sphere'],
      ['cube', 'cube'], ['prism', 'prism'], ['pyramid', 'pyramid'],
      ['↑', 'arrow up'], ['↓', 'arrow down'],
      ['←', 'arrow left'], ['→', 'arrow right'],
      ['π', 'pi-geom'], ['r', 'radius'], ['d', 'diameter'],
      ['A', 'area'], ['V', 'volume-geom'], ['P', 'perimeter'],
    ],
  },
  // Time & distance
  {
    category: 'time-distance',
    prefix: 'math-time-distance-keyboard',
    pairs: [
      ['s', 'second'], ['min', 'minute'], ['hr', 'hour'], ['day', 'day'],
      ['mm', 'millimeter'], ['cm', 'centimeter'], ['m', 'meter'], ['km', 'kilometer'],
      ['in', 'inch'], ['ft', 'foot'], ['yd', 'yard'], ['mi', 'mile'],
    ],
  },
  // Weight
  {
    category: 'weight',
    prefix: 'math-weight-keyboard',
    pairs: [
      ['mg', 'milligram'], ['g', 'gram'], ['kg', 'kilogram'], ['t', 'metric ton'],
      ['oz', 'ounce'], ['lb', 'pound'], ['st', 'stone'], ['ton', 'ton'],
    ],
  },
  // Volume
  {
    category: 'volume',
    prefix: 'math-volume-keyboard',
    pairs: [
      ['mL', 'milliliter'], ['L', 'liter'], ['tsp', 'teaspoon'], ['tbsp', 'tablespoon'],
      ['cup', 'cup'], ['pt', 'pint'], ['qt', 'quart'], ['gal', 'gallon'],
    ],
  },
  // Money
  {
    category: 'money',
    prefix: 'math-money-keyboard',
    pairs: [
      ['$', 'dollar'], ['¢', 'cent'], ['€', 'euro'], ['£', 'pound sterling'],
      ['¥', 'yen'], ['₹', 'rupee'], ['₽', 'ruble'], ['₩', 'won'],
    ],
  },
  // Chemistry — elements
  {
    category: 'chemistry',
    prefix: 'math-chemistry-elements',
    pairs: [
      ['H', 'hydrogen'], ['C', 'carbon'], ['N', 'nitrogen'], ['O', 'oxygen'],
      ['F', 'fluorine'], ['Na', 'sodium'], ['Mg', 'magnesium'], ['Al', 'aluminium'],
      ['Si', 'silicon'], ['P', 'phosphorus'], ['S', 'sulfur'], ['Cl', 'chlorine'],
      ['K', 'potassium'], ['Ca', 'calcium'], ['Fe', 'iron'], ['Cu', 'copper'],
      ['Zn', 'zinc'], ['Ag', 'silver'], ['Au', 'gold'], ['Hg', 'mercury'],
      ['Pb', 'lead'], ['Br', 'bromine'], ['I', 'iodine'], ['He', 'helium'],
    ],
  },
  // Chemistry — ops
  {
    category: 'chemistry',
    prefix: 'math-chemistry-ops',
    pairs: [
      ['→', 'yields'], ['⇌', 'equilibrium'], ['↑', 'gas evolved'], ['↓', 'precipitate'],
      ['+', 'plus'], ['·', 'middle dot'], ['⁺', 'positive charge'], ['⁻', 'negative charge'],
      ['²⁺', 'two plus'], ['²⁻', 'two minus'],
      ['₂', 'subscript 2'], ['₃', 'subscript 3'], ['₄', 'subscript 4'],
      ['Δ', 'delta heat'], ['pH', 'pH'], ['mol', 'mole'],
      ['(s)', 'solid phase'], ['(l)', 'liquid phase'],
      ['(g)', 'gas phase'], ['(aq)', 'aqueous phase'],
    ],
  },
  // Physics — greek
  {
    category: 'physics',
    prefix: 'math-physics-greek',
    pairs: [
      ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'],
      ['ε', 'epsilon'], ['η', 'eta'], ['θ', 'theta'], ['λ', 'lambda'],
      ['μ', 'mu'], ['ν', 'nu'], ['π', 'pi'], ['ρ', 'rho'],
      ['σ', 'sigma'], ['τ', 'tau'], ['φ', 'phi'], ['ψ', 'psi'], ['ω', 'omega'],
      ['Δ', 'big delta'], ['Σ', 'big sigma'], ['Φ', 'big phi'], ['Ω', 'big omega'],
    ],
  },
  // Physics — units
  {
    category: 'physics',
    prefix: 'math-physics-units',
    pairs: [
      ['m', 'metre'], ['s', 'second'], ['kg', 'kilogram'], ['A', 'ampere'],
      ['K', 'kelvin'], ['mol', 'mole-physics'], ['N', 'newton'], ['J', 'joule'],
      ['W', 'watt'], ['V', 'volt'], ['Ω', 'ohm'], ['Hz', 'hertz'],
      ['Pa', 'pascal'], ['T', 'tesla'], ['C', 'coulomb'], ['eV', 'electron volt'],
    ],
  },
  // Physics — ops
  {
    category: 'physics',
    prefix: 'math-physics-ops',
    pairs: [
      ['∫', 'integral'], ['∂', 'partial'], ['∇', 'nabla'], ['∑', 'sum'],
      ['∏', 'product'], ['·', 'dot product'], ['×', 'cross product'],
      ['→', 'right arrow'], ['⃗', 'vector hat'], ['|', 'magnitude bar'],
      ['⟨', 'left bracket'], ['⟩', 'right bracket'],
      ['c', 'speed of light'], ['h', 'planck'], ['ℏ', 'hbar'], ['G', 'grav constant'],
      ['°', 'degree'], ['∞', 'infinity'],
    ],
  },
  // Biology — nucleotides
  {
    category: 'biology',
    prefix: 'math-biology-nucleotides',
    pairs: [
      ['A', 'adenine'], ['T', 'thymine'], ['G', 'guanine'], ['C', 'cytosine'],
      ['U', 'uracil'], ['→', 'translates to'], ['⇒', 'gives rise to'],
      ['mRNA', 'messenger rna'], ['tRNA', 'transfer rna'], ['rRNA', 'ribosomal rna'],
      ['DNA', 'dna'], ['RNA', 'rna'],
    ],
  },
  // Biology — genetics
  {
    category: 'biology',
    prefix: 'math-biology-genetics',
    pairs: [
      ['AA', 'homozygous dominant'], ['Aa', 'heterozygous'], ['aa', 'homozygous recessive'],
      ['BB', 'big-b homozygous'], ['Bb', 'big-b heterozygous'], ['bb', 'big-b homozygous recessive'],
      ['F1', 'first generation'], ['F2', 'second generation'],
      ['P', 'parental'], ['×', 'cross'], ['♂', 'male'], ['♀', 'female'],
    ],
  },
  // Biology — taxonomy
  {
    category: 'biology',
    prefix: 'math-biology-taxonomy',
    pairs: [
      ['Domain', 'domain'], ['Kingdom', 'kingdom'], ['Phylum', 'phylum'], ['Class', 'class'],
      ['Order', 'order'], ['Family', 'family'], ['Genus', 'genus'], ['Species', 'species'],
    ],
  },
  // Biology — organelles
  {
    category: 'biology',
    prefix: 'math-biology-organelles',
    pairs: [
      ['nucleus', 'nucleus'], ['mitochondria', 'mitochondria'], ['ribosome', 'ribosome'],
      ['ER', 'endoplasmic reticulum'], ['Golgi', 'golgi'], ['lysosome', 'lysosome'],
      ['chloroplast', 'chloroplast'], ['cell wall', 'cell wall'], ['membrane', 'cell membrane'],
      ['cytoplasm', 'cytoplasm'], ['vacuole', 'vacuole'], ['nucleolus', 'nucleolus'],
    ],
  },
  // Statistics — params
  {
    category: 'statistics',
    prefix: 'math-stats-params',
    pairs: [
      ['μ', 'population mean'], ['σ', 'population std'], ['σ²', 'population variance'],
      ['ρ', 'correlation'], ['x̄', 'sample mean'], ['s', 'sample std'],
      ['s²', 'sample variance'], ['r', 'sample correlation'],
      ['n', 'sample size'], ['N', 'population size'],
      ['p̂', 'sample proportion'], ['p', 'probability'],
    ],
  },
  // Statistics — ops
  {
    category: 'statistics',
    prefix: 'math-stats-ops',
    pairs: [
      ['Σ', 'summation-stats'], ['∏', 'product-stats'],
      ['P(', 'probability of'], ['E[', 'expected value'], ['Var[', 'variance of'],
      ['SE', 'standard error'], ['CI', 'confidence interval'],
      ['H0', 'null hypothesis'], ['Ha', 'alternative hypothesis'],
      ['!', 'factorial'],
      // Note: the keyboard array reuses the literal "P(" twice (combinations
      // and permutations). The first wins for our lookup; the second is
      // unreachable through this map, which is OK — workflows only need
      // P( and that exists.
      ['C(', 'combinations'],
    ],
  },
  // Statistics — distributions
  {
    category: 'statistics',
    prefix: 'math-stats-dist',
    pairs: [
      ['𝒩', 'normal'], ['z', 'z score'], ['t', 't statistic'],
      ['χ²', 'chi squared'], ['F', 'f statistic'], ['df', 'degrees of freedom'],
      ['α', 'alpha-stats'], ['β', 'beta-stats'],
      ['p-value', 'p value'], ['≈', 'approximately-stats'],
      ['≠', 'not equal-stats'], ['∼', 'distributed as'],
    ],
  },
  // Earth — units
  {
    category: 'earth-science',
    prefix: 'math-earth-units',
    pairs: [
      ['AU', 'astronomical unit'], ['ly', 'light year'], ['pc', 'parsec'],
      ['Mya', 'million years ago'], ['Gya', 'billion years ago'],
      ['km', 'kilometre-earth'], ['mb', 'millibar'],
      ['°C', 'celsius'], ['°F', 'fahrenheit'], ['mph', 'miles per hour'],
    ],
  },
  // Earth — plates / arrows
  {
    category: 'earth-science',
    prefix: 'math-earth-plates',
    pairs: [
      ['→', 'plate east'], ['←', 'plate west'], ['↑', 'plate up'], ['↓', 'plate down'],
      ['⇄', 'transform'], ['⊕', 'subduction'], ['⊖', 'rifting'],
    ],
  },
  // History — eras
  {
    category: 'history',
    prefix: 'math-history-eras',
    pairs: [
      ['BCE', 'before common era'], ['CE', 'common era'],
      ['BC', 'before christ'], ['AD', 'anno domini'],
      ['c.', 'circa'], ['fl.', 'flourished'],
      ['–', 'date range dash'], ['→', 'leads to'], ['↦', 'continues to'],
    ],
  },
  // History — centuries
  {
    category: 'history',
    prefix: 'math-history-centuries',
    pairs: [
      ['1st', 'first'], ['2nd', 'second'], ['3rd', 'third'], ['4th', 'fourth'],
      ['5th', 'fifth'], ['10th', 'tenth'], ['15th', 'fifteenth'],
      ['17th', 'seventeenth'], ['18th', 'eighteenth'],
      ['19th', 'nineteenth'], ['20th', 'twentieth'], ['21st', 'twenty first'],
    ],
  },
  // Language arts — POS
  {
    category: 'language-arts',
    prefix: 'math-la-pos',
    pairs: [
      ['N', 'noun'], ['V', 'verb'], ['ADJ', 'adjective'], ['ADV', 'adverb'],
      ['PRON', 'pronoun'], ['PREP', 'preposition'], ['CONJ', 'conjunction'],
      ['ART', 'article'], ['INTJ', 'interjection'], ['AUX', 'auxiliary'],
      ['DET', 'determiner'], ['NUM', 'numeral'],
    ],
  },
  // Language arts — sentence type
  {
    category: 'language-arts',
    prefix: 'math-la-sentence',
    pairs: [
      ['DECL', 'declarative'], ['INT', 'interrogative'], ['IMP', 'imperative'],
      ['EXCL', 'exclamatory'], ['COMP', 'compound'], ['CPLX', 'complex'],
    ],
  },
  // Language arts — punctuation
  {
    category: 'language-arts',
    prefix: 'math-la-punct',
    pairs: [
      ['.', 'period'], [',', 'comma-la'], [';', 'semicolon-la'], [':', 'colon-la'],
      ['!', 'exclamation'], ['?', 'question'],
      ["'", 'apostrophe'], ['"', 'dquote-la'],
      ['(', 'open paren-la'], [')', 'close paren-la'],
      ['–', 'en dash'], ['—', 'em dash'], ['…', 'ellipsis'],
    ],
  },
];

// Build per-category glyph→testid maps from GRIDS.
const GRID_MAPS: Partial<Record<KeyRef['category'], Record<string, KeyRef>>> = {};
for (const grid of GRIDS) {
  const m = (GRID_MAPS[grid.category] ??= {});
  for (const [g, label] of grid.pairs) {
    if (m[g]) continue; // first-wins (e.g. STATS_OPS reuses P( label)
    m[g] = { category: grid.category, testid: `${grid.prefix}-${slug(label)}` };
  }
}

// ── Programming keyboards ───────────────────────────────────────────
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
const PROG_OPS: Array<[string, string]> = [
  ['(', 'open paren'], [')', 'close paren'],
  ['[', 'open bracket'], [']', 'close bracket'],
  ['{', 'open brace'], ['}', 'close brace'],
  ['=', 'assign'], ['==', 'equal'], ['!=', 'not equal'],
  ['<', 'less'], ['>', 'greater'], ['<=', 'less eq'], ['>=', 'greater eq'],
  ['+', 'plus-prog'], ['-', 'minus-prog'], ['*', 'star'], ['/', 'slash'],
  ['%', 'percent-prog'], [':', 'colon'], [';', 'semicolon'],
  [',', 'comma-prog'], ['.', 'dot'], ['"', 'dquote'], ["'", 'squote'],
];

function buildProgMap(lang: 'python' | 'java'): Record<string, KeyRef> {
  const cat: KeyRef['category'] = lang === 'python' ? 'programming-python' : 'programming-java';
  const prefix = lang === 'python' ? 'math-python' : 'math-java';
  const out: Record<string, KeyRef> = {};
  // Letters (a-z; case shift handled by spec via a synthetic '⇧' marker
  // — the spec taps the shift key explicitly when uppercase is needed).
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    out[c] = { category: cat, testid: `${prefix}-ltr-${c}` };
  }
  // Digits
  for (const d of '0123456789') out[d] = { category: cat, testid: `${prefix}-digit-${d}` };
  // Underscore
  out['_'] = { category: cat, testid: `${prefix}-underscore` };
  // Ops — same prefix/slug rule as GlyphGrid
  for (const [g, label] of PROG_OPS) {
    if (!out[g]) out[g] = { category: cat, testid: `${prefix}-ops-${slug(label)}` };
  }
  // Keywords — committed token-by-character + trailing space, but the
  // single-tap testid is `${prefix}-kw-${kw}`. Spec uses the keyword
  // form `kw:<keyword>` (see lookupToken below).
  const kws = lang === 'python' ? PYTHON_KEYWORDS : JAVA_KEYWORDS;
  for (const kw of kws) {
    out[`kw:${kw}`] = { category: cat, testid: `${prefix}-kw-${kw}` };
  }
  // Shift — spec taps `${prefix}-letters-shift` then a letter to get
  // uppercase. Encoded in the map as literal capital letters routing to
  // the shift sequence (handled by the spec's typeToken function, not a
  // single key — so we DON'T register A..Z here; the spec handles them
  // by tapping shift then the lowercase tile).
  return out;
}

const PY_MAP = buildProgMap('python');
const JAVA_MAP = buildProgMap('java');

// ── Public API ──────────────────────────────────────────────────────

/**
 * Find the (category, testid) pair for a glyph in a given keyboard
 * category. Returns null if the glyph isn't reachable on that
 * keyboard. The workflow spec then `test.skip()`s with a "key X not on
 * keyboard" message instead of crashing.
 *
 * Falls back across categories in a natural order: the requested
 * category first, then `main` (digits/operators), then `adv-math`
 * (variables / ≤ ≥ ≠ √ ² ³), then `letters` (a-z). For glyphs in a
 * SUBJECT keyboard (chemistry, physics, …) callers pass that category
 * explicitly.
 */
export function lookupKey(glyph: string, preferred: KeyRef['category']): KeyRef | null {
  const order: Array<KeyRef['category']> = [];
  order.push(preferred);
  if (preferred !== 'main') order.push('main');
  if (preferred !== 'adv-math') order.push('adv-math');
  if (preferred !== 'letters') order.push('letters');

  for (const cat of order) {
    const ref = lookupInCategory(glyph, cat);
    if (ref) return ref;
  }
  return null;
}

function lookupInCategory(glyph: string, cat: KeyRef['category']): KeyRef | null {
  switch (cat) {
    case 'main':                return MAIN[glyph] ?? null;
    case 'adv-math':            return ADV_MAP[glyph] ?? null;
    case 'letters':             return LTR_MAP[glyph] ?? null;
    case 'programming-python':  return PY_MAP[glyph] ?? null;
    case 'programming-java':    return JAVA_MAP[glyph] ?? null;
    default:                    return GRID_MAPS[cat]?.[glyph] ?? null;
  }
}

/** All glyphs reachable on the given category (excluding fallbacks). */
export function glyphsForCategory(cat: KeyRef['category']): string[] {
  switch (cat) {
    case 'main':               return Object.keys(MAIN);
    case 'adv-math':           return Object.keys(ADV_MAP);
    case 'letters':            return Object.keys(LTR_MAP);
    case 'programming-python': return Object.keys(PY_MAP);
    case 'programming-java':   return Object.keys(JAVA_MAP);
    default:                   return Object.keys(GRID_MAPS[cat] ?? {});
  }
}
