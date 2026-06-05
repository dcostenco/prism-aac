/**
 * Statistics workflow — Grade 9-11 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/statistics.md, typed step-by-step on the math
 * panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * statistics keyboard (gap surfaced in tests/workflows/COVERAGE.md),
 * the spec skips with a descriptive message rather than failing.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "statistics" as const;

test.describe("statistics workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("mean: 2,4,6,8 → μ = 5", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["s=2+4+6+8", "s=20", "n=4", "μ=20÷4", "μ=5"],
      CATEGORY,
    );
  });

  test("range: 3,7,12,4,9 → range = 9", async ({ page }, ti) => {
    await runProblem(page, ti, ["a=12", "b=3", "r=12−3", "r=9"], CATEGORY);
  });

  test("squared deviation step (x − μ)² with x=7, μ=5", async ({
    page,
  }, ti) => {
    await runProblem(page, ti, ["x−μ=7−5", "x−μ=2", "σ=2×2", "σ=4"], CATEGORY);
  });

  test("z-score: x=70, μ=60, σ=5 → z=2", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["z=x−μ÷σ", "z=70−60÷5", "z=10÷5", "z=2"],
      CATEGORY,
    );
  });

  test("hypothesis test: p < α → reject H0", async ({ page }, ti) => {
    await runProblem(page, ti, ["p≈0.02", "α=0.05", "p<α", "r H0"], CATEGORY);
  });

  test("two-coin probability: p × p = 1 ÷ 4", async ({ page }, ti) => {
    await runProblem(page, ti, ["p=1÷2", "p×p=1÷2×1÷2", "p×p=1÷4"], CATEGORY);
  });
});
