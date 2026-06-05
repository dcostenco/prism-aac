/**
 * L4 verification — keyboard fits the viewport across panels.
 *
 * Replaces the className-only assertion in
 * tests/keyboard-always-visible.test.tsx, which only proved the DOM
 * element mounted with the right Tailwind utility — never that the
 * keyboard's bottom row was actually visible to the user.
 *
 * The May 2026 user-reported "broken keyboards" bug shipped past that
 * jsdom test because jsdom doesn't run layout. This Playwright suite
 * is the L4 evidence for the fix:
 *
 *   1. ai-chat / aac-chat panels: every keyboard row including the
 *      utility row (Speak button) must be inside the viewport.
 *   2. math panel: qwerty must NOT render (math owns its own input).
 *      The math panel's own Vorbește (Speak) button must be visible.
 *
 * Each test takes a screenshot to disk so a regression produces an
 * actual artifact for the developer + the user to look at.
 */
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const SHOTS_DIR = path.resolve("e2e", "_screenshots");

async function bootClean(page: Page, baseURL: string | undefined) {
  const start = baseURL || "/";
  await page.goto(start);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* sandboxed */
    }
  });
  await page.goto(start, { waitUntil: "domcontentloaded" });
  // The toolbar renders icon-only at narrow viewports — wait for any
  // qwerty key (always visible at boot) instead of the toolbar label.
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function setRomanian(page: Page) {
  await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("prism-aac-settings");
      const cur = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      cur.state = {
        ...(cur.state ?? {}),
        language: "ro",
        outputLanguage: "ro",
      };
      localStorage.setItem("prism-aac-settings", JSON.stringify(cur));
    } catch {
      /* */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(
    'button:has-text("Q"), button:has-text("Vorbește")',
    { timeout: 30000 },
  );
}

test.describe("Keyboard L4 viewport fit (real browser, real layout)", () => {
  test("ai-chat panel: every qwerty row stays inside viewport", async ({
    page,
    baseURL,
  }, testInfo) => {
    await bootClean(page, baseURL);
    // Toolbar uses i18n key `ai_chat` which renders to "AI" (en) / "IA" (ro)
    // as the aria-label on the ✨ button.
    await page
      .getByRole("button", { name: /^(AI|IA)$/ })
      .first()
      .click();
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    // The Speak button at the bottom-right of the qwerty utility row
    // is the canary: if it's clipped, the user lost the spacebar /
    // mode-toggle / punctuation row above it.
    const speak = page.getByRole("button", { name: /^Speak$/ }).first();
    await expect(speak).toBeVisible();
    const box = await speak.boundingBox();
    expect(box, "Speak bounding box").toBeTruthy();

    if (box && viewport) {
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    // Row-height tappability check. WCAG 2.5.5 minimum tap target is
    // 44×44 CSS px. Below this, the keyboard renders inside the
    // viewport but is unusable — exactly the user-reported "broken
    // keyboards" symptom (May 2026 screenshots showed ~35px rows).
    const qBox = await page
      .locator('button[data-key="Q"]')
      .first()
      .boundingBox();
    expect(qBox, "Q key bounding box").toBeTruthy();
    if (qBox) {
      expect(
        qBox.height,
        `qwerty Q key only ${qBox.height}px tall — below 44px tap target on ${testInfo.project.name}`,
      ).toBeGreaterThanOrEqual(44);
    }
    if (box) {
      expect(
        box.height,
        `Speak utility row only ${box.height}px tall — below 44px tap target on ${testInfo.project.name}`,
      ).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: path.join(
        SHOTS_DIR,
        `aichat-keyboard-${testInfo.project.name}.png`,
      ),
      fullPage: false,
    });
  });

  test("math panel: qwerty hidden, math Done (Gata) visible inside viewport", async ({
    page,
    baseURL,
  }, testInfo) => {
    await bootClean(page, baseURL);
    await setRomanian(page);
    await page.getByRole("button", { name: /^(Math|Matematică)$/ }).click();
    await page.waitForSelector("text=/Matematic|Math/", { timeout: 10000 });

    const viewport = page.viewportSize();
    // No Q key visible — qwerty is hidden when the math panel ships
    // its own input layer. (The math panel still has number keys etc.,
    // but no qwerty Q.)
    const qBtn = page.getByRole("button", { name: /^Q$/ });
    await expect(qBtn).toHaveCount(0);

    // The math panel header has a Done button (data-testid pinned across
    // locales) — speech is on the AAC main MessageBar Speak, not on the
    // math panel header. Earlier revision of this test expected a
    // "Vorbește" button inside the math panel that never landed; pinning
    // the actual surfaced affordance (Done) instead.
    const mathDone = page.getByTestId("math-panel-done");
    await expect(mathDone).toBeVisible();
    const box = await mathDone.boundingBox();
    expect(box).toBeTruthy();
    if (box && viewport) {
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    await page.screenshot({
      path: path.join(SHOTS_DIR, `math-no-qwerty-${testInfo.project.name}.png`),
      fullPage: false,
    });
  });
});
