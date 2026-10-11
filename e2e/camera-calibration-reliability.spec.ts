import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeScreenshot } from './helpers/screenshot-validation';
import { expectPhotographicCameraInput, installCameraVideoProbe } from './helpers/camera-provenance';
import { installLocalCameraAccess } from './helpers/camera-access-fixture';
test.beforeEach(async ({ page, baseURL }, info) => installLocalCameraAccess(page, baseURL, info));

// Camera pixels are simulated/degraded, NOT real-device reliability evidence.
// MediaPipe WASM, detector, tracker,
// private samples, wizard, storage and cursor rendering are all production.
const photograph = readFileSync(resolve(process.cwd(), 'e2e/_fixtures/wizard-scenarios/person-on-sofa.jpg')).toString('base64');
const NEAR_CROPPED_PROFILE = { name: 'near-cropped-dim', width: 160, height: 120,
  zoom: 2.1, tilt: -0.15, brightness: 0.65, blur: 1, drift: 0.015 };
const RANGE_COMPARE_EPSILON = 1e-9;

async function expectTargetUncovered(page: Page, targetSelector: string) {
  const failures = await page.locator(targetSelector).evaluate(target => {
    const bounds = target.getBoundingClientRect();
    const issues: string[] = [];
    if (bounds.width === 0 || bounds.height === 0 || bounds.left < 0 || bounds.top < 0 ||
      bounds.right > innerWidth || bounds.bottom > innerHeight) issues.push('target clipped');
    for (const selector of ['[data-testid="tracking-wizard-pip-wrapper"]',
      '[data-testid="tracking-wizard-diag"]', '[data-testid="tracking-wizard-guide"]',
      '[data-testid="tracking-capture-center"]', '[data-testid="tracking-capture-corner"]']) {
      const panel = document.querySelector(selector)?.getBoundingClientRect();
      if (panel && panel.width > 0 && panel.height > 0 && bounds.left < panel.right &&
        bounds.right > panel.left && bounds.top < panel.bottom && bounds.bottom > panel.top) {
        issues.push(`target covered by ${selector}`);
      }
    }
    return issues;
  });
  expect(failures, 'the camera cursor must aim at an unobscured visible target').toEqual([]);
}

