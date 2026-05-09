/**
 * Earth Science — Grade 9 workflow.
 * Problems drawn from tests/workflows/grade-8-12/earth-science-grade-9.md.
 * Category: earth-science (km, AU, ly, Mya, °C, °F, mb, ×10 sci-notation
 * superscripts, yr, plate arrows). Digits/operators fall back to main.
 */
import { test } from '@playwright/test';
import { gotoMathPanel, runProblem } from '../_helpers';

const CATEGORY = 'earth-science' as const;

test.describe('earth-science grade-9 workflow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('earthquake S-P wave gap — Δt=90s, d≈720km', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'Δt=90',
      'd≈Δt×8',
      'd≈90×8',
      'd≈720',
    ], CATEGORY);
  });

  test('temperature conversion — 25°C to °F', async ({ page }, ti) => {
    await runProblem(page, ti, [
      '°F=(°C×9÷5)+32',
      '°F=(25×9÷5)+32',
      '°F=45+32',
      '°F=77',
    ], CATEGORY);
  });

  test('pressure drop — surface 1013mb, Everest 333mb', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'Δ=1013−333',
      'Δ=680',
    ], CATEGORY);
  });

  test('geologic age — fossil 65Mya to today', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'start=65',
      'end=0',
      'age=65−0',
      'age=65',
    ], CATEGORY);
  });

  test('AU to km — Mars 1.52AU×1.50×10⁸km', async ({ page }, ti) => {
    await runProblem(page, ti, [
      'd=1.52×1.50×10⁸',
      'd=2.28×10⁸',
    ], CATEGORY);
  });
});
