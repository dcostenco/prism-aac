import { test, expect, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

/** A portal that answers Sign out with `body`, then reports nobody signed in. */
async function signedInPortal(page: Page, deleteBody: Record<string, unknown>) {
  const state = { signedIn: true, deletes: 0, signOutPage: '' };
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  });
  await page.route('**/api/**', route => route.abort());
  await page.route('http://localhost:11434/**', route => route.abort());
  await page.route('**/api/v1/prism-aac/session', route => {
    if (route.request().method() === 'DELETE') {
      state.deletes += 1;
      state.signedIn = false;
      return route.fulfill({ json: deleteBody });
    }
    return state.signedIn
      ? route.fulfill({ json: { signed_in: true, email: 'signout-test@example.invalid', name: 'Sign-out test' } })
      : route.fulfill({ status: 401, json: { signed_in: false } });
  });
  await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { aac_plan: 'free', needs_onboarding: true } }));
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
  await page.route(/\/api\/v1\/prism-aac\/billing(?:\?.*)?$/, route => route.fulfill({ json: {
    userId: 'signout-test', enabled: true, hasCloudAccess: false, includedWithSynalux: false, betaExempt: false,
    transitionEndsAt: null, channels: [], manageChannel: null, purchaseBlocked: false,
    offer: { usdMonthly: 4.99, appleProductId: 'ai.synalux.prismaac.cloud.monthly', version: 'test-offer-v1',
      monthlySpeechCharacters: 50000, monthlyAiRequests: 100, allowanceReset: 'utc_calendar_month' },
  } }));
  await page.route('**/api/auth/signout**', route => {
    state.signOutPage = route.request().url();
    return route.fulfill({ contentType: 'text/html', body: '<p>Synalux sign-out page</p>' });
  });
  return state;
}

async function openAccount(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Synalux Account/ }).click();
}

// One click signs out: the portal ends the Synalux sign-in with the AAC one and
// says so, so no Synalux sign-out page (with its own confirmation) opens and the
// next check finds nobody signed in.
test('Sign out takes one click and opens no second page', async ({ page, context }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const extraPages: string[] = [];
  context.on('page', p => extraPages.push(p.url()));
  const portal = await signedInPortal(page, { signed_in: false, portal_signed_out: true });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await openAccount(page);
  await expect(page.getByText('signout-test@example.invalid')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('signout-test@example.invalid')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  expect(portal.deletes).toBe(1);
  expect(portal.signOutPage).toBe('');
  expect(extraPages).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  await page.getByRole('button', { name: /Synalux Account/ }).scrollIntoViewIfNeeded();
  await safeScreenshot(page, test.info().outputPath('signed-out.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[role=dialog], body'],
  });

  // A fresh load asks the portal again and stays signed out.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openAccount(page);
  await expect(page.getByText('Sign in with Synalux', { exact: true })).toBeVisible();
  await expect(page.getByText('signout-test@example.invalid')).toHaveCount(0);
});

// A portal that ended only the AAC sign-in (no marker) leaves the Synalux
// sign-in alive, so the app hands over to the Synalux sign-out page.
test('falls back to the Synalux sign-out page when the portal does not confirm both sign-ins ended', async ({ page }) => {
  const portal = await signedInPortal(page, { signed_in: false });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect.poll(() => portal.signOutPage).toContain('/api/auth/signout');
  expect(portal.deletes).toBe(1);
});
