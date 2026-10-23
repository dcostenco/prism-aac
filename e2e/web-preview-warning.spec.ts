import { test, expect } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';
import { openPreviewKeyboard } from './helpers/web-preview';

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  await page.route('**/api/**', route => route.abort());
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    if (!localStorage.getItem('prism-aac-settings')) localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  });
});

test('resumed preview warns immediately and reload retains the shorter deadline without blocking the board', async ({ page }) => {
  let remainingMs = 90_000; await page.clock.install();
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'preview', remainingMs } }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-warning')).toContainText('Cloud preview ends soon.');
  await openPreviewKeyboard(page); await page.locator('button[data-key="I"]').click();
  remainingMs = 50_000; await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('message-text')).toHaveText('I'); await expect(page.getByRole('timer')).toContainText('0:50');
  await page.clock.fastForward(51_000);
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'sign_in_required');
  await page.locator('button[data-key="I"]').click(); await expect(page.getByTestId('message-text')).toHaveText(/^ii$/i);
});

test('an expired server decision preserves the board without granting a new preview', async ({ page }) => {
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'preview', remainingMs: 0 } }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'sign_in_required');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await openPreviewKeyboard(page); await page.locator('button[data-key="I"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('I');
});

for (const language of ['de', 'ar']) {
  test(`warning remains usable in ${language}`, async ({ page }) => {
    await page.addInitScript(lang => {
      localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
        language: lang, outputLanguage: lang, aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
      }, version: 19 }));
    }, language);
    await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'preview', remainingMs: 90_000 } }));
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    const notice = page.getByTestId('web-preview-notice');
    await expect(notice).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    await expect(page.getByTestId('web-preview-warning')).not.toBeEmpty();
    // Use the visible mode control without assuming the active alphabet.
    const keyboard = page.locator('[data-scan-group="keyboard"]');
    if (!await keyboard.isVisible()) await page.getByTestId('kb-cycle-btn').click();
    await expect(keyboard).toBeVisible();
    await keyboard.locator('button[data-key]').first().click();
    await expect(page.getByTestId('message-empty-prompt')).toHaveCount(0);
    const box = await notice.boundingBox(); expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
    await safeScreenshot(page, test.info().outputPath(`free-core-warning-${language}.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=web-preview-warning]', '[data-testid=message-text]'],
      criticalSelectors: ['[data-testid=web-preview-warning]', '[data-testid=message-text]', '[data-key-row="controls"] .aac-speak'],
    });
  });
}
