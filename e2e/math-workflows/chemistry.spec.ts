/**
 * Chemistry workflow — Grade 8-10 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/chemistry.md, typed step-by-step on the math panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * chemistry keyboard (gap surfaced in tests/workflows/COVERAGE.md),
 * the spec skips with a descriptive message rather than failing.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from './_helpers';

const CATEGORY = 'chemistry' as const;

test.describe('chemistry workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('balancing equations: water from H₂ + O₂', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'H₂+O₂→H₂O',
      '2H₂+O₂→2H₂O',
    ], CATEGORY);
  });

  test('balancing equations: methane combustion', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'C+O₂→CO₂',
    ], CATEGORY);
  });

  test('molar mass: water  H × 2 + O = 18', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'H×2+O=m',
      '1×2+16=m',
      '2+16=18',
    ], CATEGORY);
  });

  test('moles from grams: 36 g of water (M=18)', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'n=g÷m',
      'n=36÷18',
      'n=2mol',
    ], CATEGORY);
  });

  test('stoichiometry: 4 mol H₂ → mol H₂O', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '2H₂+O₂→2H₂O',
      'n=4×1',
      'n=4mol',
    ], CATEGORY);
  });

  test('salt formation: Na + Cl', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'Na+Cl→NaCl',
      '2Na+Cl₂→2NaCl',
    ], CATEGORY);
  });
});
