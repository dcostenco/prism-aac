import { test, expect, type Page } from '@playwright/test';

// Chrome on a phone (Android, or a narrow window) is Chromium. There a word
// that passed a tile label's content box, though it still fit inside the
// label's padding, was drawn with an ellipsis: "Mo…" for More and "Wa…" for
// Want on the browser's Say cards at 375px. The iPhone projects run WebKit,
// which draws such a word whole, so this check runs once, in Chromium.
test.use({ browserName: 'chromium', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

/** Labels drawn narrower than their text (cut off), or wider than the label. */
function cutLabels(page: Page, selector: string) {
  return page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)]
    .filter(label => label.offsetParent !== null)
    .flatMap((label) => {
      const style = getComputedStyle(label);
      const probe = document.createElement('span');
      probe.textContent = label.textContent;
      Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', font: style.font, letterSpacing: style.letterSpacing });
      document.body.appendChild(probe);
      const whole = probe.getBoundingClientRect().width;
      probe.remove();
      const range = document.createRange();
      range.selectNodeContents(label);
      const boxes = [...range.getClientRects()].filter(r => r.width > 0);
      const oneLine = boxes.length > 0 && boxes.every(r => Math.abs(r.top - boxes[0].top) < 1);
      // An ellipsized word reports a second, shorter box for what is drawn.
      const drawn = Math.min(...boxes.map(r => r.width));
      const cut = oneLine && drawn + 0.5 < whole;
      const tooWide = oneLine && whole > label.clientWidth + 0.5;
      return cut || tooWide ? [`${label.textContent} (drawn ${drawn.toFixed(1)} of ${whole.toFixed(1)}, label ${label.clientWidth})`] : [];
    }), selector);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one Chromium run covers it');
  await page.route(/arasaac\.org/, route => route.abort());
});

test('the browser Say cards show whole words in Chromium', async ({ page }) => {
  await page.goto('/prism-aac/browser');
  await page.getByTestId('browser-mode-say').click();
  await page.locator('[data-testid="prediction-label"]').first().waitFor();
  await page.waitForTimeout(800);
  expect(await cutLabels(page, '[data-testid="prediction-label"]')).toEqual([]);
});

test('the board tiles show whole words in Chromium', async ({ page }) => {
  // The picture board, as the iPhone picture-board spec opens it.
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'false');
    localStorage.setItem('prism-kb-max', 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', theme: 'light', gridSize: 12,
      cloudPredictionEnabled: false, aiAutocorrectEnabled: false,
    }, version: 20 }));
  });
  await page.goto('/prism-aac');
  await page.getByTestId('phrase-tile-card').first().waitFor();
  await page.waitForTimeout(800);
  expect(await cutLabels(page, '.aac-tile-label')).toEqual([]);
});
