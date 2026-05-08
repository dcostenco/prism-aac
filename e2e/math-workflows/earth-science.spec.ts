/**
 * Earth Science workflow — Grade 7-9 problems modelled on the
 * algebra reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/earth-science.md, typed step-by-step on the math
 * panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * Earth Science keyboard (gap surfaced in
 * tests/workflows/COVERAGE.md), the spec skips with a descriptive
 * message rather than failing.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from './_helpers';

const CATEGORY = 'earth-science' as const;

test.describe('earth-science workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('light-year conversion — 2 ly ≈ 18 trillion km', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '1ly=9km',
      '2ly=2×9',
      '2ly=18km',
    ], CATEGORY);
  });

  test('AU conversion — 3 AU ≈ 450 million km', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '1AU=150km',
      '3AU=3×150',
      '3AU=450km',
    ], CATEGORY);
  });

  test('plate tectonic rate — 5 cm/year for 200 years', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'r=5',
      'y=200',
      'd=5×200',
      'd=1000',
    ], CATEGORY);
  });

  test('temperature change — 25 °C to 10 °C', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=25°C',
      'e=10°C',
      'd=25−10',
      'd=15°C',
    ], CATEGORY);
  });

  test('wind speed: 30 mph for 2 hours = 60 mi', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=30mph',
      't=2',
      'd=30×2',
      'd=60mi',
    ], CATEGORY);
  });

  test('geologic time — fossil 65 Mya', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=65Mya',
      'e=0',
      'a=65−0',
      'a=65Mya',
    ], CATEGORY);
  });
});
