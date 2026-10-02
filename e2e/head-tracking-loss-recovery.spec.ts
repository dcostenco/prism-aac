import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeScreenshot } from './helpers/screenshot-validation';
import { expectPhotographicCameraInput, installCameraVideoProbe } from './helpers/camera-provenance';
import { installLocalCameraAccess } from './helpers/camera-access-fixture';
test.beforeEach(async ({ page, baseURL }, info) => installLocalCameraAccess(page, baseURL, info));

// Real WASM/head tracker/overlay; simulated camera pixels, NOT physical proof.
const photograph = readFileSync(resolve(process.cwd(),
  'e2e/_fixtures/wizard-scenarios/person-on-sofa.jpg')).toString('base64');
test.use({ serviceWorkers: 'block', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

for (const drift of [0, 0.003, 0.015]) {
  test(`head and gesture input survives camera loss, drift ${drift}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(installCameraVideoProbe);
    await page.addInitScript(({ photograph, drift }) => {
      const state = { lost: false, frames: 0, calls: 0, trackId: '', retiredTrackIds: [] as string[] };
      Object.assign(window, { __headCameraReplay: state });
      const image = new Image(); image.src = `data:image/jpeg;base64,${photograph}`;
      let stream: MediaStream | null = null;
      const mockCamera = async () => {
        state.calls++;
        if (stream?.getVideoTracks().some(track => track.readyState === 'live')) return stream;
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
        const context = canvas.getContext('2d')!;
        const timer = setInterval(() => {
          state.frames++;
          context.fillStyle = '#20242d'; context.fillRect(0, 0, 320, 240);
          if (state.lost) return;
          const offset = drift * Math.min(state.frames / 300, 1);
          context.save(); context.filter = 'brightness(0.8) blur(0.5px)';
          // Head mode needs the face within its calibrated vertical range,
          // unlike the whole-body wizard fixture (which centers the torso).
          context.translate(320 * (0.5 + offset), 240 * (0.92 + offset / 2));
          context.rotate(0.12);
          context.drawImage(image, -240, -216, 480, 360);
          context.restore();
        }, 33);
        stream = canvas.captureStream(30);
        const track = stream.getVideoTracks()[0]; const stop = track.stop.bind(track);
        state.trackId = track.id;
        track.stop = () => { state.retiredTrackIds.push(track.id); clearInterval(timer); stop(); };
        return stream;
      };
      // WebKit can replace the instance method during navigation. Patch its
      // prototype too, or the test may unknowingly use the native fake camera.
      MediaDevices.prototype.getUserMedia = mockCamera;
      navigator.mediaDevices.getUserMedia = mockCamera;
    }, { photograph, drift });
    await page.goto('/prism-aac');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    const details = page.getByTestId('gesture-recognition-details');
    await details.locator('summary').click();
    await page.getByRole('button', { name: 'Gesture recognition', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gesture recognition', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Head tracking', exact: true }).click();
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await expectPhotographicCameraInput(page, '__headCameraReplay');
    const overlay = page.getByTestId('head-tracking-overlay');
    await expect(overlay).toHaveAttribute('data-status', 'tracking', { timeout: 45_000 });
    // Stable neutral frames must not immediately shut off this input mode.
    await page.waitForTimeout(1500);
    await expect(overlay).toHaveAttribute('data-status', 'tracking');
    await expectPhotographicCameraInput(page, '__headCameraReplay');
    const cursor = overlay.locator(':scope > div').first();
    const active = await cursor.boundingBox();
    const viewport = page.viewportSize()!;
    expect(active).not.toBeNull();
    // Reject an off-range fixture even if status says tracking: edge-pinning
    // (or dwelling a toolbar control) is not a valid neutral prerequisite.
    expect(active!.x).toBeGreaterThan(0);
    expect(active!.y).toBeGreaterThan(0);
    expect(active!.x + active!.width).toBeLessThan(viewport.width);
    expect(active!.y + active!.height).toBeLessThan(viewport.height);
    await safeScreenshot(page, info.outputPath('head-tracking-active.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-overlay"]'],
    });
    await page.evaluate(() => Object.assign((window as unknown as {
      __headCameraReplay: object }).__headCameraReplay, { lost: true }));
    await expect(overlay).toHaveAttribute('data-status', 'lost');
    const frozen = await cursor.boundingBox();
    expect(frozen).not.toBeNull();
    await page.waitForTimeout(800);
    expect(await cursor.boundingBox()).toEqual(frozen);
    await safeScreenshot(page, info.outputPath('head-tracking-lost.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-overlay"]'],
    });
    await page.evaluate(() => Object.assign((window as unknown as {
      __headCameraReplay: object }).__headCameraReplay, { lost: false }));
    await expect(overlay).toHaveAttribute('data-status', 'tracking', { timeout: 15_000 });
    await expectPhotographicCameraInput(page, '__headCameraReplay');
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
