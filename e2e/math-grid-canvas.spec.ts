/**
 * MathGrid Phase 1A — canvas rendering, tap-focus, glyph commit, backspace.
 *
 * Runs against the isolated dev page at /dev/math-grid (mounted by
 * app/dev/math-grid/page.tsx). The page exposes a physical-keyboard
 * handler for prototyping; the on-screen keyboard arrives in Phase 1B.
 *
 * Locks the cell-grid model behaviors that everything else (predictive
 * cursor, fractions, long division) will build on. If these regress,
 * the higher-level features can't be trusted.
 */
import { test, expect, type Page } from "@playwright/test";

async function gotoDevPage(page: Page, baseURL: string | undefined) {
  const start = (baseURL || "") + "/dev/math-grid";
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="math-grid"]');
  // Ensure size has been measured by the ResizeObserver loop.
  await page.waitForFunction(
    () => {
      const svg = document.querySelector('[data-testid="math-grid-svg"]');
      return !!svg && svg.getBoundingClientRect().width > 100;
    },
    { timeout: 5000 },
  );
}

test.describe("MathGrid (Phase 1A)", () => {
  test("mounts with grid lines + active-cell cursor visible", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);

    const lines = await page
      .locator('[data-testid="math-grid-lines"] line')
      .count();
    expect(
      lines,
      "grid renders both vertical and horizontal lines",
    ).toBeGreaterThan(8);

    const cursor = page.locator('[data-testid="math-grid-cursor"]');
    await expect(cursor).toBeVisible();
  });

  test("typing a digit commits a glyph and advances the cursor", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    // Focus the page (without clicking the canvas — that would move the cursor).
    await page.locator('[data-testid="math-dev-reset"]').focus();
    await page.keyboard.press("5");
    await page.waitForTimeout(120);

    // The dev-page header echoes cursor + cells count. Use it as ground truth.
    const header = await page.locator("header").first().innerText();
    expect(header, "cursor advanced to (0,1) and one cell stored").toMatch(
      /cursor=\(0,1\).*cells=1/,
    );

    // The glyph is also rendered as an SVG <text> at the right position.
    const glyphs = await page
      .locator('[data-testid="math-grid-glyphs"] text')
      .count();
    expect(glyphs, "rendered glyph node exists").toBeGreaterThanOrEqual(1);
  });

  test("backspace clears the cell at cursor when filled", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-dev-reset"]').focus();
    await page.keyboard.press("5");
    await page.waitForTimeout(120);
    // Cursor is now at (0,1). Backspace should not delete (0,1) — it's empty —
    // and instead delete (0,0) and move cursor there.
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cursor=\(0,0\).*cells=0/);
  });

  test("Enter drops cursor to the next row, column 0", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    // Focus the footer (not the reset button — Enter would activate it).
    await page
      .locator("footer")
      .focus()
      .catch(() => {
        /* footer may not be focusable; that's fine */
      });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cursor=\(1,0\)/);
  });

  test("tap inside the canvas moves cursor to that cell", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    const svg = page.locator('[data-testid="math-grid-svg"]');
    const box = await svg.boundingBox();
    if (!box) throw new Error("svg missing");
    // Tap roughly cell (3, 5): each cell defaults to 56px at scale 1, pan=0.
    await page.mouse.click(box.x + 5 * 56 + 28, box.y + 3 * 56 + 28);
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cursor=\(3,5\)/);
  });

  test("reset clears all cells and returns cursor to (0,0)", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-dev-reset"]').focus();
    await page.keyboard.press("5");
    await page.keyboard.press("+");
    await page.keyboard.press("7");
    await page.waitForTimeout(140);
    let header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cells=3/);
    await page.locator('[data-testid="math-dev-reset"]').click();
    await page.waitForTimeout(80);
    header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cursor=\(0,0\).*cells=0/);
  });
});