// Camera inference and continuous trace screencasts compete on small devices.
// Keep call/network diagnostics, plus explicit validated workflow screenshots.
test.use({ serviceWorkers: 'block', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

test.afterEach(async ({ page, context }) => {
  await page.close();
  await context.close();
});

for (const profile of [
  { name: 'close-low-resolution', width: 320, height: 240, zoom: 1.5, tilt: 0.12, brightness: 0.8, blur: 0.5, drift: 0.003 },
  NEAR_CROPPED_PROFILE,
  { ...NEAR_CROPPED_PROFILE, name: 'near-cropped-dim-center-only', centerOnly: true },
  { ...NEAR_CROPPED_PROFILE, name: 'near-cropped-dim-selected-finger', explicitFallback: true },
]) {
  test(`synthetic camera smoke ${profile.name}, drift ${profile.drift}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(installCameraVideoProbe);
    await page.addInitScript(({ photograph, profile }) => {
      const state = { x: 0, y: 0, lost: false, frames: 0, calls: 0, trackId: '', retiredTrackIds: [] as string[] };
      Object.assign(window, { __cameraReplay: state });
      // Never enable __POSE_TEST_DRIVE: it bypasses actual cursor processing.
      const image = new Image(); image.src = `data:image/jpeg;base64,${photograph}`;
      let stream: MediaStream | null = null;
      const mockCamera = async () => {
        state.calls++;
        if (stream?.getVideoTracks().some(track => track.readyState === 'live')) return stream;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = profile.width; canvas.height = profile.height;
        const context = canvas.getContext('2d')!;
        const timer = setInterval(() => {
          state.frames++;
          context.fillStyle = '#20242d'; context.fillRect(0, 0, canvas.width, canvas.height);
          const offset = profile.drift * Math.min(state.frames / 600, 1);
          if (!state.lost) {
            context.save();
            context.filter = `brightness(${profile.brightness}) blur(${profile.blur}px)`;
            context.translate(canvas.width * (0.5 + state.x + offset),
              canvas.height * (0.4 + state.y + offset / 2));
            context.rotate(profile.tilt);
            context.drawImage(image, -canvas.width * profile.zoom / 2,
              -canvas.height * profile.zoom * 0.3,
              canvas.width * profile.zoom, canvas.height * profile.zoom);
            context.restore();
          }
        }, 33);
        stream = canvas.captureStream(30);
        const track = stream.getVideoTracks()[0];
        state.trackId = track.id;
        const stop = track.stop.bind(track);
        track.stop = () => { state.retiredTrackIds.push(track.id); clearInterval(timer); stop(); };
        return stream;
      };
      // Preserve the fixture across WebKit's instance-method replacement.
      MediaDevices.prototype.getUserMedia = mockCamera;
      navigator.mediaDevices.getUserMedia = mockCamera;
    }, { photograph, profile });
    await page.clock.install();
    await page.goto('/prism-aac');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    const toggle = page.getByRole('button', { name: 'Camera input', exact: true });
    if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
    // Head-only photo: the finger case checks honest explicit fallback,
    // not successful finger recognition from a head-only frame.
    const explicitFallback = 'explicitFallback' in profile && profile.explicitFallback;
    const initialTarget = explicitFallback ? 'right_index' : 'nose';
    await page.getByTestId(`tracking-target-${initialTarget}`).click();
    await expect(page.getByTestId(`tracking-target-${initialTarget}`)).toHaveAttribute('data-selected', 'true');
    await page.getByRole('button', { name: /Set Up Tracking/ }).click();
    await safeScreenshot(page, info.outputPath('setup-entry.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-start"]'],
      criticalSelectors: ['[data-testid="tracking-setup-start"]'],
      occluderSelectors: ['[data-testid="tracking-wizard-pip-wrapper"]', '[data-testid="tracking-wizard-status"]'],
    });
    await page.getByTestId('tracking-setup-start').click();
    await expectPhotographicCameraInput(page, '__cameraReplay');
    const wizard = page.getByTestId('tracking-setup-wizard');
    if (explicitFallback) {
      await expect(wizard.getByRole('button', { name: /Head/ })).toBeVisible({ timeout: 45_000 });
      await page.waitForTimeout(1800);
      await expect(wizard).toHaveAttribute('data-phase', 'detecting');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('prism-aac-settings')!).state.cameraTrackingTarget)).toBe('right_index');
      await safeScreenshot(page, info.outputPath('selected-finger-explicit-fallback.png'), {
        expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"][data-phase="detecting"]'],
      });
      await wizard.getByRole('button', { name: /Head/ }).click();
      await wizard.getByRole('button', { name: /^Calibrate Head/ }).click();
    }
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center', { timeout: 45_000 });
    await expect(wizard).toHaveAttribute('data-tracker-status', 'tracking');
    const capture = page.getByTestId('tracking-capture-center');
    await expect(capture).toBeEnabled();
    await expectPhotographicCameraInput(page, '__cameraReplay');
    // Neutral must fit the calibration circle after live recentering, not
    // require already-calibrated movement to reach it in the first place.
    await expect.poll(async () => {
      const cursor = await page.getByTestId('tracking-wizard-cursor').boundingBox();
      const circle = await page.getByTestId('tracking-center-target').boundingBox();
      if (!cursor || !circle) return Infinity;
      return Math.hypot(cursor.x + cursor.width / 2 - circle.x - circle.width / 2,
        cursor.y + cursor.height / 2 - circle.y - circle.height / 2) + cursor.width / 2;
    }, { timeout: 8_000 }).toBeLessThan(55);
    // Exercise the hands-free stable-hold path. Its live sample-count label
    // resizes the manual button and auto-capture can detach it during a
    // Playwright stability wait; neither should disable automatic capture.
    // pauseAt can run queued tracker callbacks before pausing JS, and native
    // CSS transitions continue afterward. Credit only the settled frozen
    // geometry, not the earlier live fit. Never inject a pose or cursor.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200));
    await expect.poll(() => page.getByTestId('tracking-wizard-cursor').evaluate(cursor =>
      cursor.getAnimations().some(animation => animation.playState === 'running'),
    ), { timeout: 2_000 }).toBe(false);
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center');
    const frozenCursor = (await page.getByTestId('tracking-wizard-cursor').boundingBox())!;
    const frozenCircle = (await page.getByTestId('tracking-center-target').boundingBox())!;
    expect(frozenCursor).not.toBeNull();
    expect(frozenCircle).not.toBeNull();
    expect(Math.hypot(frozenCursor.x + frozenCursor.width / 2 - frozenCircle.x - frozenCircle.width / 2,
      frozenCursor.y + frozenCursor.height / 2 - frozenCircle.y - frozenCircle.height / 2) +
      frozenCursor.width / 2).toBeLessThan(55);
    // Pointer-transparent instructions/diagnostics still obscure calibration.
    // This is independent of cursor fit and must not be waived by it.
    await expectTargetUncovered(page, '[data-testid="tracking-center-target"]');
    const captureBounds = (await capture.boundingBox())!;
    expect(captureBounds.height).toBeGreaterThanOrEqual(48);
    expect(captureBounds.y + captureBounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await safeScreenshot(page, info.outputPath('center-with-drift.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-center-target"]'],
      criticalSelectors: ['[data-testid="tracking-capture-center"]', '[data-testid="tracking-calibrate-skip"]'],
      occluderSelectors: ['[data-testid="tracking-wizard-pip-wrapper"]', '[data-testid="tracking-wizard-diag"]', '[data-testid="tracking-wizard-status"]'],
    });
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center');
    expect(await page.getByTestId('tracking-wizard-cursor').boundingBox()).toEqual(frozenCursor);
    expect(await page.getByTestId('tracking-center-target').boundingBox()).toEqual(frozenCircle);
    await page.clock.resume();
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-corners', { timeout: 25_000 });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await expectTargetUncovered(page, '[data-testid="tracking-corner-target-0"]');
    await safeScreenshot(page, info.outputPath('corner-workarea.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-corner-target-0"]'],
      criticalSelectors: ['[data-testid="tracking-capture-corner"]', '[data-testid="tracking-save-center-only"]',
        '[data-testid="tracking-corners-skip"]'],
      occluderSelectors: ['[data-testid="tracking-wizard-pip-wrapper"]', '[data-testid="tracking-wizard-diag"]', '[data-testid="tracking-wizard-status"]'],
    });
    await page.clock.resume();
    const centerOnly = 'centerOnly' in profile && profile.centerOnly;
    if (centerOnly) {
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.getByTestId('tracking-save-center-only').click();
      await page.clock.resume();
    } else {
    const offsets = [[0.10, -0.08], [-0.10, -0.08], [-0.10, 0.08], [0.10, 0.08]];
    for (let index = 0; index < offsets.length; index++) {
      const [x, y] = offsets[index];
      await page.evaluate(({ x, y }) => Object.assign((window as unknown as {
        __cameraReplay: object }).__cameraReplay, { x, y }), { x, y });
      // Follow the hands-free five-second capture path with fresh image
      // frames. No force-click or fabricated calibration/cursor callbacks.
      if (index < offsets.length - 1) {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          `Step 2: Corners (${index + 2}/4)`, { timeout: 12_000 });
      }
    }
    }
    await expect(wizard).toHaveAttribute('data-phase', 'accuracy-test', { timeout: 12_000 });
    await expectTargetUncovered(page, '[data-active="true"][data-testid^="tracking-test-target-"]');
    // This limited-motion replay is accepted by the runtime. The visible
    // diagnostic must not contradict it with a legacy, stricter range floor.
    await expect(page.getByTestId('tracking-wizard-diag')).toContainText('min-range: OK');
    const centerCalibration = centerOnly ? await page.evaluate(() => {
      const orientation = innerWidth >= innerHeight ? 'landscape' : 'portrait';
      return JSON.parse(localStorage.getItem(`prism-pose-calibration-${orientation}`)!);
    }) : null;
    if (centerOnly) expect(centerCalibration.wizardCompleted).toBe(true);
    await expectPhotographicCameraInput(page, '__cameraReplay');
    const hits = await page.getByTestId('tracking-test-hits').innerText();
    await page.evaluate(() => Object.assign((window as unknown as {
      __cameraReplay: object }).__cameraReplay, { lost: true }));
    await expect(wizard).toHaveAttribute('data-tracker-status', 'lost');
    await page.waitForTimeout(800);
    await expect(page.getByTestId('tracking-test-hits')).toHaveText(hits);
    await safeScreenshot(page, info.outputPath('lost-no-false-hit.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"]'],
      criticalSelectors: ['[data-testid="tracking-test-skip"]', '[data-active="true"][data-testid^="tracking-test-target-"]'],
      occluderSelectors: ['[data-testid="tracking-wizard-pip-wrapper"]', '[data-testid="tracking-wizard-diag"]', '[data-testid="tracking-wizard-status"]'],
    });
    // Manual escape remains usable; it is not recognition/accuracy proof.
    await page.getByTestId('tracking-test-skip').click();
    const result = page.getByTestId('tracking-accuracy-result');
    await expect(result).toHaveAttribute('data-accuracy-passed', 'false');
    await expect(result).toContainText('Camera accuracy is not yet verified');
    const finishBounds = await page.getByRole('button', { name: 'Start Using Prism AAC' }).boundingBox();
    expect(finishBounds).not.toBeNull();
    expect(finishBounds!.height).toBeGreaterThanOrEqual(48);
    expect(finishBounds!.y + finishBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await safeScreenshot(page, info.outputPath('accuracy-not-verified.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-accuracy-result"]'],
      criticalSelectors: ['[data-testid="tracking-accuracy-result"]', '[data-phase="complete"] .max-w-md > button'],
      occluderSelectors: ['[data-testid="tracking-wizard-pip-wrapper"]'],
    });
    await page.evaluate(() => Object.assign((window as unknown as {
      __cameraReplay: object }).__cameraReplay, { lost: false, x: 0, y: 0 }));
    await page.getByRole('button', { name: 'Start Using Prism AAC' }).click();
    await expect(wizard).toHaveCount(0);
    // Return to the board before testing persistence. Remaining in Settings
    // lets a neutral camera dwell activate its controls; that separate
    // interaction-policy issue is not storage loss or covered by this smoke.
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tracking-target-nose')).toHaveAttribute('data-selected', 'true');
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking', { timeout: 15_000 });
    await expectPhotographicCameraInput(page, '__cameraReplay');
    expect(await page.evaluate(() =>
      JSON.parse(localStorage.getItem('prism-aac-settings')!).state.cameraInputEnabled,
    )).toBe(true);
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    await expect(page.getByRole('button', { name: 'Camera input', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tracking-target-nose')).toHaveAttribute('data-selected', 'true');
    if (centerOnly) {
      const restored = await page.evaluate(() => {
        const orientation = innerWidth >= innerHeight ? 'landscape' : 'portrait';
        return JSON.parse(localStorage.getItem(`prism-pose-calibration-${orientation}`)!);
      });
      expect(restored.wizardCompleted).toBe(true);
      expect(restored.leftX - restored.rightX + RANGE_COMPARE_EPSILON)
        .toBeGreaterThanOrEqual(centerCalibration.leftX - centerCalibration.rightX);
      expect(restored.bottomY - restored.topY + RANGE_COMPARE_EPSILON)
        .toBeGreaterThanOrEqual(centerCalibration.bottomY - centerCalibration.topY);
    }
    expect(errors).toEqual([]);
  });
}
