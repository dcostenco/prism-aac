/** Current, signed-out web UI; no mocked pictures, identity or paid access.
 * Run with scripts/playwright-watchdog.sh, one WebKit worker, and BASE_URL.
 * Native simulator images have separate receipts and are not produced here.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { safeScreenshot } from './helpers/screenshot-validation';
import pack from '../constants/generated/picturePack.json';

const OUT = path.resolve(process.env.README_CAPTURE_OUT || 'docs/screenshots/2026-10');
const APP = '/prism-aac';
const CAPTURE_RUN = process.env.README_CAPTURE_RUN || randomUUID();
test.use({ browserName: 'webkit', deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });

test.afterEach(async ({ page, context }, info) => {
  if (info.status !== info.expectedStatus) {
    console.log('FAILED_CAPTURE_STATE', await page.locator('body').innerText());
    console.log('FAILED_CAPTURE_TARGETS', await page.locator('[data-readme-capture]').evaluateAll(es => es.map(e => {
      const r=e.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {text:e.textContent,rect:{left:r.left,top:r.top,width:r.width,height:r.height},
        hit:hit?.outerHTML.slice(0,300), viewport:{width:innerWidth,height:innerHeight}};
    })));
  }
  try { await page.close(); } finally { await context.close(); }
});

async function openBoard(page: Page, dark = false) {
  await page.addInitScript(({ dark }) => {
    // Configure only this isolated visitor's ordinary display preferences.
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'false');
    localStorage.setItem('prism-kb-max', 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: 'en', outputLanguage: 'en', theme: dark ? 'dark' : 'light',
        highContrast: dark, gridSize: 12, cloudPredictionEnabled: false,
        aiAutocorrectEnabled: false }, version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3,
    }));
  }, { dark });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('picture-board')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('phrase-tile-card').first()).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('prism-aac-bundled-pictures', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('packs').objectStore('packs').get('active');
        request.onsuccess = () => resolve(request.result?.version ?? request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }), { timeout: 30_000 }).toBe(pack.version);
}

async function capture(page: Page, name: string, criticalSelectors: string[]) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator('img').evaluateAll(images => images
    .filter(image => { const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .every(image => image.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('blob:'))),
  { timeout: 20_000 }).toBe(true);
  await fs.mkdir(OUT, { recursive: true });
  const targets = await page.evaluate(selectors => {
    document.querySelectorAll('[data-readme-capture]').forEach(e => e.removeAttribute('data-readme-capture'));
    let index = 0;
    return selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(element => {
      const r=element.getBoundingClientRect();
      return r.width>0 && r.height>0 && getComputedStyle(element).visibility !== 'hidden';
    }).map(element => {
      const id = `readme-${index++}`;
      element.setAttribute('data-readme-capture', id);
      return `[data-readme-capture="${id}"]`;
    }));
  }, criticalSelectors);
  expect(targets.length, 'named controls must exist before documenting them').toBeGreaterThan(0);
  const file = path.join(OUT, name + '.png');
  await safeScreenshot(page, file, { expectedPath: APP,
    requiredSelectors: ['[data-testid="aac-safe-viewport"]', ...criticalSelectors], criticalSelectors: targets });
  const png = await fs.readFile(file);
  await fs.writeFile(path.join(OUT, name + '.json'), JSON.stringify({
    capturedAt: new Date().toISOString(), captureRun: CAPTURE_RUN,
    testCase: test.info().title, surface: 'web', url: page.url(),
    viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio),
    picturePackVersion: pack.version, imageSha256: createHash('sha256').update(png).digest('hex'),
    criticalSelectors, pictureSource: 'verified local Prism AAC picture pack',
  }, null, 2) + '\n');
}

const boardTargets = ['[data-testid="phrase-tile-card"] [data-testid="phrase-tile-label"]',
  '[data-testid="prediction-tile"]', '[data-testid="category-tile"]', '[data-testid="kb-cycle-btn"]'];

for (const device of [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 1032, height: 1376 },
  { name: 'ipad-landscape', width: 1376, height: 1032 },
]) {
  test(`${device.name} picture board`, async ({ page }) => {
    await page.setViewportSize(device);
    await openBoard(page);
    if (device.name === 'iphone-landscape') {
      await page.getByTestId('kb-cycle-btn').click();
      await expect(page.locator('button[data-key="Q"]')).toBeVisible();
      await capture(page, device.name, ['button[data-key="Q"]', '[data-testid="prediction-tile"]']);
    } else await capture(page, device.name, boardTargets);
  });
}

for (const device of [
  { name: 'iphone-dark', width: 390, height: 844 },
  { name: 'ipad-dark', width: 1376, height: 1032 },
]) {
  test(`${device.name} high contrast`, async ({ page }) => {
    await page.setViewportSize(device);
    await openBoard(page, true);
    await capture(page, device.name, boardTargets);
  });
}

async function feature(page: Page, name: string) {
  console.log('Opening feature', name);
  const button = page.getByRole('button', { name, exact: true });
  if (!await button.first().isVisible()) await page.getByTestId('aac-toolbar-more-button').click();
  await button.filter({ visible: true }).first().click({ timeout: 10_000 });
}

test('feature panels with the current picture library', async ({ page }) => {
  await page.setViewportSize({ width: 1376, height: 1032 });
  await openBoard(page);
  await page.getByTestId('category-tile').first().click();
  await capture(page, 'categories', ['[data-testid="phrase-tile-label"]', '[data-testid="kb-cycle-btn"]']);
  await feature(page, 'Categories');
  await page.getByTestId('kb-cycle-btn').click();
  await expect(page.locator('button[data-key="Q"]')).toBeVisible();
  await capture(page, 'keyboard', ['button[data-key="Q"]', '[data-testid="prediction-tile"]']);
  await feature(page, 'Alert');
  await expect(page.getByTestId('alert-confirm-modal')).toBeVisible();
  await capture(page, 'emergency', ['[data-testid="alert-cancel"]', '[data-testid="alert-send"]']);
  await page.getByTestId('alert-cancel').click();
  await feature(page, 'Send a message');
  await capture(page, 'aac-chat', ['button[aria-label="Categories"]']);
  await feature(page, 'AI');
  await expect(page.getByTestId('ai-chat-panel')).toBeVisible();
  await capture(page, 'ai-chat', ['[data-testid="ai-chat-panel"]']);
  await page.setViewportSize({ width: 1032, height: 1376 });
  await feature(page, 'Schedule');
  await capture(page, 'schedule', ['button[aria-label="Categories"]']);
  await feature(page, 'Games');
  await capture(page, 'games', ['button[aria-label="Categories"]']);
  await page.setViewportSize({ width: 1376, height: 1032 });
  await feature(page, 'Math');
  await capture(page, 'math', ['[data-testid="math-panel"]']);
  await feature(page, 'PDF reader');
  await capture(page, 'pdf-reader', ['[data-testid="pdf-reader-pick"]']);
  await feature(page, 'Screenshot reader (OCR)');
  await capture(page, 'ocr-reader', ['[data-testid="ocr-capture-pick"]']);
  await feature(page, 'Settings');
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'settings', ['button[aria-label="Close settings"]']);
  const input = page.getByTestId('vision-context-settings');
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await input.scrollIntoViewIfNeeded();
  await capture(page, 'input-modes', ['[data-testid="vision-context-settings"]', 'button[aria-label="Close settings"]']);
  await page.getByRole('dialog').locator('button[aria-expanded]').filter({ hasText: 'Math' }).click({ timeout: 10_000 });
  await page.getByText('Hold-time dwell', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'math-settings', ['button[aria-label="Two-hit magnify"]', 'button[aria-label="Close settings"]']);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.getByTestId('language-button-input').click();
  await capture(page, 'languages', ['[role="listbox"]']);
});
