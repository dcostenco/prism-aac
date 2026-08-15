/**
 * Regression suite for the 2026-08-15 "AI Chat UI/UX is broken" report.
 *
 * Root cause: PrismApp wrapped <CategoryPanel/> in a `flex-[3]` div whenever
 * the panel would render null. CategoryPanel's open condition is exactly
 * `none | categories | category-detail | ordering`, so that branch ALWAYS
 * wrapped nothing — and an empty flex item still claims its share of the
 * column. Measured before the fix, AI Chat:
 *
 *   viewport 1326x760 -> 343px dead, panel got 116px
 *   viewport  390x844 -> 385px dead, panel got 130px
 *   viewport  844x390 -> 204px dead of 390 total; the keyboard's bottom row,
 *                        including Speak, was pushed off-screen entirely
 *
 * These tests assert the invariants rather than pixel positions, so they hold
 * across viewports and survive restyling:
 *   1. No empty element may claim layout height.
 *   2. The keyboard must sit on the bottom edge — an AAC user cannot reach a
 *      Speak key that is off-screen, and dead space below the keyboard is the
 *      regression the first fix attempt introduced in aac-chat.
 *   3. A panel that owns the screen must meet the keyboard, with no gap.
 *
 * Run against a build containing the fix. NOTE: `npm run build` in this repo
 * can serve a STALE Tailwind stylesheet — the emitted CSS hash did not change
 * across nine consecutive incremental builds, so newly-introduced utility
 * classes silently had no effect. Use `rm -rf .next && npm run build` before
 * trusting a layout run.
 */
import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'user-safari', width: 1326, height: 760 },
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'tablet-landscape', width: 1180, height: 820 },
];

/** Every mode that renders the shared Keyboard. */
const MODES = [
  { id: 'board', open: null },
  { id: 'ai-chat', open: 'ai' },
  { id: 'aac-chat', open: 'contacts' },
] as const;

async function boot(page: Page, open: string | null) {
  await page.addInitScript(() => {
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: 'en', outputLanguage: 'ro', speechVolume: 0 },
      version: 0,
    }));
  });
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30_000 });
  if (open === 'ai') {
    await page.getByRole('button', { name: 'AI', exact: true }).first().click();
    await page.waitForSelector('[data-testid="ai-chat-panel"]', { timeout: 15_000 });
  } else if (open === 'contacts') {
    await page.locator('button', { hasText: '💬' }).first().click();
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(900);
}

/**
 * Empty elements that GROW to claim free space — the exact bug signature.
 *
 * `flex-grow > 0` is the discriminator, not merely "empty and tall". Several
 * empty boxes here legitimately reserve height: MessageBar's composed-text area
 * carries a `min-h` so the layout does not jump on the first keystroke, and the
 * prediction tiles reserve their pictogram slot. Those are sized, intentional
 * and harmless. A phantom grower is different in kind — it has no content to
 * size it, so it takes whatever is left over.
 */
async function emptyGrowers(page: Page) {
  return page.evaluate(() => {
    // Scope to the app's main vertical column — its direct children are the
    // toolbar, message bar, prediction bar, panels and keyboard, and that is
    // the stack the bug lived in. Nested `flex-1` spacers deeper in the tree
    // (CategoryPanel's side-nav pushes its lower buttons down with one) are
    // deliberate and must not be flagged.
    const column = document.querySelector<HTMLElement>('.h-svh.flex.flex-col');
    if (!column) return [{ cls: 'APP_COLUMN_NOT_FOUND', h: -1, w: -1 }];
    return [...column.children]
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .filter((e) => e.children.length === 0 && !(e.textContent || '').trim())
      .filter((e) => parseFloat(getComputedStyle(e).flexGrow || '0') > 0)
      .map((e) => ({ cls: e.className.slice(0, 70), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
      .filter((r) => r.h > 40 && r.w > 100);
  });
}

for (const vp of VIEWPORTS) {
  for (const mode of MODES) {
    test(`${mode.id} @ ${vp.name}: no empty element claims layout height`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await boot(page, mode.open);

      const growers = await emptyGrowers(page);
      expect(growers, `phantom growers: ${JSON.stringify(growers)}`).toEqual([]);
    });

    test(`${mode.id} @ ${vp.name}: keyboard reaches the bottom edge`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await boot(page, mode.open);

      const { kbBottom, viewportH, kbTop } = await page.evaluate(() => {
        const kb = document.querySelector('[data-testid="keyboard-shell"]')!.getBoundingClientRect();
        return { kbBottom: Math.round(kb.bottom), kbTop: Math.round(kb.top), viewportH: window.innerHeight };
      });
      // Off-screen (bottom row unreachable) and floating (dead space below)
      // are both failures; 2px tolerance for sub-pixel rounding.
      expect(Math.abs(kbBottom - viewportH), `kbTop=${kbTop} kbBottom=${kbBottom} viewportH=${viewportH}`).toBeLessThanOrEqual(2);
    });
  }

  test(`ai-chat @ ${vp.name}: panel meets the keyboard and nothing is clipped`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await boot(page, 'ai');

    const m = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="ai-chat-panel"]')!.getBoundingClientRect();
      const kb = document.querySelector('[data-testid="keyboard-shell"]')!.getBoundingClientRect();
      const preview = document.querySelector('[data-testid="ai-chat-input-preview"]') as HTMLElement;
      return {
        gap: Math.round(kb.top - panel.bottom),
        previewClipped: preview.scrollHeight > Math.ceil(preview.getBoundingClientRect().height) + 1,
        previewVisible: preview.getBoundingClientRect().bottom <= kb.top + 1,
      };
    });

    expect(m.gap, 'dead space between AI chat panel and keyboard').toBeLessThanOrEqual(2);
    expect(m.previewClipped, 'the typed-text preview is clipped').toBe(false);
    expect(m.previewVisible, 'the typed-text preview is hidden behind the keyboard').toBe(true);
  });
}
