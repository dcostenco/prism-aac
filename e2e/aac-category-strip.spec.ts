import { expect, test, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

const viewports = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'desktop-landscape', width: 1600, height: 1000 },
] as const;

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

async function categoryStripGeometry(page: Page) {
  return page.evaluate(() => {
    const stripElement = document.querySelector<HTMLElement>('[data-testid="category-strip"]')!;
    const sidebarElement = document.querySelector<HTMLElement>('[data-testid="picture-mode-sidebar"]')!;
    const stripRect = stripElement.getBoundingClientRect();
    const sidebarRect = sidebarElement.getBoundingClientRect();
    const tiles = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="category-tile"]'));
    return {
      scrollWidth: stripElement.scrollWidth,
      clientWidth: stripElement.clientWidth,
      failures: tiles.flatMap((tile, index) => {
        const rect = tile.getBoundingClientRect();
        const fullyInsideStrip = rect.left >= stripRect.left && rect.right <= stripRect.right;
        const intersectsSidebar = rect.left < sidebarRect.right && rect.right > sidebarRect.left
          && rect.top < sidebarRect.bottom && rect.bottom > sidebarRect.top;
        return fullyInsideStrip && !intersectsSidebar ? [] : [{ index, fullyInsideStrip, intersectsSidebar }];
      }),
    };
  });
}

for (const viewport of viewports) {
test(`every bottom category fits before the picture navigation rail at ${viewport.name}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('kb-cycle-btn')).toBeVisible({ timeout: 30_000 });
  if (await page.getByTestId('typing-mode-sidebar').isVisible().catch(() => false)) {
    await page.getByTestId('kb-cycle-btn').click();
  }

  const strip = page.getByTestId('category-strip');
  const sidebar = page.getByTestId('picture-mode-sidebar');
  const categories = page.getByTestId('category-tile');
  await expect(strip).toBeVisible();
  await expect(sidebar).toBeVisible();
  expect(await categories.count()).toBeGreaterThan(1);

  const geometry = await categoryStripGeometry(page);

  expect(geometry.scrollWidth, 'category strip must not hide horizontally overflowing categories')
    .toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.failures, 'every category must be fully visible and clear of the navigation rail')
    .toEqual([]);

  const firstPageLabels = await categories.allTextContents();
  const nextPage = page.getByTestId('category-page-next');
  await expect(nextPage, 'overflow categories need a visible paging control').toBeEnabled();
  const indicator = page.getByTestId('category-page-indicator');
  const pageCount = Number((await indicator.textContent())?.split('/')[1]);
  expect(pageCount).toBeGreaterThan(1);
  const seenLabels = new Set(firstPageLabels);
  let priorFirstLabel = firstPageLabels[0];
  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    await nextPage.click();
    await expect(indicator).toHaveText(`${pageNumber}/${pageCount}`);
    await expect(categories.first()).not.toHaveText(priorFirstLabel);
    const labels = await categories.allTextContents();
    labels.forEach((label) => seenLabels.add(label));
    priorFirstLabel = labels[0];
    const pageGeometry = await categoryStripGeometry(page);
    expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth);
    expect(pageGeometry.failures).toEqual([]);
  }
  expect(seenLabels.size).toBeGreaterThan(firstPageLabels.length);
  await expect(nextPage).toBeDisabled();
  await page.getByTestId('category-page-prev').click();
  await expect(indicator).toHaveText(`${pageCount - 1}/${pageCount}`);
  await expect(page.locator('.aac-picture-grid img').first()).toBeVisible({ timeout: 15_000 });

  const categoryCount = await categories.count();
  await safeScreenshot(page, testInfo.outputPath(`category-strip-contained-${viewport.name}.png`), {
    expectedPath: '/prism-aac',
    requiredSelectors: ['[data-testid="category-strip"]'],
    criticalSelectors: Array.from(
      { length: categoryCount },
      (_, index) => `[data-testid="category-tile"]:nth-child(${index + 1}) .aac-category-label`,
    ),
    occluderSelectors: ['[data-testid="picture-mode-sidebar"]'],
  });
});
}
