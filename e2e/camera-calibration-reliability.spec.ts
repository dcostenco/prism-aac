import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeScreenshot } from './helpers/screenshot-validation';

// Camera pixels are simulated/degraded, NOT real-device reliability evidence.
// MediaPipe WASM, detector, tracker,
// private samples, wizard, storage and cursor rendering are all production.
const photograph = readFileSync(resolve(process.cwd(), 'e2e/_fixtures/wizard-scenarios/person-on-sofa.jpg')).toString('base64');

// Camera inference and continuous trace screencasts compete on small devices.
// Keep call/network diagnostics, plus explicit validated workflow screenshots.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

test.afterEach(async ({ page, context }) => {
  await page.close();
  await context.close();
});

for (const profile of [
  { name: 'close-low-resolution', width: 320, height: 240, zoom: 1.5, tilt: 0.12, brightness: 0.8, blur: 0.5, drift: 0.003 },
  { name: 'near-cropped-dim', width: 160, height: 120, zoom: 2.1, tilt: -0.15, brightness: 0.65, blur: 1, drift: 0.015 },
]) {
  test(`synthetic camera smoke ${profile.name}, drift ${profile.drift}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ photograph, profile }) => {
      const state = { x: 0, y: 0, lost: false, frames: 0 };
      Object.assign(window, { __cameraReplay: state });
      // Never enable __POSE_TEST_DRIVE: it bypasses actual cursor processing.
      const image = new Image(); image.src = `data:image/jpeg;base64,${photograph}`;
      let stream: MediaStream | null = null;
      navigator.mediaDevices.getUserMedia = async () => {
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
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); };
        return stream;
      };
    }, { photograph, profile });
    await page.clock.install();
    await page.goto('/prism-aac');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    const toggle = page.getByRole('button', { name: 'Camera input', exact: true });
    if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
    await page.getByRole('button', { name: /Set Up Tracking/ }).click();
    await page.getByTestId('tracking-setup-start').click();
    const wizard = page.getByTestId('tracking-setup-wizard');
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center', { timeout: 45_000 });
    await expect(wizard).toHaveAttribute('data-tracker-status', 'tracking');
    const capture = page.getByTestId('tracking-capture-center');
    await expect(capture).toBeEnabled();
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
    // Freeze only the already-observed render for capture: otherwise the
    // hands-free phase can advance between validation and the PNG write.
    // Resume before exercising auto-capture; no pose/cursor is injected.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200));
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center');
    await safeScreenshot(page, info.outputPath('center-with-drift.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-center-target"]'],
    });
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-center');
    await page.clock.resume();
    await expect(wizard).toHaveAttribute('data-phase', 'calibrate-corners', { timeout: 25_000 });
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
    await expect(wizard).toHaveAttribute('data-phase', 'accuracy-test', { timeout: 12_000 });
    const hits = await page.getByTestId('tracking-test-hits').innerText();
    await page.evaluate(() => Object.assign((window as unknown as {
      __cameraReplay: object }).__cameraReplay, { lost: true }));
    await expect(wizard).toHaveAttribute('data-tracker-status', 'lost');
    await page.waitForTimeout(800);
    await expect(page.getByTestId('tracking-test-hits')).toHaveText(hits);
    await safeScreenshot(page, info.outputPath('lost-no-false-hit.png'), {
      expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="tracking-setup-wizard"]'],
    });
    // Manual escape remains usable; it is not recognition/accuracy proof.
    await page.getByTestId('tracking-test-skip').click();
    await page.evaluate(() => Object.assign((window as unknown as {
      __cameraReplay: object }).__cameraReplay, { lost: false, x: 0, y: 0 }));
    await page.getByRole('button', { name: 'Start Using Prism AAC' }).click();
    await expect(wizard).toHaveCount(0);
    await expect(page.getByTestId('camera-input-overlay')).toHaveAttribute('data-status', 'tracking', { timeout: 15_000 });
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    await expect(page.getByRole('button', { name: 'Camera input', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });
}
