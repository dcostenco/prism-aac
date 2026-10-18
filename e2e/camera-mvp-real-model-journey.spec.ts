import { expect, test } from '@playwright/test';
import { installPhotographicCamera } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import { showTypingKeyboard } from './helpers/typing-keyboard';

const FRAMED_SUBJECT_SCALE = 0.65;
const STARTUP_TIMEOUT_MS = 30_000;
// The production fallback starts on entry to the center step, not when the
// user begins downloading/warming the models. Allow its 20s hold plus polling.
const CENTER_CAPTURE_TIMEOUT_MS = 25_000;
test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test('ordinary wrist setup and head-loss recovery use real models with a photographic camera source', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  await installPhotographicCamera(page, baseURL, info, { initialScale: FRAMED_SUBJECT_SCALE, subject: 'wrist', drift: 0.015 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-diagnostics').locator('summary').click();
  await page.getByTestId('tracking-diagnostics-start').click();
  await page.getByTestId('tracking-target-right_wrist').click();
  await page.getByTestId('camera-cursor-setup').click();
  await page.getByTestId('tracking-setup-start').click();
  try {
    await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center', { timeout: STARTUP_TIMEOUT_MS });
    await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-corners', { timeout: CENTER_CAPTURE_TIMEOUT_MS });
  } catch (error) {
    await page.getByTestId('tracking-setup-wizard').getByRole('button', { name: 'Cancel', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByTestId('tracking-diagnostics-save').click();
    const report = await download; await report.saveAs(info.outputPath('photographic-source-diagnostic.json'));
    throw error;
  }
  await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-tracker-status', 'tracking');
  await safeScreenshot(page, info.outputPath('real-model-wrist-calibration.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"]'],
    criticalSelectors: ['[data-testid="tracking-save-center-only"]'], occluderSelectors: [],
  });
  await page.getByTestId('tracking-save-center-only').click();
  await page.getByTestId('tracking-test-skip').click();
  await page.getByTestId('tracking-confirm').click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload(); // Confirmed wrist and orientation binding survive an ordinary reopening.
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking', { timeout: 30_000 });
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-motion-paused', 'true', { timeout: 15_000 });
  await page.evaluate(() => { (window as unknown as { cameraMvpPhoto: { absent: boolean } }).cameraMvpPhoto.absent = true; });
  await expect(page.getByTestId('camera-input-notice')).toContainText('Face not verified', { timeout: 15_000 });
  await expect(page.getByTestId('camera-input-notice')).not.toContainText('Camera tracking stopped');
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'lost');
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-motion-paused', 'false');
  await showTypingKeyboard(page);
  const key = page.locator('button[data-key="C"]');
  await key.click(); await expect(page.getByTestId('message-text')).toHaveText('c');
  await safeScreenshot(page, info.outputPath('real-model-head-loss.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-notice"]'],
    criticalSelectors: ['[data-testid="camera-input-notice"]', '[data-key-row="controls"]'],
    occluderSelectors: ['[data-testid="camera-input-status"]'],
  });
  await page.evaluate(() => { (window as unknown as { cameraMvpPhoto: { denied: boolean } }).cameraMvpPhoto.denied = true; });
  await page.getByTestId('camera-input-notice').getByRole('button', { name: /^Try again/ }).click();
  await expect(page.getByTestId('camera-input-notice')).toContainText('Camera access is unavailable', { timeout: 15_000 });
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'stopped');
  await key.click(); await expect(page.getByTestId('message-text')).toHaveText('cc');
  await safeScreenshot(page, info.outputPath('real-model-camera-denied.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-notice"]'],
    criticalSelectors: ['[data-testid="camera-input-notice"]', '[data-key-row="controls"]'], occluderSelectors: [],
  });
  expect(errors).toEqual([]);
});
