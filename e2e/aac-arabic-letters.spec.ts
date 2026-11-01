/**
 * Plan 2026-10-31, Phase 4: the Arabic keyboard had no أ إ آ ("أنا", "إلى",
 * "آخر" could not be typed). Each must be a reachable key that types itself
 * and reaches the prediction bar once learned; a word typed with a bare alef
 * ("اريد") offers its hamza spelling ("أريد"); the keyboard, its controls and
 * the bar must fit the screen; and no key may be smaller than measured when
 * the letters were added (owner-approved after before/after mockups,
 * 2026-11-01: row 2 narrows on wide screens, phones keep their key size).
 *
 * Runs per device profile: iphone-se, iphone-6.1, iphone-6.1-land, ipad-13.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildKeyboardRows, getLetterRows } from '@/constants/keyboardLayouts';

test.use({ serviceWorkers: 'block' });

type Profile = 'iphone-se' | 'iphone-6.1' | 'iphone-6.1-land' | 'ipad-13';
const PROFILES: Profile[] = ['iphone-se', 'iphone-6.1', 'iphone-6.1-land', 'ipad-13'];
const ARTIFACTS = path.resolve('test-results', 'aac-arabic-letters');
const ADDED = ['أ', 'إ', 'آ'];

// Smallest key [width, height] measured after the change (2026-11-01).
const FLOORS: Record<Profile, [number, number]> = {
  'iphone-se': [36.1, 61],
  'iphone-6.1': [37.6, 67],
  'iphone-6.1-land': [59, 46.6],
  'ipad-13': [65.8, 252],
};

function profileOf(name: string): Profile | null {
  return (PROFILES as string[]).includes(name) ? name as Profile : null;
}

async function open(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'true');
    localStorage.setItem('prism-kb-max', 'true');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: 'ar', outputLanguage: 'ar', theme: 'light', gridSize: 12, cloudPredictionEnabled: false, aiAutocorrectEnabled: false },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({ state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 }));
  });
  // No picture service: the bar shows words only and nothing is requested from it.
  await page.route('**/pictogram**', route => route.fulfill({ status: 404, body: '{}' }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('keyboard-shell')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-scan-group="keyboard"]')).toHaveAttribute('data-language', 'ar');
}

async function renderedRows(page: Page): Promise<string[][]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] [data-key-row="letters"]')]
    .map(row => [...row.querySelectorAll<HTMLElement>(':scope > button[data-key]')].map(key => key.dataset.key ?? '')));
}

function expectedRows(page: Page): string[][] {
  const { width, height } = page.viewportSize()!;
  return buildKeyboardRows(getLetterRows('ar'), width < 480, height <= 500).map(row => row.keys);
}

async function fit(page: Page) {
  return page.evaluate(() => {
    const inside = (r: DOMRect) => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    const keyboard = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!;
    const buttons = [...keyboard.querySelectorAll<HTMLElement>('button')].filter(b => b.getBoundingClientRect().width > 0);
    const letters = [...keyboard.querySelectorAll<HTMLElement>('[data-key-row="letters"] button[data-key]')].map(k => k.getBoundingClientRect());
    const bar = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
    return {
      keyboardInside: inside(keyboard.getBoundingClientRect()),
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

test('ar: keyboard fits the screen, rows as built, no key smaller than measured', async ({ page }, testInfo) => {
  const profile = profileOf(testInfo.project.name);
  test.skip(!profile, 'runs on the measured device profiles');
  await open(page);
  const rows = await renderedRows(page);
  expect(rows).toEqual(expectedRows(page));
  // أ إ آ follow ا on the same row on every screen.
  const alefRow = rows.find(row => row.includes('ا'))!;
  expect(alefRow.slice(alefRow.indexOf('ا'), alefRow.indexOf('ا') + 4)).toEqual(['ا', ...ADDED]);
  const m = await fit(page);
  expect(m.keyboardInside, 'keyboard inside the window').toBe(true);
  expect(m.buttonsOutside, 'keyboard buttons outside the window').toEqual([]);
  expect(m.barVisible, 'prediction bar inside the window').toBe(true);
  expect(m.controls, 'Shift, Backspace, Space and mode keys present').toEqual([true, true, true, true]);
  expect(m.minWidth, 'narrowest key').toBeGreaterThanOrEqual(FLOORS[profile!][0]);
  expect(m.minHeight, 'shortest key').toBeGreaterThanOrEqual(FLOORS[profile!][1]);
  expect(m.overflowX).toBeLessThanOrEqual(1);
  expect(m.overflowY).toBeLessThanOrEqual(1);
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACTS, `ar-${profile}.png`) });
});

test('ar: أ إ آ each type themselves', async ({ page }, testInfo) => {
  test.skip(!profileOf(testInfo.project.name), 'runs on the measured device profiles');
  await open(page);
  const keyboard = page.locator('[data-scan-group="keyboard"]');
  for (const letter of ADDED) await keyboard.locator(`button[data-key="${letter}"]`).first().click();
  await expect(page.getByTestId('message-text')).toContainText(ADDED.join(''));
});

// A made-up word per added letter, so no word list offers it until it is
// learned: the bar must not show it before Space and must show it after.
test('ar: a word with each added letter is learned on Space and offered on the bar', async ({ page }, testInfo) => {
  test.skip(!profileOf(testInfo.project.name), 'runs on the measured device profiles');
  test.slow();
  await open(page);
  const keyboard = page.locator('[data-scan-group="keyboard"]');
  const message = page.getByTestId('message-text');
  const tap = (letter: string) => keyboard.locator(`button[data-key="${letter}"]`).first().click();
  const clear = async (count: number) => {
    for (let i = 0; i < count; i += 1) await keyboard.locator('button[data-action="backspace"]').first().click();
  };
  for (const letter of ADDED) {
    const word = `ظغ${letter}ثض`;
    const prefix = [...word].slice(0, -1);
    const tile = page.getByTestId('prediction-label').filter({ hasText: new RegExp(`^${word}$`) });
    for (const l of prefix) await tap(l);
    await expect(tile, `${word} offered before it was learned`).toHaveCount(0);
    await tap('ض');
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

// آخر is not one of the default tiles, so it shows only by matching the typed اخر.
test('ar: "اخر" typed with a bare alef offers آخر, and choosing it writes آخر', async ({ page }, testInfo) => {
  test.skip(!profileOf(testInfo.project.name), 'runs on the measured device profiles');
  await open(page);
  const keyboard = page.locator('[data-scan-group="keyboard"]');
  const tile = page.getByTestId('prediction-label').filter({ hasText: /^آخر$/ });
  await expect(tile).toHaveCount(0);
  for (const letter of 'اخر') await keyboard.locator(`button[data-key="${letter}"]`).first().click();
  await expect(tile).toBeVisible();
  await tile.click();
  const message = page.getByTestId('message-text');
  await expect(message).toContainText('آخر');
  await expect(message).not.toContainText('اخر');
});
