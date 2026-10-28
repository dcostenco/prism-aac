import { test, expect } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

/**
 * An emergency phrase spoken with no emergency contact set up: the countdown
 * runs, nobody is called (never 911 or any emergency number), and the screen
 * says so. Every link the app opens is recorded to prove no call was placed.
 */
type OpenedWindow = Window & { __opened: string[] };

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  await page.route('**/api/**', route => route.abort());
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({
    json: { state: 'signed_in', remainingMs: 0 }, headers: { 'Cache-Control': 'no-store' },
  }));
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
    const opened: string[] = [];
    (window as unknown as OpenedWindow).__opened = opened;
    window.open = ((url?: string | URL) => { opened.push(String(url)); return null; }) as typeof window.open;
    Object.defineProperty(window.speechSynthesis, 'speak', { configurable: true, value: (utterance: SpeechSynthesisUtterance) => {
      queueMicrotask(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent));
    } });
  });
});

test('an emergency phrase with no contact set up calls no one and says so', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('message-text')).toBeVisible();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.type("I can't breathe");
  await expect(page.getByTestId('message-text')).toHaveText("I can't breathe");
  await page.locator('.aac-speak').first().click();

  await expect(page.getByRole('alertdialog')).toBeVisible();
  const notSent = page.getByTestId('emergency-not-sent');
  await expect(notSent).toBeVisible({ timeout: 25_000 });
  await expect(notSent).toContainText('Alert not sent');
  await expect(notSent).toContainText('No one was called: no emergency contact is set up.');
  const calls = await page.evaluate(() => (window as unknown as OpenedWindow).__opened.filter(u => u.startsWith('tel:')));
  expect(calls, 'no call placed, to anyone').toEqual([]);
  const done = page.getByRole('button', { name: 'Done' });
  const box = (await done.boundingBox())!;
  expect(box.height, 'Done is a 44px touch target').toBeGreaterThanOrEqual(44);

  await safeScreenshot(page, info.outputPath('emergency-not-sent.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=emergency-not-sent]'],
  });
  await done.click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  expect(errors).toEqual([]);
});
