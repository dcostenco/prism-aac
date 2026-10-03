import { test, expect, type Page } from '@playwright/test';

// The browser toolbar with the Say | Search switch. On a phone, one row ran off
// the screen once a site was open: Go, Pin and Open in new tab out of reach,
// and the field left room for a few letters of a message. Under 768px the
// toolbar takes two rows (where you are and the mode on top, the field across
// the width below); from 768px it stays one row. Taps here are real (no
// force), so a control off the screen or under another element fails.

// The method names the Browser shell injects at document start
// (ContentView.swift). navigateTo records instead of opening a native view.
const RECORDING_BROWSER_SHELL = `(() => {
  const noop = () => {};
  window.__navigations = [];
  window.prismNativeBridge = { speak: noop, stopSpeech: noop, startVoice: noop, stopVoice: noop, emergency: noop,
    freeMemoryMB: () => 0, askAI: noop, openSettings: noop, requestReview: noop,
    navigateTo: (url) => window.__navigations.push(url), goBack: noop, goForward: noop };
})();`;

// Pinned sites open in the page's frame; answer them locally so no test
// depends on the network.
async function stubSites(page: Page) {
  await page.route(/^https:\/\/(m\.wikipedia\.org|html\.duckduckgo\.com)\//, route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title><h1>Stub site</h1>' }));
}

async function openBrowser(page: Page) {
  await page.goto('/prism-aac/browser');
  await page.locator('[data-testid="browser-toolbar"] button:visible').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
}

function homeTile(page: Page, name: string) {
  return page.getByTestId('browser-content').getByRole('button', { name, exact: true });
}

interface ToolbarLayout {
  width: number;
  fieldWidth: number;
  /** Controls not wholly inside the viewport. */
  offscreen: string[];
  /** Controls whose centre another element covers. */
  covered: string[];
  /** Controls under 44px in either dimension. */
  small: string[];
}

function measureToolbar(page: Page): Promise<ToolbarLayout> {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="browser-toolbar"]')!;
    const label = (el: Element) => el.getAttribute('aria-label') || el.textContent?.trim() || '?';
    const controls = [...bar.querySelectorAll<HTMLElement>('button, a[href]')].filter(el => el.offsetParent !== null);
    const field = bar.querySelector('button[aria-label^="Tap to type"], button[aria-label^="Editing"], button[aria-label="Speaking"]');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      width: vw,
      fieldWidth: field ? field.getBoundingClientRect().width : 0,
      offscreen: controls
        .filter(el => { const r = el.getBoundingClientRect(); return r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5; })
        .map(label),
      covered: controls
        .filter(el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(Math.min(r.left + r.width / 2, vw - 1), Math.min(r.top + r.height / 2, vh - 1));
          return !(hit && (hit === el || el.contains(hit)));
        })
        .map(label),
      // Layout size: a tapped .aac-btn shrinks to 94% for 0.1s, which a
      // bounding box measured right after the tap would count.
      small: controls
        .filter(el => el.offsetWidth < 44 || el.offsetHeight < 44)
        .map(el => `${label(el)} ${el.offsetWidth}x${el.offsetHeight}`),
    };
  });
}

for (const mode of ['Search', 'Say'] as const) {
  test(`every toolbar control stays on screen and tappable (${mode} mode, home and with a site open)`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'touch-device projects only');
    await stubSites(page);
    await openBrowser(page);
    await page.getByRole('button', { name: `${mode} mode` }).click();
    await expect(page.getByRole('button', { name: `${mode} mode` })).toHaveAttribute('aria-pressed', 'true');

    for (const state of ['home', 'site open'] as const) {
      if (state === 'site open') {
        await homeTile(page, 'Wikipedia').click();
        await expect(page.getByRole('button', { name: 'Unpin this site', exact: true })).toBeVisible();
      }
      const t = await measureToolbar(page);
      expect(t.offscreen, `${state}: controls off the ${t.width}px screen`).toEqual([]);
      expect(t.covered, `${state}: controls under another element`).toEqual([]);
      expect(t.small, `${state}: controls under 44px`).toEqual([]);
      // Room for about 15 characters of a message or an address. One row on a
      // phone squeezed the field to its 60px floor with a site open.
      expect(t.fieldWidth, `${state}: field width at ${t.width}px`).toBeGreaterThanOrEqual(120);
    }
  });
}

test('Say speaks and never navigates; Go does', async ({ page }) => {
  // The cloud voice never answers, so speech is still waiting for it (the
  // browser gives it 1.5s) when Stop is pressed.
  await page.route(/\/tts(\/public)?$/, () => { /* never answered */ });
  await page.addInitScript(RECORDING_BROWSER_SHELL);
  await openBrowser(page);
  const navigations = () => page.evaluate(() => (window as unknown as { __navigations: string[] }).__navigations.length);

  await page.getByRole('button', { name: 'Say mode' }).click();
  await page.keyboard.type('wikipedia');
  await page.getByTestId('browser-say-button').click();
  await expect(page.getByTestId('browser-speaking')).toHaveText('Speaking…');
  await expect(page.getByTestId('browser-say-button')).toHaveAccessibleName('Stop speaking');
  await page.getByTestId('browser-say-button').click();
  await expect(page.getByTestId('browser-say-button')).toHaveAccessibleName('Say');
  await expect(page.getByTestId('browser-speaking')).toHaveCount(0);
  expect(await navigations(), 'Say opened a site').toBe(0);

  await page.getByRole('button', { name: 'Search mode' }).click();
  await expect(page.locator('[data-testid="browser-toolbar"] button[aria-label="Go"]')).toBeEnabled();
  await page.locator('[data-testid="browser-toolbar"] button[aria-label="Go"]').click();
  await expect.poll(navigations, { message: 'Go opened nothing' }).toBe(1);
});

test('unpinning a site can be undone from the bar', async ({ page }) => {
  await stubSites(page);
  await openBrowser(page);
  await homeTile(page, 'Wikipedia').click();
  await page.getByRole('button', { name: 'Unpin this site', exact: true }).click();

  const bar = page.getByTestId('browser-undo-bar');
  await expect(bar).toContainText('Wikipedia removed');
  await bar.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unpin this site', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(homeTile(page, 'Wikipedia')).toBeVisible();
});

test('Settings on the browser home opens Settings, where the default tiles come back', async ({ page }) => {
  await stubSites(page);
  await openBrowser(page);
  await homeTile(page, 'Wikipedia').click();
  await page.getByRole('button', { name: 'Unpin this site', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(homeTile(page, 'Wikipedia')).toHaveCount(0);

  await page.getByTestId('browser-settings-button').click();
  const settings = page.getByRole('dialog');
  // Every Settings section opens on a tap, this one included.
  await settings.getByRole('button', { name: /Browser home tiles/ }).click();
  await settings.getByRole('button', { name: 'Restore default tiles', exact: true }).click();
  await expect(settings.getByText('Default tiles restored.')).toBeVisible();
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(homeTile(page, 'Wikipedia')).toBeVisible();
});

test('Say mode is still on after a reload', async ({ page }) => {
  await openBrowser(page);
  await page.getByRole('button', { name: 'Say mode' }).click();
  await page.reload();
  await page.locator('[data-testid="browser-toolbar"] button:visible').first().waitFor({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Say mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('browser-say-button')).toBeVisible();
});
