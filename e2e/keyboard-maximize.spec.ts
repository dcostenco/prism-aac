/**
 * E2E — keyboard 3-mode cycle: MAX KB → MIN KB → HIDE KB
 *
 * Tests the sidebar button cycles through modes correctly and that
 * the layout changes are visible (keyboard height changes).
 * Captures screenshots at each state for visual verification.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = path.resolve('e2e', '_screenshots');

async function bootClean(page: Page) {
  await page.goto('/prism-aac');
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30000 });
}

test.describe('Keyboard 3-mode cycle', () => {

  test('default state shows keyboard (MIN KB mode)', async ({ page }) => {
    await bootClean(page);
    const kb = page.locator('[data-testid="keyboard-shell"]');
    await expect(kb).toBeVisible();

    // Keyboard should be at normal height (not maximized)
    const box = await kb.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeLessThan(page.viewportSize()!.height * 0.5);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-mode-default.png'), fullPage: false });
  });

  test('sidebar button cycles: default → HIDE → MAX → back to normal', async ({ page }) => {
    await bootClean(page);

    // Find the sidebar keyboard button
    const kbBtn = page.locator('nav button', { hasText: /KB|Keyboard/i }).first();
    await expect(kbBtn).toBeVisible();

    // State 1: keyboard is visible (default = MIN KB)
    const kb = page.locator('[data-testid="keyboard-shell"]');
    await expect(kb).toBeVisible();
    const minHeight = (await kb.boundingBox())!.height;

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-cycle-1-min.png'), fullPage: false });

    // Click → HIDE KB
    await kbBtn.click();
    await expect(kb).not.toBeVisible();

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-cycle-2-hidden.png'), fullPage: false });

    // Click → MAX KB
    await kbBtn.click();
    await expect(kb).toBeVisible();
    const maxHeight = (await kb.boundingBox())!.height;
    expect(maxHeight).toBeGreaterThan(minHeight * 1.3);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-cycle-3-max.png'), fullPage: false });

    // Click → back to MIN KB (normal)
    await kbBtn.click();
    await expect(kb).toBeVisible();
    const normalHeight = (await kb.boundingBox())!.height;
    expect(normalHeight).toBeLessThan(maxHeight);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-cycle-4-back-to-min.png'), fullPage: false });
  });

  test('MAX KB state persists across page reload', async ({ page }) => {
    await bootClean(page);

    // Set to MAX KB: click twice (MIN → HIDE → MAX)
    const kbBtn = page.locator('nav button', { hasText: /KB|Keyboard/i }).first();
    await kbBtn.click(); // MIN → HIDE
    await kbBtn.click(); // HIDE → MAX

    const kb = page.locator('[data-testid="keyboard-shell"]');
    await expect(kb).toBeVisible();
    const maxHeight = (await kb.boundingBox())!.height;

    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30000 });

    // Keyboard should still be maximized
    const kbAfter = page.locator('[data-testid="keyboard-shell"]');
    await expect(kbAfter).toBeVisible();
    const heightAfter = (await kbAfter.boundingBox())!.height;
    expect(heightAfter).toBeGreaterThan(maxHeight * 0.9);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-persist-after-reload.png'), fullPage: false });
  });

  test('Q key is visible and clickable in all keyboard states', async ({ page }) => {
    await bootClean(page);
    const qKey = page.locator('button[data-key="Q"]');

    // MIN KB
    await expect(qKey).toBeVisible();
    const minBox = await qKey.boundingBox();
    expect(minBox!.y + minBox!.height).toBeLessThan(page.viewportSize()!.height);

    // MAX KB: click sidebar twice
    const kbBtn = page.locator('nav button', { hasText: /KB|Keyboard/i }).first();
    await kbBtn.click(); // HIDE
    await kbBtn.click(); // MAX
    await expect(qKey).toBeVisible();
    const maxBox = await qKey.boundingBox();
    expect(maxBox!.height).toBeGreaterThanOrEqual(minBox!.height);
  });
});
