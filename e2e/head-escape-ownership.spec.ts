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
const PREDICTION_BAR_SELECTOR = '[data-testid="prediction-bar"]';
const PREDICTION_FONT_FLOOR_PX = 16;
const EXPECTED_PREDICTION_COUNT = 5;
const TEXT_PROBE_INSET_PX = 2;
const MOTION_PERMISSION_GRANTED = 'granted' as const;
const MAX_SCANNER_GROUP_STEPS = 12;
const SCANNER_CONFIG_KEY = 'prism-switch-scan';
type HeadEscapeAudit = { requests: number; motionRequests: number };
const CAMERA_DENIAL = { message: 'Camera denied by test fixture', name: 'NotAllowedError' };
const STARTUP_RETRY_MODES = [
  { label: 'Head tracking', overlay: 'head-tracking-overlay', notice: 'head-tracking-notice' },
  { label: 'Camera input', overlay: 'camera-input-overlay', notice: 'camera-input-notice' },
] as const;

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

async function assertReadablePredictionWords(page: Page) {
  // Gate every actual text rectangle before capture. A label's full-width
  // empty padding can extend into its native card's rounded corners; that
  // padding is not word content or evidence of a covered communication word.
  await page.evaluate(() => document.fonts.ready);
  const words = await page.getByTestId('prediction-label').evaluateAll((labels, inset) => labels.map(label => {
    const button = label.closest('button')!, bounds = button.getBoundingClientRect();
    const style = getComputedStyle(label), range = document.createRange(); range.selectNodeContents(label);
    const lines = Array.from(range.getClientRects());
    return { text: label.textContent?.trim(), fontPx: Number.parseFloat(style.fontSize),
      visible: style.visibility === 'visible' && style.display !== 'none' && Number(style.opacity) > 0,
      fit: (label as HTMLElement).dataset.fitStatus, client: [label.clientWidth, label.clientHeight],
      mode: label.closest('[data-testid="prediction-bar"]')?.getAttribute('data-aac-input-mode'),
      card: { width: bounds.width, height: bounds.height },
      lines: lines.map(rect => ({ width: rect.width, height: rect.height,
        contained: rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom
          && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        exposed: [[rect.left + rect.width / 2, rect.top + rect.height / 2],
          [rect.left + Math.min(inset, rect.width / 4), rect.top + Math.min(inset, rect.height / 4)],
          [rect.right - Math.min(inset, rect.width / 4), rect.top + Math.min(inset, rect.height / 4)],
          [rect.left + Math.min(inset, rect.width / 4), rect.bottom - Math.min(inset, rect.height / 4)],
          [rect.right - Math.min(inset, rect.width / 4), rect.bottom - Math.min(inset, rect.height / 4)]]
          .every(([x, y]) => { const hit = document.elementFromPoint(x, y);
            return hit === label || hit === button || hit !== null && label.contains(hit); }) })) };
  }), TEXT_PROBE_INSET_PX);
  console.log('RECOVERY_PREDICTION_WORDS', JSON.stringify({ viewport: page.viewportSize(), words }));
  expect(words).toHaveLength(EXPECTED_PREDICTION_COUNT);
  for (const word of words) {
    expect(word.text).toBeTruthy(); expect(word.visible, JSON.stringify(word)).toBe(true);
    expect(word.fontPx, JSON.stringify(word)).toBeGreaterThanOrEqual(PREDICTION_FONT_FLOOR_PX);
    expect(word.fit, JSON.stringify(word)).toBe('fit'); expect(word.lines.length).toBeGreaterThan(0);
    for (const line of word.lines) {
      expect(line.width).toBeGreaterThan(0); expect(line.height).toBeGreaterThan(0);
      expect(line.contained, JSON.stringify(word)).toBe(true); expect(line.exposed, JSON.stringify(word)).toBe(true);
    }
  }
}

