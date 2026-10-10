import { expect, test, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

const OFFLINE_API_RESPONSE = { status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Offline scanner test' }) };
const STEP_LIMIT = 150;
const TEXT_EDGE_INSET = 2;
const CAPTION_PROBE_WORDS = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
const CAPTION_GUARD_MODES = ['hidden', 'clipped', 'covered'] as const;
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

async function assertVisiblePredictionText(page: Page) {
  // The block label includes empty padding in the rounded card's clipped
  // corners. Validate every actual text line, not that transparent padding.
  const surfaces = await page.getByTestId('prediction-label').evaluateAll((labels, inset) => labels.map(label => {
    const button = label.closest('button')!;
    const bounds = button.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(label);
    const lines = Array.from(range.getClientRects());
    const style = getComputedStyle(label);
    const visible = style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0;
    return { text: label.textContent?.trim(), visible, lines: lines.map(rect => {
      const dx = Math.min(inset, rect.width / 4), dy = Math.min(inset, rect.height / 4);
      const points = [[rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + dx, rect.top + dy], [rect.right - dx, rect.top + dy],
        [rect.left + dx, rect.bottom - dy], [rect.right - dx, rect.bottom - dy]];
      return { width: rect.width, height: rect.height,
        contained: rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom
          && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        unobstructed: points.every(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          return hit === label || hit === button || hit !== null && label.contains(hit);
        }) };
    }) };
  }), TEXT_EDGE_INSET);
  expect(surfaces).toHaveLength(5);
  for (const surface of surfaces) {
    expect(surface.text).toBeTruthy(); expect(surface.visible).toBe(true);
    expect(surface.lines.length).toBeGreaterThan(0);
    for (const line of surface.lines) {
      expect(line.width).toBeGreaterThan(0); expect(line.height).toBeGreaterThan(0);
      expect(line.contained, JSON.stringify(surface)).toBe(true);
      expect(line.unobstructed, JSON.stringify(surface)).toBe(true);
    }
  }
  console.log(`PREDICTION_TEXT_SURFACES ${JSON.stringify(surfaces)}`);
}

test('prediction text gate rejects hidden, clipped and covered captions', async ({ page }) => {
  const content = `<main>${CAPTION_PROBE_WORDS.map(word =>
    `<button style="padding:12px;margin:4px;border-radius:20px"><span data-testid="prediction-label">${word}</span></button>`
  ).join('')}</main>`;
  for (const mode of CAPTION_GUARD_MODES) {
    await page.setContent(content);
    await assertVisiblePredictionText(page);
    await page.getByTestId('prediction-label').first().evaluate((label, mutation) => {
      if (mutation === 'hidden') (label as HTMLElement).style.visibility = 'hidden';
      else if (mutation === 'clipped') {
        (label.closest('button') as HTMLElement).style.cssText = 'width:1px;max-width:1px;padding:0;overflow:hidden';
      } else {
        const rect = label.getBoundingClientRect();
        const cover = document.createElement('div');
        Object.assign(cover.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
          width: `${rect.width}px`, height: `${rect.height}px`, background: 'black', zIndex: '1000' });
        document.body.append(cover);
      }
    }, mode);
    await expect(assertVisiblePredictionText(page), `caption guard must reject ${mode}`).rejects.toThrow();
  }
});

