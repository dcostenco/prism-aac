import { test, expect } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

test('one-minute web preview blocks the full app and restores the composed message after account verification', async ({ page }) => {
  let access: 'preview' | 'sign_in_required' | 'signed_in' = 'preview';
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.clock.install();
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  });
  await page.route('**/api/**', route => route.abort());
  await page.route('http://localhost:11434/**', route => route.abort());
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({
    json: { state: access, remainingMs: access === 'preview' ? 60_000 : 0 },
    headers: { 'Cache-Control': 'no-store' },
  }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-notice')).toBeVisible();
  await page.locator('button[data-key="I"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('I');
  const savedText = 'I';
  expect(runtimeErrors).toEqual([]);
  await safeScreenshot(page, test.info().outputPath('web-preview-active.png'), { expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'] });
  await page.clock.fastForward(61_000);
  access = 'sign_in_required';
  await expect(page.getByTestId('web-signin-gate')).toBeVisible();
  await expect(page.locator('button[data-key="I"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to Google' })).toBeFocused();
  expect(runtimeErrors).toEqual([]);
  await safeScreenshot(page, test.info().outputPath('web-preview-expired.png'), { expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=web-signin-gate]'] });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-signin-gate')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in to continue using Prism AAC' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to Google' })).toBeEnabled();
  await expect(page.locator('button[data-key="I"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('prism-aac-signin-draft-v1')!).text)).toBe(savedText);

  // Verify real navigation to the existing sign-in entry point; the provider
  // login itself is outside this browser fixture test.
  await page.route('**/auth?callbackUrl=**', route => route.fulfill({
    contentType: 'text/html', body: '<main>Test authentication entry point</main>',
  }));
  await page.getByRole('button', { name: 'Continue to Google' }).press('Enter');
  await expect(page).toHaveURL(/\/auth\?callbackUrl=/);
  expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe('/prism-aac');

  access = 'signed_in';
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByTestId('message-text')).toHaveText(savedText);
  expect(await page.evaluate(() => sessionStorage.getItem('prism-aac-signin-draft-v1'))).toBeNull();
  await expect(page.getByTestId('web-signin-gate')).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
  await safeScreenshot(page, test.info().outputPath('web-signed-in-message-restored.png'), { expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'] });
});

test('native app does not acquire the web registration gate', async ({ page }) => {
  let accessChecks = 0;
  await page.addInitScript(() => {
    (window as any).prismNativeBridge = { signInWithApple: () => {} };
    sessionStorage.setItem('prism-greeting-dismissed', '1');
  });
  await page.route('**/api/**', route => route.abort());
  await page.route('**/api/v1/prism-aac/access', route => {
    accessChecks++; return route.fulfill({ json: { state: 'sign_in_required', remainingMs: 0 } });
  });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByTestId('web-signin-gate')).toHaveCount(0);
  expect(accessChecks).toBe(0);
});


test('verified communication survives an access-service outage and reload', async ({ page }) => {
  let offline = false;
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  });
  await page.route('**/api/**', route => route.abort());
  await page.route('http://localhost:11434/**', route => route.abort());
  await page.route('**/api/v1/prism-aac/access', route => offline ? route.abort()
    : route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.locator('button[data-key="I"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('I');
  offline = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('web-signin-gate')).toHaveCount(0);
  await expect(page.getByTestId('message-text')).toHaveText('I');
  const box = await page.getByTestId('message-text').boundingBox();
  expect(box?.height).toBeGreaterThan(0);
  await safeScreenshot(page, test.info().outputPath('verified-communication-outage.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByTestId('web-signin-gate')).toHaveCount(0);
  await page.locator('button[data-key="I"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('I');
  expect(runtimeErrors).toEqual([]);
  await safeScreenshot(page, test.info().outputPath('verified-communication-reloaded.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
  });
});