async function installCameraFixture(page: Page, baseURL: string, outcome: 'pending' | 'denied') {
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
  // Keep model loading pending too: these are startup recovery tests,
  // not a WASM loader or recognition test. Never filter uncaught page errors.
  await page.route(`${app.origin}${PENDING_MODEL_LOADER_PATH}`, () => new Promise<void>(() => {}));
  // A deliberately pending camera exercises the real tracker escape listener
  // without touching hardware or fabricating detector/photographic evidence.
  await page.addInitScript(({ device, motionPermission, outcome, denial }) => {
    const audit = { requests: 0, motionRequests: 0 };
    Object.assign(window, { __headEscapeCamera: audit });
    const pendingCamera = () => { audit.requests++;
      return outcome === 'denied' ? Promise.reject(new DOMException(denial.message, denial.name))
        : new Promise<MediaStream>(() => {}); };
    const devices = async () => [device as MediaDeviceInfo];
    MediaDevices.prototype.getUserMedia = pendingCamera;
    MediaDevices.prototype.enumerateDevices = devices;
    navigator.mediaDevices.getUserMedia = pendingCamera;
    navigator.mediaDevices.enumerateDevices = devices;
    const requestPermission = () => { audit.motionRequests++; return Promise.resolve(motionPermission); };
    if (window.DeviceMotionEvent) {
      Object.defineProperty(window.DeviceMotionEvent, 'requestPermission', { value: requestPermission, configurable: true });
    } else {
      Object.assign(window, { DeviceMotionEvent: class extends Event {
        static requestPermission = requestPermission;
      } });
    }
  }, { device: PENDING_CAMERA_DEVICE, motionPermission: MOTION_PERMISSION_GRANTED, outcome, denial: CAMERA_DENIAL });
}

