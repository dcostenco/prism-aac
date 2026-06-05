/**
 * Biology workflow — Grade 8-10 problems modelled on the algebra
 * reference PDF. Each problem mirrors one numbered entry in
 * tests/workflows/biology.md, typed step-by-step on the math panel.
 *
 * Skip-on-missing: if a problem references a glyph that isn't on the
 * biology keyboard (gap surfaced in tests/workflows/COVERAGE.md), the
 * spec skips with a descriptive message rather than failing.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "./_helpers";

const CATEGORY = "biology" as const;

test.describe("biology workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("punnett square: Aa × Aa offspring fractions", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["Aa×Aa", "AA+Aa+Aa+aa=4", "AA=1÷4", "Aa=2÷4", "aa=1÷4"],
      CATEGORY,
    );
  });

  test("phenotype ratio: Aa × Aa  3 : 1", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["Aa×Aa", "AA+2Aa+aa=4", "d=3", "r=1", "r=3÷1"],
      CATEGORY,
    );
  });

  test("codon translation: pair DNA → RNA", async ({ page }, ti) => {
    await runProblem(page, ti, ["DNA=ATGC", "RNA=UACG"], CATEGORY);
  });

  test("codon length: 12 bases makes how many codons", async ({ page }, ti) => {
    await runProblem(page, ti, ["b=12", "c=3", "n=12÷3", "n=4"], CATEGORY);
  });

  test("photosynthesis ratio: H₂O : CO₂ = 6 : 6", async ({ page }, ti) => {
    await runProblem(page, ti, ["h=6", "c=6", "r=6÷6", "r=1"], CATEGORY);
  });

  test("Bb × bb cross — chance of Bb offspring", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["Bb×bb", "Bb+Bb+bb+bb=4", "Bb=2÷4", "Bb=1÷2"],
      CATEGORY,
    );
  });
});
