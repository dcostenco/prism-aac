/**
 * Owner report 2026-10-31: French, Spanish, Portuguese, Dutch and Filipino
 * keyboards lacked letters of their own alphabets. Every added letter must be
 * a reachable key that types itself (and its capital after Shift) and reaches
 * the prediction bar once learned; the keyboard, its controls and the bar must
 * fit the screen; and no key may be smaller than measured when the letters
 * were added (owner-approved after before/after mockups).
 *
 * Runs per device profile: iphone-se, iphone-6.1, iphone-6.1-land, ipad-13.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { SupportedLanguage } from '@/engine/i18n';
import { buildKeyboardRows, getLetterRows } from '@/constants/keyboardLayouts';

test.use({ serviceWorkers: 'block' });

type Profile = 'iphone-se' | 'iphone-6.1' | 'iphone-6.1-land' | 'ipad-13';
const PROFILES: Profile[] = ['iphone-se', 'iphone-6.1', 'iphone-6.1-land', 'ipad-13'];
const ARTIFACTS = path.resolve('test-results', 'aac-latin-letters');

// Smallest key [width, height] measured after the change (2026-10-31). Phones
// in portrait keep their widths; French and Portuguese gain a row (67.5 →
// 61.5px tall). A phone in landscape folds the added row into rows 1-3, so
// keys keep their 46.7px height. A tablet keeps the added row.
const CASES: Array<{ language: SupportedLanguage; added: string[]; floors: Record<Profile, [number, number]> }> = [
  { language: 'fr', added: [...'ÀÂÎÔÙÛŒËÏÆÜŸ'],
    floors: { 'iphone-se': [36.1, 61], 'iphone-6.1': [37.6, 61], 'iphone-6.1-land': [55, 46.6], 'ipad-13': [76.9, 202] } },
  { language: 'es', added: [...'ÁÉÍÓÚÜ'],
    floors: { 'iphone-se': [36.1, 66], 'iphone-6.1': [37.6, 66], 'iphone-6.1-land': [69, 46.6], 'ipad-13': [92.5, 202] } },
  { language: 'pt', added: [...'ÁÀÂÉÊÍÓÔÚ'],
    floors: { 'iphone-se': [36.1, 61], 'iphone-6.1': [37.6, 61], 'iphone-6.1-land': [59, 46.6], 'ipad-13': [88.9, 202] } },
  { language: 'nl', added: [...'ÁÄÉËÍÏÓÖÚÜ'],
    floors: { 'iphone-se': [35.2, 66], 'iphone-6.1': [37.0, 66], 'iphone-6.1-land': [63.6, 46.6], 'ipad-13': [92.5, 202] } },
  { language: 'tl', added: [...'Ñ'],
    floors: { 'iphone-se': [36.1, 66], 'iphone-6.1': [37.6, 66], 'iphone-6.1-land': [83, 46.6], 'ipad-13': [92.5, 253] } },
];

function profileOf(name: string): Profile | null {
  return (PROFILES as string[]).includes(name) ? name as Profile : null;
}

async function open(page: Page, language: SupportedLanguage) {
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

/** The letter rows the keyboard renders, top to bottom. */
async function renderedRows(page: Page): Promise<string[][]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] [data-key-row="letters"]')]
    .map(row => [...row.querySelectorAll<HTMLElement>(':scope > button[data-key]')].map(key => key.dataset.key ?? '')));
}

/** The rows the layout code builds for this window size. */
async function expectedRows(page: Page, language: SupportedLanguage): Promise<string[][]> {
  const { width, height } = page.viewportSize()!;
  return buildKeyboardRows(getLetterRows(language), width < 480, height <= 500).map(row => row.keys);
}

async function fit(page: Page) {
  return page.evaluate(() => {
    const inside = (r: DOMRect) => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    const keyboard = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!;
    const keyboardRect = keyboard.getBoundingClientRect();
    const buttons = [...keyboard.querySelectorAll<HTMLElement>('button')].filter(b => b.getBoundingClientRect().width > 0);
    const letters = [...keyboard.querySelectorAll<HTMLElement>('[data-key-row="letters"] button[data-key]')].map(k => k.getBoundingClientRect());
    const bar = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
    return {
      keyboardInside: inside(keyboardRect),
      buttonsOutside: buttons.filter(b => !inside(b.getBoundingClientRect())).map(b => b.dataset.key ?? b.dataset.action ?? b.getAttribute('aria-label')),
      barVisible: bar.height > 0 && inside(bar),
      controls: ['shift-key'].map(id => !!document.querySelector(`[data-testid="${id}"]`))
        .concat(['backspace', 'space', 'mode'].map(a => !!keyboard.querySelector(`[data-action="${a}"]`))),
      minWidth: Math.min(...letters.map(r => r.width)),
      minHeight: Math.min(...letters.map(r => r.height)),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
    };
  });
}

