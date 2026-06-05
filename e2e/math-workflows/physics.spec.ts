/**
 * Physics workflow — Grade 9-10 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/physics.md, typed step-by-step on the math panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * physics keyboard (gap surfaced in tests/workflows/COVERAGE.md), the
 * spec skips with a descriptive message rather than failing.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "physics" as const;

test.describe("physics workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("kinematics: v = u + a t  (u=0, a=3, t=4)", async ({ page }, ti) => {
    await runProblem(page, ti, ["v=u+a×t", "v=0+3×4", "v=12"], CATEGORY);
  });

  test("newton second law: F = m a (5 kg at 2 m/s²)", async ({ page }, ti) => {
    await runProblem(page, ti, ["f=m×a", "f=5×2", "f=10N"], CATEGORY);
  });

  test("kinetic energy: ½ m v² (4 kg at 3 m/s)", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["k=m×v×v÷2", "k=4×3×3÷2", "k=36÷2", "k=18J"],
      CATEGORY,
    );
  });

  test("ohm law: V = I R (12 V, 4 Ω)", async ({ page }, ti) => {
    await runProblem(page, ti, ["v=i×Ω", "12=i×4", "i=12÷4", "i=3"], CATEGORY);
  });

  test("power: P = V I (6 V, 2 A)", async ({ page }, ti) => {
    await runProblem(page, ti, ["p=v×a", "p=6×2", "p=12W"], CATEGORY);
  });

  test("distance from speed and time (60 m/s, 5 s)", async ({ page }, ti) => {
    await runProblem(page, ti, ["d=v×s", "d=60×5", "d=300m"], CATEGORY);
  });
});
