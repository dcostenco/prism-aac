/**
 * Statistics — Grade 11 workflow.
 * Problems drawn from tests/workflows/grade-8-12/statistics-grade-11.md.
 * Category: statistics (μ, σ, x̄, z, n, s², p-value, H0, Ha, SE, CI,
 * C(, P(, ≈, ≠, df). Digits/operators/√ fall back to main/adv-math.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'statistics' as const;

test.describe('statistics grade-11 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('sample mean — scores 7,8,6,9,10', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'n=5',
      'x̄=(7+8+6+9+10)÷n',
      'x̄=40÷5',
      'x̄=8.0',
    ], CATEGORY);
  });

  test('z-score — exam 85, μ=70, σ=10', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'z=(x−μ)÷σ',
      'z=(85−70)÷10',
      'z=15÷10',
      'z=1.5',
    ], CATEGORY);
  });

  test('sample variance — 4,6,8 with x̄=6', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '(4−6)²=4',
      '(6−6)²=0',
      '(8−6)²=4',
      's²=(4+0+4)÷(n−1)',
      's²=8÷2',
      's²=4',
    ], CATEGORY);
  });

  test('hypothesis test — p-value 0.03, α=0.05', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'H0',
      'Ha',
      'p≈0.03',
      'α=0.05',
    ], CATEGORY);
  });

  test('binomial — 5 flips, P(exactly 3 heads)', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'n=5',
      'p=0.5',
      'C(5,3)=10',
      'P(=10×0.125×0.25',
      'P(=0.3125',
    ], CATEGORY);
  });
});