for (const { language, added, floors } of CASES) {
  test(`${language}: keyboard fits the screen, rows as built, no key smaller than measured`, async ({ page }, testInfo) => {
    const profile = profileOf(testInfo.project.name);
    test.skip(!profile, 'runs on the measured device profiles');
    await open(page, language);
    expect(await renderedRows(page)).toEqual(await expectedRows(page, language));
    const keys = (await renderedRows(page)).flat();
    for (const letter of added) expect(keys, `${language} ${letter}`).toContain(letter);
    const m = await fit(page);
    expect(m.keyboardInside, 'keyboard inside the window').toBe(true);
    expect(m.buttonsOutside, 'keyboard buttons outside the window').toEqual([]);
    expect(m.barVisible, 'prediction bar inside the window').toBe(true);
    expect(m.controls, 'Shift, Backspace, Space and mode keys present').toEqual([true, true, true, true]);
    expect(m.minWidth, 'narrowest key').toBeGreaterThanOrEqual(floors[profile!][0]);
    expect(m.minHeight, 'shortest key').toBeGreaterThanOrEqual(floors[profile!][1]);
    expect(m.overflowX).toBeLessThanOrEqual(1);
    expect(m.overflowY).toBeLessThanOrEqual(1);
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: path.join(ARTIFACTS, `${language}-${profile}.png`) });
  });

  test(`${language}: every added letter types itself, and its capital after Shift`, async ({ page }, testInfo) => {
    test.skip(!profileOf(testInfo.project.name), 'runs on the measured device profiles');
    await open(page, language);
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

  // A made-up word per added letter ("zu" + letter + "ka"), so no word list
  // offers it until it is learned: the bar must not show it before Space and
  // must show it after.
  test(`${language}: a word with each added letter is learned on Space and offered on the bar`, async ({ page }, testInfo) => {
    test.skip(!profileOf(testInfo.project.name), 'runs on the measured device profiles');
    test.slow();
    await open(page, language);
    const keyboard = page.locator('[data-scan-group="keyboard"]');
    const message = page.getByTestId('message-text');
    const tap = (letter: string) => keyboard.locator(`button[data-key="${letter.toLocaleUpperCase(language)}"]`).first().click();
    const clear = async (count: number) => {
      for (let i = 0; i < count; i += 1) await keyboard.locator('button[data-action="backspace"]').first().click();
    };
    for (const letter of added) {
      const word = `zu${letter.toLocaleLowerCase(language)}ka`;
      const prefix = [...word].slice(0, -1);
      const tile = page.getByTestId('prediction-label').filter({ hasText: new RegExp(`^${word}$`, 'i') });
      for (const l of prefix) await tap(l);
      await expect(tile, `${word} offered before it was learned`).toHaveCount(0);
      await tap('a');
      await keyboard.locator('button[data-action="space"]').click();
      await clear(word.length + 1);
      await expect(message).not.toContainText(word);
      for (const l of prefix) await tap(l);
      await expect(tile, `${word} after learning`).toBeVisible();
      await tile.click();
      await expect(message).toContainText(word);
      await clear(word.length + 1);
    }
  });
}

test('fr: crossing 480px wide and 500px tall switches between wrapped, four-row and folded layouts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-6.1', 'one mounted run is enough');
  await page.setViewportSize({ width: 844, height: 501 });
  await open(page, 'fr');
  const rows = page.locator('[data-scan-group="keyboard"]');
  for (const [width, height, count] of [[844, 501, '4'], [844, 500, '3'], [479, 844, '5'], [480, 844, '4']] as const) {
    await page.setViewportSize({ width, height });
    await expect(rows, `${width}x${height}`).toHaveAttribute('data-aac-keyboard-rows', count);
    expect(await renderedRows(page), `${width}x${height}`).toEqual(await expectedRows(page, 'fr'));
    const m = await fit(page);
    expect(m.keyboardInside, `${width}x${height}: keyboard inside the window`).toBe(true);
    expect(m.buttonsOutside, `${width}x${height}`).toEqual([]);
  }
});
