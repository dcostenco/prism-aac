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
  // v2 audit Adv-Math additions: lowercase variables for
  // mensuration / kinematics word problems.
  ['w', 'variable w'], ['l', 'variable l'],
  ['h', 'variable h'], ['t', 'variable t'],
];
const ADV_MAP: Record<string, KeyRef> = {};
for (const [g, label] of ADV) {
  ADV_MAP[g] = { category: 'adv-math', testid: `math-key-adv-${label.replace(/ /g, '-')}` };
}

// v2 audit Adv-Math additions: trig sub-row, calc primitives,
// subscripts. Each lives on its own GlyphGrid so the testid prefix
// follows the GlyphGrid convention (`{prefix}-{slug}`).
const ADV_TRIG: Array<[string, string]> = [
  ['sin', 'sine'], ['cos', 'cosine'], ['tan', 'tangent'],
  ['csc', 'cosecant'], ['sec', 'secant'], ['cot', 'cotangent'],
  ['sin⁻¹', 'arcsine'], ['cos⁻¹', 'arccosine'], ['tan⁻¹', 'arctangent'],
];
const ADV_CALC: Array<[string, string]> = [
  ['lim', 'limit'], ['→', 'limit arrow'],
  ['dx', 'differential x'], ['dy', 'differential y'],
  ['f(x)', 'function f of x'], ['g(x)', 'function g of x'],
];
const ADV_SUBSCRIPTS: Array<[string, string]> = [
  ['₀', 'subscript 0'], ['₁', 'subscript 1'],
  ['₅', 'subscript 5'], ['₆', 'subscript 6'],
  ['₇', 'subscript 7'], ['₈', 'subscript 8'],
  ['₉', 'subscript 9'],
  ['ₙ', 'subscript n'], ['ᵢ', 'subscript i'],
];
for (const [g, label] of ADV_TRIG) {
  if (!ADV_MAP[g]) ADV_MAP[g] = { category: 'adv-math', testid: `math-adv-trig-${slug(label)}` };
}
for (const [g, label] of ADV_CALC) {
  if (!ADV_MAP[g]) ADV_MAP[g] = { category: 'adv-math', testid: `math-adv-calc-${slug(label)}` };
}
for (const [g, label] of ADV_SUBSCRIPTS) {
  if (!ADV_MAP[g]) ADV_MAP[g] = { category: 'adv-math', testid: `math-adv-subscripts-${slug(label)}` };
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
      // v2 audit Geom additions: similar tilde, cube exponent on Geom,
      // mensuration variables.
      ['~', 'similar tilde'], ['³', 'cubed geom'],
      ['l', 'length-geom'], ['w', 'width-geom'],
      ['h', 'height-geom'], ['s', 'side-geom'],
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
      // v2 audit Chemistry additions: extended subscripts + composite
      // molar units + percent.
      ['₀', 'subscript 0'], ['₁', 'subscript 1'],
      ['₅', 'subscript 5'], ['₆', 'subscript 6'],
      ['₇', 'subscript 7'], ['₈', 'subscript 8'],
      ['₉', 'subscript 9'],
      ['g/mol', 'grams per mole'], ['mol/L', 'moles per litre'],
      ['%', 'percent chem'],
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
      // v2 audit Physics priority 3.
      ['g', 'grav accel'],
    ],
  },
  // v2 audit Physics priority 1: equation variables.
  {
    category: 'physics',
    prefix: 'math-physics-vars',
    pairs: [
      ['F', 'force'], ['a', 'acceleration'], ['v', 'velocity'],
      ['u', 'initial velocity'], ['p', 'momentum'], ['t', 'time'],
      ['d', 'distance'], ['h', 'height'], ['r', 'radius-phys'],
      ['KE', 'kinetic energy'], ['PE', 'potential energy'],
      ['GPE', 'gravitational potential energy'],
    ],
  },
  // v2 audit Physics priority 2: composite SI units.
  {
    category: 'physics',
    prefix: 'math-physics-composite',
    pairs: [
      ['m/s', 'metres per second'],
      ['m/s²', 'metres per second squared'],
      ['km/h', 'kilometres per hour'],
      ['kg·m/s', 'kilogram metre per second'],
      ['N·m', 'newton metre'],
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
  // v2 audit Biology priority 3: codon-table glyphs.
  {
    category: 'biology',
    prefix: 'math-biology-codons',
    pairs: [
      ['Met', 'methionine'], ['Ala', 'alanine'],
      ['Tyr', 'tyrosine'], ['Stop', 'stop codon'],
    ],
  },
  // v2 audit Biology priority 2: exponent keys on Biology.
  {
    category: 'biology',
    prefix: 'math-biology-exponents',
    pairs: [
      ['²', 'squared bio'], ['³', 'cubed bio'], ['^n', 'caret n'],
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
      // v2 audit Statistics additions: critical-value tiles, mirrored
      // inequalities, and paired-data primitives.
      ['ME', 'margin of error'],
      ['z*', 'z star critical'],
      ['t*', 't star critical'],
      ['<', 'less than stats'],
      ['>', 'greater than stats'],
      ['≤', 'less or equal stats'],
      ['≥', 'greater or equal stats'],
      ['Cov(', 'covariance of'],
      ['corr(', 'correlation of'],
      ['Pr(', 'probability prefix'],
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
      // v2 audit Earth priority 2: time-span units distinct from Mya/Gya.
      ['yr', 'year span'], ['kyr', 'kiloyear'], ['Myr', 'megayear'],
    ],
  },
  // v2 audit Earth priority 1: scientific-notation helper row.
  {
    category: 'earth-science',
    prefix: 'math-earth-scinot',
    pairs: [
      ['×10', 'times ten'],
      ['⁰', 'sup 0'], ['¹', 'sup 1'], ['²', 'sup 2'], ['³', 'sup 3'],
      ['⁴', 'sup 4'], ['⁵', 'sup 5'], ['⁶', 'sup 6'], ['⁷', 'sup 7'],
      ['⁸', 'sup 8'], ['⁹', 'sup 9'],
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
      // v2 audit History priority 2: fill the century-ordinal gap.
      ['6th', 'sixth'], ['7th', 'seventh'], ['8th', 'eighth'],
      ['9th', 'ninth'], ['11th', 'eleventh'], ['12th', 'twelfth'],
      ['13th', 'thirteenth'], ['14th', 'fourteenth'], ['16th', 'sixteenth'],
    ],
  },
  // v2 audit History priority 3: Δ ≈ ~ mirrored into history.
  {
    category: 'history',
    prefix: 'math-history-decor',
    pairs: [
      ['Δ', 'delta history'],
      ['≈', 'approximately history'],
      ['~', 'circa tilde'],
    ],
  },
  // v2 audit History priority 1: appended event tiles.
  {
    category: 'history',
    prefix: 'math-history-events',
    pairs: [
      ['1492', 'columbus'],
      ['1607', 'jamestown world'],
      ['1789', 'french revolution world'],
      ['1804', 'napoleon emperor world'],
      ['1815', 'congress of vienna'],
      ['1848', 'springtime of nations'],
      ['1865', 'us civil war end world'],
      ['1898', 'spanish american war world'],
      ['1929', 'great depression'],
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
      // v2 audit Language Arts priority 2: lowercase POS abbreviations
      // — only reachable when the case-shift toggle is active. The
      // keyboard renders ONE of {LA_PARTS_OF_SPEECH, LA_POS_LOWER}
      // depending on toggle state, but both share the same `math-la-pos`
      // testid prefix, so e2e specs that ask for a lowercase variant
      // need the toggle pressed first. Since first-wins applies above,
      // these only resolve when no uppercase glyph already maps.
      ['n.', 'noun lower'], ['v.', 'verb lower'],
      ['adj.', 'adjective lower'], ['adv.', 'adverb lower'],
      ['pron.', 'pronoun lower'], ['prep.', 'preposition lower'],
      ['conj.', 'conjunction lower'], ['art.', 'article lower'],
      ['intj.', 'interjection lower'], ['aux.', 'auxiliary lower'],
      ['det.', 'determiner lower'], ['num.', 'numeral lower'],
    ],
  },
  // v2 audit Language Arts priority 1: syntactic-role tags.
  {
    category: 'language-arts',
    prefix: 'math-la-syntactic',
    pairs: [
      ['SUBJ', 'subject'], ['PRED', 'predicate'],
      ['OBJ', 'object'], ['DO', 'direct object'],
      ['IO', 'indirect object'], ['COMP-OBJ', 'object complement'],
    ],
  },
  // v2 audit Language Arts priority 3: Q&A study-note pair.
  {
    category: 'language-arts',
    prefix: 'math-la-qa',
    pairs: [
      ['Q:', 'question prefix'],
      ['A:', 'answer prefix'],
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

// v2 audit cross-cutting findings: the SHARED_DECOR row (² ³ ₂ ₃ ₄ Δ ≈)
// surfaces on Main, Adv-Math, Chemistry, Physics, Earth Science.
// Each panel renders its own `SharedDecorRow` with a unique prefix, so
// the testid is `${prefix}-${slug(label)}`. Existing per-subject maps
// take precedence (first-wins) so muscle memory is preserved; these
// fallback entries only kick in when the glyph wasn't already
// registered on the target chip.
const SHARED_DECOR_PAIRS: Array<[string, string]> = [
  ['²', 'squared shared'],
  ['³', 'cubed shared'],
  ['₂', 'subscript 2 shared'],
  ['₃', 'subscript 3 shared'],
  ['₄', 'subscript 4 shared'],
  ['Δ', 'delta shared'],
  ['≈', 'approximately shared'],
];
// Adv-math direct map
for (const [g, label] of SHARED_DECOR_PAIRS) {
  if (!ADV_MAP[g]) ADV_MAP[g] = { category: 'adv-math', testid: `math-adv-decor-${slug(label)}` };
}
// Main direct map — these are the only path for the ² ³ ₂ ₃ ₄ Δ ≈
// glyphs on the Main chip (MathMainKeyboard renders the same
// SHARED_DECOR row inline using `math-main-decor-${kebab(label)}`,
// but as a flex row not a GlyphGrid — so testid uses dashed labels
// directly, NOT the slugifier).
for (const [g, label] of SHARED_DECOR_PAIRS) {
  if (!MAIN[g]) MAIN[g] = { category: 'main', testid: `math-main-decor-${label.replace(/ /g, '-')}` };
}
// Chemistry / physics / earth-science — fold into GRID_MAPS so the
// per-category fallback path picks them up. First-wins above means
// existing per-panel `Δ` (chemistry-ops 'delta heat', physics-greek
// 'big delta') keep their original testids — these only register
// glyphs that were missing on the chip.
for (const cat of ['chemistry', 'physics', 'earth-science'] as const) {
  const m = (GRID_MAPS[cat] ??= {});
  const prefix = cat === 'chemistry' ? 'math-chem-decor'
               : cat === 'physics'   ? 'math-phys-decor'
               :                       'math-earth-decor';
  for (const [g, label] of SHARED_DECOR_PAIRS) {
    if (!m[g]) m[g] = { category: cat, testid: `${prefix}-${slug(label)}` };
  }
}

// v2 audit Biology priority 1: case-toggle row uses non-GlyphGrid
// testids (direct buttons) so we register them by hand. Both the
// primary tile (`math-biology-case-{letter}`) and the pair sibling
// (`math-biology-case-pair-{letter}`) render simultaneously, which
// keeps both upper- and lowercase variants tappable regardless of
// shift state. First-wins above means existing `A` / `P` mappings
// from BIO_NUCLEOTIDES / BIO_GENETICS take precedence — these case-
// toggle fallbacks only kick in for `a` / `b` / `c` / `p` / `B` / `C`
// which were previously unreachable on the Biology chip.
const BIO_CASE_TOGGLE_MAP: Record<string, KeyRef> = {
  // Lowercase variants — render in pair tiles by default.
  a: { category: 'biology', testid: 'math-biology-case-pair-a' },
  b: { category: 'biology', testid: 'math-biology-case-pair-b' },
  c: { category: 'biology', testid: 'math-biology-case-pair-c' },
  p: { category: 'biology', testid: 'math-biology-case-pair-p' },
  // Uppercase variants for B / C (A and P already win via existing maps).
  B: { category: 'biology', testid: 'math-biology-case-b' },
  C: { category: 'biology', testid: 'math-biology-case-c' },
};
for (const [g, ref] of Object.entries(BIO_CASE_TOGGLE_MAP)) {
  const m = (GRID_MAPS['biology'] ??= {});
  if (!m[g]) m[g] = ref;
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

// v2 audit Python priority 1: built-in functions surfaced as token
// tiles (one cell per char + trailing space, same as keywords). Tile
// testid: `${prefix}-builtin-${name}`.
const PYTHON_BUILTINS_LIST = [
  'sum', 'max', 'min', 'abs', 'sorted', 'list', 'dict', 'str', 'int', 'float', 'input',
];

// v2 audit Python priority 2/3: comment marker, indent (4-space tile),
// newline glyph. Tile testid: `${prefix}-extra-${slug(label)}`.
const PYTHON_EXTRAS_LIST: Array<[string, string]> = [
  ['#', 'comment hash'],
  ['→|', 'indent'],
  ['↵', 'newline'],
];

// v2 audit Java priority 1: compound-assignment ops (raw glyph commit).
// Tile testid: `${prefix}-compop-${slug(label)}`.
const JAVA_COMPOUND_LIST: Array<[string, string]> = [
  ['++', 'increment'], ['--', 'decrement'],
  ['+=', 'plus equals'], ['-=', 'minus equals'],
  ['*=', 'times equals'], ['/=', 'divide equals'],
];

// v2 audit Java priority 2: idiom tokens (System.out.println etc.).
// Tile testid: `${prefix}-idiom-${slug(idiom)}`.
const JAVA_IDIOMS_LIST = [
  'System.out.println', 'System.out.print', 'length', 'length()',
  'equals', 'toString', 'Math.',
];

// v2 audit Java priority 3: @ annotation marker + newline glyph. Tile
// testid: `${prefix}-extra-${slug(label)}`.
const JAVA_EXTRAS_LIST: Array<[string, string]> = [
  ['@', 'annotation at'],
  ['↵', 'newline'],
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
  // v2 audit Python additions: built-ins + extras (#, indent, newline).
  if (lang === 'python') {
    for (const bi of PYTHON_BUILTINS_LIST) {
      if (!out[bi]) out[bi] = { category: cat, testid: `${prefix}-builtin-${bi}` };
    }
    for (const [g, label] of PYTHON_EXTRAS_LIST) {
      if (!out[g]) out[g] = { category: cat, testid: `${prefix}-extra-${label.replace(/ /g, '-')}` };
    }
  }
  // v2 audit Java additions: compound-assignment ops + idiom tokens
  // + extras (@, newline).
  if (lang === 'java') {
    for (const [g, label] of JAVA_COMPOUND_LIST) {
      if (!out[g]) out[g] = { category: cat, testid: `${prefix}-compop-${label.replace(/ /g, '-')}` };
    }
    for (const id of JAVA_IDIOMS_LIST) {
      if (!out[id]) out[id] = { category: cat, testid: `${prefix}-idiom-${slug(id)}` };
    }
    for (const [g, label] of JAVA_EXTRAS_LIST) {
      if (!out[g]) out[g] = { category: cat, testid: `${prefix}-extra-${label.replace(/ /g, '-')}` };
    }
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