test('Escape persists an explicit stop during scanning and requires user resume', async ({ page, baseURL }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await installCameraFixture(page, baseURL!, 'pending');
  await page.goto('/prism-aac');
  await expect(page.getByTestId('prediction-bar')).toBeVisible();
  await assertReadablePredictionWords(page);
  await openInputSettings(page);
  await page.getByRole('button', { name: 'Head tracking', exact: true }).click();
  const overlay = page.getByTestId('head-tracking-overlay');
  await expect(overlay).toHaveAttribute('data-status', 'starting');
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    __headEscapeCamera: HeadEscapeAudit }).__headEscapeCamera.requests)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as {
    __headEscapeCamera: HeadEscapeAudit }).__headEscapeCamera.motionRequests)).toBe(1);
  const scanning = page.getByTestId('switch-scan-settings');
  await scanning.getByRole('button', { name: 'Switch scanning', exact: true }).click();
  await scanning.getByRole('button', { name: 'Manual (step)', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  const controller = page.getByTestId('switch-scan-controller');
  await expect(controller).toBeVisible();
  await expect(page.locator('.switch-scan-active')).toHaveCount(1);
  await expect(overlay).toHaveAttribute('data-status', 'paused');
  await expect(overlay).toBeHidden();
  const pausedNotice = page.getByTestId('head-tracking-notice');
  await expect(pausedNotice).toHaveText(/selection paused/i);
  await assertReadablePredictionWords(page);
  expect(await checkCriticalOcclusion(page, { expectedPath: '/prism-aac',
    criticalSelectors: [KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
    occluderSelectors: ['[data-testid="head-tracking-notice"]'] })).toEqual([]);
  await safeScreenshot(page, info.outputPath('paused-during-scanning.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-notice"]'],
    criticalSelectors: [KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
  });
  const predictionGroup = page.locator('[data-scan-group="predictions"].switch-scan-active');
  for (let step = 0; step < MAX_SCANNER_GROUP_STEPS && await predictionGroup.count() === 0; step++) {
    await page.keyboard.press('Tab');
  }
  await expect(predictionGroup).toHaveCount(1);
  await page.keyboard.press('Escape');
  const toast = page.getByTestId('head-tracking-stop-toast');
  await expect(toast).toHaveAttribute('data-stop-reason', 'escape');
  await expect(overlay).toHaveCount(0);
  const resume = page.getByRole('button', { name: 'Enable Head Tracking', exact: true });
  await expect(resume).toBeVisible();
  expect((await resume.boundingBox())!.height).toBeGreaterThanOrEqual(MINIMUM_ACTION_HEIGHT);
  await expect(page.locator('.switch-scan-active')).toHaveCount(1);
  await assertCommunicationControlsUncovered(page);
  await assertReadablePredictionWords(page);
  await safeScreenshot(page, info.outputPath('escape-during-scanning.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-stop-toast"]'],
    criticalSelectors: [RESUME_LABEL_SELECTOR, KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
  });
  // The newly inserted recovery group precedes predictions. A fresh next
  // switch must reach the keyboard, not repeat the same prediction group.
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-scan-group="keyboard"].switch-scan-active')).toHaveCount(1);
  const configuredColor = await page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Scanner configuration was not persisted');
    const probe = document.createElement('span'); probe.style.color = JSON.parse(raw).highlightColor;
    return probe.style.color;
  }, SCANNER_CONFIG_KEY);
  await expect.poll(() => page.locator('[data-scan-group="keyboard"].switch-scan-active')
    .evaluate(element => getComputedStyle(element).outlineColor)).toBe(configuredColor);
  const keyboardPaint = await page.locator('[data-scan-group="keyboard"].switch-scan-active').evaluate(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { outlineWidth: Number.parseFloat(style.outlineWidth), outlineOffset: Number.parseFloat(style.outlineOffset),
      outlineColor: style.outlineColor, shadow: style.boxShadow, width: rect.width, height: rect.height };
  });
  console.log('SCANNER_GROUP_PAINT', JSON.stringify(keyboardPaint));
  expect(keyboardPaint.width).toBeGreaterThan(0); expect(keyboardPaint.height).toBeGreaterThan(0);
  expect(keyboardPaint.outlineWidth).toBeGreaterThan(0);
  expect(keyboardPaint.outlineOffset).toBeLessThanOrEqual(-keyboardPaint.outlineWidth);
  expect(keyboardPaint.shadow).toContain('inset');
  await assertReadablePredictionWords(page);
  await safeScreenshot(page, info.outputPath('navigation-after-recovery.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-scan-group="keyboard"].switch-scan-active'],
    criticalSelectors: [RESUME_LABEL_SELECTOR, KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
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
  expect(await page.evaluate(() => (window as unknown as {
    __headEscapeCamera: HeadEscapeAudit }).__headEscapeCamera.motionRequests)).toBe(2);
  await expect(overlay).toHaveAttribute('data-status', 'starting');
  await expect(toast).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(toast).toHaveAttribute('data-stop-reason', 'escape');
  await expect(overlay).toHaveCount(0);
  await assertCommunicationControlsUncovered(page);
  await assertReadablePredictionWords(page);
  await safeScreenshot(page, info.outputPath('escape-after-user-resume.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="head-tracking-stop-toast"]'],
    criticalSelectors: [RESUME_LABEL_SELECTOR, KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
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
  await assertReadablePredictionWords(page);
  // The same landscape compact rules must support the visible Words board,
  // not just typing. Use its ordinary minimize control, not storage overrides.
  if (await page.getByTestId('kb-minimize').isVisible()) await page.getByTestId('kb-minimize').click();
  await expect(page.getByTestId('prediction-bar')).toHaveAttribute('data-aac-input-mode', 'picture');
  await assertReadablePredictionWords(page);
  await safeScreenshot(page, info.outputPath('recovery-picture-words.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="prediction-bar"]', '[data-testid="picture-board"]'],
    criticalSelectors: [PREDICTION_BAR_SELECTOR],
  });
  expect(errors).toEqual([]);
});

for (const mode of STARTUP_RETRY_MODES) {
  test(`${mode.label} offers a visible retry after denied camera startup and stays manually controllable`, async ({ page, baseURL }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await installCameraFixture(page, baseURL!, 'denied');
    await page.goto('/prism-aac');
    await openInputSettings(page);
    await page.getByRole('button', { name: mode.label, exact: true }).click();
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    const overlay = page.getByTestId(mode.overlay), notice = page.getByTestId(mode.notice);
    await expect(overlay).toHaveAttribute('data-status', 'stopped');
    await expect(overlay).toBeHidden();
    await expect(notice).toContainText(/tracking stopped/i);
    const requests = await page.evaluate(() => (window as unknown as {
      __headEscapeCamera: HeadEscapeAudit }).__headEscapeCamera.requests);
    expect(requests).toBeGreaterThan(0);
    await notice.getByRole('button', { name: /^Try again/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as {
      __headEscapeCamera: HeadEscapeAudit }).__headEscapeCamera.requests)).toBeGreaterThan(requests);
    await expect(overlay).toHaveAttribute('data-status', 'stopped');
    await assertReadablePredictionWords(page);
    expect(await checkCriticalOcclusion(page, { expectedPath: '/prism-aac',
      criticalSelectors: [KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
      occluderSelectors: [`[data-testid="${mode.notice}"]`] })).toEqual([]);
    await safeScreenshot(page, info.outputPath(`${mode.notice}-retry.png`), {
      expectedPath: '/prism-aac', requiredSelectors: [`[data-testid="${mode.notice}"]`],
      criticalSelectors: [KEYBOARD_CONTROL_ROW, PREDICTION_BAR_SELECTOR],
    });
    await openInputSettings(page);
    const toggle = page.getByRole('button', { name: mode.label, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await expect(overlay).toHaveCount(0);
    await expect(notice).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
