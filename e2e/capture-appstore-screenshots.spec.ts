/**
 * Capture App Store Connect screenshots at exact required resolutions.
 *
 * App Store required sizes (points × scale):
 *   6.9" iPhone: 1320×2868 (iPhone 16 Pro Max, 3x, viewport 440×956)
 *   6.3" iPhone: 1206×2622 (iPhone 16 Pro, 3x, viewport 402×874)
 *   13" iPad:    2064×2752 (iPad Pro 13", 2x, viewport 1032×1376)
 *   11" iPad:    1668×2388 (iPad Pro 11", 2x, viewport 834×1194)
 *
 * Run: BASE_URL=http://localhost:3000/prism-aac npx playwright test e2e/capture-appstore-screenshots.spec.ts --reporter=list
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'ios-native', 'screenshots', 'appstore');

// Exact App Store viewport sizes (CSS pixels — Playwright captures at deviceScaleFactor)
const DEVICES = {
  'iphone-6.9': { width: 440, height: 956, scaleFactor: 3 },
  'iphone-6.3': { width: 402, height: 874, scaleFactor: 3 },
  'ipad-13':    { width: 1032, height: 1376, scaleFactor: 2 },
  'ipad-11':    { width: 834, height: 1194, scaleFactor: 2 },
};

for (const [device, vp] of Object.entries(DEVICES)) {
  test.describe(`${device}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.scaleFactor,
      isMobile: device.startsWith('iphone'),
      hasTouch: true,
    });

    test.beforeEach(async ({ page, baseURL }) => {
      const start = baseURL || '/';
      await page.goto(start);
      await page.evaluate(() => {
        try { localStorage.clear(); sessionStorage.clear(); } catch {}
      });
      await page.goto(start, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
      await page.waitForTimeout(1500);
    });

    test('01 home board', async ({ page }) => {
      await page.screenshot({ path: path.join(OUT, `${device}-01-home.png`) });
    });

    test('02 categories', async ({ page }) => {
      const catBtn = page.getByRole('button', { name: /feelings/i }).first();
      if (await catBtn.isVisible()) {
        await catBtn.click();
        await page.waitForTimeout(800);
      }
      await page.screenshot({ path: path.join(OUT, `${device}-02-categories.png`) });
    });

    test('03 ai chat', async ({ page }) => {
      await enableToolbar(page, 'ai_chat');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
      const aiBtn = page.getByRole('button', { name: /ai/i }).first();
      if (await aiBtn.isVisible()) {
        await aiBtn.click();
        await page.waitForTimeout(800);
      }
      await page.screenshot({ path: path.join(OUT, `${device}-03-ai-chat.png`) });
    });

    test('04 dark high contrast', async ({ page }) => {
      await page.evaluate(() => {
        const raw = localStorage.getItem('prism-aac-settings');
        const state = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        if (!state.state) state.state = {};
        state.state.theme = 'dark';
        state.state.highContrast = true;
        localStorage.setItem('prism-aac-settings', JSON.stringify(state));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, `${device}-04-dark.png`) });
    });

    test('05 emergency', async ({ page }) => {
      const alertBtn = page.getByRole('button', { name: /alert/i }).first();
      if (await alertBtn.isVisible()) {
        await alertBtn.click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(OUT, `${device}-05-emergency.png`) });
      const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    });

    test('06 settings', async ({ page }) => {
      const settingsBtn = page.getByRole('button', { name: /settings/i }).first();
      await settingsBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${device}-06-settings.png`) });
    });
  });
}

async function enableToolbar(page: Page, ...ids: string[]) {
  await page.evaluate((ids) => {
    const raw = localStorage.getItem('prism-aac-settings');
    const state = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    if (!state.state) state.state = {};
    if (!state.state.toolbarConfig) state.state.toolbarConfig = { order: [], enabled: {} };
    for (const id of ids) state.state.toolbarConfig.enabled[id] = true;
    localStorage.setItem('prism-aac-settings', JSON.stringify(state));
  }, ids);
}
