/**
 * History workflow — Grade 5-8 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/history.md, typed step-by-step on the math panel —
 * era markers + century ordinals.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * History keyboard (gap surfaced in tests/workflows/COVERAGE.md),
 * the spec skips with a descriptive message rather than failing.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from './_helpers';

const CATEGORY = 'history' as const;

test.describe('history workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('years between 50 BCE and 50 CE = 100', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=50BCE',
      'e=50CE',
      'y=50+50',
      'y=100',
    ], CATEGORY);
  });

  test('years between 1492 and 1776 = 284', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=1492',
      'e=1776',
      'y=1776−1492',
      'y=284',
    ], CATEGORY);
  });

  test('century of 1850 = 19th', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'y=1850',
      'c=1850÷100',
      'c=19',
      'a=19th',
    ], CATEGORY);
  });

  test('century of 50 CE = 1st', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'y=50CE',
      'c=1',
      'a=1st',
    ], CATEGORY);
  });

  test('order three eras: BCE → CE → AD', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '1st=BCE',
      '2nd=CE',
      '3rd=AD',
    ], CATEGORY);
  });

  test('rome → constantinople: 1453 − 476 = 977', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=476',
      'e=1453',
      'y=1453−476',
      'y=977',
    ], CATEGORY);
  });
});
