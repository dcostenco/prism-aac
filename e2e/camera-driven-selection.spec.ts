import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installPhotographicCamera, PHOTO_DRIFT_RAMP_MS } from './helpers/photographic-camera-fixture';
import { safeScreenshot } from './helpers/screenshot-validation';
import { showTypingKeyboard } from './helpers/typing-keyboard';

const DRIFTS = [0, 0.003, 0.015];
const SUBJECT_SCALE = 0.65;
const MOVE_MS = 900;
const REPEAT_OBSERVATION_MS = 4000;
const EXPECTED_KEY = 'H';
// Open-loop camera commands, fixed before the run. Never use cursor positions,
// hit testing or target geometry to steer the simulated camera.
const COMMANDS = {
  desktop: { width: 1280, height: 720, x: -12, y: 15, expectedX: 720, expectedY: 454 },
  'iphone-6.1': { width: 390, height: 844, x: -22, y: 30, expectedX: 240, expectedY: 642 },
} as const;
type CameraState = {
  pan: number; panY: number; drift: number; lastBias: number; frames: number;
  move: null | { startedAt: number; durationMs: number; from: { x: number; y: number }; to: { x: number; y: number } };
};
type ClickRecord = { key: string | null; action: string | null; time: number; trusted: boolean };
type TestWindow = Window & { cameraMvpPhoto: CameraState; cameraSelectionClicks: ClickRecord[] };

test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

