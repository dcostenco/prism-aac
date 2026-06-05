/**
 * Misc Math workflow — Grade 9-11 set-and-function problems modelled
 * on the algebra reference PDF. Each problem mirrors one numbered
 * entry in tests/workflows/misc-math.md, typed step-by-step on the
 * math panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * Misc-Math keyboard (gap surfaced in tests/workflows/COVERAGE.md),
 * the spec skips with a descriptive message rather than failing.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "misc-math" as const;

test.describe("misc math workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("union of two sets", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["a=(1,2,3)", "b=(3,4,5)", "a∪b=(1,2,3,4,5)"],
      CATEGORY,
    );
  });

  test("intersection of two sets", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["a=(1,2,3)", "b=(2,3,4)", "a∩b=(2,3)"],
      CATEGORY,
    );
  });

  test("subset check — (1,2) ⊂ (1,2,3)", async ({ page }, ti) => {
    await runProblem(page, ti, ["x=(1,2)", "y=(1,2,3)", "x⊂y=1"], CATEGORY);
  });

  test("empty set intersection", async ({ page }, ti) => {
    await runProblem(page, ti, ["a=(1,2)", "b=(3,4)", "a∩b=∅"], CATEGORY);
  });

  test("function composition — g(f(2)) where f=x+2, g=3x", async ({
    page,
  }, ti) => {
    await runProblem(
      page,
      ti,
      ["f(2)=2+2", "f(2)=4", "g(4)=3×4", "g(f)=12"],
      CATEGORY,
    );
  });

  test("element-of test — 3 ∈ (1,2,3)", async ({ page }, ti) => {
    await runProblem(page, ti, ["x=3", "s=(1,2,3)", "x∈s=1"], CATEGORY);
  });
});
