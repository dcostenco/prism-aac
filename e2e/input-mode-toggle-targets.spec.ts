import { expect, test, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';
import { installLocalCameraAccess } from './helpers/camera-access-fixture';

const TARGET = { width: 64, height: 48, descriptionGap: 32 };
const OFFLINE_RESPONSE = { status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Offline Settings target test' }) };
const CAMERA_ROW = '[data-testid="camera-input-settings"] label:has(button[aria-label="Camera input"])';
const CAMERA_HEADING = '[data-testid="camera-input-settings"] > h4';
const HEADING_REST_HEIGHT = 48;
const CAMERA_DENIAL = 'No physical camera in this test';
const AUXILIARY_TOGGLES = ['Show touch accuracy options', 'Group scanning'];
const CAPTURE = { expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-input-settings"]'],
  criticalSelectors: [`${CAMERA_ROW} > div`, `${CAMERA_ROW} > button`] };

test.use({ serviceWorkers: 'block' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

async function openInputModes(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
}

async function waitForTogglePaint(page: Page) {
  const camera = page.getByRole('button', { name: 'Camera input', exact: true });
  await expect.poll(() => camera.evaluate(node => node.getAnimations({ subtree: true })
    .some(animation => animation.playState === 'running'))).toBe(false);
}

test('one Accessibility entry offers camera setup before enablement and keeps touch calibration separate', async ({ page, baseURL }, info) => {
  await installLocalCameraAccess(page, baseURL, info);
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const entry = dialog.locator('button[aria-expanded]').first();
  await expect(entry).toContainText('Accessibility & Input Modes');
  await entry.click();
  const group = page.getByTestId('camera-accessibility-settings');
  const setup = group.getByTestId('camera-cursor-setup');
  await expect(setup).toHaveCount(1);
  await expect(setup).toBeVisible();
  await expect(group.getByRole('button', { name: 'Camera input', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.getByRole('button', { name: 'Hand Calibration', exact: true })).toHaveCount(0);
  await safeScreenshot(page, info.outputPath('central-camera-entry.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="camera-accessibility-settings"]'],
    criticalSelectors: ['[data-testid="camera-cursor-setup"]'], occluderSelectors: [],
  });
  await setup.click();
  await expect(page.getByTestId('tracking-setup-wizard')).toBeVisible();
  await page.getByTestId('tracking-setup-wizard').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('tracking-setup-wizard')).toHaveCount(0);
  await expect(group.getByRole('button', { name: 'Camera input', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const touch = group.getByText('Touchscreen Accuracy & Hand Profiles', { exact: true });
  await touch.scrollIntoViewIfNeeded();
  await touch.click();
  await expect(group.getByRole('button', { name: /^(Scan Hand & Calibrate|Re-Calibrate)$/ })).toBeVisible();
  await expect(group.getByText('Optional touchscreen tap precision and finger-button mappings. This does not calibrate the camera cursor.', { exact: true }).last()).toBeVisible();
});

test('native Settings targets remain reachable and preferences survive reopen and reload', async ({ page, baseURL }, info) => {
  const origin = new URL(baseURL!).origin;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('Settings target fixture requires localhost');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.includes('/api/') || url.origin !== origin && ['fetch', 'xhr'].includes(request.resourceType())) {
      return route.fulfill({ ...OFFLINE_RESPONSE, headers: { 'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true' } });
    }
    return route.continue();
  });
  await installLocalCameraAccess(page, baseURL, info);
  // This is a manual Settings workflow under explicit scanner ownership,
  // not a physical-camera or cloud/session test. Never request real hardware.
  await page.addInitScript(denial => {
    const audit = { cameraCalls: 0 }; Object.assign(window, { __settingsTargetAudit: audit });
    navigator.mediaDevices.getUserMedia = async () => { audit.cameraCalls++; throw new DOMException(denial, 'NotAllowedError'); };
  }, CAMERA_DENIAL);
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await openInputModes(page);
  const scanning = page.getByRole('button', { name: 'Switch scanning', exact: true });
  await scanning.click();
  await page.getByRole('button', { name: 'Manual (step)', exact: true }).click();
  const camera = page.getByRole('button', { name: 'Camera input', exact: true });
  await expect(camera).toHaveAttribute('aria-pressed', 'false');
  await camera.click(); await expect(camera).toHaveAttribute('aria-pressed', 'true');
  const heading = page.locator(CAMERA_HEADING);
  await heading.scrollIntoViewIfNeeded();
  const restBand = await heading.boundingBox();
  expect(restBand).not.toBeNull();
  expect(restBand!.height).toBeGreaterThanOrEqual(HEADING_REST_HEIGHT);
  // The title is a noninteractive resting surface, not a larger toggle.
  // A real native tap here must leave the chosen input mode alone.
  await heading.click();
  await expect(camera).toHaveAttribute('aria-pressed', 'true');
  expect(await heading.evaluate(element => {
    const b = element.getBoundingClientRect();
    return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === element;
  })).toBe(true);
  await page.getByTestId('tracking-target-nose').click();
  await expect(page.getByTestId('tracking-target-nose')).toHaveAttribute('data-selected', 'true');
  for (const name of AUXILIARY_TOGGLES) {
    const toggle = page.getByRole('button', { name, exact: true });
    const initial = await toggle.getAttribute('aria-pressed');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', initial === 'true' ? 'false' : 'true');
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await openInputModes(page);
    await expect(toggle).toHaveAttribute('aria-pressed', initial === 'true' ? 'false' : 'true');
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed', initial!);
  }
  await camera.locator('..').evaluate(node => node.scrollIntoView({ block: 'center' }));
  const geometry = await camera.evaluate(button => {
    const b = button.getBoundingClientRect(), description = button.parentElement!.querySelector(':scope > div')!;
    const d = description.getBoundingClientRect();
    return { width: b.width, height: b.height, descriptionGap: b.left - d.right,
      captionScrollWidth: description.scrollWidth, captionClientWidth: description.clientWidth };
  });
  await waitForTogglePaint(page);
  await expect(page.getByTestId('switch-scan-controller')).toHaveAttribute('data-phase', /^(groups|items)$/);
  expect(await page.evaluate(() => (window as unknown as { __settingsTargetAudit: { cameraCalls: number } })
    .__settingsTargetAudit.cameraCalls)).toBe(0);
  await safeScreenshot(page, info.outputPath('settings-target-camera-on.png'), CAPTURE);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await openInputModes(page);
  await expect(camera).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('tracking-target-nose')).toHaveAttribute('data-selected', 'true');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload(); await openInputModes(page);
  await expect(camera).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('tracking-target-nose')).toHaveAttribute('data-selected', 'true');
  await expect(scanning).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as { __settingsTargetAudit: { cameraCalls: number } })
    .__settingsTargetAudit.cameraCalls)).toBe(0);
  await camera.click(); await expect(camera).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('tracking-target-nose')).toHaveCount(0);
  await camera.locator('..').evaluate(node => node.scrollIntoView({ block: 'center' }));
  await waitForTogglePaint(page);
  await safeScreenshot(page, info.outputPath('settings-target-camera-off.png'), CAPTURE);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.reload(); await openInputModes(page);
  await expect(camera).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('tracking-target-nose')).toHaveCount(0);
  console.log(`SETTINGS_TARGET_GEOMETRY ${JSON.stringify({ geometry, viewport: page.viewportSize() })}`);
  expect(errors).toEqual([]);
  // Normal-state assertions stay strict. Before-state runs intentionally fail
  // these final checks after capturing the same complete manual workflow.
  expect(geometry.width).toBeGreaterThanOrEqual(TARGET.width);
  expect(geometry.height).toBeGreaterThanOrEqual(TARGET.height);
  expect(geometry.descriptionGap).toBeGreaterThanOrEqual(TARGET.descriptionGap);
  expect(geometry.captionScrollWidth).toBeLessThanOrEqual(geometry.captionClientWidth);
});
