/**
 * Programming Java — Grade 11 workflow.
 * Problems drawn from tests/workflows/grade-8-12/programming-java-grade-11.md.
 * Category: programming-java (keywords public/private/class/void/int/String/
 * boolean/if/else/for/while/return/new/static, ops, idioms System.out.println
 * length(), digits a-z via letters).
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'programming-java' as const;

test.describe('programming java grade-11 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('for-loop sum 1..10', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'int',
      'total=0;',
      'for',
      '(int',
      'i=1;i<=10;i++)',
      'total=total+i;',
      'System.out.println(total);',
      '55',
    ], CATEGORY);
  });

  test('if/else — letter grade for score=88', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'int',
      'score=88;',
      'if',
      '(score>=90)',
      'System.out.println("A");',
      'else',
      'if',
      '(score>=80)',
      'System.out.println("B");',
    ], CATEGORY);
  });

  test('string length — "Hello"', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'String',
      's="Hello";',
      'int',
      'n=s.length();',
      'n=5',
    ], CATEGORY);
  });

  test('while loop — first power of 2 greater than 100', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'int',
      'p=1;',
      'while',
      '(p<=100)',
      'p=p*2;',
      'p=128',
    ], CATEGORY);
  });

  test('method — return sum of two integers', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'public',
      'static',
      'int',
      'add(int',
      'a,int',
      'b)',
      'return',
      'a+b;',
      'add(3,4)',
      '7',
    ], CATEGORY);
  });
});
