import { test, expect, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

/**
 * Paid-plan notices above the board, shown whenever the server's paid-only policy is on.
 * Every state a signed-in user can see is captured: countdown collapsed and
 * expanded in a short, a long and a right-to-left language, the payment-failed
 * grace, and a paid account (no bar). Each asserts the bar's rendered height
 * against its design cap, that it never overflows sideways, and that the board
 * keeps the rest of the screen.
 */
const DAY = 86_400_000;
// Caps follow the design: text plus one row of 44px targets (ACCESSIBILITY.md).
// Phones wrap the text to two lines; wider screens fit one row.
type Case = { name: string; state: string; days: number; language: 'en' | 'de' | 'ar'; expand?: boolean; testId?: string; cap?: { phone: number; wide: number } };
const ROW = { phone: 112, wide: 64 };
const CASES: Case[] = [
  { name: 'countdown-en', state: 'pre_cutover_free', days: 30, language: 'en', testId: 'aac-paid-notice', cap: ROW },
  { name: 'countdown-de', state: 'pre_cutover_free', days: 30, language: 'de', testId: 'aac-paid-notice', cap: ROW },
  { name: 'countdown-ar', state: 'pre_cutover_free', days: 30, language: 'ar', testId: 'aac-paid-notice', cap: ROW },
  { name: 'countdown-expanded-en', state: 'pre_cutover_free', days: 30, language: 'en', expand: true, testId: 'aac-paid-notice', cap: { phone: 260, wide: 140 } },
  { name: 'grace-en', state: 'grace', days: 9, language: 'en', testId: 'aac-grace-notice', cap: ROW },
  { name: 'grace-de', state: 'grace', days: 9, language: 'de', testId: 'aac-grace-notice', cap: ROW },
  { name: 'paid-no-bar', state: 'paid', days: 30, language: 'en' },
];

// Runs under playwright.web-preview.config.ts, which builds a local server with
// the flag on; the default config targets a deployment without it.
test.skip(process.env.AAC_PAID_NOTICES_E2E !== '1', 'runs under playwright.web-preview.config.ts');

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* already closed */ }
  try { await context.close(); } catch { /* already closed */ }
});

async function setUp(page: Page, c: Case) {
  await page.addInitScript(({ language }) => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language, outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  }, { language: c.language });
  await page.route('**/api/**', route => route.abort());
  await page.route('http://localhost:11434/**', route => route.abort());
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'notice-test@example.invalid', name: 'Notice test' } } }));
  await page.route('**/api/v1/roles/me', route => route.fulfill({ json: { plan: 'free', aac_plan: 'free' } }));
  const accessUntil = new Date(Date.now() + c.days * DAY).toISOString();
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({ json: { state: 'signed_in', remainingMs: 0,
    entitlement: { state: c.state, accessUntil: c.state === 'paid' ? null : accessUntil, policyVersion: '2026-10-27-v1' } } }));
}

for (const c of CASES) {
  test(`${c.name}: the notice fits above the board`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await setUp(page, c);
    const answered = page.waitForResponse('**/api/v1/prism-aac/access');
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    const body = page.locator('.aac-web-preview-body');
    await expect(body).toBeVisible();
    const viewport = page.viewportSize()!;

    if (!c.testId) {
      await answered;
      await expect(page.getByTestId('aac-paid-notice')).toHaveCount(0);
      await expect(page.getByTestId('aac-grace-notice')).toHaveCount(0);
    } else {
      const bar = page.getByTestId(c.testId);
      await expect(bar).toBeVisible();
      if (c.expand) {
        await bar.getByRole('button', { expanded: false }).click();
        await expect(bar.getByRole('button', { expanded: true })).toBeVisible();
      }
      if (c.language === 'ar') await expect(bar).toHaveAttribute('dir', 'rtl');
      const box = (await bar.boundingBox())!;
      const boardBox = (await body.boundingBox())!;
      const cap = viewport.width < 640 ? c.cap!.phone : c.cap!.wide;
      expect(box.height, `${c.name} bar height`).toBeLessThanOrEqual(cap);
      for (const button of await bar.getByRole('button').all()) {
        const target = (await button.boundingBox())!;
        expect(target.width, 'touch target width').toBeGreaterThanOrEqual(44);
        expect(target.height, 'touch target height').toBeGreaterThanOrEqual(44);
      }
      expect(boardBox.y, 'board starts below the bar').toBeGreaterThanOrEqual(box.y + box.height - 1);
      expect(boardBox.height, 'board keeps the rest of the screen').toBeGreaterThanOrEqual(viewport.height - box.height - 2);
      const overflow = await bar.evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow, 'bar never overflows sideways').toBeLessThanOrEqual(0);
      info.annotations.push({ type: 'bar', description: `${c.name} ${viewport.width}x${viewport.height} bar=${Math.round(box.height)}px board=${Math.round(boardBox.height)}px` });
    }
    await safeScreenshot(page, info.outputPath(`${c.name}.png`), {
      expectedPath: '/prism-aac', requiredSelectors: c.testId ? [`[data-testid=${c.testId}]`] : ['.aac-web-preview-body'],
    });
    expect(errors).toEqual([]);
  });
}
