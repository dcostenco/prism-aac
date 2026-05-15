/**
 * Capture 3 keyboard mode screenshots at iPad resolution (1366x1024)
 * for README and App Store assets.
 *
 * Usage:
 *   mkdir -p e2e/_screenshots
 *   BASE_URL=http://localhost:3333 npx playwright test e2e/capture-screenshots.ts --workers=1
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = path.resolve('e2e', '_screenshots');

test.use({
  viewport: { width: 1366, height: 1024 },
  deviceScaleFactor: 2,
});

test('capture 3 keyboard modes at iPad resolution', async ({ page }) => {
  // 1. Navigate and clear localStorage
  await page.goto('/prism-aac');
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });

  // 2. Wait for keyboard shell to appear
  await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30000 });
  const kb = page.locator('[data-testid="keyboard-shell"]');
  await expect(kb).toBeVisible();

  // Small settle delay for animations
  await page.waitForTimeout(500);

  // 3. Screenshot 1: default state (MIN KB)
  await page.screenshot({
    path: path.join(SHOTS_DIR, 'mode-1-min-kb.png'),
    fullPage: false,
  });
  console.log('Captured mode-1-min-kb.png');

  // 4. Find and click the KB sidebar button → HIDE state
  const kbBtn = page.locator('nav button', { hasText: /KB|Keyboard/i }).first();
  await expect(kbBtn).toBeVisible();
  await kbBtn.click();
  await expect(kb).not.toBeVisible();
  await page.waitForTimeout(300);

  // 5. Screenshot 2: HIDE state
  await page.screenshot({
    path: path.join(SHOTS_DIR, 'mode-2-hidden.png'),
    fullPage: false,
  });
  console.log('Captured mode-2-hidden.png');

  // 6. Click again → MAX state
  await kbBtn.click();
  await expect(kb).toBeVisible();
  await page.waitForTimeout(300);

  // 7. Screenshot 3: MAX KB state
  await page.screenshot({
    path: path.join(SHOTS_DIR, 'mode-3-max-kb.png'),
    fullPage: false,
  });
  console.log('Captured mode-3-max-kb.png');
});
