/**
 * Advanced Math workflow — Grade 10-12 problems modelled on the
 * algebra reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/advanced-math.md, typed step-by-step on the math
 * panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * Adv-Math keyboard (gap surfaced in tests/workflows/COVERAGE.md),
 * the spec skips with a descriptive message rather than failing.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from './_helpers';

const CATEGORY = 'adv-math' as const;

test.describe('advanced math workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('quadratic formula — x² + 5x + 6 = 0', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'x²+5x+6=0',
      'a=1',
      'b=5',
      'c=6',
      'x=−b±√(b²−4ac)÷2a',
      'x=−5±1÷2',
      'x=−2',
      'x=−3',
    ], CATEGORY);
  });

  test('exponential growth: y = 5 × 2³', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'y=5×2³',
      'y=5×8',
      'y=40',
    ], CATEGORY);
  });

  test('logarithm identity: log(8) ÷ log(2) = 3', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'log(8)=log(2³)',
      'log(8)=3log(2)',
      'log(8)÷log(2)=3',
    ], CATEGORY);
  });

  test('natural log: ln(e³) = 3', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'ln(e³)=3ln(e)',
      'ln(e)=1',
      'ln(e³)=3',
    ], CATEGORY);
  });

  test('square root of perfect-square sum: √(36+64) = 10', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'x=√(36+64)',
      'x=√100',
      'x=10',
    ], CATEGORY);
  });

  test('derivative shortcut: slope of x² at x=4 is 8', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'y=x²',
      's=2x',
      's=2×4',
      's=8',
    ], CATEGORY);
  });
});
