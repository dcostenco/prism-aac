import { expect, test } from '@playwright/test';
import { installPhotographicCamera } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';

const JITTER_PX = 24;
test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test('uncertain real-model camera readings keep manual communication available', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  await installPhotographicCamera(page, baseURL, info);
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
  const overlay = page.getByTestId('camera-input-overlay');
  await expect(overlay).toHaveAttribute('data-selection-ready', 'true', { timeout: 30_000 });
  await expect(page.getByTestId('camera-input-status')).toContainText('1.2 seconds');
  await page.evaluate(jitterPx => { (window as unknown as { cameraMvpPhoto: { jitterPx: number } }).cameraMvpPhoto.jitterPx = jitterPx; }, JITTER_PX);
  await expect(overlay).toHaveAttribute('data-selection-ready', 'false', { timeout: 15_000 });
  // The person stops moving at the current position. Readiness must remain
  // withheld while the recent noisy evidence ages out; do not forge UI state.
  await page.evaluate(() => {
    const state = (window as unknown as { cameraMvpPhoto: { jitterPx: number; lastJitter: number; pan: number } }).cameraMvpPhoto;
    state.pan += state.lastJitter; state.jitterPx = 0;
  });
  await page.locator('button[data-key="C"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('c');
  const lost = await overlay.getAttribute('data-status') === 'lost';
  const message = lost ? page.getByTestId('camera-input-notice') : page.getByTestId('camera-input-status');
  if (lost) {
    await expect(message).toContainText(/Face not verified|chosen wrist is not visible|readings changed abruptly/);
    info.annotations.push({ type: 'capture-branch', description: 'Lost verification after source movement stopped; manual-access evidence only, not an uncertainty-copy visual pass or recognition accuracy.' });
  } else await expect(message).toContainText(/automatic selection paused|Move your wrist/);
  await expect(overlay).toHaveAttribute('data-selection-ready', 'false');
  const banner = await page.getByTestId('camera-input-status').boundingBox();
  expect(banner).not.toBeNull(); expect(banner!.height).toBeLessThanOrEqual(72);
  const moving = !lost && (await message.textContent())?.includes('Move your wrist');
  info.annotations.push({ type: 'capture-state', description: lost ? 'lost' : moving ? 'moving; not an uncertainty-copy visual pass' : 'uncertain' });
  await safeScreenshot(page, info.outputPath(lost ? 'lost-camera-manual-access.png' : moving ? 'moving-camera-manual-access.png' : 'uncertain-camera-manual-access.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-status"]'],
    criticalSelectors: [lost ? '[data-testid="camera-input-notice"]' : '[data-testid="camera-input-status"]', '[data-key-row="controls"]'], occluderSelectors: [],
  });
  await expect(page.getByTestId('message-text')).toHaveText('c', { timeout: 5000 });
  expect(errors).toEqual([]);
});
