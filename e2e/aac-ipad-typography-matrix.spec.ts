/**
 * First-stage iPad typography acceptance for motor-impaired AAC users.
 *
 * The four projects deliberately cover both orientations of the smallest and
 * largest supported iPads. Prediction words and keyboard letters are primary
 * communication targets, so this test rejects caption-sized text even when
 * the controls technically fit on screen.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.use({ serviceWorkers: 'block' });

const ARTIFACT_DIR = process.env.AAC_IPAD_TYPOGRAPHY_ARTIFACT_DIR
  ?? path.resolve('test-results', 'aac-ipad-typography-matrix');

const IPAD_MATRIX = {
  'ipad-7': {
    label: 'iPad Mini portrait',
    viewport: { width: 768, height: 1024 },
    minimumKeyFont: 56,
    minimumPredictionFont: 30,
  },
  'ipad-7-land': {
    label: 'iPad Mini landscape',
    viewport: { width: 1024, height: 768 },
    minimumKeyFont: 56,
    minimumPredictionFont: 30,
  },
  'ipad-13': {
    label: 'iPad 13-inch portrait',
    viewport: { width: 1032, height: 1376 },
    minimumKeyFont: 64,
    minimumPredictionFont: 36,
  },
  'ipad-13-land': {
    label: 'iPad 13-inch landscape',
    viewport: { width: 1376, height: 1032 },
    minimumKeyFont: 64,
    minimumPredictionFont: 36,
  },
} as const;

type MatrixProject = keyof typeof IPAD_MATRIX;

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

async function expectPredictionPictogramsReady(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => (
    [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')]
      .filter((tile) => {
        const image = tile.querySelector<HTMLImageElement>('img');
        return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      }).length
  )), { timeout: 20_000 }).toBe(5);
}

test.beforeEach(async ({ page }, testInfo) => {
  const projectName = testInfo.project.name as MatrixProject;
  test.skip(!(projectName in IPAD_MATRIX), 'first-stage iPad matrix only');
  await proxyArasaacForLocalWebKit(page);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'true');
    localStorage.setItem('prism-kb-max', 'true');
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
  await expect(page.getByTestId('prediction-bar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('keyboard-shell')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('maximizes prediction and keyboard text without clipping', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name as MatrixProject;
  const expected = IPAD_MATRIX[projectName];
  expect(page.viewportSize(), expected.label).toEqual(expected.viewport);

  await expect(page.getByRole('region', { name: /home vocabulary board/i }))
    .toHaveAttribute('data-aac-mode', 'typing');
  await expect(page.getByTestId('prediction-tile')).toHaveCount(5);
  await expect(page.locator('[data-scan-group="keyboard"] button[data-key="Q"]')).toBeVisible();
  await expect(page.getByTestId('picture-board')).toHaveCount(0);
  await expectPredictionPictogramsReady(page);

  const metrics = await page.evaluate(() => {
    const predictionTiles = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')];
    const predictionLabels = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-label"]')];
    const predictionIcons = predictionTiles.map((tile) => tile.querySelector<HTMLElement>('.aac-tile-icon')!);
    const predictionImages = predictionIcons.map((icon) => icon.querySelector<HTMLImageElement>('img')!);
    const characterKeys = [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] button[data-key]')]
      .filter((key) => /^\p{L}$/u.test(key.dataset.key ?? ''));
    const keyRects = characterKeys.map((key) => key.getBoundingClientRect());
    const predictionRects = predictionTiles.map((tile) => tile.getBoundingClientRect());
    const keyboardRect = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!.getBoundingClientRect();
    const predictionBarRect = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
    const allBounds = [...keyRects, ...predictionRects];
    return {
      minimumCharacterFont: Math.min(...characterKeys.map((key) => Number.parseFloat(getComputedStyle(key).fontSize))),
      minimumPredictionFont: Math.min(...predictionLabels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize))),
      minimumPredictionCardRadius: Math.min(...predictionTiles.map((tile) => Number.parseFloat(getComputedStyle(tile).borderTopLeftRadius))),
      minimumPredictionIconRadius: Math.min(...predictionIcons.map((icon) => Number.parseFloat(getComputedStyle(icon).borderTopLeftRadius))),
      maximumPredictionImageWidthRatio: Math.max(...predictionImages.map((image, index) => (
        image.getBoundingClientRect().width / predictionIcons[index].getBoundingClientRect().width
      ))),
      maximumPredictionImageHeightRatio: Math.max(...predictionImages.map((image, index) => (
        image.getBoundingClientRect().height / predictionIcons[index].getBoundingClientRect().height
      ))),
      minimumKeyWidth: Math.min(...keyRects.map((rect) => rect.width)),
      minimumKeyHeight: Math.min(...keyRects.map((rect) => rect.height)),
      keyboardHeight: keyboardRect.height,
      predictionHeight: predictionBarRect.height,
      characterOverflow: characterKeys.filter((key) => key.scrollWidth > key.clientWidth || key.scrollHeight > key.clientHeight).length,
      predictionOverflow: predictionLabels.filter((label) => label.scrollWidth > label.clientWidth || label.scrollHeight > label.clientHeight).length,
      offscreenElements: allBounds.filter((rect) => (
        rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight
      )).length,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      predictionColors: predictionLabels.map((label) => getComputedStyle(label).color),
    };
  });

  expect(metrics.minimumCharacterFont, `${expected.label}: keyboard letter font`)
    .toBeGreaterThanOrEqual(expected.minimumKeyFont);
  expect(metrics.minimumPredictionFont, `${expected.label}: prediction label font`)
    .toBeGreaterThanOrEqual(expected.minimumPredictionFont);
  expect(metrics.minimumPredictionCardRadius, `${expected.label}: rounded prediction cards`)
    .toBeGreaterThanOrEqual(20);
  expect(metrics.minimumPredictionIconRadius, `${expected.label}: rounded pictogram wells`)
    .toBeGreaterThanOrEqual(16);
  expect(metrics.maximumPredictionImageWidthRatio, `${expected.label}: bounded pictogram width`)
    .toBeLessThanOrEqual(0.72);
  expect(metrics.maximumPredictionImageHeightRatio, `${expected.label}: bounded pictogram height`)
    .toBeLessThanOrEqual(0.72);
  expect(metrics.minimumKeyWidth, `${expected.label}: minimum key width`).toBeGreaterThanOrEqual(48);
  expect(metrics.minimumKeyHeight, `${expected.label}: minimum key height`).toBeGreaterThanOrEqual(48);
  expect(metrics.keyboardHeight, `${expected.label}: keyboard is the dominant typing surface`)
    .toBeGreaterThan(metrics.predictionHeight);
  expect(metrics.characterOverflow, `${expected.label}: clipped keyboard glyphs`).toBe(0);
  expect(metrics.predictionOverflow, `${expected.label}: clipped prediction labels`).toBe(0);
  expect(metrics.offscreenElements, `${expected.label}: offscreen primary targets`).toBe(0);
  expect(metrics.documentOverflowX, `${expected.label}: horizontal overflow`).toBeLessThanOrEqual(1);
  expect(metrics.predictionColors, `${expected.label}: prediction contrast`)
    .toEqual(Array(5).fill('rgb(0, 0, 0)'));

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, `${projectName}.json`),
    `${JSON.stringify({ projectName, ...expected, metrics }, null, 2)}\n`,
  );
  await safeScreenshot(page, `${projectName}.png`);
});
