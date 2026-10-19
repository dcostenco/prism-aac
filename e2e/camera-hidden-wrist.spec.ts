import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { installPhotographicCamera, PHOTO_DRIFT_RAMP_MS } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import english from '../i18n/en.json';
import { showTypingKeyboard } from './helpers/typing-keyboard';

const DRIFTS = [0, 0.003, 0.015];
const OBSERVE_MS = 8000;
test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

for (const drift of DRIFTS) test(`hidden wrist cannot calibrate or move the camera cursor, drift=${drift}`, async ({ page, baseURL }, info) => {
  test.setTimeout(90_000);
  await installPhotographicCamera(page, baseURL, info, { initialScale: 0.65, drift, subject: 'head' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByTestId('tracking-target-right_wrist').click();
  await page.getByTestId('camera-cursor-setup').click();
  await page.getByTestId('tracking-setup-start').click();
  const wizard = page.getByTestId('tracking-setup-wizard');
  // A face/head failure is not proof of the new wrist guard. Wait for the
  // specific wrist-missing response while the real face detector is running.
  await expect(page.getByTestId('tracking-wizard-status')).toHaveText(english.camera_loss_wrist, { timeout: 30_000 });
  const guidance = page.getByTestId('tracking-detection-status');
  await expect(guidance).toHaveText(english.camera_loss_wrist);
  const until = await page.evaluate(({ hold, ramp }) => Math.max(performance.now() + hold, ramp + 1000),
    { hold: OBSERVE_MS, ramp: PHOTO_DRIFT_RAMP_MS });
  const observationStart = await page.evaluate(() => performance.now());
  await expect.poll(async () => {
    await expect(wizard).toHaveAttribute('data-tracker-status', 'lost');
    await expect(wizard).toHaveAttribute('data-phase', 'detecting');
    await expect(wizard).toHaveAttribute('data-pose-sample-count', '0');
    await expect(wizard).toHaveAttribute('data-selection-ready', 'false');
    await expect(guidance).toHaveText(english.camera_loss_wrist);
    await expect(page.getByTestId('tracking-capture-center')).toHaveCount(0);
    return page.evaluate(end => performance.now() >= end, until);
  }, { timeout: until - observationStart + 3000, intervals: [200] }).toBe(true);
  const hardware = await page.evaluate(() => (window as unknown as { cameraMvpPhoto: { lastBias: number; frames: number } }).cameraMvpPhoto);
  expect(hardware.lastBias).toBe(drift);
  const guidanceBounds = await guidance.boundingBox();
  const viewport = page.viewportSize()!;
  expect(guidanceBounds).not.toBeNull();
  expect(guidanceBounds!.height).toBeLessThanOrEqual(180);
  expect(guidanceBounds!.x).toBeGreaterThanOrEqual(0);
  expect(guidanceBounds!.y).toBeGreaterThanOrEqual(0);
  expect(guidanceBounds!.x + guidanceBounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(guidanceBounds!.y + guidanceBounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.getByTestId('tracking-wizard-pip').evaluate(video => {
    const input = video as HTMLVideoElement;
    return input.readyState >= 2 && input.videoWidth > 0 && input.videoHeight > 0 && input.currentTime > 0;
  })).toBe(true);
  await safeScreenshot(page, info.outputPath('hidden-wrist-refused.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"]'],
    // The noninteractive video's own "camera feed" caption covers its bottom
    // corners on phones. Validate the composed preview, not caption hit-through.
    criticalSelectors: ['[data-testid="tracking-detection-status"]', '[data-testid="tracking-wizard-status"]', '[data-testid="tracking-wizard-pip-wrapper"]'], occluderSelectors: [],
  });
  writeFileSync(info.outputPath('hidden-wrist-state.json'), JSON.stringify({
    buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), drift,
    subject: 'person-on-sofa.jpg', observationMs: until - observationStart, hardware,
    guidance: await guidance.textContent(), guidanceBounds,
    state: await wizard.evaluate(element => ({ ...((element as HTMLElement).dataset) })),
  }, null, 2));
  // Face-first failure must replace the wrist instruction, not leave stale
  // guidance after the head also leaves the physical camera pixels.
  await page.evaluate(() => {
    (window as unknown as { cameraMvpPhoto: { absent: boolean } }).cameraMvpPhoto.absent = true;
  });
  await expect(guidance).toHaveText(english.camera_loss_head, { timeout: 10_000 });
  await expect(wizard).toHaveAttribute('data-pose-sample-count', '0');
  await expect(wizard).toHaveAttribute('data-selection-ready', 'false');
  await safeScreenshot(page, info.outputPath('head-loss-guidance.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"]'],
    criticalSelectors: ['[data-testid="tracking-detection-status"]', '[data-testid="tracking-wizard-status"]'], occluderSelectors: [],
  });
  await page.evaluate(() => {
    (window as unknown as { cameraMvpPhoto: { absent: boolean } }).cameraMvpPhoto.absent = false;
  });
  await expect(guidance).toHaveText(english.camera_loss_wrist, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.getByTestId('message-text')).toHaveText('Type here...');
  await showTypingKeyboard(page);
  await page.locator('button[data-key="A"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('a');
  expect(errors).toEqual([]);
  info.annotations.push({ type: 'claim-boundary', description: 'Actual SDK on a head-visible, wrist-cropped photo. Proves local refusal and independent manual access only; not physical-camera accuracy or hand identity.' });
});
