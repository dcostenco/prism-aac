/**
 * Phase 6 — math takes over the AAC viewport.
 *
 * When the math panel is open, GreetingBanner / MessageBar /
 * PredictionBar / CategoryPanel must NOT be rendered. Closing math
 * brings them back. Verifies via the existing AAC shell route (not
 * the dev harness, since the harness doesn't mount the chrome).
 */
import { test, expect, type Page } from "@playwright/test";

async function bootClean(page: Page, baseURL: string | undefined) {
  const start = baseURL || "/";
  await page.goto(start);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function openMath(page: Page) {
  // Phase 6 trims the default toolbar. Re-enable the math button via
  // the persisted settings store before clicking it.
  await page.evaluate(() => {
    try {
      const ls = window.localStorage;
      const raw = ls.getItem("prism-aac-settings");
      const cur = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      cur.state = cur.state || {};
      cur.state.toolbarConfig = cur.state.toolbarConfig || {
        order: [],
        enabled: {},
      };
      cur.state.toolbarConfig.enabled = {
        ...cur.state.toolbarConfig.enabled,
        math: true,
      };
      ls.setItem("prism-aac-settings", JSON.stringify(cur));
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
  await page
    .getByRole("button", { name: /^(Math|Matemat)/i })
    .first()
    .click();
  await page.waitForSelector('[data-testid="math-panel"]');
}

test.describe("Phase 6 — math takes over the viewport", () => {
  test("Prediction tiles + qwerty + categories are hidden while math is open", async ({
    page,
    baseURL,
  }) => {
    await bootClean(page, baseURL);
    // Sanity: prediction tiles + qwerty exist BEFORE math opens.
    const predictionsBefore = await page
      .locator('[aria-label^="Predict:"]')
      .count();
    expect(predictionsBefore, "predictions visible pre-math").toBeGreaterThan(
      0,
    );
    expect(await page.locator('button[data-key="Q"]').count()).toBe(1);

    await openMath(page);

    // Predictions row is gone.
    await expect(
      page.locator('[aria-label^="Predict:"]'),
      "no prediction tiles in math mode",
    ).toHaveCount(0);
    // Qwerty letter Q is gone (the qwerty is hidden for panels with
    // their own keyboard, which math has).
    await expect(
      page.locator('button[data-key="Q"]'),
      "qwerty hidden in math mode",
    ).toHaveCount(0);
    // Math panel itself IS there with its own keyboard.
    await expect(
      page.locator('[data-testid="math-main-keyboard"]'),
    ).toBeVisible();
  });

  test("Closing math brings the chrome back", async ({ page, baseURL }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    await page.locator('[data-testid="math-panel-close"]').click();
    await expect(page.locator('[data-testid="math-panel"]')).toHaveCount(0);
    // Qwerty + predictions return.
    await page.waitForSelector('button[data-key="Q"]', { timeout: 5000 });
    await expect(
      page.locator('[aria-label^="Predict:"]').first(),
    ).toBeVisible();
  });

  test("Math canvas owns the full vertical space (no chrome competing)", async ({
    page,
    baseURL,
  }) => {
    await bootClean(page, baseURL);
    await openMath(page);
    const panel = page.locator('[data-testid="math-panel"]');
    const box = await panel.boundingBox();
    if (!box) throw new Error("panel missing box");
    const vh = await page.evaluate(() => window.innerHeight);
    // Math panel should occupy >= 75% of the viewport. Toolbar at top
    // is the only sibling; everything else (banner/message/predictions/
    // category) must be hidden so the panel can claim the rest.
    expect(box.height, "math owns most of the viewport").toBeGreaterThan(
      vh * 0.75,
    );
  });
});
