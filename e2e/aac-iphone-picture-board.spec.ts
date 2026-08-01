/**
 * Phone Picture-mode acceptance for motor-impaired AAC users.
 *
 * Four vocabulary targets must use the full phone width. Navigation stays
 * reachable without taking a permanent side column, labels remain whole and
 * readable, and semantic card colours remain visible behind black text.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.use({ serviceWorkers: 'block' });

const ARTIFACT_DIR = process.env.AAC_LAYOUT_ARTIFACT_DIR
  ?? process.env.AAC_PHONE_PICTURE_ARTIFACT_DIR
  ?? path.resolve('test-results', 'aac-iphone-picture-board');

const PHONE_PROJECTS = new Set([
  'iphone-se',
  'iphone-6.1',
  'iphone-6.5',
  'iphone-6.9',
  'iphone-se-land',
  'iphone-6.1-land',
  'iphone-6.5-land',
  'iphone-6.9-land',
]);

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

async function safeScreenshot(page: Page, fileName: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  await expect(page.getByText(/internal server error/i)).toHaveCount(0);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, fileName), fullPage: false });
}

async function expectVisiblePictograms(page: Page, includePredictions: boolean): Promise<void> {
  await expect.poll(async () => page.evaluate((shouldCheckPredictions) => {
    const firstLoaded = (selector: string, count: number) => [...document.querySelectorAll<HTMLElement>(selector)]
      .slice(0, count)
      .every((tile) => {
        const image = tile.querySelector<HTMLImageElement>('img');
        if (!image?.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
      });
    return (!shouldCheckPredictions || firstLoaded('[data-testid="prediction-tile"]', 5))
      && firstLoaded('[data-testid="phrase-tile-card"]', 4);
  }, includePredictions), { timeout: 20_000 }).toBe(true);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!PHONE_PROJECTS.has(testInfo.project.name), 'iPhone picture-mode matrix only');
  await proxyArasaacForLocalWebKit(page);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'false');
    localStorage.setItem('prism-kb-max', 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: {
        language: 'en',
        outputLanguage: 'en',
        theme: 'light',
        gridSize: 12,
        cloudPredictionEnabled: false,
        aiAutocorrectEnabled: false,
      },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { text: '', autoSpeak: false, soundEnabled: false },
      version: 3,
    }));
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: /home vocabulary board/i }))
    .toHaveAttribute('data-aac-mode', 'picture', { timeout: 20_000 });
  await expect(page.getByTestId('picture-board')).toBeVisible();
  await expect(page.getByTestId('phrase-tile-card').first()).toBeVisible();
  await expect(page.getByTestId('category-tile').nth(3)).toBeVisible();
  await expectVisiblePictograms(page, true);
});

test.afterEach(async ({ page, context }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

test('fits four full-width picture targets with reachable navigation and readable semantic labels', async ({ page }, testInfo) => {
  const isLandscape = testInfo.project.name.endsWith('-land');
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const board = page.getByTestId('picture-board');
  const grid = board.locator('.aac-picture-grid');
  const phraseCards = page.getByTestId('phrase-tile-card');
  const categoryStrip = page.getByTestId('category-strip');
  const categoryCards = page.getByTestId('category-tile');
  const pictureNavigation = page.getByTestId('picture-mode-sidebar');

  const metrics = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('[data-testid="picture-board"]')!;
    const grid = board.querySelector<HTMLElement>('.aac-picture-grid')!;
    const nav = document.querySelector<HTMLElement>('[data-testid="picture-mode-sidebar"]')!;
    const strip = document.querySelector<HTMLElement>('[data-testid="category-strip"]')!;
    const predictions = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')];
    const messageBar = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!;
    const messageContent = document.querySelector<HTMLElement>('[data-testid="message-content"]')!;
    const messageControls = [...document.querySelectorAll<HTMLElement>('[data-scan-group="message-bar"] > button')];
    const phrases = [...document.querySelectorAll<HTMLElement>('[data-testid="phrase-tile-card"]')];
    const phraseLabels = [...document.querySelectorAll<HTMLElement>('[data-testid="phrase-tile-label"]')];
    const predictionLabels = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-label"]')];
    const categories = [...document.querySelectorAll<HTMLElement>('[data-testid="category-tile"]')];
    const categoryLabels = categories.map((card) => card.querySelector<HTMLElement>('.aac-category-label')!);
    const firstPhrase = phrases[0];
    const firstIcon = firstPhrase.querySelector<HTMLElement>('.aac-tile-icon')!;
    const rect = (element: Element) => {
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const visible = (element: Element) => {
      const value = element.getBoundingClientRect();
      return value.width > 0 && value.height > 0 && value.right > 0 && value.left < innerWidth
        && value.bottom > 0 && value.top < innerHeight;
    };
    const renderedLines = (label: HTMLElement) => {
      const style = getComputedStyle(label);
      const lineHeight = Number.parseFloat(style.lineHeight);
      return lineHeight > 0 ? Math.round(label.getBoundingClientRect().height / lineHeight) : 1;
    };
    return {
      board: rect(board),
      grid: rect(grid),
      nav: rect(nav),
      strip: rect(strip),
      phraseRects: phrases.slice(0, 4).map(rect),
      categoryRects: categories.slice(0, 4).map(rect),
      predictionRects: predictions.map(rect),
      messageBar: rect(messageBar),
      messageContent: rect(messageContent),
      messageCompact: messageBar.dataset.compact,
      messageControlRects: messageControls.map(rect),
      predictionBackgrounds: predictions.map((tile) => getComputedStyle(tile).backgroundColor),
      predictionAccentColors: predictions.map((tile) => getComputedStyle(tile).borderLeftColor),
      splitPredictionWords: predictionLabels.flatMap((label) => {
        const text = label.textContent?.trim() ?? '';
        return /^\p{L}{1,12}$/u.test(text) && renderedLines(label) > 1 ? [text] : [];
      }),
      predictionOverflowWraps: predictionLabels.map((label) => getComputedStyle(label).overflowWrap),
      predictionLabelOverflow: predictionLabels
        .filter((label) => label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1)
        .map((label) => label.textContent?.trim()),
      visiblePhraseCount: phrases.filter(visible).length,
      visibleFirstRowLabelCount: phraseLabels.slice(0, 4).filter((label) => {
        const labelRect = label.getBoundingClientRect();
        const stripRect = strip.getBoundingClientRect();
        return labelRect.width > 0 && labelRect.height > 0
          && labelRect.top >= 0 && labelRect.bottom <= Math.min(innerHeight, stripRect.top) + 1;
      }).length,
      phraseLabelColors: phraseLabels.slice(0, 4).map((label) => getComputedStyle(label).color),
      categoryLabelColors: categoryLabels.slice(0, 4).map((label) => getComputedStyle(label).color),
      phraseLabelFonts: phraseLabels.slice(0, 4).map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
      categoryLabelFonts: categoryLabels.slice(0, 4).map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
      splitShortWords: phraseLabels.slice(0, 12).flatMap((label) => {
        const text = label.textContent?.trim() ?? '';
        return /^\p{L}{1,8}$/u.test(text) && renderedLines(label) > 1 ? [text] : [];
      }),
      overflowWraps: phraseLabels.slice(0, 4).map((label) => getComputedStyle(label).overflowWrap),
      phraseLabelOverflow: phraseLabels.slice(0, 12)
        .filter((label) => label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1)
        .map((label) => ({
          text: label.textContent?.trim(),
          clientWidth: label.clientWidth,
          scrollWidth: label.scrollWidth,
          clientHeight: label.clientHeight,
          scrollHeight: label.scrollHeight,
          fontSize: getComputedStyle(label).fontSize,
        })),
      firstPhraseBackground: getComputedStyle(firstPhrase).backgroundColor,
      firstIconBackground: getComputedStyle(firstIcon).backgroundColor,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });

  expect(metrics.board.width).toBeGreaterThanOrEqual(viewport!.width - 4);
  expect(metrics.nav.width).toBeGreaterThanOrEqual(viewport!.width - 4);
  expect(metrics.nav.height).toBeLessThanOrEqual(isLandscape ? 48 : 60);
  if (isLandscape) {
    expect(metrics.messageCompact).toBe('1');
    expect(metrics.messageBar.height).toBeLessThanOrEqual(60);
    expect(metrics.messageContent.height).toBeLessThanOrEqual(48);
  } else {
    expect(metrics.messageBar.height).toBeLessThanOrEqual(80);
    expect(metrics.messageContent.height).toBeLessThanOrEqual(64);
  }
  expect(metrics.documentOverflowX).toBeLessThanOrEqual(1);

  expect(metrics.phraseRects).toHaveLength(4);
  expect(Math.max(...metrics.phraseRects.map((rect) => rect.top)) - Math.min(...metrics.phraseRects.map((rect) => rect.top))).toBeLessThanOrEqual(2);
  // 8px board padding on each side plus three 6px gaps leaves this exact
  // four-column width; allow half-pixel WebKit rounding.
  expect(Math.min(...metrics.phraseRects.map((rect) => rect.width))).toBeGreaterThanOrEqual((metrics.board.width - 34) / 4 - 0.5);
  expect(Math.max(...metrics.phraseRects.map((rect) => rect.right))).toBeLessThanOrEqual(viewport!.width + 1);
  expect(metrics.visiblePhraseCount).toBeGreaterThanOrEqual(4);
  expect(metrics.visibleFirstRowLabelCount).toBe(4);
  expect(metrics.grid.height).toBeGreaterThanOrEqual(isLandscape ? 72 : 180);

  expect(metrics.categoryRects).toHaveLength(4);
  expect(Math.max(...metrics.categoryRects.map((rect) => rect.top)) - Math.min(...metrics.categoryRects.map((rect) => rect.top))).toBeLessThanOrEqual(2);
  expect(Math.min(...metrics.categoryRects.map((rect) => rect.width))).toBeGreaterThanOrEqual((metrics.board.width - 28) / 4 - 0.5);
  expect(Math.max(...metrics.categoryRects.map((rect) => rect.right))).toBeLessThanOrEqual(viewport!.width + 1);

  expect(metrics.predictionRects).toHaveLength(5);
  expect(Math.min(...metrics.predictionRects.map((rect) => Math.min(rect.width, rect.height)))).toBeGreaterThanOrEqual(68);
  expect(Math.max(...metrics.predictionRects.map((rect) => Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height)))).toBeLessThanOrEqual(1.08);
  expect(Math.max(...metrics.messageControlRects.map((rect) => Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height)))).toBeLessThanOrEqual(1.08);
  expect(metrics.predictionBackgrounds.every((color) => color !== 'rgb(255, 255, 255)')).toBe(true);
  expect(metrics.predictionBackgrounds).toEqual(metrics.predictionAccentColors);
  expect(metrics.splitPredictionWords).toEqual([]);
  expect(metrics.predictionOverflowWraps).not.toContain('anywhere');
  expect(metrics.predictionLabelOverflow).toEqual([]);

  expect(metrics.phraseLabelColors.every((color) => color === 'rgb(0, 0, 0)')).toBe(true);
  expect(metrics.categoryLabelColors.every((color) => color === 'rgb(0, 0, 0)')).toBe(true);
  expect(Math.min(...metrics.phraseLabelFonts)).toBeGreaterThanOrEqual(isLandscape ? 16 : 18);
  expect(Math.max(...metrics.phraseLabelFonts)).toBeLessThanOrEqual(22);
  expect(Math.min(...metrics.categoryLabelFonts)).toBeGreaterThanOrEqual(14);
  expect(Math.max(...metrics.categoryLabelFonts)).toBeLessThanOrEqual(20);
  expect(metrics.splitShortWords).toEqual([]);
  expect(metrics.overflowWraps).not.toContain('anywhere');
  expect(metrics.phraseLabelOverflow).toEqual([]);

  expect(metrics.firstPhraseBackground).not.toBe('rgb(255, 255, 255)');
  expect(metrics.firstIconBackground).toBe('rgba(0, 0, 0, 0)');
  await expect(page.locator('.aac-tile-label[data-fit-status="overflow"]')).toHaveCount(0);

  const navIntegrity = await pictureNavigation.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      label: button.getAttribute('aria-label') ?? button.textContent?.trim(),
      width: rect.width,
      height: rect.height,
      withinViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      hitTarget: hit === button || (hit instanceof Node && button.contains(hit)),
    };
  }));
  expect(navIntegrity.length).toBeGreaterThanOrEqual(4);
  expect(navIntegrity.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
  expect(navIntegrity.every((target) => target.withinViewport && target.hitTarget)).toBe(true);

  await safeScreenshot(page, `${testInfo.project.name}-picture-board.png`);

  await expect(board).toBeVisible();
  await expect(grid).toBeVisible();
  await expect(categoryStrip).toBeVisible();
  expect(await phraseCards.count()).toBeGreaterThanOrEqual(12);
  await expect(categoryCards).not.toHaveCount(0);
  await expect(pictureNavigation.getByTestId('kb-cycle-btn')).toBeVisible();
  await expect(pictureNavigation.getByRole('button', { name: /search/i })).toBeVisible();
  await expect(pictureNavigation.getByRole('button', { name: /home/i })).toHaveCount(0);

  // Home is intentionally absent while already on Home, but becomes one
  // reachable, non-duplicated motor target after entering a category.
  await categoryCards.first().click();
  const homeButton = pictureNavigation.getByRole('button', { name: /home/i });
  await expect(homeButton).toHaveCount(1);
  await homeButton.scrollIntoViewIfNeeded();
  await expect(homeButton).toBeVisible();
  const homeIntegrity = await homeButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      width: rect.width,
      height: rect.height,
      withinViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      hitTarget: hit === button || (hit instanceof Node && button.contains(hit)),
    };
  });
  expect(homeIntegrity.width).toBeGreaterThanOrEqual(44);
  expect(homeIntegrity.height).toBeGreaterThanOrEqual(44);
  expect(homeIntegrity.withinViewport).toBe(true);
  expect(homeIntegrity.hitTarget).toBe(true);
  await homeButton.click();
  await expect(page.getByRole('region', { name: /home vocabulary board/i })).toBeVisible();
  await expect(pictureNavigation.getByRole('button', { name: /home/i })).toHaveCount(0);
});
