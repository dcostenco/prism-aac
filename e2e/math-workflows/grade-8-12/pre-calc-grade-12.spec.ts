/**
 * Pre-Calculus — Grade 12 workflow.
 * Problems drawn from tests/workflows/grade-8-12/pre-calc-grade-12.md.
 * Category: adv-math (log, ln, ², ³, √, ∛, π, x, y, n, !, ≈, →, lim,
 * sin, cos, tan). Digits/operators fall back to main.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'adv-math' as const;

test.describe('pre-calc grade-12 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('logarithm — solve log₂(x)=5', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'log(x)=5',
      'x=2³',
      'x=32',
    ], CATEGORY);
  });

  test('exponential growth — P₀=1000, double every 10yr, t=30', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'P=1000×2³',
      'P=1000×8',
      'P=8000',
    ], CATEGORY);
  });

  test('trig — sin(30°)+cos(60°)', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'sin(30)=0.5',
      'cos(60)=0.5',
      'sum=0.5+0.5',
      'sum=1.0',
    ], CATEGORY);
  });

  test('quadratic — x²−5x+6=0', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'x²−5x+6=0',
      '(x−2)(x−3)=0',
      'x=2',
      'x=3',
    ], CATEGORY);
  });

  test('combinations — C(8,3)', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'C(8,3)=8!÷(3!×5!)',
      '=(8×7×6)÷(3×2×1)',
      '=336÷6',
      '=56',
    ], CATEGORY);
  });
});
