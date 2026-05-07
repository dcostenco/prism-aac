/**
 * Empty-panel compact behaviour — May 2026 user feedback.
 *
 * User screenshots #39 (AI Chat) and #40 (Send Message) showed both
 * panels claiming flex-[3] of the viewport even when they had nothing
 * useful to render — just a one-line "type a question" prompt or
 * "no contacts yet" placeholder. Quote: "AI chat empty panel? Waste
 * of a screen." and "no contacts small icon - no way to show contacts,
 * inboxes outboxes?".
 *
 * Fix:
 *   1. Both panels switch from flex-[3] to flex-none (compact) when
 *      they have no real content — header + footer only — letting the
 *      qwerty fill the freed space.
 *   2. AAC Chat header gains a ⚙️ Manage-Contacts button and the
 *      empty-state body shows the same as a primary CTA, so the user
 *      can jump straight to Settings → Contacts instead of being told
 *      to "ask a caregiver".
 *
 * These tests pin both invariants as L3 component-render / L4 live-DOM
 * checks (a future change that drops the data-state attribute or
 * removes the manage-contacts CTA breaks them loudly).
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

test.describe('Empty-panel compact mode', () => {
  test('AI Chat panel compacts when empty (no messages, no in-flight question)', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /^(AI|IA)$/ }).first().click();
    const panel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(panel).toBeVisible();
    // Compact when empty.
    await expect(panel).toHaveAttribute('data-state', 'compact');
    // Class string must NOT include flex-[3] when compact (or the panel
    // would still be claiming three quarters of the viewport).
    const cls = await panel.getAttribute('class');
    expect(cls, 'AI Chat compact class').not.toContain('flex-[3]');
    expect(cls, 'AI Chat compact class').toContain('flex-none');
  });

  test('AAC Chat panel compacts when there are zero contacts', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    // Toolbar's Send-Message button — i18n key aac_chat. EN aria-label.
    await page.getByRole('button', { name: /Send|Mesaj|AAC/i }).first().click();
    const panel = page.locator('[data-testid="aac-chat-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'compact');
    const cls = await panel.getAttribute('class');
    expect(cls, 'AAC Chat compact class').not.toContain('flex-[3]');
    expect(cls, 'AAC Chat compact class').toContain('flex-none');
  });

  test('AAC Chat exposes Manage-Contacts buttons (header + empty-state CTA)', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /Send|Mesaj|AAC/i }).first().click();
    const headerBtn = page.locator('[data-testid="aac-chat-manage-contacts"]');
    const ctaBtn = page.locator('[data-testid="aac-chat-add-contacts-cta"]');
    await expect(headerBtn).toBeVisible();
    await expect(ctaBtn).toBeVisible();
    // Both should be clickable (the user shouldn't have to dig through
    // a menu to find contact management).
    await expect(headerBtn).toBeEnabled();
    await expect(ctaBtn).toBeEnabled();
  });
});
