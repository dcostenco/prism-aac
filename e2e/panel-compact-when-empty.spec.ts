/**
 * Empty-panel compact behaviour — May 2026 user feedback.
 *
 * Lesson learned (logged to skill: visual-verification-required):
 * a previous version of this spec only checked DOM attributes
 * (`data-state="compact"` and the class string for `flex-none`) and
 * passed locally, but the rendered panel was still ~500px tall
 * because the empty-state body content (centered prompt + "Ask AI ✨"
 * button + 3-line copy) hadn't been collapsed. The user reported
 * "all fixes still broken" with a screenshot.
 *
 * Pin: any UI-shrinking fix MUST be verified by `boundingBox().height`
 * AND a saved screenshot, not just attribute presence. DOM-only
 * assertions are necessary but not sufficient. See SKILL:
 * visual-verification-required.
 */
import { test, expect, type Page } from '@playwright/test';

// Cap chosen to match design intent (header + one CTA bar ≤ ~130px),
// NOT to whatever the unconfigured branch happens to measure. The
// 240px cap that shipped on 2026-05-07 silently passed the
// configured-empty branch at 202px, which the user reported as broken.
// New canonical check is scripts/visual-check.mjs + verify-state-coverage.mjs
// — covers BOTH unconfigured and configured-empty. This e2e cap is the
// spec-level guardrail; the runtime verifier is the deep one.
const COMPACT_MAX_PX = 140;

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

test.describe('Empty-panel compact mode', () => {
  test('AI Chat panel compacts when empty — DOM + rendered height', async ({ page, baseURL }, testInfo) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /^(AI|IA)$/ }).first().click();
    const panel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(panel).toBeVisible();

    // L1 — DOM attribute
    await expect(panel).toHaveAttribute('data-state', 'compact');

    // L2 — class string
    const cls = await panel.getAttribute('class');
    expect(cls, 'AI Chat compact class').not.toContain('flex-[3]');
    expect(cls, 'AI Chat compact class').toContain('flex-none');

    // L3 — RENDERED height. The May 2026 regression had data-state
    // saying "compact" while the panel was ~490px tall because the
    // empty-state placeholder div was still rendered.
    const h = await rectHeight(page, '[data-testid="ai-chat-panel"]');
    await testInfo.attach('ai-chat-compact.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
    expect(h, `AI Chat compact height (rendered, must be ≤ ${COMPACT_MAX_PX}px)`).toBeLessThanOrEqual(COMPACT_MAX_PX);
  });

  test('AAC Chat panel compacts with zero contacts — DOM + rendered height', async ({ page, baseURL }, testInfo) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /Send|Mesaj|AAC/i }).first().click();
    const panel = page.locator('[data-testid="aac-chat-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'compact');
    const cls = await panel.getAttribute('class');
    expect(cls, 'AAC Chat compact class').not.toContain('flex-[3]');
    expect(cls, 'AAC Chat compact class').toContain('flex-none');

    const h = await rectHeight(page, '[data-testid="aac-chat-panel"]');
    await testInfo.attach('aac-chat-compact.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
    expect(h, `AAC Chat compact height (rendered, must be ≤ ${COMPACT_MAX_PX}px)`).toBeLessThanOrEqual(COMPACT_MAX_PX);
  });

  test('AAC Chat exposes Manage-Contacts buttons (header + CTA bar)', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /Send|Mesaj|AAC/i }).first().click();
    const headerBtn = page.locator('[data-testid="aac-chat-manage-contacts"]');
    const ctaBtn = page.locator('[data-testid="aac-chat-add-contacts-cta"]');
    await expect(headerBtn).toBeVisible();
    await expect(ctaBtn).toBeVisible();
    await expect(headerBtn).toBeEnabled();
    await expect(ctaBtn).toBeEnabled();
  });

  test('Keyboard gets the freed space when AI Chat is compact', async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await page.getByRole('button', { name: /^(AI|IA)$/ }).first().click();
    const panelH = await rectHeight(page, '[data-testid="ai-chat-panel"]');
    const kbH = await rectHeight(page, '[data-testid="keyboard-shell"]');
    // The whole point of compacting the panel: the keyboard should now
    // be substantially taller than the panel. Use 1.5× as a sanity
    // ratio — anything less means the panel is still hogging space.
    expect(kbH / panelH, `keyboard/panel height ratio (kb=${kbH}px panel=${panelH}px)`).toBeGreaterThan(1.5);
  });
});
