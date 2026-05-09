/**
 * Algebra — Grade 9 workflow.
 * Problems drawn from tests/workflows/grade-8-12/algebra-grade-9.md.
 * Category: main (digits + operators), with adv-math fallback for
 * variables x, y, t, n and symbols ², √.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'main' as const;

test.describe('algebra grade-9 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('pizza shop — linear equation 12+1.50t=21', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '12+1.50t=21',
      '1.50t=21−12',
      '1.50t=9',
      't=9÷1.50',
      't=6',
    ], CATEGORY);
  });

  test('phone plan — solve 25+0.10x=33', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '25+0.10x=33',
      '0.10x=33−25',
      '0.10x=8',
      'x=8÷0.10',
      'x=80',
    ], CATEGORY);
  });

  test('consecutive integers — sum to 47', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'n+(n+1)=47',
      '2n+1=47',
      '2n=46',
      'n=23',
      'n+1=24',
    ], CATEGORY);
  });

  test('two-step — 2x−3=17', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '2x−3=17',
      '2x=17+3',
      '2x=20',
      'x=10',
    ], CATEGORY);
  });

  test('distance-rate-time — 45km in 3hr', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'd=r×t',
      '45=r×3',
      'r=45÷3',
      'r=15',
    ], CATEGORY);
  });
});
