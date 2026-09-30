import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 1000 } });

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

test('guest typing keeps local correction available without calling the authenticated portal route', async ({ page }) => {
  let authChecks = 0;
  let portalCorrectionRequests = 0;

  await page.route('**/api/auth/session', async (route) => {
    authChecks++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('http://localhost:11434/**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/v1/text/correct', async (route) => {
    portalCorrectionRequests++;
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' });
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => authChecks, { timeout: 10_000 }).toBeGreaterThan(0);

  const key = (value: string) => page.locator(
    `[data-scan-group="keyboard"] button[data-key="${value}"]`,
  ).first();
  if (!await key('H').isVisible().catch(() => false)) {
    await page.getByTestId('kb-cycle-btn').click();
  }
  await expect(key('H')).toBeVisible();
  await key('H').click();
  await key('W').click();
  await expect(page.getByTestId('message-text')).toContainText(/hw/i);

  // MessageBar debounces correction for 400 ms; allow the local probe and
  // correction decision to finish before asserting the portal stayed idle.
  await page.waitForTimeout(1_200);
  expect(portalCorrectionRequests).toBe(0);
});

test('signed-in typing retains portal correction fallback', async ({ page }) => {
  let authChecks = 0;
  let roleChecks = 0;
  let portalCorrectionRequests = 0;

  await page.route('**/api/auth/session', async (route) => {
    authChecks++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email: 'aac-test@example.com', name: 'AAC Test' } }),
    });
  });
  await page.route('**/api/v1/roles/me', async (route) => {
    roleChecks++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'free', is_platform_admin: false }),
    });
  });
  await page.route('http://localhost:11434/**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/v1/text/correct', async (route) => {
    portalCorrectionRequests++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ corrected: 'how are you', original: 'HW', changed: true }),
    });
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => authChecks, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(() => roleChecks, { timeout: 10_000 }).toBeGreaterThan(0);

  const key = (value: string) => page.locator(
    `[data-scan-group="keyboard"] button[data-key="${value}"]`,
  ).first();
  if (!await key('H').isVisible().catch(() => false)) {
    await page.getByTestId('kb-cycle-btn').click();
  }
  await key('H').click();
  await key('W').click();

  await expect(page.getByTestId('autocorrect-suggestion')).toContainText(/how are you/i);
  expect(portalCorrectionRequests).toBe(1);
});
