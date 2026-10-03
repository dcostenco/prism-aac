import { test, expect, type Page } from '@playwright/test';

// The iOS Prism AAC Browser shell shows /browser full screen on touch phones.
// Two rules written for the main typing keyboard reached this one: portrait
// key-font rules gated on (pointer: coarse) grew every key row until the
// bottom row (123, space, Go/Speak) fell off the screen, and a 120px landscape
// cap left 26px keys. Desktop runs never match (pointer: coarse), so only the
// touch-device projects can see either defect.

interface KeyGeometry {
  vw: number;
  vh: number;
  count: number;
  outside: { label: string; top: number; bottom: number }[];
  minHeight: number;
}

async function keyboardGeometry(page: Page): Promise<KeyGeometry> {
  return page.evaluate(() => {
    const keys = [...document.querySelectorAll<HTMLElement>(
      '[data-testid="keyboard-shell"] [data-scan-group="keyboard"] button',
    )].filter(key => key.offsetParent !== null);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rects = keys.map(key => {
      const r = key.getBoundingClientRect();
      return { label: key.getAttribute('aria-label') || key.textContent?.trim() || '?',
        top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    });
    return {
      vw, vh, count: rects.length,
      outside: rects
        .filter(r => r.top < -0.5 || r.bottom > vh + 0.5 || r.left < -0.5 || r.right > vw + 0.5)
        .map(({ label, top, bottom }) => ({ label, top: Math.round(top), bottom: Math.round(bottom) })),
      minHeight: Math.min(...rects.map(r => r.height)),
    };
  });
}

// Playwright emulates no safe area, but the keyboard pads its controls row by
// the home-indicator inset (--aac-safe-area-bottom). Set the inset a Face ID
// iPhone reports so the bottom row is measured as a real phone lays it out.
function homeIndicatorInset(projectName: string): number {
  if (!projectName.startsWith('iphone-') || projectName.startsWith('iphone-se')) return 0;
  return projectName.endsWith('-land') ? 21 : 34;
}

for (const mode of ['go', 'speak'] as const) {
  test(`browser keyboard fits the screen with usable keys (${mode} mode)`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'touch-device projects only');
    const inset = homeIndicatorInset(testInfo.project.name);
    if (inset) await page.addInitScript(px => {
      document.addEventListener('DOMContentLoaded', () =>
        document.documentElement.style.setProperty('--aac-safe-area-bottom', `${px}px`));
    }, inset);
    await page.goto('/prism-aac/browser');
    await page.waitForSelector('[data-testid="keyboard-shell"] [data-scan-group="keyboard"] button', { timeout: 15_000 });
    if (mode === 'speak') {
      await page.locator('button[aria-label="Switch to Speak mode"]').click();
      await expect(page.locator('button[aria-label="Switch to Go mode"]')).toBeVisible();
    }
    // Let fonts and the prediction row settle before measuring.
    await page.waitForTimeout(400);

    const g = await keyboardGeometry(page);
    expect(g.count, 'keyboard rendered').toBeGreaterThan(25);
    expect(g.outside, `keys outside the ${g.vw}x${g.vh} viewport`).toEqual([]);
    // Apple's minimum control size; motor-access guidance asks for more.
    expect(g.minHeight, `smallest key at ${g.vw}x${g.vh}`).toBeGreaterThanOrEqual(44);
  });
}
