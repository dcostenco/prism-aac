import { expect, test } from '@playwright/test';
import { checkCriticalOcclusion, safeScreenshot } from './helpers/screenshot-validation';

const OFFLINE_RESPONSE = { status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Offline warning-layout test' }) };
const CAMERA_DENIAL = { name: 'NotAllowedError', message: 'Camera denied by warning-layout fixture' };
const WARNING_SELECTOR = '[data-testid="camera-input-recal-toast"]';
const LETTER_SELECTOR = 'button[data-key="C"]';
const CRITICAL_SELECTORS = ['[data-key-row="controls"]', '[data-key-row="letters"]:has(button[data-key="C"])'];
const MINIMUM_RECOVERY_ACTION_HEIGHT = 48;
test.use({ serviceWorkers: 'block' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

test('camera drift warning reserves space above communication and can be dismissed without losing input', async ({ page, baseURL }, info) => {
  const app = new URL(baseURL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) throw new Error('Warning fixture requires localhost');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.includes('/api/') || url.origin !== app.origin && ['fetch', 'xhr'].includes(request.resourceType())) {
      return route.fulfill({ ...OFFLINE_RESPONSE, headers: { 'access-control-allow-origin': app.origin, 'access-control-allow-credentials': 'true' } });
    }
    return route.continue();
  });
  await page.route(`${app.origin}/prism-aac/models/mediapipe/wasm/*.js`, () => new Promise<void>(() => {}));
  await page.addInitScript(denial => {
    const audit = { requests: 0 }; Object.assign(window, { __cameraWarningAudit: audit });
    const deniedCamera = () => { audit.requests++; return Promise.reject(new DOMException(denial.message, denial.name)); };
    MediaDevices.prototype.getUserMedia = deniedCamera;
    navigator.mediaDevices.getUserMedia = deniedCamera;
  }, CAMERA_DENIAL);
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await page.getByRole('button', { name: 'Camera input', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cameraWarningAudit: { requests: number } }).__cameraWarningAudit.requests)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.getByTestId('camera-input-notice')).toBeVisible();
  // This is the existing drift-warning event boundary, not a fabricated
  // successful detector/calibration. The camera remains genuinely denied.
  await page.evaluate(() => window.dispatchEvent(new Event('prism-recalibration-needed')));
  const warning = page.locator(WARNING_SELECTOR); await expect(warning).toBeVisible();
  const layout = await warning.evaluate(node => {
    const rect = node.getBoundingClientRect(), composer = document.querySelector('[data-scan-group="message-bar"]')!.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { position: style.position, translate: style.translate, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      composerTop: composer.top, viewport: { width: innerWidth, height: innerHeight } };
  });
  console.log('CAMERA_WARNING_LAYOUT', JSON.stringify(layout));
  expect(layout.position).toBe('static'); expect(layout.translate).toBe('none');
  expect(layout.bottom).toBeLessThanOrEqual(layout.composerTop);
  expect(layout.left).toBeGreaterThanOrEqual(0); expect(layout.right).toBeLessThanOrEqual(layout.viewport.width);
  expect((await warning.getByRole('button', { name: 'Dismiss', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(MINIMUM_RECOVERY_ACTION_HEIGHT);
  expect(await warning.getByRole('button', { name: 'Dismiss', exact: true }).evaluate(button => {
    const rect = button.getBoundingClientRect();
    return [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].every(([x, y]) => {
      const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
      return hit === button || hit !== null && button.contains(hit);
    });
  })).toBe(true);
  // Authored keys are rounded: their empty square corners are not native
  // targets. Gate the letter row against the warning, and independently
  // require this real key's bounds, readable caption and interior exposure.
  const letter = await page.locator(LETTER_SELECTOR).evaluate(button => {
    const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
    return { caption: button.textContent?.trim(), fontPx: Number.parseFloat(style.fontSize),
      contained: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      exposed: [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].every(([x, y]) => {
        const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
        return hit === button || hit !== null && button.contains(hit);
      }) };
  });
  console.log('CAMERA_WARNING_NATIVE_KEY', JSON.stringify(letter));
  expect(letter.caption).toBe('c'); expect(letter.fontPx).toBeGreaterThanOrEqual(16);
  expect(letter.contained).toBe(true); expect(letter.exposed).toBe(true);
  expect(await checkCriticalOcclusion(page, { expectedPath: '/prism-aac', criticalSelectors: CRITICAL_SELECTORS,
    occluderSelectors: [WARNING_SELECTOR] })).toEqual([]);
  await page.locator(LETTER_SELECTOR).click(); await expect(page.getByTestId('message-text')).toHaveText('c');
  await safeScreenshot(page, info.outputPath('drift-warning-input-exposed.png'), {
    expectedPath: '/prism-aac', requiredSelectors: [WARNING_SELECTOR],
    criticalSelectors: CRITICAL_SELECTORS, occluderSelectors: [WARNING_SELECTOR],
  });
  await warning.getByRole('button', { name: 'Dismiss', exact: true }).click(); await expect(warning).toHaveCount(0);
  await page.locator(LETTER_SELECTOR).click(); await expect(page.getByTestId('message-text')).toHaveText('cc');
  expect(errors).toEqual([]);
});
