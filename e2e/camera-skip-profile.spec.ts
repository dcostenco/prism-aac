import { expect, test, type Page } from '@playwright/test';
import { installPhotographicCamera } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import { CAMERA_WRIST_SOURCE } from '../services/cameraTrackingTargets';
import { showTypingKeyboard } from './helpers/typing-keyboard';

const PROFILE_KEYS = [`prism-${CAMERA_WRIST_SOURCE}-calibration-landscape`, `prism-${CAMERA_WRIST_SOURCE}-calibration-portrait`];
const LEGACY_KEYS = ['prism-pose-calibration-landscape', 'prism-pose-calibration-portrait', 'prism-pose-calibration', 'prism_pose_wizard_completed'];
const CAMERA_OPTIONS = { initialScale: 0.65, drift: 0.015, subject: 'wrist' as const };
const SKIP_PHASES = ['center', 'corners'] as const;
const readProfiles = (page: Page) => page.evaluate(keys => keys.map(key => localStorage.getItem(key)), PROFILE_KEYS);
const readLegacyProfiles = (page: Page) => page.evaluate(keys => keys.map(key => localStorage.getItem(key)), LEGACY_KEYS);
test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

async function openSetup(page: Page) {
  await page.getByTestId('camera-cursor-setup').click();
  await page.getByTestId('tracking-setup-start').click();
}
async function captureCenterManually(page: Page) {
  await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center', { timeout: 30_000 });
  await expect(page.getByTestId('tracking-capture-center')).toBeEnabled();
  await page.getByTestId('tracking-capture-center').click();
  await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-corners');
}
async function finishSkippedSetup(page: Page) {
  await page.getByTestId('tracking-test-skip').click();
  await expect(page.getByTestId('tracking-skip-notice')).toContainText('Saved profiles will not change');
}

for (const phase of SKIP_PHASES) test(`Skip ${phase} preserves a profile created through ordinary setup after Save and reload`, async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  await installPhotographicCamera(page, baseURL, info, CAMERA_OPTIONS);
  info.annotations.push({ type: 'scope', description: 'Profile preservation through manual capture/Skip only. Automatic neutral capture and camera pause accuracy remain separate unresolved gates.' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  const legacy = await readLegacyProfiles(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-target-right_wrist').click();
  await openSetup(page);
  await captureCenterManually(page);
  await page.getByTestId('tracking-save-center-only').click();
  await page.getByTestId('tracking-test-skip').click();
  await page.getByTestId('tracking-confirm').click();
  const original = await readProfiles(page);
  expect(original.some(value => value !== null)).toBe(true);
  expect(JSON.parse(original.find(value => value !== null)!)).toMatchObject({
    wizardCompleted: true, trackingTarget: 'right_wrist', coordinateSource: CAMERA_WRIST_SOURCE,
  });
  expect(await readLegacyProfiles(page)).toEqual(legacy);
  await openSetup(page);
  if (phase === 'corners') await captureCenterManually(page);
  else await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center', { timeout: 30_000 });
  await page.getByTestId(phase === 'center' ? 'tracking-calibrate-skip' : 'tracking-corners-skip').click();
  await finishSkippedSetup(page);
  await safeScreenshot(page, info.outputPath(`skip-${phase}-preserves-profile.png`), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-skip-notice"]'],
    criticalSelectors: ['[data-testid="tracking-skip-notice"]', '[data-testid="tracking-confirm"]'], occluderSelectors: [],
  });
  await page.getByTestId('tracking-confirm').click();
  expect(await readProfiles(page)).toEqual(original);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload();
  expect(await readProfiles(page)).toEqual(original);
  expect(await readLegacyProfiles(page)).toEqual(legacy);
  await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking', { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('Skip without a saved profile leaves camera off and manual communication usable', async ({ page, baseURL }, info) => {
  test.setTimeout(90_000);
  await installPhotographicCamera(page, baseURL, info, CAMERA_OPTIONS);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  const original = await readProfiles(page);
  const legacy = await readLegacyProfiles(page);
  expect(original.every(value => value === null)).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-target-right_wrist').click();
  await openSetup(page);
  await expect(page.getByTestId('tracking-setup-wizard')).toHaveAttribute('data-phase', 'calibrate-center', { timeout: 30_000 });
  await page.getByTestId('tracking-calibrate-skip').click();
  await finishSkippedSetup(page);
  await safeScreenshot(page, info.outputPath('skip-no-profile.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-skip-notice"]'],
    criticalSelectors: ['[data-testid="tracking-skip-notice"]', '[data-testid="tracking-confirm"]'], occluderSelectors: [],
  });
  await page.getByTestId('tracking-confirm').click();
  expect(await readProfiles(page)).toEqual(original);
  await expect(page.getByRole('button', { name: 'Camera input', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Camera input', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload();
  expect(await readProfiles(page)).toEqual(original);
  expect(await readLegacyProfiles(page)).toEqual(legacy);
  await expect(page.getByTestId('camera-input-overlay')).toHaveCount(0);
  await showTypingKeyboard(page);
  await page.locator('button[data-key="C"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('c');
  expect(errors).toEqual([]);
});
