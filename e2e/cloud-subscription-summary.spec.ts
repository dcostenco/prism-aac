import { test, expect } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

for (const channel of ['apple', 'stripe']) {
  test(`verified ${channel} subscription replaces the legacy Free account label`, async ({ page }) => {
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
    await page.route('**/api/auth/session', route => route.fulfill({ json: {
      user: { email: 'subscription-test@example.invalid', name: 'Subscription test' },
    } }));
    await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { plan: 'free', aac_plan: 'free' } }));
    await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
    await page.route('**/api/v1/prism-aac/billing', route => route.fulfill({ json: {
      userId: 'subscription-test', enabled: true, hasCloudAccess: true, betaExempt: false,
      transitionEndsAt: null, channels: [channel], manageChannel: channel, purchaseBlocked: true,
      offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly' },
    } }));
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Synalux Account/ }).click();
    const summary = page.getByTestId('subscription-summary');
    await expect(summary).toHaveCount(1);
    await expect(summary).toContainText('Cloud subscription · Active');
    await expect(page.getByText('Free', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Cloud access is active on your account.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage subscription', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Subscribe/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Refresh cloud plan', exact: true }).click();
    await expect(summary).toContainText('Cloud subscription · Active');
    await summary.scrollIntoViewIfNeeded();
    expect(runtimeErrors).toEqual([]);
    await safeScreenshot(page, test.info().outputPath(`${channel}-subscription-active.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=subscription-summary]'],
      // Check the readable label; rounded card corners belong to its parent
      // background and are not interactive/occluded content.
      criticalSelectors: ['[data-testid=subscription-summary] p'],
    });
  });
}
