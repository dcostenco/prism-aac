import { expect, test } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';
import { installLocalCameraAccess } from './helpers/camera-access-fixture';
test.beforeEach(async ({ page, baseURL }, info) => installLocalCameraAccess(page, baseURL, info));

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

const CAMERA_SHIM = () => {
  let stream: MediaStream | null = null;
  const makeStream = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    let frame = 0;
    setInterval(() => {
      if (!context) return;
      frame += 1;
      context.fillStyle = '#20242d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f4f4f5';
      context.fillRect(260 + (frame % 4), 150, 120, 180);
    }, 33);
    return (
      canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }
    ).captureStream?.(15) ?? null;
  };

  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, writable: true });
  }
  navigator.mediaDevices.getUserMedia = async () => {
    if (!stream) stream = makeStream();
    if (!stream) throw new Error('captureStream unavailable');
    return stream;
  };
  // Instance-only shims may be replaced by WebKit during navigation.
  MediaDevices.prototype.getUserMedia = navigator.mediaDevices.getUserMedia;
};

test('bundled hand model opens the real scanning phase instead of default-profile touch calibration', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.addInitScript(CAMERA_SHIM);
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Settings' }).click();
  const calibrationSection = page.getByRole('button', { name: /Hand Calibration/ });
  await calibrationSection.scrollIntoViewIfNeeded();
  await calibrationSection.click();
  const openCalibration = page.getByRole('button', { name: /^(Scan Hand & Calibrate|Re-Calibrate)$/ });
  await openCalibration.scrollIntoViewIfNeeded();
  await openCalibration.click();
  await expect(page.getByRole('button', { name: 'Start Hand Scan' })).toBeVisible();

  const handModelResponse = page.waitForResponse(
    response => response.url().endsWith('/models/mediapipe/hand_landmarker.task'),
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Start Hand Scan' }).click();

  const response = await handModelResponse;
  expect(response.status()).toBe(200);
  expect(Number(response.headers()['content-length'])).toBe(7_819_105);
  await expect(page.getByTestId('hand-calibration-title')).toHaveText('Scanning Hand...', { timeout: 30_000 });
  await expect(page.getByTestId('hand-calibration-status')).toHaveText('Hold your hand in front of the camera');
  await expect(page.getByTestId('hand-scan-progress')).toBeVisible();
  await expect(page.getByText(/Touch Calibration/)).toHaveCount(0);
  await expect(page.getByText(/using default profile/i)).toHaveCount(0);

  await safeScreenshot(page, testInfo.outputPath('hand-scanning-model-ready-desktop.png'), {
    expectedPath: '/prism-aac',
    requiredSelectors: ['[data-testid="hand-calibration"]'],
    criticalSelectors: [
      '[data-testid="hand-calibration-title"]',
      '[data-testid="hand-calibration-status"]',
      '[data-testid="hand-scan-progress"]',
      'button[aria-label="Close hand calibration"]',
    ],
    occluderSelectors: [],
  });
});
