/**
 * Critical iPad toolbar hierarchy.
 *
 * AAC users must not search through a long icon ribbon for speech, voice
 * input, emergency help, or settings. On a landscape touch tablet those
 * controls stay direct, while every configured secondary action remains
 * reachable from More. Desktop and phone behavior is covered separately by
 * the existing toolbar overflow contract.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = process.env.AAC_LAYOUT_ARTIFACT_DIR;

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

async function expectVisiblePredictionPictograms(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => [...document.querySelectorAll('.aac-prediction-tile')]
    .filter((tile) => {
      const image = tile.querySelector<HTMLImageElement>('img');
      if (!image || !image.complete || image.naturalWidth <= 0) return false;
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).length), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
}

async function safeScreenshot(page: Page, fileName: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  await expect(page.getByText(/internal server error/i)).toHaveCount(0);
  const outputDir = ARTIFACT_DIR || test.info().outputDir;
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, fileName), fullPage: false });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-7-land', '1024x768 touch-tablet checkpoint');
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
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: {
        language: 'en',
        outputLanguage: 'en',
        theme: 'light',
        toolbarConfig: {
          order: [
            'categories', 'mic', 'aac_chat', 'alert', 'schedule',
            'marketplace', 'math', 'ai_chat', 'notes', 'games',
            'pdf_reader', 'ocr_capture', 'comfort_player', 'history',
            'sound', 'settings',
          ],
          enabled: {},
        },
        installedApps: ['symbol-libraries'],
      },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { soundEnabled: true, autoSpeak: false },
      version: 3,
    }));
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('aac-focus-toolbar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('prediction-bar')).toBeVisible();
  await expectVisiblePredictionPictograms(page);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('keeps essentials direct and all configured actions reachable from More', async ({ page }) => {
  const viewport = page.viewportSize();
  expect(viewport).toEqual({ width: 1024, height: 768 });

  const toolbar = page.getByRole('toolbar');
  const focus = page.getByTestId('aac-focus-toolbar');
  await expect(page.getByTestId('aac-toolbar-strip')).toBeHidden();

  for (const id of ['categories', 'sound', 'mic', 'alert', 'settings']) {
    const button = focus.locator(`[data-toolbar-button-id="${id}"]`);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box, `${id} must have measurable touch geometry`).not.toBeNull();
    expect(box!.width, `${id} touch width`).toBeGreaterThanOrEqual(48);
    expect(box!.height, `${id} touch height`).toBeGreaterThanOrEqual(48);
  }

  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(toolbarBox!.height).toBeGreaterThanOrEqual(52);
  expect(toolbarBox!.height).toBeLessThanOrEqual(72);
  await safeScreenshot(page, '01-toolbar-focus-closed.png');

  const more = page.getByTestId('aac-toolbar-more-button');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');

  const menu = page.getByTestId('aac-toolbar-more-menu');
  await expect(menu).toBeVisible();
  for (const id of ['aac_chat', 'schedule', 'app:symbol-libraries']) {
    await expect(menu.locator(`[data-toolbar-button-id="${id}"]`)).toBeVisible();
  }
  await expect(menu.locator('[data-toolbar-button-id="categories"]')).toHaveCount(0);
  await expect(menu.locator('[data-toolbar-button-id="aac_chat"]')).toContainText('Send a message');
  await expect(menu).not.toContainText('aac_chat');
  await expect(menu.locator('[data-toolbar-button-id="sound"]')).toHaveCount(0);
  await expect(menu.locator('[data-toolbar-button-id="alert"]')).toHaveCount(0);
  await safeScreenshot(page, '02-toolbar-more-open.png');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
});

test('keeps caregiver-disabled controls out of the iPad focus toolbar', async ({ page }) => {
  // Register this after the shared bootstrap so every new document first gets
  // the normal config and then the caregiver overrides. Mutating storage in
  // the already-running page is racy with Zustand's persistence subscriber.
  await page.addInitScript(() => {
    const raw = localStorage.getItem('prism-aac-settings');
    if (!raw) throw new Error('Missing settings bootstrap');
    const settings = JSON.parse(raw);
    settings.state.toolbarConfig.enabled.sound = false;
    settings.state.toolbarConfig.enabled.mic = false;
    localStorage.setItem('prism-aac-settings', JSON.stringify(settings));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  expect(await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('prism-aac-settings') || '{}');
    return settings.state?.toolbarConfig?.enabled;
  })).toEqual(expect.objectContaining({ sound: false, mic: false }));

  const focus = page.getByTestId('aac-focus-toolbar');
  await expect(focus).toBeVisible();
  await expect(focus.locator('[data-toolbar-button-id="sound"]')).toHaveCount(0);
  await expect(focus.locator('[data-toolbar-button-id="mic"]')).toHaveCount(0);
  await expect(focus.locator('[data-toolbar-button-id="alert"]')).toBeVisible();
  await expect(focus.locator('[data-toolbar-button-id="settings"]')).toBeVisible();
});
