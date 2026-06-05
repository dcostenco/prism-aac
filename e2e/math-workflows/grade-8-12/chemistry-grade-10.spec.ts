/**
 * Chemistry — Grade 10 workflow.
 * Problems drawn from tests/workflows/grade-8-12/chemistry-grade-10.md.
 * Category: chemistry (elements Na Cl H O C Ca, →, ₂ ₃ ₄, mol, pH, Δ).
 * Digits/operators fall back to main.
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "../_helpers";

const CATEGORY = "chemistry" as const;

test.describe("chemistry grade-10 workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test("molar mass of NaCl — Na+Cl=58.5g/mol", async ({ page }, ti) => {
    // Uppercase M is not on chemistry/main/adv-math/letters — use 'mass' spelled out.
    await runProblem(
      page,
      ti,
      ["mass=Na+Cl", "mass=23+35.5", "mass=58.5"],
      CATEGORY,
    );
  });

  test("moles from grams — 117g NaCl", async ({ page }, ti) => {
    // Avoid uppercase M (molar mass); substitute the numeric value directly.
    await runProblem(page, ti, ["n=117÷58.5", "n=2"], CATEGORY);
  });

  test("stoichiometry — 4mol CH₄, mol H₂O produced", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["CH₄+2O₂→CO₂+2H₂O", "ratio=2÷1", "H₂O=4×2", "H₂O=8"],
      CATEGORY,
    );
  });

  test("pH calculation — [H⁺]=1×10⁻³", async ({ page }, ti) => {
    // Superscript ⁻ is not in the chemistry map; use log(0.001) to express 10⁻³.
    await runProblem(page, ti, ["pH=log(0.001)", "pH=3"], CATEGORY);
  });

  test("empirical formula — 40%Ca 12%C 48%O", async ({ page }, ti) => {
    await runProblem(
      page,
      ti,
      ["Ca=40÷40", "C=12÷12", "O=48÷16", "Ca=1", "C=1", "O=3"],
      CATEGORY,
    );
  });
});
