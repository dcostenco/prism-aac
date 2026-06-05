/**
 * Language Arts — Grade 8 workflow.
 * Problems drawn from tests/workflows/grade-8-12/language-arts-grade-8.md.
 * Category: language-arts (N, V, ADJ, ADV, PRON, PREP, CONJ, ART, DECL,
 * INT, IMP, EXCL, COMP, CPLX, SUBJ, PRED, OBJ, Q:, A:, punctuation).
 */
import { test } from "@playwright/test";
import { gotoMathPanel, runProblem } from "../_helpers";

const CATEGORY = "language-arts" as const;

test.describe("language-arts grade-8 workflow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await gotoMathPanel(page, baseURL);
  });

  test('parts of speech — "The quick fox jumps over the lazy dog"', async ({
    page,
  }, ti) => {
    await runProblem(
      page,
      ti,
      ["ART", "ADJ", "N", "V", "PREP", "ART", "ADJ", "N", "DECL"],
      CATEGORY,
    );
  });

  test('sentence type — "Stop running in the hall!"', async ({ page }, ti) => {
    await runProblem(page, ti, ["IMP"], CATEGORY);
  });

  test("subject and verb — complex sentence", async ({ page }, ti) => {
    await runProblem(page, ti, ["SUBJ", "N", "PRED", "V", "CPLX"], CATEGORY);
  });

  test('compound vs. complex — "I studied, and I passed."', async ({
    page,
  }, ti) => {
    await runProblem(page, ti, ["CONJ", "COMP"], CATEGORY);
  });

  test('pronoun reference — ambiguous "her"', async ({ page }, ti) => {
    await runProblem(page, ti, ["PRON", "ADJ"], CATEGORY);
  });
});
