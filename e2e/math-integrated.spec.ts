/**
 * Phase 4 — new MathPanel integrated into the AAC shell.
 *
 * Asserts: opening Math from the toolbar mounts the new cell-grid
 * canvas + keyboard region; typing through the Main keyboard commits
 * cells; Done sends a serialized expression back to the MessageBar
 * and closes the panel; Close clears the grid without touching the
 * MessageBar.
 */
import { test, expect, type Page } from '@playwright/test';

async function bootClean(page: Page, baseURL: string | undefined) {
  const start = baseURL || '/';
  await page.goto(start);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  // Phase 6: trimmed default toolbar hides the math button. Re-enable
  // it via the persisted settings store before navigating again.
  await page.evaluate(() => {
    try {
      const ls = window.localStorage;
      const cur = { state: { toolbarConfig: { order: [], enabled: { math: true } } }, version: 0 };
      ls.setItem('prism-aac-settings', JSON.stringify(cur));
    } catch {}
  });
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  // Wait for the AAC qwerty to indicate full mount.
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function openMath(page: Page) {
  await page.getByRole('button', { name: /^(Math|Matemat)/i }).first().click();
  await page.waitForSelector('[data-testid="math-panel"]');
  await page.waitForSelector('[data-testid="math-grid-svg"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

test.describe('MathPanel integrated (Phase 4)', () => {
  test('opening Math mounts the new cell-grid canvas + keyboard region + lock tool', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await expect(page.locator('[data-testid="math-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-keyboard-region"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-lock-tool"]')).toBeVisible();
    // Default keyboard is Main → digits 0-9 visible.
    await expect(page.locator('[data-testid="math-key-5"]')).toBeVisible();
  });

  test('typing 5 + 7 in the new keyboard fills three grid cells', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-plus"]').click();
    await page.locator('[data-testid="math-key-7"]').click();
    await page.waitForTimeout(120);
    const glyphs = await page.locator('[data-testid="math-grid-glyphs"] text').count();
    expect(glyphs, '3 grid glyphs after typing "5 + 7"').toBeGreaterThanOrEqual(3);
  });

  test('Done sends serialized expression to MessageBar and closes Math', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-plus"]').click();
    await page.locator('[data-testid="math-key-7"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-panel-done"]').click();
    await page.waitForTimeout(200);
    // Math panel unmounts.
    await expect(page.locator('[data-testid="math-panel"]')).toHaveCount(0);
    // MessageBar's text region now contains the serialized expression.
    // We don't pin the exact rendering; just check that "5 +" is visible
    // somewhere in the message bar surface.
    const msgBarText = await page.locator('[data-messaging-mode]').first().innerText();
    expect(msgBarText, 'serialized expression appended to MessageBar').toMatch(/5\s+.*7/);
  });

  test('Close discards the grid (no MessageBar update)', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    // Read MessageBar BEFORE opening math (Phase 6 hides chrome
    // including MessageBar while math is open, so we have to capture
    // the "before" state first).
    const beforeText = await page.locator('[data-messaging-mode]').first().innerText();
    await openMath(page);
    await page.locator('[data-testid="math-key-3"]').click();
    await page.locator('[data-testid="math-key-2"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-panel-close"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="math-panel"]')).toHaveCount(0);
    const afterText = await page.locator('[data-messaging-mode]').first().innerText();
    expect(afterText, 'MessageBar text unchanged after Close').toBe(beforeText);

    // Reopening Math starts fresh — no cells from the previous session.
    await openMath(page);
    const glyphs = await page.locator('[data-testid="math-grid-glyphs"] text').count();
    expect(glyphs, 'fresh grid on reopen').toBe(0);
  });

  test('Adv. Math chip works inside the integrated panel', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-category-adv-math"]').click();
    await page.waitForTimeout(120);
    await expect(page.locator('[data-testid="math-adv-math-keyboard"]')).toBeVisible();
    await page.locator('[data-testid="math-tool-fraction-box"]').click();
    await page.waitForTimeout(120);
    const decorations = await page.locator('[data-testid="math-grid-decorations"] line').count();
    expect(decorations, 'fraction-bar decoration drawn').toBeGreaterThanOrEqual(1);
  });
});
