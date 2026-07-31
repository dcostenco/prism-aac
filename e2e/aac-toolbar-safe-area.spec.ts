/**
 * Touch-device toolbar and safe-area acceptance.
 *
 * AAC controls must remain directly reachable without entering the camera,
 * notch, Dynamic Island, or home-indicator exclusion zones. Playwright does
 * not expose non-zero CSS env(safe-area-inset-*) values, so this test injects
 * representative iPhone/iPad insets through the app's safe-area variables and
 * verifies the rendered geometry—not just the presence of CSS declarations.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.use({ serviceWorkers: 'block' });

const ARTIFACT_DIR = process.env.AAC_SAFE_AREA_ARTIFACT_DIR
  ?? path.resolve('test-results', 'aac-toolbar-safe-area');

const DEVICE_INSETS = {
  'iphone-6.1': { top: 47, right: 0, bottom: 34, left: 0 },
  'iphone-6.1-land': { top: 0, right: 47, bottom: 21, left: 47 },
  'ipad-7': { top: 24, right: 0, bottom: 20, left: 0 },
  'ipad-7-land': { top: 24, right: 0, bottom: 20, left: 0 },
} as const;

type SafeAreaProject = keyof typeof DEVICE_INSETS;

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
  const projectName = testInfo.project.name as SafeAreaProject;
  test.skip(!(projectName in DEVICE_INSETS), 'touch safe-area matrix only');
  const inset = DEVICE_INSETS[projectName];

  await proxyArasaacForLocalWebKit(page);
  await page.addInitScript(() => {
    class SpeechRecognitionStub {}
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: SpeechRecognitionStub,
    });
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
        cloudPredictionEnabled: false,
        aiAutocorrectEnabled: false,
      },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { text: '', autoSpeak: false, soundEnabled: true },
      version: 3,
    }));
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.evaluate((safeArea) => {
    document.documentElement.style.setProperty('--aac-safe-area-top', `${safeArea.top}px`);
    document.documentElement.style.setProperty('--aac-safe-area-right', `${safeArea.right}px`);
    document.documentElement.style.setProperty('--aac-safe-area-bottom', `${safeArea.bottom}px`);
    document.documentElement.style.setProperty('--aac-safe-area-left', `${safeArea.left}px`);
  }, inset);
  await expect(page.getByTestId('prediction-bar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('keyboard-shell')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('keeps the primary ribbon, More, languages, and keyboard outside unsafe insets', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name as SafeAreaProject;
  const inset = DEVICE_INSETS[projectName];
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const safeViewport = page.getByTestId('aac-safe-viewport');
  const focus = page.getByTestId('aac-focus-toolbar');
  const strip = page.getByTestId('aac-toolbar-strip');
  const more = page.getByTestId('aac-toolbar-more-button');

  await expect(safeViewport).toBeVisible();
  await expect(focus).toBeVisible();
  await expect(strip).toBeHidden();
  await expect(more).toBeVisible();

  for (const id of ['categories', 'sound', 'mic', 'alert', 'settings']) {
    await expect(focus.locator(`[data-toolbar-button-id="${id}"]`)).toBeVisible();
  }

  const safeMetrics = await page.evaluate(({ safeArea }) => {
    const viewportRoot = document.querySelector<HTMLElement>('[data-testid="aac-safe-viewport"]')!;
    const toolbar = document.querySelector<HTMLElement>('[role="toolbar"]')!;
    const protectedControls = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="aac-focus-toolbar"] > button'),
      ...document.querySelectorAll<HTMLElement>('[data-testid^="language-button-"]'),
    ];
    const keyboardControls = [
      ...document.querySelectorAll<HTMLElement>('[data-key-row="controls"] > button'),
    ];
    const rootStyle = getComputedStyle(viewportRoot);
    const toolbarRect = toolbar.getBoundingClientRect();
    return {
      rootPadding: {
        top: Number.parseFloat(rootStyle.paddingTop),
        right: Number.parseFloat(rootStyle.paddingRight),
        left: Number.parseFloat(rootStyle.paddingLeft),
      },
      toolbarPaddingTop: Number.parseFloat(getComputedStyle(toolbar).paddingTop),
      toolbarTop: toolbarRect.top,
      safeBandOwnedByToolbar: safeArea.top === 0 || Boolean(
        document.elementFromPoint(innerWidth / 2, safeArea.top / 2)?.closest('[role="toolbar"]'),
      ),
      protectedControlViolations: protectedControls
        .map((control) => ({ label: control.getAttribute('aria-label'), rect: control.getBoundingClientRect() }))
        .filter(({ rect }) => (
          rect.left < safeArea.left - 0.5
          || rect.right > innerWidth - safeArea.right + 0.5
          || rect.top < safeArea.top - 0.5
        ))
        .map(({ label, rect }) => ({ label, left: rect.left, right: rect.right, top: rect.top })),
      keyboardBottomViolations: keyboardControls
        .map((control) => ({ label: control.getAttribute('aria-label'), rect: control.getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom > innerHeight - safeArea.bottom + 0.5)
        .map(({ label, rect }) => ({ label, bottom: rect.bottom })),
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      documentOverflowY: document.documentElement.scrollHeight - innerHeight,
    };
  }, { safeArea: inset });

  expect(safeMetrics.rootPadding.top).toBe(0);
  expect(safeMetrics.rootPadding.right).toBe(inset.right);
  expect(safeMetrics.rootPadding.left).toBe(inset.left);
  expect(safeMetrics.toolbarPaddingTop).toBeGreaterThanOrEqual(inset.top);
  expect(safeMetrics.toolbarTop).toBe(0);
  expect(safeMetrics.safeBandOwnedByToolbar, 'status/camera band must be painted as part of the ribbon').toBe(true);
  expect(safeMetrics.protectedControlViolations, 'top-ribbon controls entered camera/notch space').toEqual([]);
  expect(safeMetrics.keyboardBottomViolations, 'keyboard controls entered home-indicator space').toEqual([]);
  expect(safeMetrics.documentOverflowX).toBeLessThanOrEqual(1);
  expect(safeMetrics.documentOverflowY).toBeLessThanOrEqual(1);

  if (projectName === 'iphone-6.1') {
    const emptyAllocation = await page.evaluate(() => {
      const message = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!.getBoundingClientRect();
      const messageContent = document.querySelector<HTMLElement>('[data-testid="message-content"]')!.getBoundingClientRect();
      const predictions = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
      const keyboard = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!.getBoundingClientRect();
      return {
        messageHeight: message.height,
        messageContentHeight: messageContent.height,
        predictionHeight: predictions.height,
        keyboardHeight: keyboard.height,
        predictionKeyboardGap: Math.max(0, keyboard.top - predictions.bottom),
      };
    });
    expect(emptyAllocation.messageHeight, 'empty composer includes a visible canvas and its action row')
      .toBeGreaterThanOrEqual(110);
    expect(emptyAllocation.messageHeight, 'empty composer reserves one line, not three blank lines')
      .toBeLessThanOrEqual(150);
    expect(emptyAllocation.messageContentHeight, 'empty typing canvas must not disappear')
      .toBeGreaterThanOrEqual(56);
    expect(emptyAllocation.messageContentHeight, 'empty typing canvas must reserve only one line')
      .toBeLessThanOrEqual(80);
    expect(emptyAllocation.keyboardHeight, 'QWERTY retains its motor-accessible input height')
      .toBeGreaterThanOrEqual(274);
    expect(
      emptyAllocation.predictionHeight + emptyAllocation.keyboardHeight,
      'predictions and keyboard keep the remaining safe viewport',
    ).toBeGreaterThanOrEqual(530);
    expect(emptyAllocation.predictionKeyboardGap).toBeLessThanOrEqual(2);
    expect(emptyAllocation.keyboardHeight, 'keyboard remains larger than predictions')
      .toBeGreaterThan(emptyAllocation.predictionHeight);

    const predictionGeometry = await page.evaluate(() => {
      const rects = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')]
        .map((tile) => tile.getBoundingClientRect());
      const rows: Array<{ top: number; count: number }> = [];
      for (const rect of rects) {
        const row = rows.find((candidate) => Math.abs(candidate.top - rect.top) <= 2);
        if (row) row.count += 1;
        else rows.push({ top: rect.top, count: 1 });
      }
      const overlaps: Array<[number, number]> = [];
      for (let left = 0; left < rects.length; left += 1) {
        for (let right = left + 1; right < rects.length; right += 1) {
          const a = rects[left];
          const b = rects[right];
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
            overlaps.push([left, right]);
          }
        }
      }
      return {
        count: rects.length,
        rowCounts: rows.sort((a, b) => a.top - b.top).map((row) => row.count),
        minimumWidth: Math.min(...rects.map((rect) => rect.width)),
        minimumHeight: Math.min(...rects.map((rect) => rect.height)),
        maximumAspectRatio: Math.max(...rects.map((rect) => (
          Math.max(rect.width / rect.height, rect.height / rect.width)
        ))),
        overlaps,
        offscreen: rects.filter((rect) => (
          rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1
        )).length,
      };
    });
    expect(predictionGeometry.count).toBe(5);
    expect(predictionGeometry.rowCounts, 'phone predictions use a readable 3 + 2 card grid').toEqual([3, 2]);
    expect(predictionGeometry.minimumWidth, 'prediction cards remain motor-accessible').toBeGreaterThanOrEqual(120);
    expect(predictionGeometry.minimumHeight, 'prediction cards use the released vertical space').toBeGreaterThanOrEqual(120);
    expect(predictionGeometry.maximumAspectRatio, 'prediction cards remain square-like').toBeLessThanOrEqual(1.85);
    expect(predictionGeometry.overlaps).toEqual([]);
    expect(predictionGeometry.offscreen).toBe(0);
  }

  const toolbarBox = await page.getByRole('toolbar').boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(toolbarBox!.height - inset.top, 'touch toolbar remains a single compact ribbon below the safe inset')
    .toBeLessThanOrEqual(60);
  await expectPredictionPictogramsReady(page);
  await safeScreenshot(page, `${projectName}-safe-area-closed.png`);

  await more.click();
  const menu = page.getByTestId('aac-toolbar-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-toolbar-button-id="categories"]')).toHaveCount(0);

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(inset.left);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport!.width - inset.right);
  expect(menuBox!.y).toBeGreaterThanOrEqual(inset.top);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport!.height - inset.bottom);

  await safeScreenshot(page, `${projectName}-safe-area-more.png`);

  if (projectName === 'iphone-6.1') {
    await more.click();
    await expect(menu).toHaveCount(0);
    const key = (value: string) => page.locator(
      `[data-scan-group="keyboard"] button[data-key="${value}"]`,
    ).first();
    await key('I').click();
    await page.locator('[data-scan-group="keyboard"] button[data-action="space"]').click();
    for (const value of ['N', 'E', 'E', 'D']) await key(value).click();
    await expect(page.getByTestId('message-text')).toContainText(/i need/i);
    await expectPredictionPictogramsReady(page);
    const populatedAllocation = await page.evaluate(() => {
      const message = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!.getBoundingClientRect();
      const predictions = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
      const keyboard = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!.getBoundingClientRect();
      return {
        messageHeight: message.height,
        predictionHeight: predictions.height,
        keyboardHeight: keyboard.height,
        predictionKeyboardGap: Math.max(0, keyboard.top - predictions.bottom),
      };
    });
    expect(populatedAllocation.messageHeight, 'one-line output uses content height, not a three-line canvas')
      .toBeLessThanOrEqual(150);
    expect(populatedAllocation.keyboardHeight, 'populated output preserves the proven QWERTY geometry')
      .toBeGreaterThanOrEqual(230);
    expect(
      populatedAllocation.predictionHeight + populatedAllocation.keyboardHeight,
      'populated output leaves the rest of the viewport to prediction and keyboard input',
    ).toBeGreaterThanOrEqual(540);
    expect(populatedAllocation.predictionKeyboardGap).toBeLessThanOrEqual(2);
    expect(populatedAllocation.keyboardHeight, 'keyboard remains larger than predictions after typing')
      .toBeGreaterThan(populatedAllocation.predictionHeight);
    await safeScreenshot(page, `${projectName}-safe-area-populated.png`);
  }
});
