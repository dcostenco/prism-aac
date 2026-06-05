/**
 * MathGrid Phase 1C — predictive cursor / column-arithmetic alignment.
 *
 * Validates that ⏎ (Smart Return) drops to the leftmost filled cell
 * of the current row (not always col 0), and that ↵ (Right Return)
 * drops to rightmost+1. This is what makes the cell-grid usable for
 * vertical addition / subtraction / multiplication scaffolds.
 */
import { test, expect, type Page } from "@playwright/test";

async function gotoDevPage(page: Page, baseURL: string | undefined) {
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

test.describe("MathGrid Phase 1C — Smart Return", () => {
  test("Smart Return aligns with leftmost filled column when row is empty-anchored at 0", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    await page.locator('[data-testid="math-key-5"]').click();
    await page.locator('[data-testid="math-key-return"]').click();
    await page.waitForTimeout(120);
    // Filled (0,0). Smart Return → (1,0).
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cursor=\(1,0\)/);
  });

  test("Smart Return aligns with leftmost filled column when row is offset", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    // Tap to offset cursor to (0,4), then type "23" so cells (0,4)+(0,5) filled.
    const svg = await page
      .locator('[data-testid="math-grid-svg"]')
      .boundingBox();
    if (!svg) throw new Error("svg missing");
    await page.mouse.click(svg.x + 4 * 56 + 28, svg.y + 0 * 56 + 28);
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-key-2"]').click();
    await page.locator('[data-testid="math-key-3"]').click();
    await page.waitForTimeout(80);
    // Cursor is at (0,6). Smart Return → (1,4) — leftmost filled on row 0 is col 4.
    await page.locator('[data-testid="math-key-return"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header, "aligned to leftmost filled col on row 0 (=4)").toMatch(
      /cursor=\(1,4\)/,
    );
  });

  test("Right Return aligns one past the rightmost filled column", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    const svg = await page
      .locator('[data-testid="math-grid-svg"]')
      .boundingBox();
    if (!svg) throw new Error("svg missing");
    await page.mouse.click(svg.x + 4 * 56 + 28, svg.y + 0 * 56 + 28);
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-key-2"]').click();
    await page.locator('[data-testid="math-key-3"]').click();
    await page.waitForTimeout(80);
    // Cursor is at (0,6). Filled cols 4 + 5. Right Return → (1, 6).
    await page.locator('[data-testid="math-key-return-right"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cursor=\(1,6\)/);
  });

  test("Vertical addition: type 23, Return, type +45 — cells stack", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    const svg = await page
      .locator('[data-testid="math-grid-svg"]')
      .boundingBox();
    if (!svg) throw new Error("svg missing");
    // Place "23" at columns 4 and 5 of row 0.
    await page.mouse.click(svg.x + 4 * 56 + 28, svg.y + 0 * 56 + 28);
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-key-2"]').click();
    await page.locator('[data-testid="math-key-3"]').click();
    await page.waitForTimeout(60);
    // Smart Return → (1,4). Then "+" goes to (1,4)? Let's just type the
    // operand digits — the operator goes one column left of the addend
    // by hand for now (Phase 2C will add a "left-shift on operator" rule).
    await page.locator('[data-testid="math-key-return"]').click();
    await page.waitForTimeout(60);
    await page.locator('[data-testid="math-key-4"]').click();
    await page.locator('[data-testid="math-key-5"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    // Expected: cells 4 (cursor lands here after addition).
    expect(header).toMatch(/cursor=\(1,6\).*cells=4/);
  });

  test("Smart Return on empty row drops cursor to (r+1, 0)", async ({
    page,
    baseURL,
  }) => {
    await gotoDevPage(page, baseURL);
    // Move cursor to (3, 5), Smart Return.
    const svg = await page
      .locator('[data-testid="math-grid-svg"]')
      .boundingBox();
    if (!svg) throw new Error("svg missing");
    await page.mouse.click(svg.x + 5 * 56 + 28, svg.y + 3 * 56 + 28);
    await page.waitForTimeout(80);
    await page.locator('[data-testid="math-key-return"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    // Row 3 is empty → leftmost = 0 → cursor (4, 0).
    expect(header).toMatch(/cursor=\(4,0\)/);
  });
});
