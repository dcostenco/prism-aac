import { test, expect } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

// One click signs out: the session DELETE ends the Synalux sign-in too, so no
// Synalux sign-out page (with its own confirmation) opens and the next check
// finds nobody signed in.
test('Sign out takes one click and opens no second page', async ({ page, context }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const extraPages: string[] = [];
  context.on('page', p => extraPages.push(p.url()));
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  });
  let signedIn = true;
  let deletes = 0;
  await page.route('**/api/**', route => route.abort());
  await page.route('http://localhost:11434/**', route => route.abort());
  await page.route('**/api/v1/prism-aac/session', route => {
    if (route.request().method() === 'DELETE') {
      deletes += 1;
      signedIn = false;
      return route.fulfill({ json: { signed_in: false } });
    }
    return signedIn
      ? route.fulfill({ json: { signed_in: true, email: 'signout-test@example.invalid', name: 'Sign-out test' } })
      : route.fulfill({ status: 401, json: { signed_in: false } });
  });
  await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { aac_plan: 'free', needs_onboarding: true } }));
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
  await page.route('**/api/v1/prism-aac/billing', route => route.fulfill({ json: {
    userId: 'signout-test', enabled: true, hasCloudAccess: false, includedWithSynalux: false, betaExempt: false,
    transitionEndsAt: null, channels: [], manageChannel: null, purchaseBlocked: false,
    offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly', version: 'test-offer-v1',
      monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month' },
  } }));

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Synalux Account/ }).click();
  await expect(page.getByText('signout-test@example.invalid')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('signout-test@example.invalid')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  expect(deletes).toBe(1);
  expect(extraPages).toEqual([]);
  expect(page.url()).toContain('/prism-aac');
  expect(runtimeErrors).toEqual([]);
  const account = page.getByRole('button', { name: /Synalux Account/ });
  await account.scrollIntoViewIfNeeded();
  await safeScreenshot(page, test.info().outputPath('signed-out.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[role=dialog], body'],
  });
});
