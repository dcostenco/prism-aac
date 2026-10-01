import { expect, test } from '@playwright/test';
import { checkCriticalOcclusion, safeScreenshot } from './helpers/screenshot-validation';

test.use({ viewport: { width: 1600, height: 1000 } });

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

for (const gridSize of [4, 6] as const) {
  test(`Grid Size ${gridSize} renders ${gridSize} complete home-board blocks`, async ({ page }, testInfo) => {
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('kb-cycle-btn')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /settings/i }).first().click();
    const settings = page.getByRole('dialog');
    await expect(settings).toBeVisible();
    await settings.getByRole('button', { name: String(gridSize), exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();

    const board = page.getByRole('region', { name: /home vocabulary board/i });
    if (await page.getByTestId('typing-mode-sidebar').isVisible().catch(() => false)) {
      await page.getByTestId('kb-cycle-btn').click();
    }
    await expect(board).toHaveAttribute('data-aac-mode', 'picture');

    const grid = page.locator('.aac-picture-grid');
    const blocks = grid.locator(':scope > *');
    await expect(blocks).toHaveCount(gridSize);
    await expect(grid.locator('img').first()).toBeVisible({ timeout: 15_000 });

    const viewport = page.viewportSize();
    const gridBox = await grid.boundingBox();
    expect(viewport).not.toBeNull();
    expect(gridBox).not.toBeNull();
    for (const block of await blocks.all()) {
      const box = await block.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(gridBox!.x);
      expect(box!.y).toBeGreaterThanOrEqual(gridBox!.y);
      expect(box!.x + box!.width).toBeLessThanOrEqual(gridBox!.x + gridBox!.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
    }

    await safeScreenshot(page, testInfo.outputPath(`grid-size-${gridSize}.png`), {
      expectedPath: '/prism-aac',
      requiredSelectors: ['[data-testid="picture-board"]'],
      criticalSelectors: Array.from(
        { length: gridSize },
        (_, index) => `.aac-picture-grid > :nth-child(${index + 1}) [data-testid="phrase-tile-label"]`,
      ),
      occluderSelectors: ['[data-testid="category-strip"]', '[data-testid="picture-mode-sidebar"]'],
    });
  });
}

test('label occlusion checks accept only the exact owning control', async ({ page }) => {
  await page.setContent(`
    <button id="owner" style="position:fixed;left:20px;top:20px;width:180px;height:80px">
      <span id="label" style="display:block;width:160px;height:40px;pointer-events:none">Readable label</span>
    </button>
  `);

  await expect(checkCriticalOcclusion(page, {
    criticalSelectors: ['#label'],
  })).resolves.toEqual([]);

  await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'unrelated-overlay';
    overlay.style.cssText = 'position:fixed;left:20px;top:20px;width:180px;height:80px;z-index:9999';
    document.body.appendChild(overlay);
  });

  const blocked = await checkCriticalOcclusion(page, {
    criticalSelectors: ['#label'],
  });
  expect(blocked).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'hit_test_blocked' }),
  ]));
});