for (const drift of DRIFTS) test(`camera movement and a pause select one letter exactly once, drift=${drift}`, async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  const command = COMMANDS[info.project.name as keyof typeof COMMANDS];
  if (!command) throw new Error('This camera trajectory is qualified only at the declared desktop and phone viewports');
  expect(page.viewportSize()).toEqual({ width: command.width, height: command.height });
  await installPhotographicCamera(page, baseURL, info, { initialScale: SUBJECT_SCALE, drift, subject: 'wrist' });
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
  let completed = false;
  try {
    // Observer only: no .click() on the target, synthetic events, handler
    // overrides, store writes or forged readiness/calibration.
    await page.evaluate(() => {
      const w = window as TestWindow; w.cameraSelectionClicks = [];
      document.addEventListener('click', event => {
        if (event.isTrusted) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target) w.cameraSelectionClicks.push({ key: target.getAttribute('data-key'), action: target.getAttribute('data-action'),
          time: performance.now(), trusted: event.isTrusted });
      }, true);
    });
    const overlay = page.getByTestId('camera-input-overlay');
    // Movement does not require selection permission. The outcome below,
    // not a ready flag, is the positive camera-selection oracle.
    await expect(overlay).toHaveAttribute('data-status', 'tracking', { timeout: 30_000 });
    await expect(page.getByTestId('message-text')).toHaveText('Type here...');
    const target = page.locator(`button[data-key="${EXPECTED_KEY}"]`);
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    // A layout assertion, not a controller: a failed assumption fails the run
    // rather than changing the camera trajectory to chase the rendered target.
    expect(command.expectedX).toBeGreaterThan(bounds!.x);
    expect(command.expectedX).toBeLessThan(bounds!.x + bounds!.width);
    expect(command.expectedY).toBeGreaterThan(bounds!.y);
    expect(command.expectedY).toBeLessThan(bounds!.y + bounds!.height);
    await page.evaluate(({ x, y, durationMs }) => {
      const state = (window as TestWindow).cameraMvpPhoto;
      state.move = { startedAt: performance.now(), durationMs, from: { x: state.pan, y: state.panY }, to: { x, y } };
    }, { x: command.x, y: command.y, durationMs: MOVE_MS });
    await page.waitForFunction(({ x, y }) => {
      const state = (window as TestWindow).cameraMvpPhoto;
      return Math.abs(state.pan - x) < 1e-6 && Math.abs(state.panY - y) < 1e-6;
    }, { x: command.x, y: command.y });
    // The injected drift keeps moving the hardware pixels after the wrist
    // command ends. Start the settled-selection deadline after that ramp,
    // while retaining every click observed throughout both kinds of motion.
    await expect.poll(() => page.evaluate(() => (window as TestWindow).cameraMvpPhoto.lastBias),
      { timeout: PHOTO_DRIFT_RAMP_MS }).toBe(drift);
    await expect(page.getByTestId('message-text')).toHaveText('h', { timeout: 15_000 });
    const observation = await page.evaluate(({ hold, ramp }) => ({
      now: performance.now(), until: Math.max(performance.now() + hold, ramp + hold),
    }), { hold: REPEAT_OBSERVATION_MS, ramp: PHOTO_DRIFT_RAMP_MS });
    await expect.poll(async () => {
      const clicks = await page.evaluate(() => (window as TestWindow).cameraSelectionClicks);
      expect(clicks.map(click => click.key)).toEqual([EXPECTED_KEY]);
      expect(clicks[0].trusted).toBe(false); // Production camera activation uses HTMLElement.click().
      await expect(page.getByTestId('message-text')).toHaveText('h');
      await expect(overlay).toHaveAttribute('data-status', 'tracking');
      return await page.evaluate(until => performance.now() >= until, observation.until);
    }, { timeout: observation.until - observation.now + 2000, intervals: [200] }).toBe(true);
    expect(await page.evaluate(() => (window as TestWindow).cameraMvpPhoto.lastBias)).toBe(drift);
    await safeScreenshot(page, info.outputPath('camera-selected-letter.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-overlay"]'],
      criticalSelectors: ['[data-testid="message-text"]', `button[data-key="${EXPECTED_KEY}"]`], occluderSelectors: [],
    });
    // A real visible mode change replaces the selected H with a different
    // control at the same fixed camera command. DOM replacement is not wrist
    // departure; it must not speak/type another symbol from the completed hold.
    await page.getByRole('button', { name: 'Switch keyboard mode', exact: true }).click();
    await expect(target).toHaveCount(0);
    const replacement = page.locator('button[data-key="("]');
    const replacementBounds = await replacement.boundingBox();
    expect(replacementBounds).not.toBeNull();
    expect(command.expectedX).toBeGreaterThan(replacementBounds!.x);
    expect(command.expectedX).toBeLessThan(replacementBounds!.x + replacementBounds!.width);
    expect(command.expectedY).toBeGreaterThan(replacementBounds!.y);
    expect(command.expectedY).toBeLessThan(replacementBounds!.y + replacementBounds!.height);
    const replacementUntil = await page.evaluate(hold => performance.now() + hold, REPEAT_OBSERVATION_MS);
    await expect.poll(async () => {
      expect((await page.evaluate(() => (window as TestWindow).cameraSelectionClicks)).map(click => click.key)).toEqual([EXPECTED_KEY]);
      await expect(page.getByTestId('message-text')).toHaveText('h');
      await expect(overlay).toHaveAttribute('data-status', 'tracking');
      await expect(overlay).toHaveAttribute('data-selection-ready', 'false');
      await expect(overlay.locator('circle[stroke-dasharray]')).toHaveCount(0);
      return await page.evaluate(until => performance.now() >= until, replacementUntil);
    }, { timeout: REPEAT_OBSERVATION_MS + 2000, intervals: [200] }).toBe(true);
    await safeScreenshot(page, info.outputPath('camera-replacement-stays-locked.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-overlay"]'],
      criticalSelectors: ['[data-testid="message-text"]', 'button[data-key="("]'], occluderSelectors: [],
    });
    await replacement.click(); // Manual communication remains independent of the camera re-arm lock.
    await expect(page.getByTestId('message-text')).toHaveText('h(');
    expect((await page.evaluate(() => (window as TestWindow).cameraSelectionClicks)).map(click => click.key)).toEqual([EXPECTED_KEY]);
    expect(errors).toEqual([]);
    completed = true;
  } finally {
    const metadata = await page.evaluate(() => {
      const w = window as TestWindow;
      return { capturedAtMs: performance.now(), hardware: w.cameraMvpPhoto, clicks: w.cameraSelectionClicks,
        message: document.querySelector('[data-testid="message-text"]')?.textContent,
        ready: document.querySelector('[data-testid="camera-input-overlay"]')?.getAttribute('data-selection-ready') };
    });
    const reportPath = info.outputPath('camera-command-and-clicks.json');
    writeFileSync(reportPath, JSON.stringify({ buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(),
      drift, command, subject: 'person-pointing-br.jpg',
      subjectSha256: createHash('sha256').update(readFileSync('e2e/_fixtures/wizard-scenarios/person-pointing-br.jpg')).digest('hex'),
      ...metadata }, null, 2));
    await info.attach('camera-command-and-clicks', { path: reportPath, contentType: 'application/json' });
    try {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
      await page.getByTestId('tracking-diagnostics').locator('summary').click();
      const pending = page.waitForEvent('download');
      await page.getByTestId('tracking-diagnostics-save').click();
      await (await pending).saveAs(info.outputPath('camera-selection-diagnostic.json'));
    } catch (error) {
      if (completed) throw error;
      info.annotations.push({ type: 'diagnostic-export-failed', description: String(error) });
    }
  }
  info.annotations.push({ type: 'claim-boundary', description: 'One photographed subject with whole-image open-loop movement. Proves an actual app camera click, not independent arm articulation or physical-device accuracy.' });
});
