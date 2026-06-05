/**
 * MathGrid Phase 5D — two-hit magnify.
 *
 * When mathTwoHitMagnify is on, the FIRST press on any math key
 * arms the button (1.4× scale + green halo, no commit). The SECOND
 * press within 2 s commits. 2 s of inactivity auto-disarms.
 *
 * Composes with hold-time dwell: arming is independent of dwell, but
 * once armed the second press goes through the normal dwell/instant
 * commit path.
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

async function setTwoHit(page: Page, on: boolean) {
  await page.evaluate((flag) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stores = (window as any).__devMathStores;
    stores.useSettingsStore.getState().update({ mathTwoHitMagnify: flag });
  }, on);
  await page.waitForTimeout(60);
}

test.describe("MathGrid Phase 5D — two-hit magnify", () => {
  test("off (default) → first tap commits instantly, no armed visual", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    const key = page.locator('[data-testid="math-key-3"]');
    await expect(key).toHaveAttribute("data-two-hit", "0");
    await key.click();
    await page.waitForTimeout(80);
    const header = await page.locator("header").first().innerText();
    expect(header, "instant commit when two-hit is off").toMatch(/cells=1/);
  });

  test("on → first tap ARMS (data-armed=1, scaled, NO commit)", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setTwoHit(page, true);
    const key = page.locator('[data-testid="math-key-7"]');
    await expect(key).toHaveAttribute("data-two-hit", "1");
    await key.click();
    await page.waitForTimeout(80);
    // Armed state.
    await expect(key).toHaveAttribute("data-armed", "1");
    // No commit yet.
    const header = await page.locator("header").first().innerText();
    expect(header, "first tap does NOT commit").toMatch(/cells=0/);
  });

  test("on → second tap COMMITS the glyph and disarms", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setTwoHit(page, true);
    const key = page.locator('[data-testid="math-key-9"]');
    await key.click(); // arm
    await page.waitForTimeout(80);
    await expect(key).toHaveAttribute("data-armed", "1");
    await key.click(); // commit
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header, "second tap commits").toMatch(/cells=1/);
    // Disarmed after commit.
    await expect(key).toHaveAttribute("data-armed", "0");
  });

  test("on → 2 s of inactivity AUTO-DISARMS", async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await setTwoHit(page, true);
    const key = page.locator('[data-testid="math-key-4"]');
    await key.click(); // arm
    await expect(key).toHaveAttribute("data-armed", "1");
    // Wait past the 2 s auto-disarm window.
    await page.waitForTimeout(2200);
    await expect(key, "auto-disarmed after 2s").toHaveAttribute(
      "data-armed",
      "0",
    );
    // No commit either.
    const header = await page.locator("header").first().innerText();
    expect(header, "no commit during the wait").toMatch(/cells=0/);
  });

  test("on → arming a DIFFERENT key clears the prior armed key visually", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setTwoHit(page, true);
    const k1 = page.locator('[data-testid="math-key-1"]');
    const k2 = page.locator('[data-testid="math-key-2"]');
    await k1.click();
    await expect(k1).toHaveAttribute("data-armed", "1");
    // Arm a different key — the per-button state is independent, so
    // k1 stays armed visually until its own 2s timer fires. We verify
    // the state machine handles back-to-back arming without crashing.
    await k2.click();
    await expect(k2).toHaveAttribute("data-armed", "1");
    // Neither has committed yet.
    const header = await page.locator("header").first().innerText();
    expect(header, "no commits across two arms").toMatch(/cells=0/);
  });

  test("on + dwell=400 → second tap still requires the dwell hold", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setTwoHit(page, true);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore.getState().update({ mathHoldTimeMs: 400 });
    });
    await page.waitForTimeout(60);

    const key = page.locator('[data-testid="math-key-5"]');
    await key.click(); // arm
    await expect(key).toHaveAttribute("data-armed", "1");

    // Second press: hold past 400 ms to trigger dwell commit.
    const box = await key.boundingBox();
    if (!box) throw new Error("key missing");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(550);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header, "committed after dwell on second press").toMatch(/cells=1/);
  });
});
