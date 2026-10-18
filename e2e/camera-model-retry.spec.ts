import { expect, test } from '@playwright/test';
import { installPhotographicCamera } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import { showTypingKeyboard } from './helpers/typing-keyboard';

const POSE_MODEL_ROUTE = '**/models/mediapipe/pose_landmarker_lite.task';
const CAMERA_OPTIONS = { subject: 'wrist' as const, initialScale: 0.65, drift: 0.015 };
test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test('a transient pose-model download failure recovers using the visible Try again action', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  await installPhotographicCamera(page, baseURL, info, CAMERA_OPTIONS);
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
  let failedRequests = 0, available = false;
  await page.route(POSE_MODEL_ROUTE, route => {
    if (available) return route.continue();
    failedRequests++;
    return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Simulated local model-download outage' });
  });
  await page.reload();
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'stopped', { timeout: 30_000 });
  await expect(page.getByTestId('camera-input-notice')).toContainText('could not process a frame');
  expect(failedRequests).toBeGreaterThan(0);
  await showTypingKeyboard(page);
  await page.locator('button[data-key="C"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('c');
  available = true;
  await page.getByTestId('camera-input-notice').getByRole('button', { name: /^Try again/ }).click();
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking', { timeout: 30_000 });
  await expect(page.getByTestId('camera-input-notice')).toHaveCount(0);
  await safeScreenshot(page, info.outputPath('model-retry-recovered.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-status"]'],
    criticalSelectors: ['[data-testid="camera-input-status"]', '[data-key-row="controls"]'], occluderSelectors: [],
  });
  expect(errors).toEqual([]);
});
