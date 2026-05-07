/**
 * Math Docs Tool — Phase 5B (save / open / delete).
 *
 * Tests the localStorage-backed doc persistence inside the AAC shell.
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

test.describe('MathDocsTool (Phase 5B)', () => {
  test('Save + Open buttons render in the math header', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await expect(page.locator('[data-testid="math-docs-tool"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-docs-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-docs-open-toggle"]')).toBeVisible();
  });

  test('Saving an empty grid shows a "nothing to save" toast', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-docs-save"]').click();
    await page.waitForTimeout(200);
    const toast = page.locator('[data-testid="math-docs-toast"]');
    await expect(toast).toContainText(/nothing to save/i);
  });

  test('Save → toast confirms; Open shows the saved doc; tap reloads it', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    // Type 5 + 7
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-plus"]').click();
    await page.locator('[data-testid="math-key-7"]').click();
    await page.waitForTimeout(120);
    // Save
    await page.locator('[data-testid="math-docs-save"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="math-docs-toast"]')).toContainText(/Saved as/);
    // Wait for toast to clear before opening so the toast doesn't
    // overlap the dropdown selector.
    await page.waitForTimeout(2700);

    // Reset the grid (Close + reopen).
    await page.locator('[data-testid="math-panel-close"]').click();
    await openMath(page);
    let glyphs = await page.locator('[data-testid="math-grid-glyphs"] text').count();
    expect(glyphs, 'fresh grid after Close+reopen').toBe(0);

    // Open the doc list — the saved entry should be there.
    await page.locator('[data-testid="math-docs-open-toggle"]').click();
    await page.waitForTimeout(200);
    const list = page.locator('[data-testid="math-docs-list"]');
    await expect(list).toBeVisible();
    const rows = await page.locator('[data-testid^="math-docs-row-"]').count();
    expect(rows, 'one saved row visible').toBe(1);

    // Click the load button for that row.
    const loader = page.locator('[data-testid^="math-docs-load-"]').first();
    await loader.click();
    await page.waitForTimeout(200);
    glyphs = await page.locator('[data-testid="math-grid-glyphs"] text').count();
    expect(glyphs, '3 glyphs reloaded after Open').toBe(3);
  });

  test('Saved docs survive a full page reload', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-key-9"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-docs-save"]').click();
    await page.waitForTimeout(200);
    // Reload the whole app.
    await page.reload();
    await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
    await openMath(page);
    await page.locator('[data-testid="math-docs-open-toggle"]').click();
    await page.waitForTimeout(200);
    const rows = await page.locator('[data-testid^="math-docs-row-"]').count();
    expect(rows, 'doc persists across reload').toBe(1);
  });

  test('Delete button removes a saved doc from the list', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-key-3"]').click();
    await page.locator('[data-testid="math-docs-save"]').click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="math-docs-open-toggle"]').click();
    await page.waitForTimeout(200);
    const deleteBtn = page.locator('[data-testid^="math-docs-delete-"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(200);
    const rows = await page.locator('[data-testid^="math-docs-row-"]').count();
    expect(rows, 'row removed').toBe(0);
  });
});
