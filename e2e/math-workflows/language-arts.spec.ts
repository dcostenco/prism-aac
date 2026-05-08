/**
 * Language Arts workflow — Grade 5-7 problems modelled on the
 * algebra reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/language-arts.md, typed step-by-step on the math
 * panel — POS tags + sentence-type markers.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * Language Arts keyboard (gap surfaced in
 * tests/workflows/COVERAGE.md), the spec skips with a descriptive
 * message rather than failing.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from './_helpers';

const CATEGORY = 'language-arts' as const;

test.describe('language-arts workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('POS-tag "the cat ran fast"', async ({ page }, ti) => {
    await runProblem(page, ti, [
      't=ART',
      'c=N',
      'r=V',
      'f=ADV',
    ], CATEGORY);
  });

  test('POS-tag "she gave him a red book"', async ({ page }, ti) => {
    await runProblem(page, ti, [
      's=PRON',
      'g=V',
      'h=PRON',
      'a=ART',
      'r=ADJ',
      'b=N',
    ], CATEGORY);
  });

  test('sentence-type ID — "go home now."', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'g=V',
      'h=N',
      't=IMP',
    ], CATEGORY);
  });

  test('sentence-type ID — "are you ready?"', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'a=AUX',
      'y=PRON',
      'r=ADJ',
      't=INT',
    ], CATEGORY);
  });

  test('sentence-type ID — "we won the game!"', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'w=PRON',
      'w=V',
      't=ART',
      'g=N',
      't=EXCL',
    ], CATEGORY);
  });

  test('compound sentence — "he ran and she walked"', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'h=PRON',
      'r=V',
      'a=CONJ',
      's=PRON',
      'w=V',
      't=COMP',
    ], CATEGORY);
  });
});
