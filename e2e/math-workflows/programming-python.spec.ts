/**
 * Python workflow — Grade 7-10 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/programming-python.md, typed step-by-step on the
 * Python programming keyboard.
 *
 * The programming keyboard commits ONE character per cell — keyword
 * tiles are token shortcuts that emit each char + a trailing space.
 * For deterministic cell-count assertions the spec types every
 * keyword as its individual letters (which exist on the same panel)
 * rather than tapping the keyword shortcut. Either path produces the
 * same on-canvas glyphs.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * Python keyboard (gap surfaced in tests/workflows/COVERAGE.md), the
 * spec skips with a descriptive message rather than failing.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "programming-python" as const;

test.describe("python workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("for-loop sum total over range(1,4)", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["t=0", "for x in r:", "t=t+x", "p(t)", "t=6"],
      CATEGORY,
    );
  });

  test("list comprehension: [x*x for x in range(1,4)]", async ({
    page,
  }, ti) => {
    await runProblem(page, ti, ["s=[x*x for x in r]", "s=[1,4,9]"], CATEGORY);
  });

  test("function definition — return double(x)", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["def d(x):", "return x*2", "d(5)=10"],
      CATEGORY,
    );
  });

  test('string concatenation — "hi " + name', async ({ page }, ti) => {
    await runProblem(page, ti, ['n="ada"', 'g="hi"+n', 'g="hi ada"'], CATEGORY);
  });

  test("if/else — even or odd for n=7", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["n=7", "if n%2==0:", 'p("e")', "else:", 'p("o")'],
      CATEGORY,
    );
  });

  test("len of list [4,5,6] = 3", async ({ page }, ti) => {
    await runProblem(page, ti, ["a=[4,5,6]", "n=len(a)", "n=3"], CATEGORY);
  });
});
