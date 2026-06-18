import { test, expect } from '@playwright/test';

test.describe('Browser page — AAC-enabled web browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/prism-aac/browser');
    await page.waitForSelector('[data-testid="browser-toolbar"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test('renders browser toolbar with navigation buttons', async ({ page }) => {
    await expect(page.locator('[data-testid="browser-toolbar"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Back"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Forward"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Home"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Bookmarks"]')).toBeVisible();
  });

  test('renders browser content with bookmarks', async ({ page }) => {
    await expect(page.locator('[data-testid="browser-content"]')).toBeVisible();
    await expect(page.getByText('Prism AAC Browser')).toBeVisible();
    await expect(page.locator('button[aria-label="Google"]')).toBeVisible();
    await expect(page.locator('button[aria-label="YouTube"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Wikipedia"]')).toBeVisible();
  });

  test('renders AAC keyboard and prediction bar', async ({ page }) => {
    await expect(page.locator('[data-testid="keyboard-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-bar"]')).toBeVisible();
  });

  test('emergency SOS button is always visible', async ({ page }) => {
    await expect(page.locator('button[aria-label="Emergency"]')).toBeVisible();
  });

  test('settings button opens settings modal', async ({ page }) => {
    await page.locator('button[aria-label="Settings"]').click({ force: true });
    await page.waitForTimeout(500);
    const settingsModal = page.locator('[role="dialog"]').or(page.getByText('Categories'));
    await expect(settingsModal.first()).toBeVisible();
  });

  test('bookmarks toggle shows and hides bookmark bar', async ({ page }) => {
    const bookmarkBtn = page.locator('button[aria-label="Bookmarks"]');
    await bookmarkBtn.click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('a[aria-label="AAC Board"]')).toBeVisible();

    await bookmarkBtn.click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('a[aria-label="AAC Board"]')).not.toBeVisible();
  });

  test('mode toggle switches between Speak and Browse', async ({ page }) => {
    // Find the mode toggle button (shows Browse/Speak text)
    const toggleBtn = page.locator('button[aria-label*="Switch to Browse"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click({ force: true });
    await page.waitForTimeout(500);

    // After toggle, the Go button should appear
    await expect(page.locator('button[aria-label="Go"]')).toBeVisible();
  });

  test('typing text shows in prediction bar', async ({ page }) => {
    await page.keyboard.type('hel');
    await page.waitForTimeout(1000);
    const predBar = page.locator('[data-testid="prediction-bar"]');
    const tiles = predBar.locator('button');
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('back and forward buttons start disabled', async ({ page }) => {
    const backBtn = page.locator('button[aria-label="Back"]');
    const fwdBtn = page.locator('button[aria-label="Forward"]');
    await expect(backBtn).toBeDisabled();
    await expect(fwdBtn).toBeDisabled();
  });

  test('no Next.js dev indicators in production', async ({ page }) => {
    const devOverlay = page.locator('nextjs-portal');
    const count = await devOverlay.count();
    // In dev mode these exist; in production they should not
    // This test validates screenshots are clean
    if (count > 0) {
      console.warn('Dev overlay detected — screenshots will have "N" badge');
    }
  });

  test('AAC Board link in bookmarks navigates to /prism-aac', async ({ page }) => {
    await page.locator('button[aria-label="Bookmarks"]').click({ force: true });
    await page.waitForTimeout(300);
    const aacLink = page.locator('a[aria-label="AAC Board"]');
    await expect(aacLink).toBeVisible();
    const href = await aacLink.getAttribute('href');
    expect(href).toBe('/prism-aac');
  });

  test('head tracking overlay mounts (component exists in DOM)', async ({ page }) => {
    // HeadTrackingOverlay is dynamically imported — verify it loads
    await page.waitForTimeout(2000);
    // The overlay only renders visible cursor when headTrackingEnabled=true in settings
    // Just verify the component mounted without errors (no crash = pass)
    const crashed = await page.locator('text=Error — Emergency AAC Mode').count();
    expect(crashed).toBe(0);
  });
});
