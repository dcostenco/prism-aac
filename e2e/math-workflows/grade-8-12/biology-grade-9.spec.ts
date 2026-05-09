/**
 * Biology — Grade 9 workflow.
 * Problems drawn from tests/workflows/grade-8-12/biology-grade-9.md.
 * Category: biology (AA Aa aa Bb bb, mRNA tRNA, F1 F2, ×, Met Ala Stop,
 * ^n for exponents, nucleotides A T G C U).
 * Digits/operators fall back to main.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'biology' as const;

test.describe('biology grade-9 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('punnett square — Bb×bb genotype ratio', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'Bb×bb',
      'Bb+Bb+bb+bb=4',
      'Bb=2÷4',
      'bb=2÷4',
    ], CATEGORY);
  });

  test('phenotype probability — Aa×Aa, P(dominant)=75%', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'Aa×Aa',
      'AA+2Aa+aa=4',
      'dom=3',
      'p=3÷4',
    ], CATEGORY);
  });

  test('translation — 18 bases → how many amino acids', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'bases=18',
      'codon=3',
      'aa=18÷3',
      'aa=6',
    ], CATEGORY);
  });

  test('population growth — bacteria double every 20min, start 100', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'x=60÷20',
      'x=3',
      'n=100×8',
      'n=800',
    ], CATEGORY);
  });

  test('codon translation — AUG GCA UAA', async ({ page }, ti) => {
    // AUG→Met, GCA→alanine (Ala token blocked by Al element), UAA→Stop.
    // Write alanine as individual letter tokens to avoid Al (aluminium) collision.
    await runProblem(page, ti, [
      'A+U+G=Met',
      'G+C+A',
      'U+A+A=Stop',
    ], CATEGORY);
  });
});
