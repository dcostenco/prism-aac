/**
 * Shared helpers for math-workflow e2e specs.
 *
 * Each subject spec drives the dev math-grid harness (/dev/math-grid)
 * because it exposes the cell-grid + every keyboard panel in one
 * page, and the dev header echoes (cursor, cells) which gives us a
 * deterministic readback after each step.
 *
 * Workflow spec lifecycle per problem:
 *   1. `gotoMathPanel`        — load page, wait for keyboard region.
 *   2. `resetGrid`            — reset between problems so cell counts
 *                               start at zero.
 *   3. for each step (string of glyphs + a trailing return):
 *        a. typeStep(page, step, category) — for every glyph in the
 *           step, look up the testid via _glyphMap, switch chip if
 *           needed, click the key.
 *        b. assertCellsAtLeast(N) — after the step, the grid must hold
 *           at least N glyphs (the digits + operator we just typed).
 *
 * Multi-character glyphs (e.g. `mol`, `²⁺`, `Stone Age`) commit as a
 * SINGLE cell on the grid, so step length in cells == step.length when
 * glyphs are single-codepoint, but is the count of TOKENS we resolved
 * when some glyphs are multi-char. The helper tracks per-step token
 * count so the assertion is precise.
 */
import { type Page, type TestInfo, expect } from '@playwright/test';
import { lookupKey, type KeyRef } from './_glyphMap';

export type Category = KeyRef['category'];

/** Navigate to the dev math-grid harness and wait for the keyboard. */
export async function gotoMathPanel(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-keyboard-region"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5_000 });
}

/** Click the dev "reset" button to clear the grid + cursor. */
export async function resetGrid(page: Page) {
  await page.locator('[data-testid="math-dev-reset"]').click();
  await page.waitForTimeout(60);
}

/** Read (cursor.r, cursor.c, cells) from the dev-page header. */
export async function readState(page: Page): Promise<{ r: number; c: number; cells: number }> {
  const text = await page.locator('header').first().innerText();
  const m = text.match(/cursor=\((\d+),(\d+)\)\s+cells=(\d+)/);
  if (!m) throw new Error(`dev header missing cursor/cells: ${text}`);
  return { r: Number(m[1]), c: Number(m[2]), cells: Number(m[3]) };
}

/** Tokenise a step string into glyph TOKENS that match the keyboard.
 *
 *  Tokenisation is category-agnostic: we always check the multi-char
 *  glyph list first (longest-prefix-wins), then fall back to a single
 *  Unicode codepoint. The category only matters at the LOOKUP step.
 */
export function tokenise(step: string): string[] {
  // Multi-char glyphs the keyboards expose. Order matters: longer
  // prefixes win, so 'p-value' beats 'p'. The list mirrors the
  // multi-char entries in _glyphMap.
  const MULTI = [
    'mRNA', 'tRNA', 'rRNA', 'DNA', 'RNA',
    'Domain', 'Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species',
    'mitochondria', 'ribosome', 'nucleus', 'nucleolus', 'chloroplast',
    'lysosome', 'cytoplasm', 'membrane', 'vacuole', 'cell wall', 'Golgi', 'ER',
    'Stone Age', 'Bronze Age', 'Iron Age',
    'cone', 'cyl', 'sphere', 'cube', 'prism', 'pyramid',
    'tsp', 'tbsp', 'cup', 'gal',
    'min', 'hr', 'day',
    'mph', 'AU', 'ly', 'pc', 'Mya', 'Gya', 'mb', '°C', '°F',
    'mol', 'pH',
    '(s)', '(l)', '(g)', '(aq)',
    '²⁺', '²⁻',
    'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Hg', 'Pb', 'Br', 'He',
    'Hz', 'Pa', 'eV',
    'mm', 'cm', 'km', 'mg', 'kg', 'oz', 'lb', 'st', 'ton', 'ft', 'yd', 'mi', 'mL',
    'pt', 'qt',
    '1st', '2nd', '3rd', '4th', '5th', '10th', '15th',
    '17th', '18th', '19th', '20th', '21st',
    // Language-arts POS tags MUST come before 'BC', 'AD', etc. so that
    // 'ADJ' matches the full token rather than 'AD' (Anno Domini).
    'ADJ', 'ADV', 'PRON', 'PREP', 'CONJ', 'INTJ', 'AUX', 'DET', 'NUM',
    'ART',
    'DECL', 'IMP', 'EXCL', 'COMP', 'CPLX',
    // 'INT' sentence-type must come before 'int' Python builtin (case differs
    // so no real conflict, but keeping INT here for logical grouping).
    'INT',
    'BCE', 'CE', 'BC', 'AD', 'c.', 'fl.',
    'AA', 'Aa', 'aa', 'BB', 'Bb', 'bb', 'F1', 'F2',
    'p-value', 'H0', 'Ha', 'SE', 'CI', 'df', 'σ²', 's²', 'x̄', 'p̂', 'χ²', '𝒩',
    'P(', 'E[', 'Var[', 'C(',
    '==', '!=', '<=', '>=',
    'log', 'ln',
    // v2 audit additions — multi-char tokens that newly land on
    // dedicated chips. Order matters (longest-prefix-wins) so
    // 'System.out.println' beats 'System.out.print' which beats
    // 'length()' which beats 'length' which beats 'l'.
    'System.out.println', 'System.out.print', 'length()', 'length',
    'toString', 'equals', 'Math.',
    'sin⁻¹', 'cos⁻¹', 'tan⁻¹',
    'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
    'lim', 'dx', 'dy', 'f(x)', 'g(x)',
    'g/mol', 'mol/L',
    'm/s²', 'm/s', 'km/h', 'kg·m/s', 'N·m',
    'Cov(', 'corr(', 'Pr(',
    'Met', 'Ala', 'Tyr', 'Stop',
    '×10',
    'KE', 'PE', 'GPE',
    'ME', 'z*', 't*',
    'kyr', 'Myr', 'yr',
    '++', '--', '+=', '-=', '*=', '/=',
    '^n',
    '→|',
    'Q:', 'A:',
    // 'COMP-OBJ' must precede plain tokens to avoid 'COMP' eating its prefix.
    'COMP-OBJ', 'SUBJ', 'PRED', 'OBJ', 'DO', 'IO',
    'n.', 'v.', 'adj.', 'adv.', 'pron.', 'prep.', 'conj.',
    'art.', 'intj.', 'aux.', 'det.', 'num.',
    '6th', '7th', '8th', '9th', '11th', '12th', '13th', '14th', '16th',
    'sum', 'max', 'min', 'abs', 'sorted', 'list', 'dict', 'str', 'int',
    'float', 'input',
    // Year tiles (history events appended in v2 audit). Span 4 digits so
    // they win against the single digit fallback. Listed individually
    // because the tokeniser walks the array in order and we want the
    // exact match instead of "1" + "4" + "9" + "2".
    '1492', '1607', '1789', '1804', '1815', '1848', '1865', '1898', '1929',
  ];
  const out: string[] = [];
  let i = 0;
  while (i < step.length) {
    let matched = '';
    for (const m of MULTI) {
      if (step.startsWith(m, i)) {
        matched = m;
        break;
      }
    }
    if (matched) {
      out.push(matched);
      i += matched.length;
    } else {
      // Single codepoint (handles surrogate pairs like 𝒩).
      const code = step.codePointAt(i)!;
      const ch = String.fromCodePoint(code);
      out.push(ch);
      i += ch.length;
    }
  }
  return out;
}

