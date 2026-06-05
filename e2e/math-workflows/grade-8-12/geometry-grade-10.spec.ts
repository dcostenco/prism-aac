/**
 * Geometry — Grade 10 workflow.
 * Problems drawn from tests/workflows/grade-8-12/geometry-grade-10.md.
 * Category: geom (°, π, △, ◯, A, V, P, r, d, ², √, shapes).
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "../_helpers";

const CATEGORY = "geom" as const;

test.describe("geometry grade-10 workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("pythagorean theorem — 5-12-13 ladder", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["5²+12²=c²", "25+144=c²", "c²=169", "c=√169", "c=13"],
      CATEGORY,
    );
  });

  test("circle area — radius 9", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["A=π×r²", "A=π×9²", "A=π×81", "A≈254.34"],
      CATEGORY,
    );
  });

  test("triangle angle sum — 47°+68°+c=180°", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["47+68+c=180", "c=180−47−68", "c=65"],
      CATEGORY,
    );
  });

  test("volume of rectangular prism — 6×4×3", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["V=l×w×h", "V=6×4×3", "V=24×3", "V=72"],
      CATEGORY,
    );
  });

  test("surface area of cube — edge 5", async ({ page }, ti) => {
    // Uppercase S is not on geom/main/adv-math/letters; use lowercase 'sa'.
    await runProblem(
      page,
      ti,
      ["sa=6×s×s", "sa=6×5×5", "sa=6×25", "sa=150"],
      CATEGORY,
    );
  });
});
