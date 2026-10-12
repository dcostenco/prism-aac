import { expect, test } from '@playwright/test';
import { installLocalCameraAccess } from './helpers/camera-access-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';

const EMPTY_PICTOGRAM_SEARCH = JSON.stringify([]);

test.use({ serviceWorkers: 'block' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test('camera options require an explicit wrist and leave noncamera access available', async ({ page, baseURL }, info) => {
  await installLocalCameraAccess(page, baseURL, info);
  // This offline camera-policy test does not exercise provider search.
  // Return a valid empty search, not a cross-origin denial without CORS.
  await page.route('https://api.arasaac.org/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' }, body: EMPTY_PICTOGRAM_SEARCH,
  }));
  await page.addInitScript(() => {
    Object.assign(window, { cameraRequests: 0 });
    navigator.mediaDevices.getUserMedia = async () => {
      (window as unknown as { cameraRequests: number }).cameraRequests++;
      throw new DOMException('Hardware intentionally unavailable in scope test', 'NotAllowedError');
    };
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  const group = page.getByTestId('camera-accessibility-settings');
  await expect(group.getByTestId('camera-cursor-setup')).toBeDisabled();
  await expect(group.getByRole('button', { name: 'Head tracking', exact: true })).toBeDisabled();
  await expect(group.getByTestId('camera-gestures-disabled')).toHaveAttribute('disabled', '');
  await group.getByTestId('gesture-recognition-details').locator('summary').click();
  await expect(group.getByRole('button', { name: 'Gesture recognition', exact: true })).toBeDisabled();
  await expect(group.locator('[data-testid^="tracking-target-"]')).toHaveCount(2);
  const warning = group.getByTestId('camera-wrist-scope');
  await warning.scrollIntoViewIfNeeded();
  const warningBounds = await warning.boundingBox();
  expect(warningBounds).not.toBeNull();
  expect(warningBounds!.width).toBeGreaterThan(200);
  expect(warningBounds!.height).toBeLessThan(page.viewportSize()!.height / 2);
  await safeScreenshot(page, info.outputPath('legacy-mode-blocked.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-wrist-scope"]'],
    criticalSelectors: ['[data-testid="camera-wrist-scope"]'], occluderSelectors: [],
  });
  await group.getByTestId('tracking-target-left_wrist').click();
  await expect(group.getByTestId('tracking-target-left_wrist')).toHaveAttribute('data-selected', 'true');
  await expect(group.getByRole('button', { name: 'Camera input', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(group.getByTestId('camera-cursor-setup')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Switch scanning', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { cameraRequests: number }).cameraRequests)).toBe(0);
  await group.getByTestId('camera-wrist-scope').scrollIntoViewIfNeeded();
  await safeScreenshot(page, info.outputPath('narrow-camera-scope.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-wrist-scope"]'],
    criticalSelectors: ['[data-testid="camera-wrist-scope"]'], occluderSelectors: [],
  });
  await group.getByTestId('camera-cursor-setup').click();
  await expect(page.getByTestId('tracking-setup-wizard')).toBeVisible();
  await expect(page.getByTestId('tracking-setup-wizard')).toContainText('Experimental wrist/arm control');
  await page.getByTestId('tracking-setup-wizard').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await expect(page.getByTestId('tracking-target-left_wrist')).toHaveAttribute('data-selected', 'true');
  expect(await page.evaluate(() => (window as unknown as { cameraRequests: number }).cameraRequests)).toBe(0);
  expect(errors).toEqual([]);
});
