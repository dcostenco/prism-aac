/**
 * MathTutorTool — Phase 5C (auth gate removed in Phase 5D).
 *
 * Surface-level tests: the three buttons render, hit the 44px floor,
 * and remain enabled regardless of auth state. Streaming + error
 * paths are covered in math-tutor-deep.spec.ts via mocked askAI.
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

  test('tutor buttons are enabled regardless of auth state (Phase 5D — gate removed)', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    // No mocked profile → buttons must STILL be enabled. askAI handles
    // 401s gracefully via the catch handler.
    for (const id of ['math-tutor-hint', 'math-tutor-check', 'math-tutor-solve']) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeEnabled();
    }
    // The signed-out hint paragraph must NOT exist.
    await expect(page.locator('[data-testid="math-tutor-signed-out"]')).toHaveCount(0);
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
