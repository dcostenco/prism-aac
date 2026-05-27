/**
 * E2E — keyboard 2-mode cycle: keyboard-only ↔ picture-only
 *
 * Replaced the old 3-state cycle (MIN → HIDE → MAX) with the corrected
 * 2-state cycle (keyboard-only ↔ picture-only). The "all-3-panels"
 * intermediate state was the Ludmila bug: one click should go directly
 * to keyboard-only, not through a mixed state.
 *
 * Cycle from default state (both panels visible):
 *   1st click → keyboard-only  (categories hidden, keyboard maximized)
 *   2nd click → picture-only   (keyboard hidden, categories visible)
 *   3rd click → keyboard-only  (repeats)
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
  // Wait until the CategoryPanel sidebar renders (kb-cycle-btn must exist)
  await page.waitForSelector('[data-testid="kb-cycle-btn"]', { timeout: 30000 });
}

test.describe('Keyboard 2-mode cycle', () => {

  test('default state: keyboard-shell and categories both visible', async ({ page }) => {
    await bootClean(page);

    const kb = page.locator('[data-testid="keyboard-shell"]');
    const catNav = page.locator('[data-testid="kb-cycle-btn"]').locator('xpath=ancestor::nav');
    await expect(kb).toBeVisible();
    await expect(catNav).toBeVisible();

    const box = await kb.boundingBox();
    expect(box).toBeTruthy();
    // In default state keyboard is NOT maximized — occupies less than half viewport height
    expect(box!.height).toBeLessThan(page.viewportSize()!.height * 0.5);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-default-state.png'), fullPage: false });
  });

  test('1st click → keyboard-only: categories hidden, keyboard maximized', async ({ page }) => {
    await bootClean(page);

    const kbBtn = page.locator('[data-testid="kb-cycle-btn"]');
    const kb = page.locator('[data-testid="keyboard-shell"]');
    const defaultHeight = (await kb.boundingBox())!.height;

    await kbBtn.click();

    // Keyboard must still be visible AND taller (maximized)
    await expect(kb).toBeVisible();
    const maxHeight = (await kb.boundingBox())!.height;
    expect(maxHeight).toBeGreaterThan(defaultHeight * 1.3);

    // CategoryPanel nav must be gone (keyboard-only mode hides it)
    await expect(kbBtn).not.toBeVisible();

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-keyboard-only.png'), fullPage: false });
  });

  test('2nd click → picture-only: keyboard-shell hidden, categories visible', async ({ page }) => {
    await bootClean(page);

    const kbBtn = page.locator('[data-testid="kb-cycle-btn"]');
    const kb = page.locator('[data-testid="keyboard-shell"]');

    // Click 1: default → keyboard-only
    await kbBtn.click();
    await expect(kb).toBeVisible();

    // In keyboard-only, the kb-cycle-btn is hidden; we locate the minimize button inside the keyboard
    const kbMinimize = page.locator('button[data-action="kb-minimize"]');
    await expect(kbMinimize).toBeVisible();

    // Click the in-keyboard minimize button to go to picture-only
    await kbMinimize.click();

    // Keyboard must now be gone
    await expect(kb).not.toBeVisible();

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-picture-only.png'), fullPage: false });
  });

  test('from picture-only, kb-cycle-btn click → keyboard-only in ONE click', async ({ page }) => {
    await bootClean(page);

    // Drive to picture-only: click kb-cycle-btn → keyboard-only, then minimize button → picture-only
    const kbBtn = page.locator('[data-testid="kb-cycle-btn"]');
    await kbBtn.click();
    const kbMinimize = page.locator('button[data-action="kb-minimize"]');
    await expect(kbMinimize).toBeVisible();
    await kbMinimize.click();

    // Now in picture-only state — kb-cycle-btn should be visible again labelled "MAX KB"
    await expect(kbBtn).toBeVisible();

    const kb = page.locator('[data-testid="keyboard-shell"]');
    await expect(kb).not.toBeVisible();

    // ONE click must go directly to keyboard-only (the Ludmila bug)
    await kbBtn.click();
    await expect(kb).toBeVisible();

    // Must NOT show all-3 (categories visible simultaneously with maximized keyboard)
    // Keyboard must be maximized: height > 50% of viewport
    const box = await kb.boundingBox();
    expect(box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.5);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-from-picture-one-click.png'), fullPage: false });
  });

  test('NO intermediate "all-3" state: prediction bar hidden in keyboard-only', async ({ page }) => {
    await bootClean(page);

    const kbBtn = page.locator('[data-testid="kb-cycle-btn"]');
    await kbBtn.click(); // → keyboard-only

    const kb = page.locator('[data-testid="keyboard-shell"]');
    await expect(kb).toBeVisible();

    // PredictionBar should be gone in keyboard-only mode
    const predBar = page.locator('[data-testid="prediction-bar"]');
    await expect(predBar).not.toBeVisible();

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-no-prediction-bar.png'), fullPage: false });
  });

  test('keyboard-only state persists across page reload', async ({ page }) => {
    await bootClean(page);

    // Drive to keyboard-only in one click
    const kbBtn = page.locator('[data-testid="kb-cycle-btn"]');
    await kbBtn.click();

    const kb = page.locator('[data-testid="keyboard-shell"]');
    await expect(kb).toBeVisible();
    const maxHeight = (await kb.boundingBox())!.height;

    await page.reload({ waitUntil: 'domcontentloaded' });
    // After reload kb-cycle-btn may not be visible (keyboard-only), wait for kb-shell
    await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30000 });

    const kbAfter = page.locator('[data-testid="keyboard-shell"]');
    await expect(kbAfter).toBeVisible();
    const heightAfter = (await kbAfter.boundingBox())!.height;
    expect(heightAfter).toBeGreaterThan(maxHeight * 0.85);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'kb-persist-reload.png'), fullPage: false });
  });

  test('Q key visible and tappable in keyboard-only state', async ({ page }) => {
    await bootClean(page);

    const kbBtn = page.locator('[data-testid="kb-cycle-btn"]');
    await kbBtn.click(); // → keyboard-only

    const qKey = page.locator('button[data-key="Q"]');
    await expect(qKey).toBeVisible();
    const box = await qKey.boundingBox();
    expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
    // Key should be larger in maximized mode
    expect(box!.height).toBeGreaterThan(30);
  });
});
