import { test, expect } from '@playwright/test';
import { openPreviewKeyboard } from './helpers/web-preview';
import { safeScreenshot } from './helpers/screenshot-validation';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OFFER = 'billing-handoff-fixture';
const DRAFT_KEY = 'prism-aac-signin-draft-v1';
const MESSAGE = 'help';
const IDENTITY_EMAIL = 'identity-outage@example.invalid';
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

for (const failure of ['network', 'server'] as const) {
  test(`${failure}: an unavailable identity check preserves the typed message through Settings and reload`, async ({ page }) => {
    const errors: string[] = [];
    let unavailable = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      sessionStorage.setItem('prism-greeting-dismissed', '1');
      localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
        language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
      }, version: 19 }));
    });
    await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
      ? route.continue() : route.abort());
    await page.route('**/api/**', route => route.abort());
    for (const endpoint of ['**/api/v1/prism-aac/session', '**/api/auth/session']) {
      await page.route(endpoint, route => {
        if (unavailable) return failure === 'network' ? route.abort() : route.fulfill({ status: 503, json: { error: 'Fixture identity unavailable' } });
        return route.fulfill({ json: endpoint.includes('/prism-aac/')
          ? { signed_in: true, email: IDENTITY_EMAIL, name: 'Identity fixture' }
          : { user: { email: IDENTITY_EMAIL } } });
      });
    }
    await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { id: ACCOUNT, plan: 'free', aac_plan: 'free' } }));
    await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => route.fulfill({ json: {
      userId: ACCOUNT, enabled: false, betaExempt: false, hasCloudAccess: false,
      channels: [], manageChannel: null, purchaseBlocked: true, transitionEndsAt: null, offer: {
        usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly', version: OFFER,
        monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month',
      },
    } }));
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await openPreviewKeyboard(page);
    for (const key of MESSAGE.toUpperCase()) await page.locator(`button[data-key="${key}"]`).click();
    await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Synalux Account/ }).click();
    await expect(page.getByText(IDENTITY_EMAIL, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close settings' }).click();
    unavailable = true;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Synalux Account/ }).click();
    await expect(page.getByTestId('synalux-signin')).toBeVisible();
    await expect(page.getByText(IDENTITY_EMAIL, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close settings' }).click();
    await safeScreenshot(page, test.info().outputPath(`${failure}-identity-reference.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'],
      criticalSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
    });
    await page.reload();
    await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
    await expect(page.locator('button[data-key="I"]')).toBeVisible();
    await safeScreenshot(page, test.info().outputPath(`${failure}-identity-retained.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'],
      criticalSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
    });
    expect(errors).toEqual([]);
  });
}

for (const operation of ['checkout', 'manage', 'storage-denied'] as const) {
  test(`${operation}: billing keeps the composed message with cloud preview disabled`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    const requests: unknown[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.info('[billing browser diagnostic]', message.text()); });
    await page.clock.install();
    await page.addInitScript(() => {
      sessionStorage.setItem('prism-greeting-dismissed', '1');
      localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
        language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
      }, version: 19 }));
    });
    await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
      ? route.continue() : route.abort());
    await page.route('**/api/**', route => route.abort());
    await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'billing@example.invalid' } } }));
    await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { id: ACCOUNT, plan: 'free', aac_plan: 'free' } }));
    await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { url: 'https://billing.stripe.com/' } });
      }
      return route.fulfill({ json: { userId: ACCOUNT, enabled: true, betaExempt: false,
        hasCloudAccess: operation === 'manage', purchaseBlocked: operation === 'manage',
        channels: operation === 'manage' ? ['stripe'] : [], manageChannel: operation === 'manage' ? 'stripe' : null,
        stripeTrialDays: 14, transitionEndsAt: null, offer: {
          usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly', version: OFFER,
          monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month',
        } } });
    });
    await page.route('**/api/v1/prism-aac/checkout', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { url: 'https://checkout.stripe.com/' } });
    });
    // The real navigation runs, but the provider document is fulfilled locally:
    // there is no Stripe connection, payment or production account mutation.
    await page.route(/^https:\/\/(?:checkout|billing)\.stripe\.com\/$/, route => route.fulfill({
      contentType: 'text/html', body: `<html><body><a href="${baseURL}/prism-aac">Return to communication</a></body></html>`,
    }));
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('web-preview-notice')).toHaveCount(0);
    await openPreviewKeyboard(page);
    for (const key of MESSAGE.toUpperCase()) await page.locator(`button[data-key="${key}"]`).click();
    await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
    await safeScreenshot(page, test.info().outputPath(`${operation}-reference.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'],
      criticalSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
    });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Synalux Account/ }).click();
    if (operation === 'storage-denied') await page.evaluate(key => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new Error('Fixture draft storage denied');
        return setItem.call(this, name, value);
      };
    }, DRAFT_KEY);
    await page.getByTestId('cloud-subscription-settings').getByRole('button', {
      name: operation === 'manage' ? 'Manage subscription' : /Start 14-day trial/,
    }).click();
    if (operation === 'storage-denied') {
      await expect(page.getByTestId('cloud-subscription-settings').getByRole('alert')).toContainText('temporarily unavailable');
      await expect(page).toHaveURL(/\/prism-aac$/);
    } else {
      await expect(page.getByRole('link', { name: 'Return to communication' })).toBeVisible();
      await page.clock.fastForward(59 * 60_000);
      await page.getByRole('link', { name: 'Return to communication' }).click();
      await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
      await expect(page.locator('button[data-key="I"]')).toBeVisible();
      // Force a new document as well as ordinary back navigation.
      await page.reload();
    }
    if (operation === 'storage-denied') await page.getByRole('button', { name: 'Close settings' }).click();
    await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
    await expect(page.locator('button[data-key="I"]')).toBeVisible();
    await safeScreenshot(page, test.info().outputPath(`${operation}-retained.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'],
      criticalSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
    });
    expect(requests).toHaveLength(1);
    if (operation !== 'manage') expect(requests[0]).toMatchObject({ expectedUserId: ACCOUNT, expectedOfferVersion: OFFER });
    else expect(requests[0]).toEqual({ action: 'manage' });
    if (operation !== 'storage-denied') expect(await page.evaluate(key => sessionStorage.getItem(key), DRAFT_KEY)).toBeNull();
    expect(errors).toEqual([]);
  });
}
