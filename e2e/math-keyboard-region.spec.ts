/**
 * MathKeyboardRegion Phase 2A — category chips + in-place swap.
 *
 * Asserts:
 *   • The keyboard region mounts with all 9 category chips visible.
 *   • Tapping a chip swaps the active panel CONTENT — without
 *     resizing the canvas above. Region height stable across swaps.
 *   • The 'main' chip is the default active state on first load.
 *   • Adv. Math chip swaps in the adv-math panel with parens, π, √, etc.
 *   • Letters chip swaps in the letters panel with a-p / q-z toggle.
 *   • Misc Math (and other not-yet-implemented categories) render the
 *     "Coming in Phase 2C" placeholder.
 */
import { test, expect, type Page } from '@playwright/test';

async function gotoDevPage(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-keyboard-region"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

test.describe('MathKeyboardRegion (Phase 2A)', () => {
  test('region mounts with all 9 category chips visible', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    for (const cat of ['main', 'adv-math', 'letters', 'misc-math', 'time-distance', 'weight', 'volume', 'geom', 'money']) {
      await expect(page.locator(`[data-testid="math-category-${cat}"]`)).toBeVisible();
    }
  });

  test('default active category is "main" on first load', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    const region = page.locator('[data-testid="math-keyboard-region"]');
    await expect(region).toHaveAttribute('data-active-category', 'main');
    await expect(page.locator('[data-testid="math-main-keyboard"]')).toBeVisible();
  });

  test('tapping Adv. Math chip swaps in the adv-math panel', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-category-adv-math"]').click();
    await page.waitForTimeout(120);
    const region = page.locator('[data-testid="math-keyboard-region"]');
    await expect(region).toHaveAttribute('data-active-category', 'adv-math');
    await expect(page.locator('[data-testid="math-adv-math-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-main-keyboard"]')).toHaveCount(0);
    // π and √ keys exist on this panel.
    await expect(page.locator('[data-testid="math-key-adv-pi"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-key-adv-square-root"]')).toBeVisible();
  });

  test('tapping Letters chip swaps in the letters panel; toggle switches a-p ↔ q-z', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-category-letters"]').click();
    await page.waitForTimeout(120);
    await expect(page.locator('[data-testid="math-letters-keyboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-key-ltr-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-key-ltr-z"]')).toHaveCount(0);
    // Toggle to q-z
    await page.locator('[data-testid="math-letters-page-toggle"]').click();
    await page.waitForTimeout(120);
    await expect(page.locator('[data-testid="math-key-ltr-z"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-key-ltr-a"]')).toHaveCount(0);
  });

  test('every category swaps to its own keyboard panel (no placeholders left)', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    // Each category id ↔ keyboard testid. Phase 2C wired all of them.
    const expected: Record<string, string> = {
      'misc-math':     'math-misc-keyboard',
      'time-distance': 'math-time-distance-keyboard',
      'weight':        'math-weight-keyboard',
      'volume':        'math-volume-keyboard',
      'geom':          'math-geom-keyboard',
      'money':         'math-money-keyboard',
    };
    for (const [cat, kbId] of Object.entries(expected)) {
      await page.locator(`[data-testid="math-category-${cat}"]`).click();
      await page.waitForTimeout(120);
      await expect(page.locator(`[data-testid="${kbId}"]`)).toBeVisible();
    }
  });

  test('Adv. Math: tapping π commits the π glyph in the active cell', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-category-adv-math"]').click();
    await page.waitForTimeout(120);
    await page.locator('[data-testid="math-key-adv-pi"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=1/);
    const glyphs = await page.locator('[data-testid="math-grid-glyphs"] text').count();
    expect(glyphs).toBeGreaterThanOrEqual(1);
  });

  test('canvas height is STABLE when swapping between categories (no canvas reflow)', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    const before = await page.locator('[data-testid="math-grid-svg"]').boundingBox();
    if (!before) throw new Error('canvas missing');

    // Swap through several categories — none of them must change the canvas height.
    for (const cat of ['adv-math', 'letters', 'misc-math', 'main']) {
      await page.locator(`[data-testid="math-category-${cat}"]`).click();
      await page.waitForTimeout(150);
      const now = await page.locator('[data-testid="math-grid-svg"]').boundingBox();
      if (!now) throw new Error('canvas missing after swap');
      // Allow ±2px tolerance for rounding.
      expect(Math.abs(now.height - before.height), `canvas height stable across swap to ${cat}`).toBeLessThanOrEqual(2);
    }
  });

  test('every category chip meets the 44px tap-target floor', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    const chips = await page.locator('[data-testid^="math-category-"]').all();
    // Phase 6 added Chemistry, Physics, Python, Java (→ 13).
    // Phase 7 added Biology, Statistics, Music, Earth Science (→ 17).
    expect(chips.length, 'all 17 chips present (9 math + 4 Phase-6 + 4 Phase-7 domains)').toBe(17);
    for (const chip of chips) {
      const box = await chip.boundingBox();
      const id = await chip.getAttribute('data-testid');
      if (!box) throw new Error(`${id} missing box`);
      expect(box.height, `${id} ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
  });
});
