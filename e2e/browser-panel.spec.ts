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

  test('renders browser content with bookmarks on home', async ({ page }) => {
    await expect(page.locator('[data-testid="browser-content"]')).toBeVisible();
    await expect(page.getByText('Prism AAC Browser')).toBeVisible();
    await expect(page.locator('button[aria-label="Google"]')).toBeVisible();
    await expect(page.locator('button[aria-label="YouTube"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Wikipedia"]')).toBeVisible();
  });

  test('renders AAC keyboard and message bar', async ({ page }) => {
    await expect(page.locator('[data-testid="keyboard-shell"]')).toBeVisible();
    // MessageBar must always be visible (including landscape) for typing
    const speakBtn = page.locator('button[aria-label="Speak"]').or(page.locator('button:has-text("Speak")'));
    await expect(speakBtn.first()).toBeVisible();
  });

  test('emergency modal loads without crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    // EmergencyCountdownModal is dynamically imported — verify component didn't crash the page
    const crashed = await page.locator('text=Error — Emergency AAC Mode').count();
    expect(crashed).toBe(0);
    // Page is still interactive — toolbar still present
    await expect(page.locator('[data-testid="browser-toolbar"]')).toBeVisible();
  });

  test('back-to-AAC button is always visible in toolbar', async ({ page }) => {
    const aacBtn = page.locator('a[aria-label="Back to AAC Board"]');
    await expect(aacBtn).toBeVisible();
    const href = await aacBtn.getAttribute('href');
    expect(href).toBe('/prism-aac');
  });

  test('bookmarks toggle shows and hides bookmark bar', async ({ page }) => {
    const bookmarkBtn = page.locator('button[aria-label="Bookmarks"]');

    // Show
    await bookmarkBtn.click({ force: true });
    await page.waitForTimeout(500);
    const toolbarGoogle = page.locator('[data-testid="browser-toolbar"] button[aria-label*="Google"]');
    await expect(toolbarGoogle.first()).toBeVisible();

    // Hide
    await bookmarkBtn.click({ force: true });
    await page.waitForTimeout(500);
    // Bookmark bar buttons should be gone (only home-grid Google remains)
    const bookmarkBarButtons = page.locator('[data-testid="browser-toolbar"] .overflow-x-auto button');
    await expect(bookmarkBarButtons).toHaveCount(0);
  });

  test('Go button is always visible and disabled when no text', async ({ page }) => {
    const goBtn = page.locator('button[aria-label="Go"]');
    await expect(goBtn).toBeVisible();
    await expect(goBtn).toBeDisabled();
  });

  test('Go button enables when text is typed', async ({ page }) => {
    await page.keyboard.type('hello');
    await page.waitForTimeout(500);
    const goBtn = page.locator('button[aria-label="Go"]');
    await expect(goBtn).toBeEnabled();
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

  test('home button returns to bookmark grid from loaded page', async ({ page }) => {
    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page.getByText('Prism AAC Browser')).not.toBeVisible();

    await page.locator('button[aria-label="Home"]').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.getByText('Prism AAC Browser')).toBeVisible();
  });

  test('refresh button appears after navigation and open-in-tab is visible', async ({ page }) => {
    await expect(page.locator('button[aria-label="Refresh"]')).not.toBeVisible();
    await expect(page.locator('a[aria-label="Open in new tab"]')).not.toBeVisible();

    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(500);
    // Both refresh and open-in-new-tab should appear
    await expect(page.locator('button[aria-label="Refresh"]')).toBeVisible();
    await expect(page.locator('a[aria-label="Open in new tab"]')).toBeVisible();

    // open-in-tab must have a valid href
    const href = await page.locator('a[aria-label="Open in new tab"]').getAttribute('href');
    expect(href).toContain('wikipedia.org');
  });

  test('stop button returns to home', async ({ page }) => {
    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    // Stop button appears while loading
    const stopBtn = page.locator('button[aria-label="Stop"]');
    if (await stopBtn.isVisible()) {
      await stopBtn.click({ force: true });
      await page.waitForTimeout(500);
      await expect(page.getByText('Prism AAC Browser')).toBeVisible();
    }
  });

  test('iframe sandbox does not include allow-popups-to-escape-sandbox', async ({ page }) => {
    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(2000);
    const iframe = page.locator('iframe[title="Web page"]');
    const sandbox = await iframe.getAttribute('sandbox');
    expect(sandbox).not.toContain('allow-popups-to-escape-sandbox');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
  });
});
