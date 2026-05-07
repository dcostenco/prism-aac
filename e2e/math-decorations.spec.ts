/**
 * MathGrid Phase 2B — decorations (fraction box, long-division
 * house, root bar, summation line) rendered as SVG overlays on
 * the cell grid.
 *
 * Asserts: each tool button on the Adv. Math keyboard inserts the
 * right decoration AND moves the cursor to the right cell. The
 * decoration's <line> element actually appears in the SVG.
 */
import { test, expect, type Page } from '@playwright/test';

async function gotoDevPageOnAdvMath(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-keyboard-region"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
  await page.locator('[data-testid="math-category-adv-math"]').click();
  await page.waitForTimeout(120);
}

test.describe('MathGrid Phase 2B — decorations', () => {
  test('Adv. Math panel exposes the 5 decoration tools', async ({ page, baseURL }) => {
    await gotoDevPageOnAdvMath(page, baseURL);
    for (const tool of ['fraction-box', 'fraction-to-denominator', 'long-division', 'root-bar', 'summation-line']) {
      await expect(page.locator(`[data-testid="math-tool-${tool}"]`)).toBeVisible();
    }
  });

  test('Open Fraction Box adds a fraction-bar SVG line', async ({ page, baseURL }) => {
    await gotoDevPageOnAdvMath(page, baseURL);
    const before = await page.locator('[data-testid="math-grid-decorations"] line').count();
    await page.locator('[data-testid="math-tool-fraction-box"]').click();
    await page.waitForTimeout(120);
    const after = await page.locator('[data-testid="math-grid-decorations"] line').count();
    expect(after - before, 'one new decoration line drawn').toBe(1);
  });

  test('Long-Division House adds TWO decoration lines (top bar + side tick)', async ({ page, baseURL }) => {
    await gotoDevPageOnAdvMath(page, baseURL);
    const before = await page.locator('[data-testid="math-grid-decorations"] line').count();
    await page.locator('[data-testid="math-tool-long-division"]').click();
    await page.waitForTimeout(120);
    const after = await page.locator('[data-testid="math-grid-decorations"] line').count();
    expect(after - before, 'two new decoration lines drawn (bar + tick)').toBe(2);
    // Cursor should have dropped one row.
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(1,0\)/);
  });

  test('Root Bar adds a single SVG line and leaves cursor in place', async ({ page, baseURL }) => {
    await gotoDevPageOnAdvMath(page, baseURL);
    const beforeHeader = await page.locator('header').first().innerText();
    const beforeCursorMatch = beforeHeader.match(/cursor=\((\d+),(\d+)\)/);
    if (!beforeCursorMatch) throw new Error('cursor not in header');
    await page.locator('[data-testid="math-tool-root-bar"]').click();
    await page.waitForTimeout(120);
    const decorations = await page.locator('[data-testid="math-grid-decorations"] line').count();
    expect(decorations, 'one new decoration line').toBe(1);
    const afterHeader = await page.locator('header').first().innerText();
    expect(afterHeader, 'cursor unchanged').toMatch(new RegExp(`cursor=\\(${beforeCursorMatch[1]},${beforeCursorMatch[2]}\\)`));
  });

  test('Summation Line toggles on / off when row has filled cells', async ({ page, baseURL }) => {
    await gotoDevPageOnAdvMath(page, baseURL);
    // Switch to Main, type some cells, then back to Adv. Math.
    await page.locator('[data-testid="math-category-main"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-key-4"]').click();
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-6"]').click();
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-category-adv-math"]').click();
    await page.waitForTimeout(120);
    // Cursor at (0,3). The summation toggle finds the contiguous span
    // of cells around the cursor row. Move cursor onto a filled cell.
    const svg = await page.locator('[data-testid="math-grid-svg"]').boundingBox();
    if (!svg) throw new Error('svg missing');
    await page.mouse.click(svg.x + 1 * 56 + 28, svg.y + 0 * 56 + 28);
    await page.waitForTimeout(80);
    // Toggle ON
    await page.locator('[data-testid="math-tool-summation-line"]').click();
    await page.waitForTimeout(120);
    let lines = await page.locator('[data-testid="math-grid-decorations"] line').count();
    expect(lines, 'summation line added').toBe(1);
    // Toggle OFF
    await page.locator('[data-testid="math-tool-summation-line"]').click();
    await page.waitForTimeout(120);
    lines = await page.locator('[data-testid="math-grid-decorations"] line').count();
    expect(lines, 'summation line removed (toggle)').toBe(0);
  });

  test('Move-to-Denominator drops cursor from numerator row to denominator row', async ({ page, baseURL }) => {
    await gotoDevPageOnAdvMath(page, baseURL);
    // Open a fraction at (0,0). Cursor stays at (0,0) (numerator).
    await page.locator('[data-testid="math-tool-fraction-box"]').click();
    await page.waitForTimeout(80);
    // Move-to-denominator → cursor goes to (1,0).
    await page.locator('[data-testid="math-tool-fraction-to-denominator"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cursor=\(1,0\)/);
  });
});
