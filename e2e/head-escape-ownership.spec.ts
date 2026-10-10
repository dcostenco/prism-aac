import { expect, test, type Page } from '@playwright/test';
import { checkCriticalOcclusion, safeScreenshot } from './helpers/screenshot-validation';

const OFFLINE_API_RESPONSE = { status: 503, contentType: 'application/json',
  body: JSON.stringify({ error: 'Offline explicit-stop test' }) };
const PENDING_CAMERA_DEVICE = { deviceId: 'pending-head-escape-fixture',
  groupId: 'pending-head-escape-group', kind: 'videoinput', label: 'Pending test camera' };
const RESUME_LABEL_SELECTOR = '[data-testid="head-tracking-resume-label"]';
const MINIMUM_ACTION_HEIGHT = 48;
const PENDING_MODEL_LOADER_PATH = '/prism-aac/models/mediapipe/wasm/*.js';
const KEYBOARD_CONTROL_ROW = '[data-key-row="controls"]';
const STOP_NOTICE_SELECTOR = '[data-testid="head-tracking-stop-toast"]';

test.use({ serviceWorkers: 'block' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

async function openInputSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
}

async function assertCommunicationControlsUncovered(page: Page) {
  await expect(page.locator(KEYBOARD_CONTROL_ROW)).toBeVisible();
  console.log('HEAD_STOP_GEOMETRY', JSON.stringify({ viewport: page.viewportSize(),
    notice: await page.locator(STOP_NOTICE_SELECTOR).boundingBox(),
    controls: await page.locator(KEYBOARD_CONTROL_ROW).boundingBox() }));
  // Test the whole critical row, including Speak and space. Its native keys
  // keep their existing rounded styling; this gate proves row exposure, not
  // full native-key corner accessibility.
  expect(await checkCriticalOcclusion(page, { expectedPath: '/prism-aac',
    criticalSelectors: [KEYBOARD_CONTROL_ROW], occluderSelectors: [STOP_NOTICE_SELECTOR] })).toEqual([]);
}

test('Escape persists an explicit stop during scanning and requires user resume', async ({ page, baseURL }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = new URL(baseURL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) {
    throw new Error('Explicit-stop camera fixture requires localhost');
  }
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const remoteData = url.origin !== app.origin && ['fetch', 'xhr'].includes(request.resourceType());
    if (url.pathname.includes('/api/') || remoteData) return route.fulfill({ ...OFFLINE_API_RESPONSE,
      headers: { 'access-control-allow-origin': app.origin, 'access-control-allow-credentials': 'true' } });
    return route.continue();
  });
  // Keep model loading pending too: this is an Escape-during-startup test,
  // not a WASM loader or recognition test. Never filter uncaught page errors.
  await page.route(`${app.origin}${PENDING_MODEL_LOADER_PATH}`, () => new Promise<void>(() => {}));
  // A deliberately pending camera exercises the real tracker escape listener
  // without touching hardware or fabricating detector/photographic evidence.
  await page.addInitScript(device => {
    const audit = { requests: 0 };
    Object.assign(window, { __headEscapeCamera: audit });
    const pendingCamera = () => { audit.requests++; return new Promise<MediaStream>(() => {}); };
    const devices = async () => [device as MediaDeviceInfo];
    MediaDevices.prototype.getUserMedia = pendingCamera;
    MediaDevices.prototype.enumerateDevices = devices;
    navigator.mediaDevices.getUserMedia = pendingCamera;
    navigator.mediaDevices.enumerateDevices = devices;
  }, PENDING_CAMERA_DEVICE);
  await page.goto('/prism-aac');
  await openInputSettings(page);
  await page.getByRole('button', { name: 'Head tracking', exact: true }).click();
  const overlay = page.getByTestId('head-tracking-overlay');
  await expect(overlay).toHaveAttribute('data-status', 'starting');
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    __headEscapeCamera: { requests: number } }).__headEscapeCamera.requests)).toBeGreaterThan(0);
  const scanning = page.getByTestId('switch-scan-settings');
  await scanning.getByRole('button', { name: 'Switch scanning', exact: true }).click();
  await scanning.getByRole('button', { name: 'Manual (step)', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  const controller = page.getByTestId('switch-scan-controller');
  await expect(controller).toBeVisible();
  await expect(page.locator('.switch-scan-active')).toHaveCount(1);
  await page.keyboard.press('Escape');
  const toast = page.getByTestId('head-tracking-stop-toast');
  await expect(toast).toHaveAttribute('data-stop-reason', 'escape');
  await expect(overlay).toHaveCount(0);
  const resume = page.getByRole('button', { name: 'Enable Head Tracking', exact: true });
  await expect(resume).toBeVisible();
  expect((await resume.boundingBox())!.height).toBeGreaterThanOrEqual(MINIMUM_ACTION_HEIGHT);
  await expect(page.locator('.switch-scan-active')).toHaveCount(1);
  await assertCommunicationControlsUncovered(page);
  await safeScreenshot(page, info.outputPath('escape-during-scanning.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-stop-toast"]'],
    criticalSelectors: [RESUME_LABEL_SELECTOR, KEYBOARD_CONTROL_ROW],
  });
  await openInputSettings(page);
  await expect(page.getByRole('button', { name: 'Head tracking', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
  await expect(scanning.getByRole('button', { name: 'Switch scanning', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.getByRole('button', { name: 'Stop scanning', exact: true }).click();
  await expect(controller).toHaveCount(0);
  await expect(overlay).toHaveCount(0);
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(overlay).toHaveAttribute('data-status', 'starting');
  await expect(toast).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(toast).toHaveAttribute('data-stop-reason', 'escape');
  await expect(overlay).toHaveCount(0);
  await assertCommunicationControlsUncovered(page);
  await safeScreenshot(page, info.outputPath('escape-after-user-resume.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-stop-toast"]'],
    criticalSelectors: [RESUME_LABEL_SELECTOR, KEYBOARD_CONTROL_ROW],
  });
  await openInputSettings(page);
  const headToggle = page.getByRole('button', { name: 'Head tracking', exact: true });
  await headToggle.click(); await expect(headToggle).toHaveAttribute('aria-pressed', 'true');
  await headToggle.click(); await expect(headToggle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(toast).toHaveCount(0);
  await page.reload();
  await openInputSettings(page);
  await expect(page.getByRole('button', { name: 'Head tracking', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(overlay).toHaveCount(0);
  expect(errors).toEqual([]);
});
