/**
 * Empty-panel compact behaviour — May 2026 user feedback.
 *
 * Final form (round 4): when AI Chat or AAC Chat has nothing to show,
 * the panel UNMOUNTS entirely. MessageBar reads sidePanel from the
 * UI store and grows by one line (data-messaging-mode='1') so the
 * caregiver/AAC user has fatter compose room. Toolbar buttons toggle
 * panel open/close.
 *
 * History (kept in this comment as a forcing function — the
 * playwright-watchdog skill mandates state-coverage; ignoring it
 * means shipping the same bug class again):
 *
 *   Round 1: flex-[3] → flex-none. DOM said compact, render was 500px.
 *            Caught by user via screenshot.
 *   Round 2: dropped the empty-state body div. DOM + screenshot in the
 *            UNCONFIGURED branch passed at 116px. User in CONFIGURED
 *            branch still saw 202px (footer remained).
 *   Round 3: dropped the footer in compact mode. 59px in
 *            configured-empty. Header + tiny mic still visible.
 *   Round 4 (current): unmount entire panel; MessageBar +1 line.
 */
import { test, expect, type Page } from '@playwright/test';

async function bootClean(page: Page, baseURL: string | undefined) {
  const start = baseURL || '/';
  await page.goto(start);
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ }
  });
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function rectHeight(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  return Math.round(box.height);
}

test.describe('Empty-panel unmount + MessageBar expansion', () => {
  test('AI Chat panel unmounts when empty (no messages, no question typed)', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /^(AI|IA)$/ }).first().click();
    // The panel section MUST NOT be in the DOM at all when compact.
    // Round 4 fix: previously the section rendered with data-state=
    // "compact" + a residual header strip. Now the whole component
    // returns null until there's something to show.
    await page.waitForTimeout(300);
    const panel = page.locator('[data-testid="ai-chat-panel"]');
    expect(await panel.count(), 'AI Chat panel must unmount when compact').toBe(0);
  });

  test('AAC Chat panel unmounts when there are zero contacts', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /Send|Mesaj|AAC/i }).first().click();
    await page.waitForTimeout(300);
    const panel = page.locator('[data-testid="aac-chat-panel"]');
    expect(await panel.count(), 'AAC Chat panel must unmount when compact').toBe(0);
  });

  test('MessageBar expands by 1 line when AI Chat is open', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    const baseline = await rectHeight(page, '[data-messaging-mode]');
    await page.getByRole('button', { name: /^(AI|IA)$/ }).first().click();
    await page.waitForTimeout(300);
    const expanded = await rectHeight(page, '[data-messaging-mode]');
    const mode = await page.locator('[data-messaging-mode]').first().getAttribute('data-messaging-mode');
    expect(mode, 'data-messaging-mode flips to 1 when in messaging side-panel').toBe('1');
    expect(expanded, `MessageBar must grow when AI Chat is open (was ${baseline}px → now ${expanded}px)`).toBeGreaterThan(baseline);
  });

  test('MessageBar expands by 1 line when AAC Chat is open', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    const baseline = await rectHeight(page, '[data-messaging-mode]');
    await page.getByRole('button', { name: /Send|Mesaj|AAC/i }).first().click();
    await page.waitForTimeout(300);
    const expanded = await rectHeight(page, '[data-messaging-mode]');
    expect(expanded, `MessageBar must grow when AAC Chat is open (was ${baseline}px → now ${expanded}px)`).toBeGreaterThan(baseline);
  });

  test('Keyboard stays comfortably tappable when in messaging mode', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /^(AI|IA)$/ }).first().click();
    await page.waitForTimeout(300);
    const expanded = await rectHeight(page, '[data-testid="keyboard-shell"]');
    // PrismApp.tsx pins the keyboard wrapper to min-h-[clamp(280px,38svh,440px)],
    // so even after MessageBar grows by 1 line the keyboard must stay
    // ≥ ~280px (4 rows comfortably tappable). On wider/taller viewports
    // it'll be much larger; this is the floor.
    expect(expanded, `keyboard height must remain ≥ ~280px in messaging mode (was ${expanded}px)`).toBeGreaterThanOrEqual(270);
  });
});
