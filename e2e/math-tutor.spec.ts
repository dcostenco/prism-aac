/**
 * MathTutorTool — Phase 5C.
 *
 * AI tutor reintegrated. Tests cover the UI surface only — actual
 * AI calls are NOT made (we'd need a stubbed askAI). The "signed-out"
 * state is the default; we verify buttons disable + the sign-in
 * prompt renders.
 */
import { test, expect, type Page } from '@playwright/test';

async function bootClean(page: Page, baseURL: string | undefined) {
  const start = baseURL || '/';
  await page.goto(start);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function openMath(page: Page) {
  await page.getByRole('button', { name: /^(Math|Matemat)/i }).first().click();
  await page.waitForSelector('[data-testid="math-panel"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

test.describe('MathTutorTool (Phase 5C)', () => {
  test('three tutor buttons (Hint / Check / Solve) render in the math header', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await expect(page.locator('[data-testid="math-tutor-hint"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-tutor-check"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-tutor-solve"]')).toBeVisible();
  });

  test('signed-out: tutor buttons are disabled + a sign-in prompt is shown', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    // No mocked profile → aiEnabled = false → all 3 disabled.
    for (const id of ['math-tutor-hint', 'math-tutor-check', 'math-tutor-solve']) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeDisabled();
    }
    await expect(page.locator('[data-testid="math-tutor-signed-out"]')).toBeVisible();
  });

  test('all 3 tutor buttons meet the 44px tap-target floor', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    for (const id of ['math-tutor-hint', 'math-tutor-check', 'math-tutor-solve']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      if (!box) throw new Error(`${id} missing box`);
      expect(box.height, `${id} ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
  });
});
