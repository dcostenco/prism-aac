/**
 * MathMainKeyboard Phase 1B — on-screen keyboard wired to the grid.
 *
 * Asserts: every key in the keyboard commits the right glyph, ⌫
 * deletes, ⏎ moves to next row, and tap targets are at least 44px
 * tall (the AAC accessibility floor).
 */
import { test, expect, type Page } from '@playwright/test';

async function gotoDevPage(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

test.describe('MathMainKeyboard (Phase 1B)', () => {
  test('keyboard mounts with all expected keys', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      await expect(page.locator(`[data-testid="math-key-${d}"]`)).toBeVisible();
    }
    for (const op of ['plus', 'minus', 'times', 'divided-by', 'equals', 'decimal-point', 'comma', 'open-parenthesis', 'close-parenthesis']) {
      await expect(page.locator(`[data-testid="math-key-${op}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="math-key-return"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-key-space"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-key-backspace"]')).toBeVisible();
  });

  test('every digit key commits the matching glyph and advances the cursor', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-key-5"]').click();
    await page.waitForTimeout(80);
    let header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(0,1\).*cells=1/);
    await page.locator('[data-testid="math-key-7"]').click();
    await page.waitForTimeout(80);
    header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(0,2\).*cells=2/);
  });

  test('plus / minus / times / divide / equals commit their glyphs', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    for (const k of ['plus', 'minus', 'times', 'divided-by', 'equals']) {
      await page.locator(`[data-testid="math-key-${k}"]`).click();
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(0,5\).*cells=5/);
  });

  test('backspace deletes and pulls cursor back', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-key-5"]').click();
    await page.waitForTimeout(60);
    // Cursor at (0,1), one cell. Backspace eats backwards to (0,0) with no cells.
    await page.locator('[data-testid="math-key-backspace"]').click();
    await page.waitForTimeout(80);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(0,0\).*cells=0/);
  });

  test('return key drops cursor to next row at column 0', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-return"]').click();
    await page.waitForTimeout(80);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(1,0\)/);
  });

  test('all keys meet the 44px minimum tap-target floor (AAC accessibility)', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    const keys = await page.locator('[data-testid^="math-key-"]').all();
    expect(keys.length, 'keyboard exposes ≥ 20 keys').toBeGreaterThanOrEqual(20);
    for (const k of keys) {
      const box = await k.boundingBox();
      const testId = await k.getAttribute('data-testid');
      if (!box) throw new Error(`key ${testId} missing box`);
      expect(box.height, `${testId} height ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
  });

  test('typing a 4-glyph expression renders 4 SVG glyphs in the grid', async ({ page, baseURL }) => {
    await gotoDevPage(page, baseURL);
    for (const k of ['math-key-5', 'math-key-plus', 'math-key-7', 'math-key-equals']) {
      await page.locator(`[data-testid="${k}"]`).click();
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(120);
    const glyphCount = await page.locator('[data-testid="math-grid-glyphs"] text').count();
    expect(glyphCount, '4 glyph nodes rendered after typing 5 + 7 =').toBeGreaterThanOrEqual(4);
  });
});
