/**
 * Geometry workflow — Grade 7-9 problems modelled on the algebra
 * reference PDF (g.r.9 …). Each problem here mirrors one numbered
 * entry in tests/workflows/geometry.md, typed step-by-step on the
 * math panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * keyboard (gap surfaced in tests/workflows/COVERAGE.md), the spec
 * skips with a descriptive message instead of failing — the gap list
 * is what the kbd-team prioritises against, not red CI.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "geom" as const;

test.describe("geometry workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("pythagorean theorem — 3-4-5 right triangle", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["a²+b²=c²", "3²+4²=c²", "9+16=c²", "c²=25", "c=√25", "c=5"],
      CATEGORY,
    );
  });

  test("area of a rectangle — 12 × 5", async ({ page }, ti) => {
    await runProblem(page, ti, ["a=l×w", "a=12×5", "a=60"], CATEGORY);
  });

  test("area of a triangle — base 8 height 6", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["a=b×h÷2", "a=8×6÷2", "a=48÷2", "a=24"],
      CATEGORY,
    );
  });

  test("perimeter of a rectangle — length 9 width 4", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["p=2×l+2×w", "p=2×9+2×4", "p=18+8", "p=26"],
      CATEGORY,
    );
  });

  test("triangle angle sum — third angle of 50° 70°", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["a+b+c=180°", "50+70+c=180", "c=180−50−70", "c=60°"],
      CATEGORY,
    );
  });

  test("circumference of a circle — radius 7", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["c=2×π×r", "c=2×π×7", "c=14×π", "c≈44"],
      CATEGORY,
    );
  });
});
