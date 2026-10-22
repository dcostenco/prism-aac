import { test, expect, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';
import { openPreviewKeyboard } from './helpers/web-preview';
type PreviewWindow = Window & { previewWarningChanges: number; previewLocalSpeech: string[] };

async function captureBoard(page: Page, name: string) {
  const keyboard = page.locator('[data-scan-group="keyboard"]');
  const box = await keyboard.boundingBox();
  expect(box?.height).toBeGreaterThan(0);
  const clipped = await keyboard.locator('button').evaluateAll(buttons => buttons.filter(button => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.top < 0 || rect.left < 0 || rect.bottom > innerHeight + 0.5 || rect.right > innerWidth + 0.5);
  }).map(button => button.getAttribute('aria-label')));
  expect(clipped, 'all keyboard controls must remain reachable').toEqual([]);
  await safeScreenshot(page, test.info().outputPath(name), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=message-text]'],
    criticalSelectors: ['[data-testid=message-text]', 'button[data-key="I"]', 'button[data-action="space"]', '[data-key-row="controls"] .aac-speak'],
  });
}

test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  await page.route('**/api/**', route => route.abort());
  await page.addInitScript(() => {
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    if (!localStorage.getItem('prism-aac-settings')) localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, speakOnSentenceEnd: false,
    }, version: 19 }));
  });
});

