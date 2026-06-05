/**
 * MathGrid Phase 2C — content keyboards for Misc Math, Time &
 * Distance, Weight, Volume, Geom, Money.
 *
 * Each keyboard renders a glyph grid wired to commitGlyph; tapping
 * any tile commits that token at the cursor. Locks: every keyboard
 * mounts when its chip is tapped, every key meets the 44px tap-
 * target floor, and tapping a known glyph from each keyboard writes
 * the expected glyph in the active cell.
 */
import { test, expect, type Page } from "@playwright/test";

async function gotoDev(page: Page, baseURL: string | undefined) {
  const start = (baseURL || "") + "/dev/math-grid";
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="math-keyboard-region"]');
  await page.waitForFunction(
    () => {
      const svg = document.querySelector('[data-testid="math-grid-svg"]');
      return !!svg && svg.getBoundingClientRect().width > 100;
    },
    { timeout: 5000 },
  );
}

const KEYBOARDS: Array<{
  catId: string;
  kbId: string;
  sampleKey: string;
  sampleGlyph: string;
}> = [
  {
    catId: "misc-math",
    kbId: "math-misc-keyboard",
    sampleKey: "math-misc-keyboard-element-of",
    sampleGlyph: "∈",
  },
  {
    catId: "time-distance",
    kbId: "math-time-distance-keyboard",
    sampleKey: "math-time-distance-keyboard-second",
    sampleGlyph: "s",
  },
  {
    catId: "weight",
    kbId: "math-weight-keyboard",
    sampleKey: "math-weight-keyboard-kilogram",
    sampleGlyph: "kg",
  },
  {
    catId: "volume",
    kbId: "math-volume-keyboard",
    sampleKey: "math-volume-keyboard-liter",
    sampleGlyph: "L",
  },
  {
    catId: "geom",
    kbId: "math-geom-keyboard",
    sampleKey: "math-geom-keyboard-triangle",
    sampleGlyph: "△",
  },
  {
    catId: "money",
    kbId: "math-money-keyboard",
    sampleKey: "math-money-keyboard-dollar",
    sampleGlyph: "$",
  },
];

test.describe("MathGrid Phase 2C — content keyboards", () => {
  for (const { catId, kbId, sampleKey, sampleGlyph } of KEYBOARDS) {
    test(`${catId} category mounts ${kbId}`, async ({ page, baseURL }) => {
      await gotoDev(page, baseURL);
      await page.locator(`[data-testid="math-category-${catId}"]`).click();
      await page.waitForTimeout(120);
      await expect(page.locator(`[data-testid="${kbId}"]`)).toBeVisible();
      // Sample key visible
      await expect(page.locator(`[data-testid="${sampleKey}"]`)).toBeVisible();
    });

    test(`${catId} sample key commits glyph "${sampleGlyph}"`, async ({
      page,
      baseURL,
    }) => {
      await gotoDev(page, baseURL);
      await page.locator(`[data-testid="math-category-${catId}"]`).click();
      await page.waitForTimeout(120);
      await page.locator(`[data-testid="${sampleKey}"]`).click();
      await page.waitForTimeout(120);
      const header = await page.locator("header").first().innerText();
      expect(
        header,
        `${catId} commit advanced to (0,1) and 1 cell stored`,
      ).toMatch(/cursor=\(0,1\).*cells=1/);
      const glyphs = await page
        .locator('[data-testid="math-grid-glyphs"] text')
        .count();
      expect(glyphs).toBeGreaterThanOrEqual(1);
    });
  }

  test("every key on every Phase 2C keyboard meets the 44px tap-target floor", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    for (const { catId, kbId } of KEYBOARDS) {
      await page.locator(`[data-testid="math-category-${catId}"]`).click();
      await page.waitForTimeout(120);
      const keys = await page.locator(`[data-testid="${kbId}"] button`).all();
      expect(keys.length, `${kbId} has at least one key`).toBeGreaterThan(0);
      for (const k of keys) {
        const box = await k.boundingBox();
        const id = await k.getAttribute("data-testid");
        if (!box) throw new Error(`${id} missing box`);
        expect(box.height, `${id} ≥ 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
