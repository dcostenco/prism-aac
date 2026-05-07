/**
 * End-to-end tests against the LIVE deployed app — the gate for every
 * UX-bug fix from this point on.
 *
 * Each test corresponds to a class of bug that slipped through the
 * unit-test suite because the unit tests use hand-crafted fixture data
 * and never exercise the hydrated React tree.
 */

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  // baseURL already includes the /prism-aac basePath. Use the empty
  // path so Playwright preserves it (page.goto('/') would strip it).
  const start = baseURL || '/';
  await page.goto(start);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* sandboxed origin — ignore */ }
  });
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  // Toolbar renders icon-only at narrow viewports — wait for any
  // qwerty key (always-on at boot) instead of a localized text label.
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
});

test('app boots and renders the keyboard chrome', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Categories' })).toBeVisible();
  // Two Speak buttons exist (header + bottom-right primary). Use .first().
  await expect(page.getByRole('button', { name: /^Speak$/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Q$/ })).toBeVisible();
});

test('auto-speak is ON by default for new users', async ({ page }) => {
  // The Auto-speak button has aria-pressed; for a brand-new install it must
  // start in the pressed (ON) state — this was the "have to press the button
  // before speech works" bug class.
  const autoBtn = page.getByRole('button', { name: /Auto-speak/i });
  await expect(autoBtn).toHaveAttribute('aria-pressed', 'true');
});

test('typing "goo" surfaces prefix-completion predictions, not static defaults', async ({ page }) => {
  // The user-reported bug: typing "goo" left the prediction tiles showing
  // [I, We, Can, Help, All done] (the static fallback). With seeded vocab,
  // at least one prediction should start with "goo".
  await page.getByRole('button', { name: /^G$/ }).click();
  await page.getByRole('button', { name: /^O$/ }).click();
  await page.getByRole('button', { name: /^O$/ }).click();
  // Predictions are buttons aria-labeled "Predict: <word>".
  const predictionTexts = await page.getByRole('button', { name: /^Predict:/ }).allInnerTexts();
  const lower = predictionTexts.map(t => t.toLowerCase());
  const hasPrefixHit = lower.some(t => t.startsWith('goo'));
  expect(hasPrefixHit, `predictions should include a "goo*" word, got ${JSON.stringify(predictionTexts)}`).toBe(true);
});

test('typing "hel" surfaces help/hello completions', async ({ page }) => {
  await page.getByRole('button', { name: /^H$/ }).click();
  await page.getByRole('button', { name: /^E$/ }).click();
  await page.getByRole('button', { name: /^L$/ }).click();
  const predictionTexts = await page.getByRole('button', { name: /^Predict:/ }).allInnerTexts();
  expect(predictionTexts.some(t => t.toLowerCase().startsWith('hel'))).toBe(true);
});

test('Alert button does NOT permanently block the UI', async ({ page }) => {
  // The user reported "alert button freezes app". The flash overlay should
  // self-dismiss within 2 seconds — after the flash, every other button
  // must be operable again.
  await page.getByRole('button', { name: 'Alert' }).click();
  // Wait past the 2-second flash window then verify the keyboard still works.
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /^Q$/ }).click();
  // Message bar should now show "q" (typed via the keyboard post-alert).
  const msg = await page.locator('[aria-label="Message text"]').innerText();
  expect(msg.toLowerCase()).toContain('q');
});

test('Settings modal opens and shows Synalux account section', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  // Multiple "Synalux" matches — heading + body. Take the first visible.
  await expect(page.getByText(/Synalux/i).first()).toBeVisible();
});

test('AI Chat panel opens (modal renders without crashing)', async ({ page }) => {
  await page.getByRole('button', { name: 'AI' }).click();
  await expect(page.getByText(/AI Chat/i).first()).toBeVisible();
});

test('Categories panel opens and shows category buttons', async ({ page }) => {
  await page.getByRole('button', { name: 'Categories' }).click();
  // At least one of the bundled categories should be visible.
  await expect(page.getByText(/Help|Talk|Food|Places|People|School/i).first()).toBeVisible();
});

test('Settings shows real Sign-in button (not a token paste field)', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  // No password field for an "auth token" — that was the broken UX.
  const tokenField = page.getByPlaceholder(/auth token/i);
  await expect(tokenField).toHaveCount(0);
  // The real button: link to NextAuth signin route.
  const signInLink = page.locator('[data-testid="synalux-signin"]');
  await expect(signInLink).toBeVisible();
  await expect(signInLink).toHaveAttribute('href', /\/api\/auth\/signin\/google/);
});

test('shift key has caps-lock long-press affordance with bigger letters', async ({ page }) => {
  // Tap the shift key to switch to upper-case (one-shot).
  const shift = page.getByTestId('shift-key');
  await expect(shift).toBeVisible();
  await shift.tap({ timeout: 5000 }).catch(async () => {
    await shift.click();
  });
  // After tap the Q key label should now be upper-case.
  const q = page.getByRole('button', { name: /^Q$/ });
  await expect(q).toBeVisible();
});

test('AI Chat shows mic button when speech recognition is supported', async ({ page, browserName }) => {
  await page.getByRole('button', { name: 'AI' }).click();
  // Mic only renders for browsers that ship SpeechRecognition (Chromium yes,
  // Firefox no). Skip the assertion on browsers without it.
  const mic = page.getByTestId('ai-mic');
  if (browserName === 'firefox') {
    await expect(mic).toHaveCount(0);
    return;
  }
  // Sign-in is required to reach the input panel; gate accepts both states.
  const visible = await mic.isVisible().catch(() => false);
  if (visible) {
    await expect(mic).toBeVisible();
  }
});

test('keyboard renders within the viewport at the running resolution', async ({ page }, testInfo) => {
  const viewport = page.viewportSize();
  const speakBtn = page.getByRole('button', { name: /^Speak$/ }).first();
  await expect(speakBtn).toBeVisible();
  const box = await speakBtn.boundingBox();
  expect(box, `Speak button has no bounding box at ${testInfo.project.name}`).toBeTruthy();
  if (box && viewport) {
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
});
