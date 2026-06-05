/**
 * Java workflow — Grade 8-10 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/programming-java.md, typed step-by-step on the
 * Java programming keyboard.
 *
 * Like the Python spec, the Java spec types every keyword as
 * individual letters so the cell-count assertions stay deterministic.
 * The keyword shortcut tiles still exist (math-java-kw-…) — the
 * keyword-shortcut path is exercised in the unit-level keyboard
 * tests; this spec covers the writing flow end-to-end.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * Java keyboard (gap surfaced in tests/workflows/COVERAGE.md), the
 * spec skips with a descriptive message rather than failing.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "programming-java" as const;

test.describe("java workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('class with main method — print "hi"', async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["class h{", "main(){", 'p("hi");', "}}"],
      CATEGORY,
    );
  });

  test("for loop sum total = 6", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["t=0;", "for(x=1;x<4;x=x+1){", "t=t+x;}", "t=6"],
      CATEGORY,
    );
  });

  test("array length: int[] a = new int[5]; a.length = 5", async ({
    page,
  }, ti) => {
    await runProblem(page, ti, ["a=new[5];", "n=a.l;", "n=5"], CATEGORY);
  });

  test("method definition — return double(x)", async ({ page }, ti) => {
    await runProblem(page, ti, ["d(x){", "return x*2;}", "d(5)=10"], CATEGORY);
  });

  test("if/else — even or odd for n=7", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["n=7;", "if(n%2==0){", "return 0;}", "else{return 1;}", "r=1"],
      CATEGORY,
    );
  });

  test('string concatenation — "hi " + name', async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ['n="ada";', 'g="hi"+n;', 'g="hi ada"'],
      CATEGORY,
    );
  });
});
