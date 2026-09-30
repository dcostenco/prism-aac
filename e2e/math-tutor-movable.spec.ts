import { expect, test, type Page, type Route } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

async function openMathFromVisibleControls(page: Page) {
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^(Math|Matemat)/i }).first())
    .toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /^(Math|Matemat)/i }).first().click();
  await expect(page.getByTestId('math-panel')).toBeVisible();
  await expect(page.getByTestId('math-grid-svg')).toBeVisible();
}

function sseBody(text: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
}

async function mockHint(page: Page, text: string) {
  await page.route('**/chat', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody(text),
    });
  });
}

const viewports = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'desktop-landscape', width: 1600, height: 1000 },
] as const;

for (const viewport of viewports) {
test(`hint window stays on-screen and can be moved away from the covered canvas at ${viewport.name}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openMathFromVisibleControls(page);
  await page.getByTestId('math-key-7').click();
  await mockHint(page, 'Look at the first number and decide which operation comes next.');
  await page.getByTestId('math-tutor-hint').click();

  const overlay = page.getByTestId('math-tutor-response');
  const handle = page.getByTestId('math-tutor-drag-handle');
  await expect(overlay).toContainText('Look at the first number');
  await expect(handle, 'movement must be visible and discoverable').toBeVisible();
  await expect(handle).toHaveAccessibleName(/move.*hint/i);

  const before = await overlay.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!before || !handleBox) throw new Error('hint overlay or drag handle has no layout box');
  expect(before.x).toBeGreaterThanOrEqual(0);
  expect(before.y).toBeGreaterThanOrEqual(0);
  expect(before.x + before.width).toBeLessThanOrEqual(viewport.width);
  expect(before.y + before.height).toBeLessThanOrEqual(viewport.height);

  const oldCentre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  const horizontalRoom = viewport.width - before.x - before.width - 8;
  const verticalRoom = viewport.height - before.y - before.height - 8;
  const deltaX = horizontalRoom >= 120 ? Math.min(520, horizontalRoom) : 0;
  const deltaY = verticalRoom >= 120 ? Math.min(180, verticalRoom) : -Math.min(180, before.y - 8);
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + deltaX,
    handleBox.y + handleBox.height / 2 + deltaY,
    { steps: 8 },
  );
  await page.mouse.up();

  const after = await overlay.boundingBox();
  if (!after) throw new Error('hint overlay disappeared after dragging');
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), 'drag must move the hint window')
    .toBeGreaterThan(100);
  expect(after.x).toBeGreaterThanOrEqual(0);
  expect(after.y).toBeGreaterThanOrEqual(0);
  expect(after.x + after.width).toBeLessThanOrEqual(viewport.width);
  expect(after.y + after.height).toBeLessThanOrEqual(viewport.height);
  await expect(overlay).toContainText('Look at the first number');
  await expect(page.getByTestId('math-tutor-dismiss')).toBeVisible();

  const oldCentreReleased = await page.evaluate(({ x, y }) => {
    const overlayElement = document.querySelector('[data-testid="math-tutor-response"]');
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && overlayElement && !overlayElement.contains(hit));
  }, oldCentre);
  expect(oldCentreReleased, 'the formerly covered canvas point must be reachable after moving the hint')
    .toBe(true);

  await safeScreenshot(page, testInfo.outputPath(`math-hint-moved-${viewport.name}.png`), {
    expectedPath: '/prism-aac',
    requiredSelectors: ['[data-testid="math-panel"]', '[data-testid="math-tutor-response"]'],
    criticalSelectors: [
      '[data-testid="math-tutor-drag-label"]',
      '[data-testid="math-tutor-response"] p',
      '[data-testid="math-tutor-dismiss-label"]',
    ],
    occluderSelectors: [],
  });
  await handle.focus();
  const keyboardDirection = after.x > 8 ? 'ArrowLeft' : after.y > 8 ? 'ArrowUp' : 'ArrowDown';
  await page.keyboard.press(keyboardDirection);
  const afterKeyboardMove = await overlay.boundingBox();
  if (!afterKeyboardMove) throw new Error('hint overlay disappeared after keyboard movement');
  expect(
    Math.abs(afterKeyboardMove.x - after.x) + Math.abs(afterKeyboardMove.y - after.y),
    'arrow keys must move the focused hint handle',
  ).toBeGreaterThanOrEqual(16);
  await page.getByTestId('math-tutor-dismiss').click();
  await expect(overlay, 'dismiss remains usable after moving the window').toHaveCount(0);
});
}
