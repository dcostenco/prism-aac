/**
 * iPhone typography and viewport-fit acceptance for motor-impaired AAC users.
 *
 * The matrix covers the smallest supported phone, two common intermediate
 * sizes, and the current App Store 6.9-inch viewport in both orientations.
 * Keyboard letters and prediction words are communication targets, not
 * captions, so the assertions reject technically-present but unreadable text.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.use({ serviceWorkers: 'block' });

const ARTIFACT_DIR = process.env.AAC_IPHONE_TYPOGRAPHY_ARTIFACT_DIR
  ?? path.resolve('test-results', 'aac-iphone-typography-matrix');

const IPHONE_MATRIX = {
  'iphone-se': {
    label: 'iPhone SE portrait',
    viewport: { width: 375, height: 667 },
    minimumKeyFont: 36,
    minimumPredictionFont: 24,
    minimumKeyWidth: 35,
    minimumKeyHeight: 56,
    minimumPredictionHeight: 72,
    maximumKeyAspectRatio: 1.85,
  },
  'iphone-6.1': {
    label: 'iPhone 6.1-inch portrait',
    viewport: { width: 390, height: 844 },
    minimumKeyFont: 36,
    minimumPredictionFont: 24,
    minimumKeyWidth: 36,
    minimumKeyHeight: 56,
    minimumPredictionHeight: 72,
    maximumKeyAspectRatio: 1.85,
  },
  'iphone-6.5': {
    label: 'iPhone Plus portrait',
    viewport: { width: 428, height: 926 },
    minimumKeyFont: 36,
    minimumPredictionFont: 24,
    minimumKeyWidth: 40,
    minimumKeyHeight: 56,
    minimumPredictionHeight: 72,
    maximumKeyAspectRatio: 1.85,
  },
  'iphone-6.9': {
    label: 'iPhone 6.9-inch portrait',
    viewport: { width: 440, height: 956 },
    minimumKeyFont: 36,
    minimumPredictionFont: 24,
    minimumKeyWidth: 41,
    minimumKeyHeight: 56,
    minimumPredictionHeight: 72,
    maximumKeyAspectRatio: 1.85,
  },
  'iphone-se-land': {
    label: 'iPhone SE landscape',
    viewport: { width: 667, height: 375 },
    minimumKeyFont: 30,
    minimumPredictionFont: 22,
    minimumKeyWidth: 60,
    minimumKeyHeight: 44,
    minimumPredictionHeight: 48,
    maximumKeyAspectRatio: 1.75,
  },
  'iphone-6.1-land': {
    label: 'iPhone 6.1-inch landscape',
    viewport: { width: 844, height: 390 },
    minimumKeyFont: 30,
    minimumPredictionFont: 22,
    minimumKeyWidth: 80,
    minimumKeyHeight: 44,
    minimumPredictionHeight: 48,
    maximumKeyAspectRatio: 1.75,
  },
  'iphone-6.5-land': {
    label: 'iPhone Plus landscape',
    viewport: { width: 926, height: 428 },
    minimumKeyFont: 30,
    minimumPredictionFont: 22,
    minimumKeyWidth: 88,
    minimumKeyHeight: 44,
    minimumPredictionHeight: 48,
    maximumKeyAspectRatio: 1.75,
  },
  'iphone-6.9-land': {
    label: 'iPhone 6.9-inch landscape',
    viewport: { width: 956, height: 440 },
    minimumKeyFont: 30,
    minimumPredictionFont: 22,
    minimumKeyWidth: 92,
    minimumKeyHeight: 44,
    minimumPredictionHeight: 48,
    maximumKeyAspectRatio: 1.75,
  },
} as const;

const QWERTY_REFERENCE_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
] as const;

type MatrixProject = keyof typeof IPHONE_MATRIX;

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
  test.skip(!(projectName in IPHONE_MATRIX), 'iPhone matrix only');
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

test.afterEach(async ({ page, context }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

test('keeps prediction and keyboard targets readable and inside the viewport', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name as MatrixProject;
  const expected = IPHONE_MATRIX[projectName];
  expect(page.viewportSize(), expected.label).toEqual(expected.viewport);

  await expect(page.getByRole('region', { name: /home vocabulary board/i }))
    .toHaveAttribute('data-aac-mode', 'typing');
  await expect(page.getByTestId('prediction-tile')).toHaveCount(5);
  await expect(page.locator('[data-scan-group="keyboard"] button[data-key="Q"]')).toBeVisible();
  await expect(page.getByTestId('picture-board')).toHaveCount(0);
  await expect(page.locator('[data-scan-group="message-bar"]')).toBeVisible();
  await expectPredictionPictogramsReady(page);

  const metrics = await page.evaluate(() => {
    const predictionBar = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!;
    const keyboard = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!;
    const messageBar = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!;
    const messageContent = document.querySelector<HTMLElement>('[data-testid="message-content"]')!;
    const predictionTiles = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')];
    const predictionLabels = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-label"]')];
    const predictionIcons = predictionTiles.map((tile) => tile.querySelector<HTMLElement>('.aac-tile-icon')!);
    const predictionImages = predictionIcons.map((icon) => icon.querySelector<HTMLImageElement>('img')!);
    const keyboardButtons = [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] button')];
    const characterKeys = [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] button[data-key]')]
      .filter((key) => /^\p{L}$/u.test(key.dataset.key ?? ''));
    const typingSidebar = document.querySelector<HTMLElement>('[data-testid="typing-mode-sidebar"]');
    const keyRects = characterKeys.map((key) => key.getBoundingClientRect());
    const letterRows = [...keyboard.querySelectorAll<HTMLElement>('[data-key-row="letters"]')]
      .map((row) => [...row.querySelectorAll<HTMLElement>(':scope > button[data-key]')]
        .map((key) => key.dataset.key));
    const predictionRects = predictionTiles.map((tile) => tile.getBoundingClientRect());
    const regionRects = [predictionBar, keyboard, messageBar].map((element) => element.getBoundingClientRect());
    const allBounds = [...keyRects, ...predictionRects, ...regionRects];
    const predictionRect = predictionBar.getBoundingClientRect();
    const keyboardRect = keyboard.getBoundingClientRect();
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
      maximumKeyAspectRatio: Math.max(...keyRects.map((rect) => Math.max(rect.width / rect.height, rect.height / rect.width))),
      letterRows,
      keyboardHeight: keyboardRect.height,
      predictionHeight: predictionRect.height,
      characterOverflow: characterKeys.filter((key) => key.scrollWidth > key.clientWidth || key.scrollHeight > key.clientHeight).length,
      predictionOverflow: predictionLabels.filter((label) => label.scrollWidth > label.clientWidth || label.scrollHeight > label.clientHeight).length,
      keyboardButtonOverflows: keyboardButtons
        .filter((button) => button.scrollWidth > button.clientWidth || button.scrollHeight > button.clientHeight)
        .map((button) => ({
          label: button.getAttribute('aria-label'),
          action: button.dataset.action ?? null,
          key: button.dataset.key ?? null,
          clientWidth: button.clientWidth,
          scrollWidth: button.scrollWidth,
          clientHeight: button.clientHeight,
          scrollHeight: button.scrollHeight,
        })),
      shortPredictionWraps: predictionLabels.flatMap((label) => {
        const style = getComputedStyle(label);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const renderedLines = lineHeight > 0
          ? Math.round(label.getBoundingClientRect().height / lineHeight)
          : 1;
        return label.textContent && label.textContent.trim().length <= 8 && renderedLines > 1
          ? [{ label: label.textContent.trim(), renderedLines }]
          : [];
      }),
      typingSidebarWidth: typingSidebar?.getBoundingClientRect().width ?? 0,
      messageBarHeight: messageBar.getBoundingClientRect().height,
      messageContentHeight: messageContent.getBoundingClientRect().height,
      offscreenElements: allBounds.filter((rect) => (
        rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1
      )).length,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      documentOverflowY: document.documentElement.scrollHeight - innerHeight,
      predictionKeyboardOverlap: Math.max(0, predictionRect.bottom - keyboardRect.top),
      predictionKeyboardGap: Math.max(0, keyboardRect.top - predictionRect.bottom),
      predictionColors: predictionLabels.map((label) => getComputedStyle(label).color),
    };
  });

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, `${projectName}.json`),
    `${JSON.stringify({ projectName, ...expected, metrics }, null, 2)}\n`,
  );
  await safeScreenshot(page, `${projectName}.png`);

  expect.soft(metrics.keyboardButtonOverflows, `${expected.label}: clipped keyboard controls`).toEqual([]);
  expect.soft(metrics.shortPredictionWraps, `${expected.label}: short prediction words wrap`).toEqual([]);
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
  expect(metrics.minimumKeyWidth, `${expected.label}: minimum key width`)
    .toBeGreaterThanOrEqual(expected.minimumKeyWidth);
  expect(metrics.minimumKeyHeight, `${expected.label}: minimum key height`)
    .toBeGreaterThanOrEqual(expected.minimumKeyHeight);
  expect(metrics.maximumKeyAspectRatio, `${expected.label}: square-like key geometry`)
    .toBeLessThanOrEqual(expected.maximumKeyAspectRatio);
  expect(metrics.letterRows, `${expected.label}: canonical QWERTY row positions`)
    .toEqual(QWERTY_REFERENCE_ROWS);
  expect(metrics.typingSidebarWidth, `${expected.label}: duplicate Typing rail`).toBe(0);
  if (expected.viewport.height > 500) {
    expect(metrics.messageContentHeight, `${expected.label}: empty composer reserves one line`).toBeLessThanOrEqual(80);
    expect(metrics.messageBarHeight, `${expected.label}: empty composer does not reserve three lines`).toBeLessThanOrEqual(150);
  }
  expect(metrics.predictionHeight, `${expected.label}: prediction target height`)
    .toBeGreaterThanOrEqual(expected.minimumPredictionHeight);
  expect(metrics.keyboardHeight, `${expected.label}: keyboard is the dominant typing surface`)
    .toBeGreaterThan(metrics.predictionHeight);
  expect(metrics.characterOverflow, `${expected.label}: clipped keyboard glyphs`).toBe(0);
  expect(metrics.predictionOverflow, `${expected.label}: clipped prediction labels`).toBe(0);
  expect(metrics.offscreenElements, `${expected.label}: offscreen primary targets`).toBe(0);
  expect(metrics.documentOverflowX, `${expected.label}: horizontal document overflow`).toBeLessThanOrEqual(1);
  expect(metrics.documentOverflowY, `${expected.label}: vertical document overflow`).toBeLessThanOrEqual(1);
  expect(metrics.predictionKeyboardOverlap, `${expected.label}: prediction/keyboard overlap`).toBe(0);
  expect(metrics.predictionKeyboardGap, `${expected.label}: dead space between predictions and keyboard`)
    .toBeLessThanOrEqual(2);
  expect(metrics.predictionColors, `${expected.label}: prediction contrast`)
    .toEqual(Array(5).fill('rgb(0, 0, 0)'));
});

test('uses the expanded composer for populated text without reopening a dead gap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-6.1', 'populated portrait composition evidence');

  const key = (value: string) => page.locator(
    `[data-scan-group="keyboard"] button[data-key="${value}"]`,
  ).first();
  await key('I').click();
  await page.locator('[data-scan-group="keyboard"] button[data-action="space"]').click();
  for (const value of ['N', 'E', 'E', 'D']) await key(value).click();

  const messageText = page.getByTestId('message-text');
  await expect(messageText).toContainText(/i need/i);
  await expectPredictionPictogramsReady(page);

  const metrics = await page.evaluate(() => {
    const messageBar = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!;
    const messageText = document.querySelector<HTMLElement>('[data-testid="message-text"]')!;
    const predictionBar = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!;
    const keyboard = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!;
    const messageRect = messageBar.getBoundingClientRect();
    const predictionRect = predictionBar.getBoundingClientRect();
    const keyboardRect = keyboard.getBoundingClientRect();
    const controlBottomGaps = [...messageBar.querySelectorAll<HTMLElement>(':scope > button')]
      .map((button) => messageRect.bottom - button.getBoundingClientRect().bottom);
    return {
      text: messageText.textContent?.trim(),
      messageHeight: messageRect.height,
      textFont: Number.parseFloat(getComputedStyle(messageText).fontSize),
      textTopInset: messageText.getBoundingClientRect().top - messageRect.top,
      maximumControlBottomGap: Math.max(...controlBottomGaps),
      predictionKeyboardGap: Math.max(0, keyboardRect.top - predictionRect.bottom),
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      documentOverflowY: document.documentElement.scrollHeight - innerHeight,
    };
  });

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'iphone-6.1-populated.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
  await safeScreenshot(page, 'iphone-6.1-populated.png');

  expect(metrics.text).toMatch(/i need/i);
  expect(metrics.messageHeight, 'one-line output does not reserve three lines').toBeLessThanOrEqual(150);
  expect(metrics.textFont, 'populated composer text size').toBeGreaterThanOrEqual(40);
  expect(metrics.textTopInset, 'typed text belongs at the top of its output canvas').toBeLessThanOrEqual(40);
  expect(metrics.maximumControlBottomGap, 'message controls belong at the lower edge').toBeLessThanOrEqual(16);
  expect(metrics.predictionKeyboardGap, 'predictions remain adjacent to keyboard').toBeLessThanOrEqual(2);
  expect(metrics.documentOverflowX).toBeLessThanOrEqual(1);
  expect(metrics.documentOverflowY).toBeLessThanOrEqual(1);
});