async function highlight(page: Page, index: number) {
  const target = page.getByTestId('prediction-tile').nth(index);
  await expect(target).toBeVisible();
  for (let step = 0; step < STEP_LIMIT; step++) {
    if (await target.evaluate(node => node.classList.contains('switch-scan-active'))) {
      return (await target.getByTestId('prediction-label').textContent())!.trim().replace(/\s+/g, ' ');
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Scanner did not reach visible prediction slot ${index}`);
}

test('Settings to explicit board selection, held keys, reload and manual recovery', async ({ page, baseURL }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const app = new URL(baseURL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) throw new Error('Scanner offline fixture requires localhost');
  // Exercise local input only; never consume real cloud speech/AI or fabricate a session.
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const remoteData = url.origin !== app.origin && ['fetch', 'xhr'].includes(request.resourceType());
    if (url.pathname.includes('/api/') || remoteData) return route.fulfill({ ...OFFLINE_API_RESPONSE,
      headers: { 'access-control-allow-origin': app.origin, 'access-control-allow-credentials': 'true' } });
    return route.continue();
  });
  await page.goto('/prism-aac');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  const settings = page.getByTestId('switch-scan-settings');
  await settings.getByRole('button', { name: 'Switch scanning', exact: true }).click();
  await settings.getByRole('button', { name: 'Manual (step)', exact: true }).click();
  await settings.getByRole('button', { name: 'Group scanning', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  // Before-state regression: Settings unmount must not retire the scanner.
  await expect(page.locator('.switch-scan-active')).toHaveCount(1);
  const controller = page.getByTestId('switch-scan-controller');
  await expect(controller).toHaveAttribute('data-phase', 'items');
  expect((await controller.boundingBox())!.height).toBeLessThanOrEqual(96);
  const message = page.getByTestId('message-text');
  const first = await highlight(page, 0);
  const unrelated = page.getByRole('button', { name: 'Sound off', exact: true });
  await unrelated.focus();
  await page.keyboard.down('Space'); await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(message).toHaveText(first);
  await expect(unrelated).toBeVisible();
  const second = await highlight(page, 1); await page.keyboard.press('Enter');
  const composed = `${first} ${second}`;
  await expect(message).toHaveText(composed);
  await assertVisiblePredictionText(page);
  await safeScreenshot(page, info.outputPath('scanner-message-selected.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="switch-scan-controller"]'],
    criticalSelectors: ['[data-testid="message-text"]', '[data-testid="switch-scan-controller"] button'],
  });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
  await expect(settings.getByRole('button', { name: 'Switch scanning', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(message).toHaveText(composed);
  await page.reload();
  await expect(controller).toHaveAttribute('data-phase', 'items');
  // Existing message-store privacy policy persists preferences, not draft text.
  await expect(page.getByTestId('message-empty-prompt')).toBeVisible();
  const third = await highlight(page, 2); await page.keyboard.press('Space');
  await expect(message).toHaveText(third);
  // Use the configured finite-loop behavior, not a service-state injection.
  for (let step = 0; step < STEP_LIMIT * 3 && await controller.getAttribute('data-phase') !== 'idle'; step++) {
    await page.keyboard.press('Tab');
  }
  await expect(controller).toHaveAttribute('data-phase', 'idle');
  const restart = page.getByRole('button', { name: 'Start scanning', exact: true });
  await expect(restart).toBeVisible();
  expect((await controller.boundingBox())!.height).toBeLessThanOrEqual(96);
  await safeScreenshot(page, info.outputPath('scanner-finite-stop-restart.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="switch-scan-controller"]'],
    criticalSelectors: ['[data-testid="switch-scan-controller"] button'],
  });
  await page.evaluate(() => {
    const audit = { clicks: 0 };
    Object.assign(window, { __switchRestartAudit: audit });
    document.addEventListener('click', event => { if (!event.isTrusted) audit.clicks++; }, true);
  });
  await restart.focus(); await page.keyboard.down('Enter');
  await expect(controller).toHaveAttribute('data-phase', 'items');
  // A switch driver may duplicate keydown without marking repeat. Starting
  // the scanner must not turn that same held activation press into selection.
  await page.dispatchEvent('body', 'keydown', { key: 'Enter', repeat: false });
  expect(await page.evaluate(() => (window as unknown as { __switchRestartAudit: { clicks: number } }).__switchRestartAudit.clicks)).toBe(0);
  await page.keyboard.up('Enter');
  await expect(message).toHaveText(third);
  await page.getByRole('button', { name: 'Stop scanning', exact: true }).click();
  await expect(controller).toHaveCount(0); await expect(page.locator('.switch-scan-active')).toHaveCount(0);
  const manual = page.getByTestId('prediction-tile').nth(4);
  const fourth = (await manual.getByTestId('prediction-label').textContent())!.trim().replace(/\s+/g, ' ');
  await manual.click();
  await expect(message).toHaveText(`${third} ${fourth}`);
  await assertVisiblePredictionText(page);
  await safeScreenshot(page, info.outputPath('scanner-stopped-manual-selection.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="message-text"]'],
    criticalSelectors: ['[data-testid="message-text"]'],
  });
  expect(errors).toEqual([]);
});
