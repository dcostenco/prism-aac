import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { installPhotographicCamera } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import { showTypingKeyboard } from './helpers/typing-keyboard';

const DRIFT = 0.015;
const SUBJECT_SCALE = 0.65;
const OBSERVATION_MS = 26_000;
const SETTINGS_KEY = 'prism-aac-settings';

test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

test('fresh interleaved pauses do not auto-disable wrist input while selection remains independent', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  await installPhotographicCamera(page, baseURL, info, { subject: 'wrist', initialScale: SUBJECT_SCALE, drift: DRIFT });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-target-right_wrist').click();
  await page.getByTestId('camera-cursor-setup').click();
  await page.getByTestId('tracking-setup-start').click();
  await expect(page.getByTestId('tracking-capture-center')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('tracking-capture-center').click();
  await page.getByTestId('tracking-save-center-only').click();
  await page.getByTestId('tracking-test-skip').click();
  await page.getByTestId('tracking-confirm').click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-diagnostics').locator('summary').click();
  await page.getByTestId('tracking-diagnostics-start').click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await showTypingKeyboard(page);
  try {
    const overlay = page.getByTestId('camera-input-overlay');
    await expect(overlay).toHaveAttribute('data-status', 'tracking', { timeout: 30_000 });
    const until = Date.now() + OBSERVATION_MS;
    await expect.poll(async () => {
      await expect(overlay).toHaveCount(1);
      await expect(page.getByTestId('camera-input-stuck-toast')).toHaveCount(0);
      return Date.now() >= until;
    }, { timeout: OBSERVATION_MS + 2000, intervals: [200] }).toBe(true);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}')?.state?.cameraInputEnabled, SETTINGS_KEY)).toBe(true);
    const message = page.getByTestId('message-text');
    const previous = await message.textContent();
    await page.locator('button[data-key="C"]').click();
    await expect(message).toHaveText(`${previous === 'Type here...' ? '' : previous}c`);
    await safeScreenshot(page, info.outputPath('wrist-input-survives-between-tick-pauses.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-overlay"]'],
      criticalSelectors: ['[data-testid="message-text"]', 'button[data-key="C"]'], occluderSelectors: [],
    });
    expect(errors).toEqual([]);
  } finally {
    const state = await page.evaluate(key => ({
      capturedAtMs: performance.now(),
      source: (window as unknown as { cameraMvpPhoto: unknown }).cameraMvpPhoto,
      cameraEnabled: JSON.parse(localStorage.getItem(key) ?? '{}')?.state?.cameraInputEnabled,
      status: document.querySelector('[data-testid="camera-input-overlay"]')?.getAttribute('data-status'),
      watchdogWarning: document.querySelector('[data-testid="camera-input-stuck-toast"]')?.textContent,
    }), SETTINGS_KEY);
    writeFileSync(info.outputPath('watchdog-state.json'), JSON.stringify({ buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), ...state }, null, 2));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    await page.getByTestId('tracking-diagnostics').locator('summary').click();
    const pending = page.waitForEvent('download');
    await page.getByTestId('tracking-diagnostics-save').click();
    await (await pending).saveAs(info.outputPath('watchdog-diagnostic.json'));
  }
  info.annotations.push({ type: 'claim-boundary', description: 'One photographed subject, real SDK, simulated viewport. Watchdog availability and manual communication only; not selection accuracy, hidden-wrist safety or physical-device acceptance.' });
});
