/**
 * README / docs screenshots from the production web build.
 *
 * Run through the watchdog against the loopback pair used by the
 * monetization harness (web build on 6990, fixture identity on 6947):
 *   npx next start -p 6990 &  node scripts/simulator-billing-fixture.mjs &
 *   BASE_URL=http://localhost:6947 MIN_FREE_GB=2 ./scripts/playwright-watchdog.sh \
 *     e2e/capture-docs-screenshots.spec.ts --workers=1
 *
 * Every PNG goes through safeScreenshot (URL drift, error UI, required
 * selectors, blank-canvas checks) — never page.screenshot directly.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { safeScreenshot } from './helpers/screenshot-validation';

const OUT = path.resolve('docs', 'screenshots');
const APP = '/prism-aac';

async function settle(page: Page) {
  await page.goto(APP);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => document.querySelectorAll('img').length === 0
    || [...document.querySelectorAll('img')].every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
}

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch {}
  try { await context.close(); } catch {}
});

test.describe('iPad landscape hero', () => {
  test.use({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2, hasTouch: true });

  test('app-hero', async ({ page }) => {
    await settle(page);
    await safeScreenshot(page, path.join(OUT, 'app-hero.png'), {
      expectedPath: APP, requiredSelectors: ['button[data-key="Q"]', 'nav'],
    });
  });

  test('keyboard-typing', async ({ page }) => {
    await settle(page);
    for (const k of ['H', 'E', 'L', 'L', 'O']) await page.locator(`button[data-key="${k}"]`).first().click();
    await expect(page.getByText(/hello/i).first()).toBeVisible();
    await safeScreenshot(page, path.join(OUT, 'keyboard-typing.png'), {
      expectedPath: APP, requiredSelectors: ['button[data-key="Q"]'],
    });
  });
});

test.describe('iPhone settings (signed in through the loopback fixture)', () => {
  test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test('panel-settings and account/cloud section', async ({ page }) => {
    await settle(page);
    await page.getByRole('button', { name: /settings/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await safeScreenshot(page, path.join(OUT, 'panel-settings.png'), {
      expectedPath: APP, requiredSelectors: ['[role="dialog"]'],
    });
    const account = dialog.getByRole('button', { name: /synalux account/i }).first();
    await account.scrollIntoViewIfNeeded();
    await account.click();
    const cloud = page.locator('[data-testid="cloud-subscription-settings"]');
    await expect(cloud).toBeVisible({ timeout: 15000 });
    await cloud.scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /subscribe with apple|subscribe/i }).first()).toBeVisible({ timeout: 15000 });
    await safeScreenshot(page, path.join(OUT, 'panel-account-cloud.png'), {
      expectedPath: APP, requiredSelectors: ['[data-testid="cloud-subscription-settings"]'],
    });
  });
});
