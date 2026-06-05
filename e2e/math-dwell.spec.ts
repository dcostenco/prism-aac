/**
 * MathGrid Phase 5A — hold-time dwell on math keyboard.
 *
 * When mathHoldTimeMs is 0 (default), keys commit instantly on press.
 * When > 0, the user must hold for the dwell duration; releasing
 * before completion cancels. A visual progress ring shows the
 * countdown.
 *
 * Implementation note: we toggle the setting via page.evaluate +
 * the zustand store rather than going through the Settings UI,
 * because the settings UI is in the AAC shell modal — not the dev
 * harness page. The store is the single source of truth.
 */
import { test, expect, type Page } from "@playwright/test";

async function gotoDev(page: Page, baseURL: string | undefined) {
  const start = (baseURL || "") + "/dev/math-grid";
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
  await page.waitForFunction(
    () => {
      const svg = document.querySelector('[data-testid="math-grid-svg"]');
      return !!svg && svg.getBoundingClientRect().width > 100;
    },
    { timeout: 5000 },
  );
}

test.describe("MathGrid Phase 5A — hold-time dwell", () => {
  test("with mathHoldTimeMs=0 (default) keys commit instantly on press", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    // Default: 0 = instant. Press a key, expect immediate commit.
    await page.locator('[data-testid="math-key-5"]').click();
    await page.waitForTimeout(80);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cells=1/);
    // No dwell ring rendered (active=0).
    const ring = await page.locator('[data-testid="dwell-ring"]').count();
    expect(ring).toBe(0);
    // Each key reports its hold-ms attribute.
    const holdMs = await page
      .locator('[data-testid="math-key-5"]')
      .getAttribute("data-hold-ms");
    expect(holdMs).toBe("0");
  });

  test("every digit key has a data-hold-ms attribute (DwellButton wrapper applied)", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    for (const d of ["1", "5", "0"]) {
      const attr = await page
        .locator(`[data-testid="math-key-${d}"]`)
        .getAttribute("data-hold-ms");
      expect(attr, `digit ${d} wrapped in DwellButton`).not.toBeNull();
    }
  });

  test("with mathHoldTimeMs=600, releasing early CANCELS the commit", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    // Push the dwell value into the settings store via the dev hatch
    // exposed by app/dev/math-grid/page.tsx.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore.getState().update({ mathHoldTimeMs: 600 });
    });
    await page.waitForTimeout(120);
    const holdMs = await page
      .locator('[data-testid="math-key-5"]')
      .getAttribute("data-hold-ms");
    expect(holdMs, "setting honored").toBe("600");

    // Press and release fast (< 600 ms) — must NOT commit.
    const key = page.locator('[data-testid="math-key-5"]');
    const box = await key.boundingBox();
    if (!box) throw new Error("key missing");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120); // way under 600 ms
    // Confirm dwell ring appeared during the press.
    const ringDuringPress = await page
      .locator('[data-testid="dwell-ring"]')
      .count();
    expect(
      ringDuringPress,
      "dwell ring rendered during dwell",
    ).toBeGreaterThanOrEqual(1);
    await page.mouse.up();
    await page.waitForTimeout(120);
    // Cells must still be 0 — the dwell was cancelled.
    const header = await page.locator("header").first().innerText();
    expect(header, "no commit on early release").toMatch(/cells=0/);
    // Ring disappears.
    const ringAfter = await page.locator('[data-testid="dwell-ring"]').count();
    expect(ringAfter, "dwell ring removed after release").toBe(0);
  });

  test("with mathHoldTimeMs=400, holding past the threshold COMMITS the glyph", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore.getState().update({ mathHoldTimeMs: 400 });
    });
    await page.waitForTimeout(120);

    const key = page.locator('[data-testid="math-key-7"]');
    const box = await key.boundingBox();
    if (!box) throw new Error("key missing");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Hold past the 400 ms threshold.
    await page.waitForTimeout(550);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header, "glyph committed after dwell completes").toMatch(/cells=1/);
  });
});
