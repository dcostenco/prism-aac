import { test, expect, type Page } from '@playwright/test';

// The sign-in gate's one-minute web preview shows a notice above the page and
// fits pages marked aac-safe-viewport into the space left. The browser page was
// not marked: it kept the full screen height, so the keyboard's bottom row (123,
// space, Go) fell off the screen on an iPhone SE and an iPad. The support page
// could not scroll at all, preview or not, because the app's body never
// scrolls. The preview exists only in a build with
// NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE=1; the browser test skips without it.

async function inPreview(page: Page) {
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({
    json: { state: 'preview', remainingMs: 60_000 },
    headers: { 'Cache-Control': 'no-store' },
  }));
}

const shown = (page: Page, testId: string) =>
  page.getByTestId(testId).waitFor({ timeout: 10_000 }).then(() => true, () => false);

test('the browser keyboard stays on screen under the web-preview notice', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'touch-device projects only');
  await inPreview(page);
  await page.goto('/prism-aac/browser');
  test.skip(!(await shown(page, 'web-preview-notice')), 'needs a build with the web sign-in gate');
  await page.waitForSelector('[data-testid="keyboard-shell"] [data-scan-group="keyboard"] button');
  await page.waitForTimeout(400);

  const keys = await page.evaluate(() => {
    const vh = window.innerHeight;
    const visible = [...document.querySelectorAll<HTMLElement>(
      '[data-testid="keyboard-shell"] [data-scan-group="keyboard"] button',
    )].filter(key => key.offsetParent !== null);
    return {
      count: visible.length,
      below: visible
        .filter(key => key.getBoundingClientRect().bottom > vh + 0.5)
        .map(key => key.getAttribute('aria-label') || key.textContent?.trim() || '?'),
    };
  });
  expect(keys.count, 'keyboard rendered').toBeGreaterThan(25);
  expect(keys.below, 'keys below the bottom of the screen').toEqual([]);
});

test('the support page scrolls to its end', async ({ page }, testInfo) => {
  await inPreview(page);
  await page.goto('/prism-aac/docs');
  const footer = page.getByText('Licensed under AGPL-3.0-or-later');
  await expect(page.getByRole('heading', { name: 'Prism AAC — Support' })).toBeVisible();

  if (testInfo.project.use.hasTouch) {
    // Mobile WebKit has no wheel. A finger scrolls the nearest box that may
    // scroll and has more to show; with none, the end cannot be reached.
    const scroller = await footer.evaluate((el) => {
      if (el.getBoundingClientRect().bottom <= window.innerHeight) return 'fits';
      for (let box = el.parentElement; box; box = box.parentElement) {
        const y = getComputedStyle(box).overflowY;
        if ((y === 'auto' || y === 'scroll') && box.scrollHeight > box.clientHeight) {
          box.scrollTop = box.scrollHeight;
          return box.tagName;
        }
      }
      return null;
    });
    expect(scroller, 'a scrollable box holding the page').not.toBeNull();
  } else {
    // Scroll the way a person does, with the wheel over the page.
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 600);
  }
  await page.waitForTimeout(300);
  await expect(footer).toBeInViewport();
});
