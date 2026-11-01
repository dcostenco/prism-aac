/**
 * Owner report 2026-10-31: French, Spanish, Portuguese, Dutch and Filipino
 * keyboards lacked letters of their own alphabets. On a phone every added
 * letter must be a reachable key that types itself (and its capital after
 * Shift), with every key inside the keyboard and no key smaller than the
 * size measured when the letters were added.
 */
import { expect, test, type Page } from '@playwright/test';
import type { SupportedLanguage } from '@/engine/i18n';

test.use({ serviceWorkers: 'block' });

// Letters each keyboard gained, and the narrowest key measured after the
// change at 375px and 390px portrait (2026-10-31, before → after unchanged
// in width; French and Portuguese phones gained a row, 67.5 → 61.5px tall).
const CASES: Array<{ language: SupportedLanguage; added: string[]; minWidth: Record<number, number>; minHeight: number }> = [
  { language: 'fr', added: [...'ÀÂÎÔÙÛŒËÏÆÜŸ'], minWidth: { 375: 36.1, 390: 37.6 }, minHeight: 61 },
  { language: 'es', added: [...'ÁÉÍÓÚÜ'], minWidth: { 375: 36.1, 390: 37.6 }, minHeight: 66 },
  { language: 'pt', added: [...'ÁÀÂÉÊÍÓÔÚ'], minWidth: { 375: 36.1, 390: 37.6 }, minHeight: 61 },
  { language: 'nl', added: [...'ÁÄÉËÍÏÓÖÚÜ'], minWidth: { 375: 35.2, 390: 37.0 }, minHeight: 66 },
  { language: 'tl', added: [...'Ñ'], minWidth: { 375: 36.1, 390: 37.6 }, minHeight: 66 },
];

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-6.1', 'phone portrait proof');
});

async function open(page: Page, language: SupportedLanguage, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((lang) => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'true');
    localStorage.setItem('prism-kb-max', 'true');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: lang, outputLanguage: lang, theme: 'light', gridSize: 12, cloudPredictionEnabled: false, aiAutocorrectEnabled: false },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({ state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 }));
  }, language);
  // No picture service: the bar shows words only and nothing is requested from it.
  await page.route('**/pictogram**', route => route.fulfill({ status: 404, body: '{}' }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('keyboard-shell')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-scan-group="keyboard"]')).toHaveAttribute('data-language', language);
}

for (const { language, added, minWidth, minHeight } of CASES) {
  for (const [width, height] of [[375, 667], [390, 844]] as const) {
    test(`${language} at ${width}px: every key inside the keyboard, none smaller than measured`, async ({ page }) => {
      await open(page, language, width, height);
      const metrics = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!.getBoundingClientRect();
        const keys = [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] [data-key-row="letters"] button[data-key]')];
        const rects = keys.map(key => key.getBoundingClientRect());
        return {
          keys: keys.map(key => key.dataset.key),
          outside: rects.filter(r => r.left < root.left - 0.5 || r.right > root.right + 0.5 || r.top < root.top - 0.5 || r.bottom > root.bottom + 0.5).length,
          minWidth: Math.min(...rects.map(r => r.width)),
          minHeight: Math.min(...rects.map(r => r.height)),
          overflowX: document.documentElement.scrollWidth - innerWidth,
        };
      });
      for (const letter of added) expect(metrics.keys, `${language} ${letter}`).toContain(letter);
      expect(metrics.outside, 'keys outside the keyboard').toBe(0);
      expect(metrics.minWidth, 'narrowest key').toBeGreaterThanOrEqual(minWidth[width]);
      expect(metrics.minHeight, 'shortest key').toBeGreaterThanOrEqual(minHeight);
      expect(metrics.overflowX).toBeLessThanOrEqual(1);
    });
  }

  test(`${language}: every added letter types itself, and its capital after Shift`, async ({ page }) => {
    await open(page, language, 390, 844);
    const keyboard = page.locator('[data-scan-group="keyboard"]');
    const message = page.getByTestId('message-text');
    for (const letter of added) await keyboard.locator(`button[data-key="${letter}"]`).first().click();
    const lower = added.map(letter => letter.toLocaleLowerCase(language)).join('');
    await expect(message).toContainText(lower);
    await page.getByTestId('shift-key').click();
    await keyboard.locator(`button[data-key="${added[0]}"]`).first().click();
    await expect(message).toContainText(lower + added[0]);
  });
}
