import { test, expect } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const PRODUCT = 'ai.synalux.prismaac.cloud.monthly';
const ORIGINAL_END = '2099-11-01T12:34:00Z';
const baseline = process.env.AAC_BILLING_BASELINE === '1';
const cases = baseline ? ['baseline'] : process.env.AAC_BILLING_LOCALE_CASES === '1'
  ? ['web-trial-de', 'web-trial-ar']
  : ['web-trial', 'web-paid', 'web-unknown', 'apple-trial', 'apple-paid', 'apple-unknown', 'trial-active', 'trial-cancelled'];

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

for (const scenario of cases) {
  test(`${scenario}: review billing terms before confirming a subscription`, async ({ page }) => {
    const errors: string[] = [];
    let checkouts = 0;
    let nativePurchases = 0;
    page.on('pageerror', error => errors.push(error.message));
    const native = scenario.startsWith('apple');
    const subscribed = scenario.startsWith('trial-');
    const eligible = scenario.startsWith('web-trial') || scenario === 'apple-trial' || baseline;
    const language = scenario.endsWith('-de') ? 'de' : scenario.endsWith('-ar') ? 'ar' : 'en';
    await page.addInitScript(({ native, eligible, unknown, account, product, language }) => {
      sessionStorage.setItem('prism-greeting-dismissed', '1');
      localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
        language, outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
      }, version: 19 }));
      if (native) {
        const host = window as unknown as {
          prismNativeBridge: { signInWithApple: () => void; subscription: (request: { id: string; operation: string; accountToken?: string }) => void };
          prismSubscriptionResult: (value: unknown) => void;
        };
        host.prismNativeBridge = { signInWithApple: () => {}, subscription: request => {
          if (request.operation === 'purchase') window.dispatchEvent(new Event('fixture-purchase'));
          if (request.operation === 'product' && request.accountToken !== account) throw new Error('Wrong AAC product account');
          const result = request.operation === 'product'
            ? { id: product, displayPrice: '€5.99', ...(!unknown ? { introductoryOfferEligible: eligible, introductoryTrialDays: 14 } : {}) }
            : request.operation === 'purchase' ? { status: 'cancelled' } : { status: 'restored', transactions: [] };
          queueMicrotask(() => host.prismSubscriptionResult({ id: request.id, result }));
        } };
      }
    }, { native, eligible, unknown: scenario.endsWith('unknown'), account: ACCOUNT, product: PRODUCT, language });
    await page.route('**/api/**', route => route.abort());
    await page.route('http://localhost:11434/**', route => route.abort());
    await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'trial-test@example.invalid', name: 'Trial test' } } }));
    await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { plan: 'free', aac_plan: 'free' } }));
    await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
    await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => route.fulfill({ json: {
      userId: ACCOUNT, enabled: true, hasCloudAccess: subscribed, betaExempt: false,
      transitionEndsAt: null, channels: subscribed ? ['stripe'] : [], manageChannel: subscribed ? 'stripe' : null,
      purchaseBlocked: subscribed, ...(!scenario.endsWith('unknown') ? { stripeTrialDays: eligible ? 14 : 0 } : {}),
      stripeTrial: subscribed ? { endsAt: ORIGINAL_END, cancelsAtEnd: scenario === 'trial-cancelled' } : null,
      offer: { usdMonthly: 4.99, appleProductId: PRODUCT, version: 'test-offer-v1', monthlySpeechCharacters: 50000,
        monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month' },
    } }));
    await page.route('**/api/v1/prism-aac/checkout', async route => {
      checkouts++;
      expect(route.request().postDataJSON()).toMatchObject({ expectedUserId: ACCOUNT, expectedOfferVersion: 'test-offer-v1' });
      await route.fulfill({ status: 503, json: { error: 'Checkout fixture: no purchase was confirmed.' } });
    });
    await page.route('**/api/v1/prism-aac/billing/apple', route => route.fulfill({ json: { accountToken: ACCOUNT } }));
    await page.exposeFunction('fixturePurchaseObserved', () => { nativePurchases++; });
    await page.addInitScript(() => window.addEventListener('fixture-purchase', () => {
      void (window as unknown as { fixturePurchaseObserved: () => Promise<void> }).fixturePurchaseObserved();
    }));
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    const settingsName = language === 'de' ? 'Einstellungen' : language === 'ar' ? 'الإعدادات' : 'Settings';
    const accountName = language === 'de' ? /Synalux/ : language === 'ar' ? /Synalux/ : /Synalux Account/;
    await page.getByRole('button', { name: settingsName, exact: true }).click();
    await page.getByRole('button', { name: accountName }).click();
    const panel = page.getByTestId('cloud-subscription-settings');
    if (subscribed) {
      const date = page.getByTestId('cloud-trial-date');
      await expect(date).toContainText('2099');
      await expect(page.getByRole('button', { name: /Start 14-day|Subscribe/ })).toHaveCount(0);
      if (scenario === 'trial-cancelled') await expect(date).toContainText('Cancellation is scheduled');
      await date.scrollIntoViewIfNeeded();
      await safeScreenshot(page, test.info().outputPath(`${scenario}.png`), {
        expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=cloud-trial-date]'],
        criticalSelectors: ['[data-testid=cloud-trial-date]'],
      });
      await page.getByRole('button', { name: 'Refresh cloud plan', exact: true }).click();
      await expect(date).toContainText('2099');
    } else {
      const button = language === 'en'
        ? panel.getByRole('button', { name: eligible && !baseline ? /Start 14-day trial/ : /Subscribe/ }).first()
        : panel.getByRole('button').first();
      await expect(button).toBeVisible();
      if (!baseline && language === 'en') {
        await expect(page.getByTestId('cloud-offer-terms')).toContainText('first charge date before you confirm');
        await expect(page.getByTestId('cloud-offer-terms')).toContainText(native ? 'at least 24 hours' : 'Payment details are required');
        await expect(panel).not.toContainText('Payment is charged to your Apple Account when you confirm');
      }
      await expect(button).toContainText(native ? '€5.99' : 'US$4.99');
      if (!eligible) await expect(panel).not.toContainText('Eligible accounts can start');
      expect(checkouts).toBe(0); expect(nativePurchases).toBe(0);
      await button.scrollIntoViewIfNeeded();
      const bounds = await button.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await safeScreenshot(page, test.info().outputPath(`${scenario}.png`), {
        expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=cloud-subscription-settings]'],
        criticalSelectors: ['[data-testid=cloud-subscription-settings] button:first-of-type'],
      });
      if (!baseline) {
        await button.click();
        if (native) {
          await expect(panel).toContainText('Purchase cancelled');
          expect(nativePurchases).toBe(1); expect(checkouts).toBe(0);
        } else {
          await expect(panel).toContainText('Checkout fixture: no purchase was confirmed.');
          expect(checkouts).toBe(1); expect(nativePurchases).toBe(0);
        }
        await page.reload();
        await page.getByRole('button', { name: settingsName, exact: true }).click();
        await page.getByRole('button', { name: accountName }).click();
        if (language === 'en') await expect(page.getByTestId('subscription-summary')).toContainText('Free');
        else await expect(panel.getByRole('button').first()).toContainText('14');
      }
    }
    expect(errors).toEqual([]);
  });
}
