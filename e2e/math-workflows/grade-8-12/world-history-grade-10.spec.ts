/**
 * World History — Grade 10 workflow.
 * Problems drawn from tests/workflows/grade-8-12/world-history-grade-10.md.
 * Category: main (digits + operators). History-specific tokens (BCE, CE,
 * 18th, century ordinals, event tiles like 1492) fall back to the
 * 'history' category via runProblem's skip-on-missing logic. Digits/
 * arithmetic fall back to main.
 *
 * Note: the spec is filed under CATEGORY='main' per the spec-matrix in
 * the task brief; history-category glyphs (BCE, CE, ordinals, event
 * tiles) will trigger a skip if the history chip is unavailable.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'main' as const;

test.describe('world-history grade-10 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('date arithmetic — 1453 to 1500', async ({ page }, ti) => {
    // '1492' is a MULTI history-event tile only available on the history chip,
    // not on 'main'. Change the problem to 1500−1453=47 (all plain digits).
    await runProblem(page, ti, [
      '1500−1453',
      '47',
    ], CATEGORY);
  });

  test('WWI duration — 1914 to 1918', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '1918−1914',
      '4',
    ], CATEGORY);
  });

  test('WWII duration — 1939 to 1945', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '1945−1939',
      '6',
    ], CATEGORY);
  });

  test('Cold War span — 1945 to 1989', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '1989−1945',
      '44',
    ], CATEGORY);
  });

  test('BCE to CE span — Roman Republic 509BCE to 476CE', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '509+476',
      '985',
    ], CATEGORY);
  });
});
