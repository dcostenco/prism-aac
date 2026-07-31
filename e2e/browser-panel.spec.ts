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
    await expect(page.locator('button[aria-label="Home"]')).toBeVisible();
  });

  test('renders browser content with bookmarks on home', async ({ page }) => {
    await expect(page.locator('[data-testid="browser-content"]')).toBeVisible();
    await expect(page.getByText('Prism AAC Browser')).toBeVisible();
    await expect(page.locator('button[aria-label="Search"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Wikipedia"]')).toBeVisible();
  });

  test('renders AAC keyboard with Go button in browser mode', async ({ page }) => {
    const keyboardShell = page.locator('[data-testid="keyboard-shell"]');
    await expect(keyboardShell).toBeVisible();
    await expect(keyboardShell).not.toHaveClass(/aac-typing-keyboard-shell/);
    const goBtn = page.locator('button[aria-label="Go"]').last();
    await expect(goBtn).toBeVisible();
  });

  test('unshifted i remains lowercase in browser input mode', async ({ page }) => {
    await expect(page.getByTestId('shift-key')).toHaveAttribute('aria-label', 'Shift off');
    const iKey = page.locator('button[data-key="I"]');
    await expect(iKey).toHaveAttribute('data-display', 'i');
    await iKey.click();

    await expect(
      page.locator('[data-testid="browser-toolbar"] button[aria-label="Editing: i"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="browser-toolbar"] button[aria-label="Editing: I"]'),
    ).toHaveCount(0);
  });

  test('speak mode toggle switches Go to Speak', async ({ page }) => {
    const speakToggle = page.locator('button[aria-label="Switch to Speak mode"]');
    await expect(speakToggle).toBeVisible();
    await speakToggle.click({ force: true });
    await page.waitForTimeout(300);
    const speakBtn = page.locator('button[aria-label="Speak"]').or(page.locator('button:has-text("Speak")'));
    await expect(speakBtn.first()).toBeVisible();
  });

  test('emergency modal loads without crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const crashed = await page.locator('text=Error — Emergency AAC Mode').count();
    expect(crashed).toBe(0);
    await expect(page.locator('[data-testid="browser-toolbar"]')).toBeVisible();
  });

  test('back-to-AAC button shows confirmation dialog', async ({ page }) => {
    const aacBtn = page.locator('button[aria-label="Back to AAC Board"]');
    await expect(aacBtn).toBeVisible();
    await aacBtn.click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.getByText('Leave Browser?')).toBeVisible();
    await expect(page.getByText('Stay')).toBeVisible();
    await expect(page.getByText('Leave')).toBeVisible();
    // Cancel — should stay on browser
    await page.getByText('Stay').click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.getByText('Leave Browser?')).not.toBeVisible();
    await expect(page.locator('[data-testid="browser-toolbar"]')).toBeVisible();
  });

  test('bookmarks toggle shows and hides bookmark bar', async ({ page }) => {
    const bookmarkBtn = page.locator('button[aria-label="Bookmarks"]');
    await bookmarkBtn.click({ force: true });
    await page.waitForTimeout(500);
    const toolbarSearch = page.locator('[data-testid="browser-toolbar"] button[aria-label*="Search"]');
    await expect(toolbarSearch.first()).toBeVisible();

    await bookmarkBtn.click({ force: true });
    await page.waitForTimeout(500);
    const bookmarkBarButtons = page.locator('[data-testid="browser-toolbar"] .overflow-x-auto button');
    await expect(bookmarkBarButtons).toHaveCount(0);
  });

  test('Go button is always visible and disabled when no text', async ({ page }) => {
    const goBtn = page.locator('button[aria-label="Go"]').first();
    await expect(goBtn).toBeVisible();
    await expect(goBtn).toBeDisabled();
  });

  test('Go button enables when text is typed', async ({ page }) => {
    await page.keyboard.type('hello');
    await page.waitForTimeout(500);
    const goBtn = page.locator('button[aria-label="Go"]').first();
    await expect(goBtn).toBeEnabled();
  });

  test('typing text shows site suggestions in browser prediction bar', async ({ page }) => {
    await page.keyboard.type('wik');
    await page.waitForTimeout(1000);
    const predBar = page.locator('[data-testid="browser-prediction-bar"]');
    await expect(predBar).toBeVisible();
    const tiles = predBar.locator('button');
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('browser prediction bar does NOT show AAC word predictions', async ({ page }) => {
    // Must not have AAC prediction bar at all
    await expect(page.locator('[data-testid="prediction-bar"]')).toHaveCount(0);
    // Must have browser prediction bar
    await expect(page.locator('[data-testid="browser-prediction-bar"]')).toBeVisible();
  });

  test('browserMode gating: typing does not contaminate AAC prediction store', async ({ page }) => {
    // Type a URL-like string
    await page.keyboard.type('youtube');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    // Verify the word is NOT learned into prediction store via localStorage
    const predStore = await page.evaluate(() => {
      const raw = localStorage.getItem('prism-aac-predictions');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const wf = parsed?.state?.wordFreq ?? {};
      return wf['youtube'] ?? null;
    });
    expect(predStore).toBeNull();
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

  test('keyboard collapses after navigation and restores via button', async ({ page }) => {
    // Use search (DuckDuckGo HTML — embeddable) to avoid network-dependent iframe load
    await page.keyboard.type('test');
    await page.locator('button[aria-label="Go"]').first().click({ force: true });
    // Wait for iframe load or timeout to trigger collapse (setLoaded or setError both collapse)
    await page.waitForTimeout(8000);
    // Keyboard should be collapsed
    await expect(page.locator('[data-testid="keyboard-shell"]')).toHaveCount(0);
    // Restore button should be visible (bottom-left)
    const restoreBtn = page.locator('button[aria-label="Show keyboard"]');
    await expect(restoreBtn).toBeVisible();
    // Tap to restore
    await restoreBtn.click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="keyboard-shell"]')).toBeVisible();
  });

  test('pin button appears when browsing and toggles pin/unpin', async ({ page }) => {
    // On home — no pin button
    await expect(page.locator('button[aria-label="Pin this site"]')).toHaveCount(0);

    // Navigate to Wikipedia (pinned by default) — should show ★
    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(1000);
    const unpinBtn = page.locator('button[aria-label="Unpin this site"]');
    await expect(unpinBtn).toBeVisible();

    // Unpin — should switch to ☆
    await unpinBtn.click({ force: true });
    await page.waitForTimeout(300);
    const pinBtn = page.locator('button[aria-label="Pin this site"]');
    await expect(pinBtn).toBeVisible();

    // Re-pin — should switch back to ★
    await pinBtn.click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('button[aria-label="Unpin this site"]')).toBeVisible();
  });

  test('refresh button appears after navigation and open-in-tab is visible', async ({ page }) => {
    await expect(page.locator('button[aria-label="Refresh"]')).not.toBeVisible();
    await expect(page.locator('a[aria-label="Open in new tab"]')).not.toBeVisible();

    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('button[aria-label="Refresh"]')).toBeVisible();
    await expect(page.locator('a[aria-label="Open in new tab"]')).toBeVisible();

    const href = await page.locator('a[aria-label="Open in new tab"]').getAttribute('href');
    expect(href).toContain('wikipedia.org');
  });

  test('navigating and returning home never shows error alert', async ({ page }) => {
    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(2000);
    await page.locator('button[aria-label="Home"]').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.getByText('Prism AAC Browser')).toBeVisible();
    await expect(page.locator('[data-testid="browser-content"][role="alert"]')).toHaveCount(0);
  });

  test('iframe sandbox is exactly the expected token set', async ({ page }) => {
    await page.locator('button[aria-label="Wikipedia"]').click({ force: true });
    await page.waitForTimeout(2000);
    const iframe = page.locator('iframe[title="Web page"]');
    const sandbox = await iframe.getAttribute('sandbox');
    expect(sandbox).toBe('allow-scripts allow-same-origin allow-forms allow-popups');
  });

  test('speakMode: Enter speaks text and does not navigate', async ({ page }) => {
    // Enable speak mode
    await page.locator('button[aria-label="Switch to Speak mode"]').click({ force: true });
    await page.waitForTimeout(300);
    // Type a phrase
    await page.keyboard.type('I want water');
    await page.waitForTimeout(300);
    // Press Enter — should NOT navigate (no iframe should appear)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Should still be on home screen (not navigated)
    await expect(page.getByText('Prism AAC Browser')).toBeVisible();
    await expect(page.locator('iframe[title="Web page"]')).toHaveCount(0);
  });

  test('speakMode: shows word prediction bar instead of site suggestions', async ({ page }) => {
    // Before toggling — browser prediction bar visible
    await expect(page.locator('[data-testid="browser-prediction-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-bar"]')).toHaveCount(0);
    // Enable speak mode
    await page.locator('button[aria-label="Switch to Speak mode"]').click({ force: true });
    await page.waitForTimeout(500);
    // Word prediction bar should appear, browser prediction bar should be gone
    await expect(page.locator('[data-testid="prediction-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="browser-prediction-bar"]')).toHaveCount(0);
    // Toggle back — browser predictions return
    await page.locator('button[aria-label="Switch to Go mode"]').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="browser-prediction-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-bar"]')).toHaveCount(0);
  });

  test('URL bar shows typed text as composition surface', async ({ page }) => {
    await page.keyboard.type('test query');
    await page.waitForTimeout(300);
    const urlBar = page.locator('[data-testid="browser-toolbar"] button[aria-label*="Editing"]');
    await expect(urlBar).toBeVisible();
    const text = await urlBar.textContent();
    expect(text).toContain('test query');
  });

  test('search uses embeddable engine (not google.com)', async ({ page }) => {
    await page.keyboard.type('hello world');
    await page.locator('button[aria-label="Go"]').first().click({ force: true });
    await page.waitForTimeout(500);
    const iframe = page.locator('iframe[title="Web page"]');
    const src = await iframe.getAttribute('src');
    expect(src).toContain('duckduckgo.com');
    expect(src).not.toContain('google.com');
  });
});