/**
 * Resolve every token in `step` to a KeyRef under `category` (with the
 * `main / adv-math / letters` fallback). Returns the resolved tokens
 * AND any missing glyphs. Spec uses the missing list to skip cleanly.
 */
export function resolveStep(step: string, category: Category): {
  resolved: Array<{ glyph: string; ref: KeyRef }>;
  missing: string[];
} {
  const tokens = tokenise(step);
  const resolved: Array<{ glyph: string; ref: KeyRef }> = [];
  const missing: string[] = [];
  for (const t of tokens) {
    if (t === ' ') {
      // Space lives on the main keyboard's space key.
      const ref = lookupKey(' ', 'main');
      if (ref) resolved.push({ glyph: ' ', ref });
      else missing.push('SPACE');
      continue;
    }
    const ref = lookupKey(t, category);
    if (ref) resolved.push({ glyph: t, ref });
    else missing.push(t);
  }
  return { resolved, missing };
}

/**
 * Type a step on the math panel: switch to the right chip, tap each
 * key in order, advance cursor to a new row at the end so the next
 * step lands below (mirrors the algebra-PDF format where each step is
 * on its own row).
 *
 * `expectedTokens` is how many cells the step should add; the helper
 * asserts the grid's `cells` count grew by exactly that much.
 */
export async function typeStep(
  page: Page,
  step: string,
  category: Category,
  opts: { newRowAfter?: boolean } = {},
): Promise<{ tokensTyped: number }> {
  const { resolved, missing } = resolveStep(step, category);
  if (missing.length) {
    throw new Error(`unreachable glyphs in step ${JSON.stringify(step)}: ${missing.join(' ')}`);
  }
  let lastCategory: Category | null = null;
  const before = await readState(page);
  for (const { ref } of resolved) {
    if (ref.category !== lastCategory) {
      await page.locator(`[data-testid="math-category-${ref.category}"]`).click();
      await page.waitForTimeout(80);
      lastCategory = ref.category;
    }
    await page.locator(`[data-testid="${ref.testid}"]`).click();
    await page.waitForTimeout(40);
  }
  if (opts.newRowAfter) {
    // Use the smart-return key on the main keyboard. Switching back to
    // main is fine — the next step will reselect its own category.
    if (lastCategory !== 'main') {
      await page.locator('[data-testid="math-category-main"]').click();
      await page.waitForTimeout(60);
    }
    await page.locator('[data-testid="math-key-return"]').click();
    await page.waitForTimeout(60);
  }
  const after = await readState(page);
  expect(
    after.cells,
    `step ${JSON.stringify(step)} should add ${resolved.length} cells (had ${before.cells}, now ${after.cells})`,
  ).toBe(before.cells + resolved.length);
  return { tokensTyped: resolved.length };
}

/**
 * Run a full problem: list of step strings + a chip category. If ANY
 * step contains an unreachable glyph, skip the whole problem with a
 * descriptive message — the gap is what the COVERAGE.md is for.
 */
export async function runProblem(
  page: Page,
  testInfo: TestInfo,
  steps: string[],
  category: Category,
) {
  // First pre-flight: which glyphs are missing across all steps?
  const allMissing: string[] = [];
  for (const s of steps) {
    const { missing } = resolveStep(s, category);
    for (const m of missing) if (!allMissing.includes(m)) allMissing.push(m);
  }
  if (allMissing.length) {
    testInfo.skip(true, `keys not on ${category} keyboard: ${allMissing.join(' ')}`);
    return;
  }
  await resetGrid(page);
  for (let i = 0; i < steps.length; i++) {
    const last = i === steps.length - 1;
    await typeStep(page, steps[i], category, { newRowAfter: !last });
  }
}
