/**
 * Physics — Grade 11 workflow.
 * Problems drawn from tests/workflows/grade-8-12/physics-grade-11.md.
 * Category: physics (F, a, v, t, m, d, KE, p, Δ, λ, Ω, V, Hz, N, J,
 * m/s², kg·m/s, composite units). Digits/operators fall back to main.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'physics' as const;

test.describe('physics grade-11 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("Newton's second law — F=ma, 70kg at 3m/s²", async ({ page }, ti) => {
    await runProblem(page, ti, [
      'F=m×a',
      'F=70×3',
      'F=210',
    ], CATEGORY);
  });

  test('kinetic energy — 1500kg car at 20m/s', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'KE=0.5×m×v²',
      'KE=0.5×1500×20²',
      'KE=0.5×1500×400',
      'KE=300000',
    ], CATEGORY);
  });

  test("Ohm's law — 9V across 3Ω", async ({ page }, ti) => {
    await runProblem(page, ti, [
      'V=I×R',
      '9=I×3',
      'I=9÷3',
      'I=3',
    ], CATEGORY);
  });

  test('wave speed — 50Hz, wavelength 2m', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'v=f×λ',
      'v=50×2',
      'v=100',
    ], CATEGORY);
  });

  test('momentum — 0.15kg baseball at 40m/s', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'p=m×v',
      'p=0.15×40',
      'p=6.0',
    ], CATEGORY);
  });
});
