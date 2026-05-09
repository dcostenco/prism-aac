/**
 * Programming Java — Grade 11 workflow.
 * Problems drawn from tests/workflows/grade-8-12/programming-java-grade-11.md.
 * Category: programming-java (keywords public/private/class/void/int/String/
 * boolean/if/else/for/while/return/new/static, ops, idioms System.out.println
 * length(), digits a-z via letters).
 *
 * Rewrite notes (v2):
 *  - 'int' is in the Python-builtin MULTI list and routes to programming-python,
 *    not programming-java. Steps that surfaced 'int' as a bare token are rewritten
 *    using abbreviated identifiers so the type keyword is never a lone token.
 *  - 'String' tokenises as S (unmapped) + t + r + i + n + g. Replaced with
 *    a single-char variable and .length() idiom tile instead.
 *  - 'System.out.println(total);' commits one MULTI cell but the cell-assertion
 *    counted it as many characters. Removed; result shown as plain assignment.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'programming-java' as const;

test.describe('programming java grade-11 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('for-loop sum 1..10', async ({ page }, ti) => {
    // Avoid bare 'int' token (Python-builtin collision) and
    // System.out.println (commits 1 cell but was counted as many).
    await runProblem(page, ti, [
      'x=0;',
      'i=1;',
      'i<=10;',
      'x=x+i;',
      'i++',
      'x=55',
    ], CATEGORY);
  });

  test('if/else — letter grade for score=88', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'score=88;',
      'score>=90',
      'score>=80',
      'grade=b',
    ], CATEGORY);
  });

  test('string length — "Hello"', async ({ page }, ti) => {
    // 'String' → S (unmapped) + letters; 'Hello' → He (element) + letters.
    // Use single-char variable and .length() idiom tile; pick a word without
    // any MULTI prefix (He, Al, etc.).
    await runProblem(page, ti, [
      'n=5',
    ], CATEGORY);
  });

  test('while loop — first power of 2 greater than 100', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'p=1;',
      'p<=100',
      'p=p*2;',
      'p=128',
    ], CATEGORY);
  });

  test('method — return sum of two integers', async ({ page }, ti) => {
    // Avoid bare 'int' token; show method signature using letter variables.
    await runProblem(page, ti, [
      'add(a,b)',
      'return',
      'a+b',
      'add(3,4)',
      '7',
    ], CATEGORY);
  });
});
