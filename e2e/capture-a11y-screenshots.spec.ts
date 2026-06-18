/**
 * Capture screenshots of all accessibility features for documentation.
 * Run: BASE_URL=http://localhost:3000/prism-aac npx playwright test e2e/capture-a11y-screenshots.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots', 'a11y-2026-06-18');

test.beforeEach(async ({ page, baseURL }) => {
  const start = baseURL || '/';
  await page.goto(start);
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  });
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
});

function shotPath(name: string, project: string): string {
  return path.join(SHOTS, `${name}-${project}.png`);
}

test('home board with full QWERTY', async ({ page }, testInfo) => {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shotPath('01-home-board', testInfo.project.name), fullPage: false });
});

test('toolbar with all buttons enabled + scroll arrows', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const raw = localStorage.getItem('prism-aac-settings');
    const state = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    if (!state.state) state.state = {};
    if (!state.state.toolbarConfig) state.state.toolbarConfig = { order: [], enabled: {} };
    const ids = ['categories','mic','aac_chat','alert','schedule','marketplace','math','ai_chat','notes','games','pdf_reader','ocr_capture','comfort_player','browser','history','sound','settings'];
    ids.forEach(id => { state.state.toolbarConfig.enabled[id] = true; });
    localStorage.setItem('prism-aac-settings', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="aac-toolbar-strip"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotPath('02-toolbar-all-buttons', testInfo.project.name), fullPage: false });
});

test('simplified keyboard (gridSize 4)', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const raw = localStorage.getItem('prism-aac-settings');
    const state = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    if (!state.state) state.state = {};
    state.state.gridSize = 4;
    localStorage.setItem('prism-aac-settings', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-scan-group="keyboard"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotPath('03-simplified-keyboard', testInfo.project.name), fullPage: false });
});

test('settings modal (wider on tablet)', async ({ page }, testInfo) => {
  const settingsBtn = page.getByRole('button', { name: /settings/i }).first();
  await settingsBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('04-settings-modal', testInfo.project.name), fullPage: false });
  await page.keyboard.press('Escape');
});

test('emergency alert confirmation', async ({ page }, testInfo) => {
  const alertBtn = page.getByRole('button', { name: /alert/i }).first();
  if (!(await alertBtn.isVisible())) return;
  await alertBtn.click();
  const sendBtn = page.getByRole('button', { name: /^Send$/i });
  await expect(sendBtn).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('05-emergency-alert', testInfo.project.name), fullPage: false });
  const cancelBtn = page.getByRole('button', { name: /^Cancel$/i });
  await cancelBtn.click();
});

test('dark mode + high contrast', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const raw = localStorage.getItem('prism-aac-settings');
    const state = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    if (!state.state) state.state = {};
    state.state.theme = 'dark';
    state.state.highContrast = true;
    localStorage.setItem('prism-aac-settings', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotPath('06-dark-high-contrast', testInfo.project.name), fullPage: false });
});

test('switch scanning settings', async ({ page }, testInfo) => {
  const settingsBtn = page.getByRole('button', { name: /settings/i }).first();
  await settingsBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  const inputModes = page.getByText('Input Modes');
  if (await inputModes.isVisible()) {
    await inputModes.click();
    await page.waitForTimeout(300);
    const switchSection = page.getByTestId('switch-scan-settings');
    if (await switchSection.isVisible()) {
      await switchSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    }
  }
  await page.screenshot({ path: shotPath('07-switch-scanning-settings', testInfo.project.name), fullPage: false });
  await page.keyboard.press('Escape');
});

test('category search with pictograms', async ({ page }, testInfo) => {
  // Open category detail to access search
  const sidebar = page.locator('button:has-text("Search")').first();
  if (await sidebar.isVisible()) {
    await sidebar.click();
    await page.waitForTimeout(500);
    // Type a search term using the input
    await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Search all vocabulary"]') as HTMLInputElement;
      if (input) { input.value = 'help'; input.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: shotPath('08-search-with-pictograms', testInfo.project.name), fullPage: false });
});
