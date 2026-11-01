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

// Letters each keyboard gained, a word that uses some of them, and the
// smallest key measured after the change (2026-10-31), per viewport, as
// [width, height]. Phones in portrait keep their key widths; French and
// Portuguese gain a row (67.5 → 61.5px tall). A phone in landscape folds the
// added row into rows 1-3, so keys keep their 46.7px height. The owner
// approved these sizes after before/after mockups.
const VIEWPORTS = { phoneSE: [375, 667], phone: [390, 844], landscape: [844, 390], tablet: [1032, 1376] } as const;
type Floors = Record<keyof typeof VIEWPORTS, [number, number]>;
const CASES: Array<{ language: SupportedLanguage; added: string[]; word: string; floors: Floors }> = [
  { language: 'fr', added: [...'ÀÂÎÔÙÛŒËÏÆÜŸ'], word: 'piqûre',
    floors: { phoneSE: [36.1, 61], phone: [37.6, 61], landscape: [55, 46.6], tablet: [76.9, 202] } },
  { language: 'es', added: [...'ÁÉÍÓÚÜ'], word: 'canción',
    floors: { phoneSE: [36.1, 66], phone: [37.6, 66], landscape: [69, 46.6], tablet: [92.5, 202] } },
  { language: 'pt', added: [...'ÁÀÂÉÊÍÓÔÚ'], word: 'avô',
    floors: { phoneSE: [36.1, 61], phone: [37.6, 61], landscape: [59, 46.6], tablet: [88.9, 202] } },
  { language: 'nl', added: [...'ÁÄÉËÍÏÓÖÚÜ'], word: 'reünie',
    floors: { phoneSE: [35.2, 66], phone: [37.0, 66], landscape: [63.6, 46.6], tablet: [92.5, 202] } },
  { language: 'tl', added: [...'Ñ'], word: 'niño',
    floors: { phoneSE: [36.1, 66], phone: [37.6, 66], landscape: [83, 46.6], tablet: [92.5, 253] } },
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

for (const { language, added, word, floors } of CASES) {
  for (const [name, [width, height]] of Object.entries(VIEWPORTS) as Array<[keyof typeof VIEWPORTS, readonly [number, number]]>) {
    test(`${language} on ${name} (${width}x${height}): every key inside the keyboard, none smaller than measured`, async ({ page }) => {
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
      expect(metrics.minWidth, 'narrowest key').toBeGreaterThanOrEqual(floors[name][0]);
      expect(metrics.minHeight, 'shortest key').toBeGreaterThanOrEqual(floors[name][1]);
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
    // Shift is one-shot: each added letter in turn gives its capital.
    for (const letter of added) {
      await page.getByTestId('shift-key').click();
      await keyboard.locator(`button[data-key="${letter}"]`).first().click();
    }
    await expect(message).toContainText(lower + added.join(''));
  });

  test(`${language}: "${word}" typed on the keyboard is learned and offered again on the bar`, async ({ page }) => {
    await open(page, language, 390, 844);
    const keyboard = page.locator('[data-scan-group="keyboard"]');
    const message = page.getByTestId('message-text');
    const tap = (letter: string) => keyboard.locator(`button[data-key="${letter.toLocaleUpperCase(language)}"]`).first().click();
    for (const letter of word) await tap(letter);
    await keyboard.locator('button[data-action="space"]').click();
    await expect(message).toContainText(word);
    for (let i = 0; i <= [...word].length; i += 1) await keyboard.locator('button[data-action="backspace"]').first().click();
    await expect(message).not.toContainText(word);
    const prefix = [...word].slice(0, -1).join('');
    for (const letter of prefix) await tap(letter);
    const tile = page.getByTestId('prediction-label').filter({ hasText: new RegExp(`^${word}$`, 'i') });
    await expect(tile).toBeVisible();
    await tile.click();
    await expect(message).toContainText(word);
  });
}