test('preview expiry preserves composition, focus, device speech dispatch and Settings without a sign-in wall', async ({ page }) => {
  let access: 'preview' | 'sign_in_required' | 'signed_in' = 'preview';
  const runtimeErrors: string[] = []; page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.clock.install();
  await page.addInitScript(() => {
    (window as PreviewWindow).previewLocalSpeech = [];
    Object.defineProperty(window.speechSynthesis, 'speak', { configurable: true, value: (utterance: SpeechSynthesisUtterance) => {
      (window as PreviewWindow).previewLocalSpeech.push(utterance.text);
      queueMicrotask(() => {
        utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
        utterance.onend?.(new Event('end') as SpeechSynthesisEvent);
      });
    } });
    localStorage.setItem('prism-aac-message', JSON.stringify({ state: { autoSpeak: false, soundEnabled: true }, version: 3 }));
  });
  let speechAttempts = 0;
  await page.route(/\/api\/v1\/(?:prism-aac\/)?tts(?:\/public)?(?:\?|$)/, route => {
    speechAttempts++;
    return route.fulfill({ status: 401, json: { error: 'Preview expired', code: 'sign_in_required' } });
  });
  await page.route('**/api/v1/prism-aac/access', route => route.fulfill({
    json: { state: access, remainingMs: access === 'preview' ? 600_000 : 0 }, headers: { 'Cache-Control': 'no-store' },
  }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'preview');
  const key = await openPreviewKeyboard(page); await key.click();
  await expect(page.getByTestId('message-text')).toHaveText('I');
  const originalKey = await key.elementHandle();
  await captureBoard(page, 'free-core-reference-active.png');
  await key.focus(); await page.clock.fastForward(470_000);
  await expect(page.getByTestId('web-preview-warning')).toBeEmpty();
  await page.evaluate(() => {
    (window as PreviewWindow).previewWarningChanges = 0;
    new MutationObserver(() => { (window as PreviewWindow).previewWarningChanges++; }).observe(
      document.querySelector('[data-testid=web-preview-warning]')!, { childList: true, characterData: true, subtree: true });
  });
  await page.clock.fastForward(10_000);
  await expect(page.getByTestId('web-preview-warning')).toHaveText('Cloud preview ends soon. Your board and device voices stay available.');
  await expect(key).toBeFocused(); await page.clock.fastForward(5_000);
  expect(await page.evaluate(() => (window as PreviewWindow).previewWarningChanges)).toBe(1);
  await expect(page.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  await captureBoard(page, 'free-core-warning.png');
  access = 'sign_in_required'; await page.clock.fastForward(130_000);
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'sign_in_required');
  await expect(key).toBeFocused();
  expect(await key.evaluate((element, original) => element === original, originalKey)).toBe(true);
  await expect(page.getByTestId('message-text')).toHaveText('I');
  // The keyboard's automatic shift affects case; composition must still append.
  await key.click(); await expect(page.getByTestId('message-text')).toHaveText(/^ii$/i);
  const composed = await page.getByTestId('message-text').innerText();
  await page.locator('[data-key-row="controls"] .aac-speak').click();
  await expect.poll(() => page.evaluate(() => (window as PreviewWindow).previewLocalSpeech)).toContain(composed);
  // Local Web Speech is instrumented: this proves dispatch, not audible quality.
  expect(speechAttempts).toBe(1);
  await captureBoard(page, 'free-core-expired.png');
  await expect(page.getByTestId('web-signin-gate')).toHaveCount(0);
  // Clearing is intentional communication state: a saved expiry snapshot must
  // not resurrect it on an account recheck or the following page reload.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('message-empty-prompt')).toBeVisible();
  const rechecked = page.waitForResponse(response => response.url().endsWith('/prism-aac/access'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await rechecked;
  await expect(page.getByTestId('message-empty-prompt')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'sign_in_required');
  await expect(page.getByTestId('message-empty-prompt')).toBeVisible();
  await page.locator('button[data-key="I"]').click();
  await expect(page.getByTestId('message-text')).toHaveText(/^i$/i);
  const newDraft = await page.getByTestId('message-text').innerText();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('message-text')).toHaveText(newDraft);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Synalux Account/ }).click();
  await expect(page.getByTestId('synalux-signin')).toBeVisible();
  await expect(page.getByText('Core AAC features (keyboard, categories, prediction, emergency) work without an account.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://github.com/dcostenco/prism-aac');
  const sourceLink = page.getByRole('link', { name: 'Source code' });
  await sourceLink.scrollIntoViewIfNeeded(); await expect(sourceLink).toBeInViewport();
  expect((await sourceLink.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await safeScreenshot(page, test.info().outputPath('free-core-guest-source.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid=aac-guest-legal-links]'],
    criticalSelectors: ['[data-testid=aac-guest-legal-links] a[href="https://github.com/dcostenco/prism-aac"]'],
  });
  access = 'signed_in'; await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-notice')).toHaveCount(0);
  await expect(page.getByTestId('message-text')).toHaveText(newDraft);
  await captureBoard(page, 'free-core-signed-in.png');
  expect(runtimeErrors).toEqual([]);
});

test('native shell retains free app access without the web preview', async ({ page }) => {
  let accessChecks = 0;
  await page.addInitScript(() => Object.assign(window, { prismNativeBridge: { signInWithApple: () => {} } }));
  await page.route('**/api/v1/prism-aac/access', route => { accessChecks++; return route.fulfill({ json: { state: 'sign_in_required', remainingMs: 0 } }); });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByTestId('web-preview-notice')).toHaveCount(0); expect(accessChecks).toBe(0);
});

test('verified communication and draft survive an access-service outage and reload', async ({ page }) => {
  let offline = false;
  await page.route('**/api/v1/prism-aac/access', route => offline ? route.abort() : route.fulfill({ json: { state: 'signed_in', remainingMs: 0 } }));
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await openPreviewKeyboard(page); await page.locator('button[data-key="I"]').click();
  await expect(page.getByTestId('message-text')).toHaveText('I');
  offline = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('web-preview-notice')).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('message-text')).toHaveText('I');
  await expect(page.getByTestId('web-preview-notice')).toHaveCount(0);
  await page.locator('button[data-key="I"]').click(); await expect(page.getByTestId('message-text')).toHaveText(/^ii$/i);
});

test('anonymous communication works during a pending check, an outage and an offline-status reload', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }); let waiting = true;
  await page.route('**/api/v1/prism-aac/access', async route => { if (waiting) await pending; return route.abort(); });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'checking');
  await openPreviewKeyboard(page); await page.locator('button[data-key="I"]').click();
  await captureBoard(page, 'free-core-checking.png');
  await page.locator('button[data-key="I"]').focus(); waiting = false; release();
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('button[data-key="I"]')).toBeFocused();
  await expect(page.getByTestId('message-text')).toHaveText('I');
  await captureBoard(page, 'free-core-access-error.png');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('message-text')).toHaveText('I');
  await expect(page.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'error');
  await page.locator('button[data-key="I"]').click(); await expect(page.getByTestId('message-text')).toHaveText(/^ii$/i);
});
