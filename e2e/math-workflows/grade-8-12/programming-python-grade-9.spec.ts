/**
 * Programming Python — Grade 9 workflow.
 * Problems drawn from tests/workflows/grade-8-12/programming-python-grade-9.md.
 * Category: programming-python (keywords def/for/if/else/return/print/range/in,
 * built-ins sum/max/min/len, ops + - * / % == != < > <= >=, digits a-z via letters).
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'programming-python' as const;

test.describe('programming python grade-9 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('function — return square of x', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'def',
      'square(x):',
      'return',
      'x*x',
      'square(7)',
      '49',
    ], CATEGORY);
  });

  test('even/odd checker — n=14', async ({ page }, ti) => {
    // Use char-by-char steps so cell count matches glyph count exactly.
    await runProblem(page, ti, [
      'n=14',
      'n%2==0',
      'output=even',
    ], CATEGORY);
  });

  test('list average — grades [80,90,70,100]', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'total=340',
      'n=4',
      'avg=total/n',
      'avg=85.0',
    ], CATEGORY);
  });

  test('find maximum — max of [12,7,23,19]', async ({ page }, ti) => {
    // 'biggest' tokenises as b+i+g+g+e+st (st=stone weight unit); use 'val'.
    await runProblem(page, ti, [
      'nums=[12,7,23,19]',
      'val=23',
    ], CATEGORY);
  });

  test('for loop sum — 1 to 10', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'total=0',
      'for',
      'i',
      'in',
      'range(1,11):',
      'total=total+i',
      '55',
    ], CATEGORY);
  });
});
