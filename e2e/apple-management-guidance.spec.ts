import { test, expect } from '@playwright/test';
import { openPreviewKeyboard } from './helpers/web-preview';
import { safeScreenshot } from './helpers/screenshot-validation';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const PRODUCT = 'ai.synalux.prismaac.cloud.monthly';
const MESSAGE = 'help';
const SANDBOX_GUIDANCE = "Apple does not support the subscription sheet on this Mac. Manage Sandbox subscriptions on an iPhone or iPad in Settings > Developer > Sandbox Apple Account > Manage. For local StoreKit tests, use Xcode's transaction manager.";

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

test('Mac Sandbox management guidance preserves the message and usable billing controls', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const navigations: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
  // The native routing tests exercise StoreKit's platform/environment decision.
  // Here the bridge reply is a fixture: this test covers the real client click,
  // callback/error handling and return to communication, without an Apple call.
  await page.addInitScript(({ product, guidance }) => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
    const host = window as unknown as {
      fixtureSubscriptionCalls: string[];
      prismSubscriptionResult: (reply: unknown) => void;
      prismNativeBridge: { signInWithApple: () => void; subscription: (request: { id: string; operation: string }) => void };
    };
    host.fixtureSubscriptionCalls = [];
    host.prismNativeBridge = { signInWithApple: () => {}, subscription: request => {
      host.fixtureSubscriptionCalls.push(request.operation);
      const reply = request.operation === 'manage'
        ? { id: request.id, error: guidance }
        : { id: request.id, result: request.operation === 'product'
          ? { id: product, displayPrice: '$4.99', introductoryOfferEligible: false }
          : { status: 'restored', transactions: [] } };
      queueMicrotask(() => host.prismSubscriptionResult(reply));
    } };
  }, { product: PRODUCT, guidance: SANDBOX_GUIDANCE });
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  await page.route('**/api/**', route => route.abort());
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'management-test@example.invalid' } } }));
  await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { id: ACCOUNT, plan: 'free', aac_plan: 'free' } }));
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
  await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => route.fulfill({ json: {
    userId: ACCOUNT, enabled: true, hasCloudAccess: true, betaExempt: false,
    transitionEndsAt: null, channels: ['apple'], manageChannel: 'apple', purchaseBlocked: true,
    offer: { usdMonthly: 4.99, appleProductId: PRODUCT, version: 'management-fixture',
      monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month' },
  } }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await openPreviewKeyboard(page);
  for (const key of MESSAGE.toUpperCase()) await page.locator(`button[data-key="${key}"]`).click();
  await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Synalux Account/ }).click();
  const panel = page.getByTestId('cloud-subscription-settings');
  const manage = panel.getByRole('button', { name: 'Manage subscription', exact: true });
  await expect(manage).toBeEnabled();
  await manage.scrollIntoViewIfNeeded();
  await safeScreenshot(page, test.info().outputPath('manage-ready.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=cloud-subscription-settings]'],
    criticalSelectors: ['[data-testid=cloud-subscription-settings] button:nth-of-type(2)'],
  });
  await manage.click();
  await expect(panel.getByRole('alert')).toHaveText(SANDBOX_GUIDANCE);
  await expect(panel).not.toContainText('Unable to Complete Request');
  await expect(manage).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Refresh cloud plan', exact: true })).toBeEnabled();
  await panel.getByRole('alert').scrollIntoViewIfNeeded();
  await safeScreenshot(page, test.info().outputPath('sandbox-guidance.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=cloud-subscription-settings] [role=alert]'],
    criticalSelectors: ['[data-testid=cloud-subscription-settings] [role=alert]'],
  });
  const operations = await page.evaluate(() => (window as unknown as { fixtureSubscriptionCalls: string[] }).fixtureSubscriptionCalls);
  expect(operations.filter(operation => operation === 'manage')).toHaveLength(1);
  expect(operations).not.toContain('purchase');
  expect([...new Set(navigations)]).toEqual([`${baseURL}/prism-aac`]);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByTestId('message-text')).toHaveText(MESSAGE);
  await expect(page.locator('button[data-key="I"]')).toBeEnabled();
  await safeScreenshot(page, test.info().outputPath('communication-retained.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'],
    criticalSelectors: ['[data-testid=message-text]', 'button[data-key="I"]'],
  });
  expect(errors).toEqual([]);
});
