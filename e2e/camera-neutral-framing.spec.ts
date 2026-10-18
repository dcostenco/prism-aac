import { expect, test } from '@playwright/test';
import { installPhotographicCamera, PHOTO_FRAMING_KEY } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import { CAMERA_WRIST_SOURCE } from '../services/cameraTrackingTargets';

const FRAMED_SUBJECT_SCALE = 0.65;
const EDGE_CAMERA_PAN_Y = 48;
const DRIFT = 0.015;
const CALIBRATION_KEYS = [`prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`, `prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`];
const LEGACY_KEYS = ['prism-pose-calibration-portrait', 'prism-pose-calibration-landscape', 'prism-pose-calibration', 'prism_pose_wizard_completed'];
const EXPECTED_RANGE = { x: 0.30, y: 0.24 };
test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

test('edge neutral asks for camera framing and can save a full-width profile after reframing', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  await installPhotographicCamera(page, baseURL, info, { initialScale: 1, drift: DRIFT, subject: 'wrist' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  // Fixed camera framing before any detector runs: keep the head and hand in
  // view, but leave too little margin below the wrist for a full neutral map.
  await page.evaluate(panY => {
    (window as unknown as { cameraMvpPhoto: { panY: number } }).cameraMvpPhoto.panY = panY;
  }, EDGE_CAMERA_PAN_Y);
  const saved = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [...CALIBRATION_KEYS, ...LEGACY_KEYS]);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-target-right_wrist').click();
  await page.getByTestId('camera-cursor-setup').click();
  await page.getByTestId('tracking-setup-start').click();
  const wizard = page.getByTestId('tracking-setup-wizard');
  const capture = page.getByTestId('tracking-capture-center');
  await expect(capture).toBeEnabled({ timeout: 30_000 });
  await capture.click();
  await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center');
  await expect(page.getByTestId('tracking-center-status')).toContainText('edge of the camera view');
  await expect(page.getByTestId('tracking-save-center-only')).toHaveCount(0);
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [...CALIBRATION_KEYS, ...LEGACY_KEYS])).toEqual(saved);
  await safeScreenshot(page, info.outputPath('edge-neutral-guidance.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"]'],
    criticalSelectors: ['[data-testid="tracking-center-status"]', '[data-testid="tracking-capture-center"]'], occluderSelectors: [],
  });
  // Hardware pixels only: move the camera farther away so both head and wrist
  // have frame margin. No synthetic landmarks, calibration or ready flag.
  await page.evaluate(({ scale, key }) => {
    const state = (window as unknown as { cameraMvpPhoto: { scale: number; panY: number } }).cameraMvpPhoto;
    state.scale = scale; state.panY = 0;
    sessionStorage.setItem(key, String(scale)); // The simulated camera keeps its position across app reloads.
  }, { scale: FRAMED_SUBJECT_SCALE, key: PHOTO_FRAMING_KEY });
  await expect(async () => {
    if (await capture.isVisible()) await capture.click();
    await expect(page.getByTestId('tracking-save-center-only')).toBeVisible();
  }).toPass({ timeout: 30_000, intervals: [1000] });
  await page.getByTestId('tracking-save-center-only').click();
  await page.getByTestId('tracking-test-skip').click();
  await page.getByTestId('tracking-confirm').click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  const raw = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)).filter(Boolean), CALIBRATION_KEYS.slice(0, 2));
  expect(raw).toHaveLength(1);
  const cal = JSON.parse(raw[0]!);
  expect(cal).toMatchObject({ wizardCompleted: true, trackingTarget: 'right_wrist', coordinateSource: CAMERA_WRIST_SOURCE });
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), LEGACY_KEYS)).toEqual(saved.slice(CALIBRATION_KEYS.length));
  expect(cal.leftX - cal.rightX).toBeCloseTo(EXPECTED_RANGE.x, 8);
  expect(cal.bottomY - cal.topY).toBeCloseTo(EXPECTED_RANGE.y, 8);
  await page.reload();
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking', { timeout: 30_000 });
  await page.locator('button[data-key="C"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('c');
  info.annotations.push({ type: 'acceptance-boundary', description: 'Framing recovery and profile persistence only; skipped accuracy targets and no selection-readiness assertion. Existing selection-safety E2E remains an independent required gate.' });
  expect(errors).toEqual([]);
});
