/**
 * MathLockTool — Phase 3A.
 *
 * The lock-equation flow protects motor-overshoot from destroying
 * finished work. Two-tap region selection: corner A → corner B →
 * region locks (green tint, ignores subsequent key entry).
 */
import { test, expect, type Page } from '@playwright/test';

async function gotoDev(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-lock-tool"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 5000 });
}

async function tapCell(page: Page, r: number, c: number) {
  const svg = await page.locator('[data-testid="math-grid-svg"]').boundingBox();
  if (!svg) throw new Error('svg missing');
  await page.mouse.click(svg.x + c * 56 + 28, svg.y + r * 56 + 28);
  await page.waitForTimeout(120);
}

test.describe('MathLockTool (Phase 3A)', () => {
  test('Lock + Unlock buttons render in idle mode', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    const tool = page.locator('[data-testid="math-lock-tool"]');
    await expect(tool).toHaveAttribute('data-mode', 'idle');
    await expect(page.locator('[data-testid="math-lock-start"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-lock-unlock"]')).toBeVisible();
    // Status banner is HIDDEN in idle.
    await expect(page.locator('[data-testid="math-lock-status"]')).toHaveCount(0);
  });

  test('Tapping Lock shows status; tapping two cells locks region (green tint persists)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    // Type 3 cells via Main keyboard so we have something to lock.
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-plus"]').click();
    await page.locator('[data-testid="math-key-7"]').click();
    await page.waitForTimeout(120);

    // Enter lock mode.
    await page.locator('[data-testid="math-lock-start"]').click();
    await page.waitForTimeout(80);
    await expect(page.locator('[data-testid="math-lock-tool"]')).toHaveAttribute('data-mode', 'lock-start');
    await expect(page.locator('[data-testid="math-lock-status"]')).toContainText(/lock/i);

    // Tap (0,0) — first corner.
    await tapCell(page, 0, 0);
    await expect(page.locator('[data-testid="math-lock-tool"]')).toHaveAttribute('data-mode', 'lock-end');

    // Tap (0,2) — second corner. The region locks then auto-exits to idle.
    await tapCell(page, 0, 2);
    // After the 600ms hold, mode resets to idle.
    await page.waitForTimeout(800);
    await expect(page.locator('[data-testid="math-lock-tool"]')).toHaveAttribute('data-mode', 'idle');

    // Now try to type into a locked cell — engine must reject.
    await tapCell(page, 0, 1);
    await page.locator('[data-testid="math-key-9"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator('header').first().innerText();
    // 3 cells were typed (5 + 7), then we clicked tap-cell which moves cursor;
    // the 9 key tried to commit to the locked (0,1) and was rejected.
    // Cells should still be 3.
    expect(header, 'locked cells reject glyph commit').toMatch(/cells=3/);
  });

  test('Cancel button exits lock mode without committing a region', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await page.locator('[data-testid="math-lock-start"]').click();
    await page.waitForTimeout(80);
    await expect(page.locator('[data-testid="math-lock-tool"]')).toHaveAttribute('data-mode', 'lock-start');
    await page.locator('[data-testid="math-lock-cancel"]').click();
    await page.waitForTimeout(80);
    await expect(page.locator('[data-testid="math-lock-tool"]')).toHaveAttribute('data-mode', 'idle');
    // Status banner gone.
    await expect(page.locator('[data-testid="math-lock-status"]')).toHaveCount(0);
  });

  test('Unlock flow lifts the lock from a region', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await page.locator('[data-testid="math-key-1"]').click();
    await page.locator('[data-testid="math-key-2"]').click();
    await page.waitForTimeout(80);

    // Lock (0,0)..(0,1)
    await page.locator('[data-testid="math-lock-start"]').click();
    await tapCell(page, 0, 0);
    await tapCell(page, 0, 1);
    await page.waitForTimeout(800);

    // Verify locked — try to commit a glyph there, should be rejected.
    await tapCell(page, 0, 0);
    await page.locator('[data-testid="math-key-9"]').click();
    await page.waitForTimeout(80);
    let header = await page.locator('header').first().innerText();
    expect(header).toMatch(/cells=2/);

    // Unlock (0,0)..(0,1)
    await page.locator('[data-testid="math-lock-unlock"]').click();
    await tapCell(page, 0, 0);
    await tapCell(page, 0, 1);
    await page.waitForTimeout(800);

    // Now backspace should delete a cell (locked-cell rejection lifted).
    await tapCell(page, 0, 0);
    await page.locator('[data-testid="math-key-backspace"]').click();
    await page.waitForTimeout(120);
    header = await page.locator('header').first().innerText();
    expect(header, 'after unlock, cell can be deleted').toMatch(/cells=1/);
  });
});
