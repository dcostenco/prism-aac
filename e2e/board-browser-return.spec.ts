import { test, expect, type Page } from '@playwright/test';

// Inside the Prism AAC Browser iOS app, "Back to AAC Board" opens the board in
// the same view, which has no back gesture. The board offers the way back: a
// labelled toolbar button where the toolbar row has room, otherwise a bar under
// the toolbar. In the toolbar row of a portrait phone the button pushed Settings
// and More under the language pair, and the bar first took its height from the
// core-word prediction cards (41px on a 667px-tall phone).

// The method names the Browser shell injects at document start (ContentView.swift).
const BROWSER_SHELL_BRIDGE = `(() => {
  const noop = () => {};
  window.prismNativeBridge = { speak: noop, stopSpeech: noop, startVoice: noop, stopVoice: noop, emergency: noop,
    freeMemoryMB: () => 0, askAI: noop, openSettings: noop, requestReview: noop,
    navigateTo: noop, goBack: noop, goForward: noop };
})();`;

// Playwright emulates no safe area. Apply the insets the app reads (globals.css
// --aac-safe-area-*) so the board is measured as a phone lays it out: a Dynamic
// Island iPhone in portrait (62pt status area, as rendered on the iPhone 17
// simulator; 34pt home indicator), the same phone in landscape (21pt home
// indicator), and an iPhone SE's 20pt status bar.
function insets(projectName: string): { top: number; bottom: number } {
  if (!projectName.startsWith('iphone-')) return { top: 0, bottom: 0 };
  if (projectName.startsWith('iphone-se')) return { top: projectName.endsWith('-land') ? 0 : 20, bottom: 0 };
  return projectName.endsWith('-land') ? { top: 0, bottom: 21 } : { top: 62, bottom: 34 };
}

async function openBoard(page: Page, projectName: string, inBrowserApp: boolean) {
  const { top, bottom } = insets(projectName);
  await page.addInitScript(([t, b]) => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--aac-safe-area-top', `${t}px`);
      document.documentElement.style.setProperty('--aac-safe-area-bottom', `${b}px`);
    });
  }, [top, bottom]);
  if (inBrowserApp) await page.addInitScript(BROWSER_SHELL_BRIDGE);
  await page.goto('/prism-aac');
  // The first toolbar button in the DOM may be the hidden variant of the way back.
  await page.locator('[role="toolbar"] button:visible').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
}

interface BoardLayout {
  width: number;
  toolbarButton: boolean;
  bar: boolean;
  /** Toolbar controls whose centre another element covers. */
  covered: string[];
  /** Visible touch targets under 44px tall, by label. */
  short: string[];
}

function measure(page: Page): Promise<BoardLayout> {
  return page.evaluate(() => {
    const shown = (sel: string) => { const el = document.querySelector<HTMLElement>(sel); return !!el && el.offsetParent !== null; };
    const label = (el: Element) => el.getAttribute('aria-label') || el.textContent?.trim() || '?';
    const visible = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter(e => e.offsetParent !== null);
    const covered = visible('[role="toolbar"] button')
      .filter(b => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(hit && (hit === b || b.contains(hit)));
      })
      .map(label);
    const short = visible('button, [role="button"], .aac-btn')
      .filter(e => e.getBoundingClientRect().height < 44)
      .map(label);
    return {
      width: window.innerWidth,
      toolbarButton: shown('[data-testid="aac-toolbar-browser-button"]'),
      bar: shown('[data-testid="aac-browser-return-bar"]'),
      covered,
      short,
    };
  });
}

test('the board inside the Browser app has a way back that hides nothing and shrinks no target', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'touch-device projects only');
  // The same board without the way back is the baseline: a target that was
  // already under 44px there (the compact landscape composer) is not this change's.
  const plain = await context.newPage();
  await openBoard(plain, testInfo.project.name, false);
  const baseline = await measure(plain);
  await plain.close();

  await openBoard(page, testInfo.project.name, true);
  const layout = await measure(page);

  expect(layout.covered, 'toolbar controls covered by another element').toEqual([]);
  expect(layout.short.filter(l => !baseline.short.includes(l)), 'targets the way back made shorter than 44px').toEqual([]);
  // Exactly one way back: the toolbar button where the row has room, else the bar.
  if (layout.width < 600) {
    expect(layout).toMatchObject({ toolbarButton: false, bar: true });
  } else {
    expect(layout).toMatchObject({ toolbarButton: true, bar: false });
  }

  const control = layout.bar ? 'aac-browser-return-bar' : 'aac-toolbar-browser-button';
  await page.getByTestId(control).click();
  await expect(page).toHaveURL(/\/prism-aac\/browser$/);
});

test('the board outside the Browser app shows no Browser control', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'touch-device projects only');
  await openBoard(page, testInfo.project.name, false);
  await expect(page.getByTestId('aac-toolbar-browser-button')).toBeHidden();
  await expect(page.getByTestId('aac-browser-return-bar')).toBeHidden();
});
