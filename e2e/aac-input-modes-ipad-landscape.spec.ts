/**
 * Critical AAC input-mode contract at the reported 1024x768 iPad size.
 *
 * The legacy open/non-maximized flags produced a partial picture board above
 * a partial keyboard. They now normalize to one of two complete surfaces:
 * Typing (predictions + keyboard) or Picture (predictions + picture board).
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = process.env.AAC_LAYOUT_ARTIFACT_DIR;

async function safeScreenshot(page: Page, fileName: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  await expect(page.getByText(/internal server error/i)).toHaveCount(0);
  const outputDir = ARTIFACT_DIR || test.info().outputDir;
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, fileName), fullPage: false });
}

async function proxyArasaacForLocalWebKit(page: Page): Promise<void> {
  if (process.env.AAC_E2E_PROXY_ARASAAC !== '1') return;
  await page.route(/^https:\/\/(api|static)\.arasaac\.org\//, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*' },
    });
  });
}

async function expectVisiblePictograms(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const loadedCount = (tileSelector: string) => [...document.querySelectorAll(tileSelector)]
      .filter((tile) => {
        const image = tile.querySelector<HTMLImageElement>('img');
        if (!image || !image.complete || image.naturalWidth <= 0) return false;
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
      }).length;
    return loadedCount('.aac-prediction-tile') >= 3
      && loadedCount('.aac-phrase-tile') >= 4;
  }), { timeout: 20_000 }).toBe(true);
}

async function expectVisiblePredictionPictograms(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => [...document.querySelectorAll('.aac-prediction-tile')]
    .filter((tile) => {
      const image = tile.querySelector<HTMLImageElement>('img');
      if (!image || !image.complete || image.naturalWidth <= 0) return false;
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).length), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
}

async function expectVisiblePhrasePictograms(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const visibleTiles = [...document.querySelectorAll<HTMLElement>('.aac-phrase-tile')]
      .filter((tile) => {
        const rect = tile.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && rect.right > 0 && rect.left < innerWidth
          && rect.bottom > 0 && rect.top < innerHeight;
      });
    if (visibleTiles.length < 3) return false;
    const firstRowTop = Math.min(...visibleTiles.map((tile) => tile.getBoundingClientRect().top));
    const firstRow = visibleTiles.filter((tile) => (
      Math.abs(tile.getBoundingClientRect().top - firstRowTop) <= 2
    ));
    return firstRow.length >= 3 && firstRow.every((tile) => {
      const image = tile.querySelector<HTMLImageElement>('img');
      if (!image || !image.complete || image.naturalWidth <= 0) return false;
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }), { timeout: 20_000 }).toBe(true);
}

type TileMetrics = {
  width: number;
  height: number;
  labelFontPx: number;
  labelColor: string;
  iconWidth: number;
  iconHeight: number;
};

async function tileMetrics(
  page: Page,
  tileSelector: string,
  labelSelector: string,
): Promise<TileMetrics> {
  return page.locator(tileSelector).first().evaluate((tile, labelQuery) => {
    const label = tile.querySelector<HTMLElement>(labelQuery);
    if (!label) throw new Error(`Missing label ${labelQuery}`);
    const tileRect = tile.getBoundingClientRect();
    const labelStyle = getComputedStyle(label);
    const icon = tile.querySelector<HTMLElement>('.aac-tile-icon');
    const iconRect = icon?.getBoundingClientRect();
    return {
      width: tileRect.width,
      height: tileRect.height,
      labelFontPx: Number.parseFloat(labelStyle.fontSize),
      labelColor: labelStyle.color,
      iconWidth: iconRect?.width ?? 0,
      iconHeight: iconRect?.height ?? 0,
    };
  }, labelSelector);
}

async function expectVisibleTileLabelsSettled(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const labels = [...document.querySelectorAll<HTMLElement>('.aac-tile-label')]
      .filter((label) => {
        const rect = label.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && rect.right > 0 && rect.left < innerWidth
          && rect.bottom > 0 && rect.top < innerHeight;
      });
    return labels.length > 0
      && labels.every((label) => Boolean(label.dataset.fitStatus));
  }), { timeout: 10_000 }).toBe(true);

  const status = await page.evaluate(() => {
    const labels = [...document.querySelectorAll<HTMLElement>('.aac-tile-label')]
      .filter((label) => {
        const rect = label.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && rect.right > 0 && rect.left < innerWidth
          && rect.bottom > 0 && rect.top < innerHeight;
      });
    return {
      visible: labels.length,
      settled: labels.filter((label) => Boolean(label.dataset.fitStatus)).length,
      overflow: labels.filter((label) => label.dataset.fitStatus === 'overflow').length,
    };
  });
  expect(status.visible).toBeGreaterThan(0);
  expect(status.settled).toBe(status.visible);
  expect(status.overflow).toBe(0);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-7-land', '1024x768 touch-tablet checkpoint');
  await proxyArasaacForLocalWebKit(page);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');

    // Reproduce the legacy default that caused the mixed layout. The runtime
    // must upgrade this pair to full Typing mode on boot.
    localStorage.setItem('prism-cat-kb-open', 'true');
    localStorage.setItem('prism-kb-max', 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: 'en', outputLanguage: 'en', theme: 'light' },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { soundEnabled: false, autoSpeak: false },
      version: 3,
    }));
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('prediction-bar')).toBeVisible({ timeout: 20_000 });
});

test.afterEach(async ({ page, context }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

test('switches between complete Typing and Picture surfaces without losing predictions', async ({ page }) => {
  expect(page.viewportSize()).toEqual({ width: 1024, height: 768 });
  const board = page.getByRole('region', { name: /home vocabulary board/i });
  const predictions = page.getByTestId('prediction-bar');

  await expect(board).toHaveAttribute('data-aac-mode', 'typing');
  await expect(predictions).toBeVisible();
  await expect(page.getByTestId('keyboard-shell')).toBeVisible();
  await expect(page.getByTestId('picture-board')).toHaveCount(0);
  await expect(page.getByTestId('typing-mode-sidebar')).toBeVisible();
  const returnButton = page.getByTestId('kb-cycle-btn');
  await expect(returnButton).toHaveAttribute('data-action', 'kb-minimize');
  await expectVisiblePredictionPictograms(page);
  await safeScreenshot(page, '01-input-mode-typing.png');

  await returnButton.click();
  await expect(board).toHaveAttribute('data-aac-mode', 'picture');
  await expect(predictions).toBeVisible();
  await expect(page.getByTestId('keyboard-shell')).toHaveCount(0);
  await expect(page.getByTestId('picture-board')).toBeVisible();
  await expect(page.getByTestId('picture-mode-sidebar')).toBeVisible();
  await expectVisiblePictograms(page);

  const predictionCards = page.locator('.aac-prediction-tile:visible');
  const phraseCards = page.locator('button:has(> [data-testid="phrase-tile-label"]):visible');
  await expect(predictionCards).toHaveCount(5);
  await expect(phraseCards.first()).toBeVisible();

  const prediction = await tileMetrics(
    page,
    '.aac-prediction-tile:visible',
    '[data-testid="prediction-label"]',
  );
  const phrase = await tileMetrics(
    page,
    'button:has(> [data-testid="phrase-tile-label"]):visible',
    '[data-testid="phrase-tile-label"]',
  );
  const category = await tileMetrics(
    page,
    '[data-testid="category-tile"]:visible',
    '.aac-category-label',
  );

  // The reported defect was a five-card prediction strip above three very
  // wide, shallow board cards. Both card systems now follow the same visual
  // rhythm: bounded aspect ratios, comparable physical size, identical label
  // scale, black text, and similarly allocated pictogram regions.
  expect(prediction.width / prediction.height).toBeLessThanOrEqual(1.6);
  expect(phrase.width / phrase.height).toBeLessThanOrEqual(1.6);
  expect(phrase.width / prediction.width).toBeGreaterThanOrEqual(0.85);
  expect(phrase.width / prediction.width).toBeLessThanOrEqual(1.2);
  expect(phrase.height / prediction.height).toBeGreaterThanOrEqual(0.85);
  expect(phrase.height / prediction.height).toBeLessThanOrEqual(1.2);
  expect(Math.abs(phrase.labelFontPx - prediction.labelFontPx)).toBeLessThanOrEqual(0.5);
  // Reference hierarchy: prediction words are primary communication targets,
  // not small captions beneath oversized pictograms.
  expect(prediction.labelFontPx).toBeGreaterThanOrEqual(30);
  expect(prediction.labelColor).toBe('rgb(0, 0, 0)');
  expect(phrase.labelColor).toBe('rgb(0, 0, 0)');
  expect(Math.abs(phrase.iconHeight - prediction.iconHeight)).toBeLessThanOrEqual(24);
  expect(Math.abs(phrase.iconWidth - prediction.iconWidth)).toBeLessThanOrEqual(32);
  expect(category.width / category.height).toBeLessThanOrEqual(1.8);
  expect(category.width / prediction.width).toBeGreaterThanOrEqual(0.85);
  expect(category.width / prediction.width).toBeLessThanOrEqual(1.2);
  expect(category.height / prediction.height).toBeGreaterThanOrEqual(0.85);
  expect(category.height / prediction.height).toBeLessThanOrEqual(1.15);
  expect(Math.abs(category.labelFontPx - prediction.labelFontPx)).toBeLessThanOrEqual(0.5);
  expect(category.labelColor).toBe('rgb(0, 0, 0)');
  expect(Math.abs(category.iconHeight - prediction.iconHeight)).toBeLessThanOrEqual(24);
  expect(Math.abs(category.iconWidth - prediction.iconWidth)).toBeLessThanOrEqual(32);
  await expect(page.locator('.aac-tile-label[data-fit-status="overflow"]')).toHaveCount(0);

  const boardIntegrity = await phraseCards.evaluateAll((cards) => {
    const rects = cards.map((card) => card.getBoundingClientRect());
    let overlapPairs = 0;
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left];
        const b = rects[right];
        const overlaps = a.left < b.right && a.right > b.left
          && a.top < b.bottom && a.bottom > b.top;
        if (overlaps) overlapPairs += 1;
      }
    }
    const unobscuredLabels = cards.filter((card) => {
      const label = card.querySelector<HTMLElement>('[data-testid="phrase-tile-label"]');
      if (!label) return false;
      const rect = label.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > innerHeight || rect.width <= 0 || rect.height <= 0) return false;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === label || (hit instanceof Element && label.contains(hit));
    }).length;
    return { overlapPairs, unobscuredLabels };
  });
  expect(boardIntegrity.overlapPairs).toBe(0);
  expect(boardIntegrity.unobscuredLabels).toBeGreaterThanOrEqual(6);
  await safeScreenshot(page, '02-input-mode-picture.png');

  await page.getByTestId('kb-cycle-btn').click();
  await expect(board).toHaveAttribute('data-aac-mode', 'typing');
  await expect(predictions).toBeVisible();
  await expect(page.getByTestId('keyboard-shell')).toBeVisible();
  await expect(page.getByTestId('picture-board')).toHaveCount(0);
});

test('keeps a compact-height iPad on the tablet picture rail', async ({ page }) => {
  const board = page.getByRole('region', { name: /home vocabulary board/i });
  await page.getByTestId('kb-cycle-btn').click();
  await expect(board).toHaveAttribute('data-aac-mode', 'picture');
  await expect(page.getByTestId('picture-board')).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 500 });
  const metrics = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.aac-category-body')!;
    const nav = document.querySelector<HTMLElement>('[data-testid="picture-mode-sidebar"]')!;
    const bodyRect = body.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return {
      bodyDirection: getComputedStyle(body).flexDirection,
      bodyWidth: bodyRect.width,
      navWidth: navRect.width,
      navHeight: navRect.height,
      navRight: navRect.right,
      viewportWidth: innerWidth,
    };
  });

  expect(metrics.bodyDirection).toBe('row');
  expect(metrics.bodyWidth).toBeGreaterThanOrEqual(1020);
  expect(metrics.navWidth).toBeLessThanOrEqual(120);
  expect(metrics.navHeight).toBeGreaterThanOrEqual(200);
  expect(metrics.navRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  await expectVisiblePhrasePictograms(page);
  await expectVisibleTileLabelsSettled(page);
  await safeScreenshot(page, '03-input-mode-picture-compact-height.png');
});

for (const viewport of [
  { width: 834, height: 500, label: '834x500' },
  { width: 744, height: 500, label: '744x500' },
] as const) {
  test(`keeps ${viewport.label} compact iPad window on the tablet picture rail`, async ({ page }) => {
    const board = page.getByRole('region', { name: /home vocabulary board/i });
    await page.getByTestId('kb-cycle-btn').click();
    await expect(board).toHaveAttribute('data-aac-mode', 'picture');
    await expect(page.getByTestId('picture-board')).toBeVisible();

    await page.setViewportSize(viewport);

    const metrics = await page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.aac-category-body')!;
      const nav = document.querySelector<HTMLElement>('[data-testid="picture-mode-sidebar"]')!;
      const bodyRect = body.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const visibleButtons = [...nav.querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0
            && rect.right > 0 && rect.left < innerWidth
            && rect.bottom > 0 && rect.top < innerHeight;
        });
      return {
        bodyDirection: getComputedStyle(body).flexDirection,
        bodyWidth: bodyRect.width,
        navWidth: navRect.width,
        navHeight: navRect.height,
        navRight: navRect.right,
        viewportWidth: innerWidth,
        documentOverflowX: document.documentElement.scrollWidth - innerWidth,
        visibleNavTargets: visibleButtons.map((button) => {
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {
            width: rect.width,
            height: rect.height,
            hitTarget: hit === button || (hit instanceof Node && button.contains(hit)),
          };
        }),
      };
    });

    expect(metrics.bodyDirection).toBe('row');
    expect(metrics.bodyWidth).toBeGreaterThanOrEqual(viewport.width - 4);
    expect(metrics.navWidth).toBeGreaterThanOrEqual(72);
    expect(metrics.navWidth).toBeLessThanOrEqual(120);
    expect(metrics.navHeight).toBeGreaterThanOrEqual(180);
    expect(metrics.navRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.documentOverflowX).toBeLessThanOrEqual(1);
    expect(metrics.visibleNavTargets.length).toBeGreaterThanOrEqual(3);
    expect(metrics.visibleNavTargets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
    expect(metrics.visibleNavTargets.every((target) => target.hitTarget)).toBe(true);
    await expect(page.getByTestId('aac-safe-viewport')).toHaveAttribute('data-aac-device-class', 'tablet');

    await expectVisiblePhrasePictograms(page);
    await expectVisibleTileLabelsSettled(page);
    await safeScreenshot(page, `04-input-mode-picture-compact-${viewport.label}.png`);
  });
}
