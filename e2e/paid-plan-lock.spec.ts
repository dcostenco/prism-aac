import { test, expect, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

/**
 * Paid-plan lock (build flag NEXT_PUBLIC_AAC_PAID_ONLY_LOCK=1). Every state a
 * user can be locked in is captured: an expired account in a short, a long and
 * a right-to-left language, a signed-out device, and the Emergency alert opened
 * from the lock, which must draw above it and take the pointer.
 */
test.skip(process.env.AAC_PAID_NOTICES_E2E !== '1', 'needs a build with NEXT_PUBLIC_AAC_PAID_ONLY_LOCK=1');

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
type Case = { name: string; language: 'en' | 'de' | 'ar'; signedIn: boolean; emergency?: boolean };
const CASES: Case[] = [
  { name: 'locked-en', language: 'en', signedIn: true },
  { name: 'locked-de', language: 'de', signedIn: true },
  { name: 'locked-ar', language: 'ar', signedIn: true },
  { name: 'signed-out-en', language: 'en', signedIn: false },
  { name: 'emergency-over-lock', language: 'en', signedIn: true, emergency: true },
];

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* already closed */ }
  try { await context.close(); } catch { /* already closed */ }
});

async function setUp(page: Page, c: Case) {
  await page.addInitScript(({ language }) => {
    // Record every link the app opens, so a test can prove no call was placed.
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = ((url?: string | URL) => { opened.push(String(url)); return null; }) as typeof window.open;
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language, outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  }, { language: c.language });
  await page.route('**/api/**', route => route.abort());
  await page.route('http://localhost:11434/**', route => route.abort());
  await page.route('**/api/auth/session', route => route.fulfill({ json: c.signedIn
    ? { user: { email: 'lock-test@example.invalid', name: 'Lock test' } } : {} }));
  await page.route('**/api/v1/roles/me', route => c.signedIn
    ? route.fulfill({ json: { plan: 'free', aac_plan: 'free' } }) : route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: c.signedIn
    ? { state: 'signed_in', remainingMs: 0, paidPlan: true, entitlement: { state: 'expired', accessUntil: null, policyVersion: '2026-10-27-v1' } }
    : { state: 'sign_in_required', remainingMs: 0, paidPlan: true } }));
  await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => route.fulfill({ json: {
    userId: ACCOUNT, enabled: true, hasCloudAccess: false, betaExempt: false, transitionEndsAt: null,
    channels: [], manageChannel: null, purchaseBlocked: false, stripeTrialDays: 14, stripeTrial: null,
    offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly', version: 'test-offer-v1',
      monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month' },
  } }));
}

for (const c of CASES) {
  test(`${c.name}: the lock covers the board and keeps safety in reach`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await setUp(page, c);
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    const lock = page.getByTestId('aac-paid-lock');
    await expect(lock).toBeVisible();
    const viewport = page.viewportSize()!;
    const box = (await lock.boundingBox())!;
    expect(box.x, 'lock covers the screen').toBeLessThanOrEqual(0);
    expect(box.width, 'lock covers the screen').toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box.height, 'lock covers the screen').toBeGreaterThanOrEqual(viewport.height - 1);
    const covered = await page.evaluate(() => {
      const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return Boolean(hit?.closest('[data-testid="aac-paid-lock"]'));
    });
    expect(covered, 'the board is covered').toBe(true);
    if (c.language === 'ar') await expect(lock).toHaveAttribute('dir', 'rtl');
    if (c.signedIn) await expect(page.getByTestId('cloud-subscription-settings')).toBeVisible();
    else await expect(page.getByTestId('aac-lock-sign-in')).toBeVisible();
    const emergency = page.getByTestId('aac-lock-emergency');
    await expect(emergency).toBeVisible();
    const button = (await emergency.boundingBox())!;
    expect(button.y, 'Emergency is on screen without scrolling').toBeGreaterThanOrEqual(0);
    expect(button.y + button.height, 'Emergency is on screen without scrolling').toBeLessThanOrEqual(viewport.height);
    for (const target of await lock.locator('button, a[href]').all()) {
      if (!await target.isVisible()) continue;
      const rect = (await target.boundingBox())!;
      expect(rect.height, `touch target height: ${await target.textContent()}`).toBeGreaterThanOrEqual(44);
    }
    const overflow = await lock.evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow, 'no sideways overflow').toBeLessThanOrEqual(0);

    if (c.emergency) {
      await emergency.click();
      // The app's own emergency countdown, mounted beneath the lock.
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      const onTop = await page.evaluate(() => {
        const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        return Boolean(hit && !hit.closest('[data-testid="aac-paid-lock"]'));
      });
      expect(onTop, 'the emergency alert draws above the lock').toBe(true);
      // No contact is set up: when the countdown ends, no one is called, not
      // even emergency services, and the screen says so.
      const notSent = page.getByTestId('emergency-not-sent');
      await expect(notSent).toBeVisible({ timeout: 20_000 });
      await expect(notSent).toContainText('No one was called');
      const calls = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.filter(u => u.startsWith('tel:')));
      expect(calls, 'no call placed').toEqual([]);
    }
    await safeScreenshot(page, info.outputPath(`${c.name}.png`), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=aac-paid-lock]'],
    });
    expect(errors).toEqual([]);
  });
}
