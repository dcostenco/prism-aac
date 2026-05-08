# Math + Subject Workflow Test Suite

Step-by-step problem-sheet workflows that exercise every subject keyboard,
plus an executable Playwright test per workflow that verifies the keys
needed to solve each problem are actually reachable on the deployed math
panel.

This is the test suite that catches "this subject's keyboard is missing
keys grade-N students need to solve a real classroom problem" without
having to wait for a user to report it.

## Two layers

### Layer 1 — generic step-by-step (`tests/workflows/`)

12 markdowns, 4–6 problems each, modeled directly on the algebra reference
PDF (`/Users/admin/Downloads/g.r.9_09_15_16_092016_0831PM.pdf`). Each
problem is a numbered transformation chain with the final answer on its
own line. The HTML comment at the top declares the keys the workflow needs
so test authors can verify keyboard coverage:

```
<!-- expected math-panel keys: 0-9 + − × ÷ = ( ) . v u a t f i d k m s kg N J V Ω -->

1. Kinematics — final velocity from u = 0, a = 3, t = 4

   v = u + a × t
   v = 0 + 3 × 4
   v = 12
```

Inventory:

| File | Subject | Problems | Coverage report |
|---|---|---:|---|
| [`advanced-math.md`](../tests/workflows/advanced-math.md) | Advanced Math | 6 | [COVERAGE](../tests/workflows/COVERAGE.md#subject-table) |
| [`biology.md`](../tests/workflows/biology.md) | Biology | 6 | ↑ |
| [`chemistry.md`](../tests/workflows/chemistry.md) | Chemistry | 6 | ↑ |
| [`earth-science.md`](../tests/workflows/earth-science.md) | Earth Science | 6 | ↑ |
| [`geometry.md`](../tests/workflows/geometry.md) | Geometry | 6 | ↑ |
| [`history.md`](../tests/workflows/history.md) | History | 6 | ↑ |
| [`language-arts.md`](../tests/workflows/language-arts.md) | Language Arts | 6 | ↑ |
| [`misc-math.md`](../tests/workflows/misc-math.md) | Misc Math | 6 | ↑ |
| [`physics.md`](../tests/workflows/physics.md) | Physics | 6 | ↑ |
| [`programming-java.md`](../tests/workflows/programming-java.md) | Programming Java | 6 | ↑ |
| [`programming-python.md`](../tests/workflows/programming-python.md) | Programming Python | 6 | ↑ |
| [`statistics.md`](../tests/workflows/statistics.md) | Statistics | 6 | ↑ |

Coverage analysis: [`tests/workflows/COVERAGE.md`](../tests/workflows/COVERAGE.md).

### Layer 2 — grade-leveled real-classroom workflows (`tests/workflows/grade-8-12/`)

12 markdowns, 5–7 problems each, written as real-classroom-style word
problems with named variables, contexts, and units. Designed to mirror
what a US Grade 8–12 student actually sees in a textbook.

Inventory:

| File | Subject — Grade | Problems | Reference |
|---|---|---:|---|
| [`algebra-grade-9.md`](../tests/workflows/grade-8-12/algebra-grade-9.md) | Algebra — Grade 9 | 7 | Original PDF |
| [`biology-grade-9.md`](../tests/workflows/grade-8-12/biology-grade-9.md) | Biology — Grade 9 | 7 | — |
| [`chemistry-grade-10.md`](../tests/workflows/grade-8-12/chemistry-grade-10.md) | Chemistry — Grade 10 | 7 | — |
| [`earth-science-grade-9.md`](../tests/workflows/grade-8-12/earth-science-grade-9.md) | Earth Science — Grade 9 | 7 | — |
| [`geometry-grade-10.md`](../tests/workflows/grade-8-12/geometry-grade-10.md) | Geometry — Grade 10 | 7 | — |
| [`language-arts-grade-8.md`](../tests/workflows/grade-8-12/language-arts-grade-8.md) | Language Arts — Grade 8 | 7 | — |
| [`physics-grade-11.md`](../tests/workflows/grade-8-12/physics-grade-11.md) | Physics — Grade 11 | 7 | — |
| [`pre-calc-grade-12.md`](../tests/workflows/grade-8-12/pre-calc-grade-12.md) | Pre-Calculus — Grade 12 | 7 | — |
| [`programming-java-grade-11.md`](../tests/workflows/grade-8-12/programming-java-grade-11.md) | Programming Java — Grade 11 | 7 | — |
| [`programming-python-grade-9.md`](../tests/workflows/grade-8-12/programming-python-grade-9.md) | Programming Python — Grade 9 | 7 | — |
| [`statistics-grade-11.md`](../tests/workflows/grade-8-12/statistics-grade-11.md) | Statistics — Grade 11 | 7 | — |
| [`world-history-grade-10.md`](../tests/workflows/grade-8-12/world-history-grade-10.md) | World History — Grade 10 | 7 | — |

Per-subject keyboard-gap audit + ranked next-step additions:
[`tests/workflows/grade-8-12/REPORT.md`](../tests/workflows/grade-8-12/REPORT.md).

## Layer 3 — executable Playwright tests (`e2e/math-workflows/`)

72 e2e tests, one per problem, that drive the math panel via real
keyboard taps and verify each step's glyphs land in the cell grid.
Missing keys cause `test.skip()` (with the gap noted) instead of failing,
so the suite always completes and surfaces the keyboard-coverage gap as
the visible test output.

| Spec | Subject | Tests |
|---|---|---:|
| [`advanced-math.spec.ts`](../e2e/math-workflows/advanced-math.spec.ts) | Advanced Math | 6 |
| [`biology.spec.ts`](../e2e/math-workflows/biology.spec.ts) | Biology | 6 |
| [`chemistry.spec.ts`](../e2e/math-workflows/chemistry.spec.ts) | Chemistry | 6 |
| [`earth-science.spec.ts`](../e2e/math-workflows/earth-science.spec.ts) | Earth Science | 6 |
| [`geometry.spec.ts`](../e2e/math-workflows/geometry.spec.ts) | Geometry | 6 |
| [`history.spec.ts`](../e2e/math-workflows/history.spec.ts) | History | 6 |
| [`language-arts.spec.ts`](../e2e/math-workflows/language-arts.spec.ts) | Language Arts | 6 |
| [`misc-math.spec.ts`](../e2e/math-workflows/misc-math.spec.ts) | Misc Math | 6 |
| [`physics.spec.ts`](../e2e/math-workflows/physics.spec.ts) | Physics | 6 |
| [`programming-java.spec.ts`](../e2e/math-workflows/programming-java.spec.ts) | Programming Java | 6 |
| [`programming-python.spec.ts`](../e2e/math-workflows/programming-python.spec.ts) | Programming Python | 6 |
| [`statistics.spec.ts`](../e2e/math-workflows/statistics.spec.ts) | Statistics | 6 |

Run all 72 e2e tests against the live deploy:

```bash
npx playwright test --project=desktop e2e/math-workflows
```

Shared infra:

- [`_glyphMap.ts`](../e2e/math-workflows/_glyphMap.ts) — glyph → keyboard-tab + data-testid lookup so tests can write `glyphMap.get('√')` instead of memorizing chip names.
- [`_helpers.ts`](../e2e/math-workflows/_helpers.ts) — `gotoMathPanel()`, `resetGrid()`, `typeStep()`, `runProblem()` — the shared drivers each spec uses.

## Ranked under-supported subjects

From [`tests/workflows/grade-8-12/REPORT.md`](../tests/workflows/grade-8-12/REPORT.md), based on Grade 8–12 workflow coverage:

1. **Pre-Calc Grade 12** — needs `sin / cos / tan / lim / aₙ` (added in commit `165599d`).
2. **Physics Grade 11** — needs equation variables `F a v u p t d KE PE` + composite SI units `m/s² km/h kg·m/s` (added in `165599d`).
3. **Programming Java Grade 11** — needs `++ -- += -= *=` + `System.out.println` idiom + `@` annotation (added in `165599d`).
4. **Chemistry Grade 10** — needs subscripts `₅ ₆ ₇ ₈ ₉` + `g/mol` + `mol/L` + `%` (added in `165599d`).
5. **Statistics Grade 11** — needs `ME / z* / t* / Cov( / corr( / Pr(` (added in `165599d`).

The cross-cutting decoration row (`² ³ ₂ ₃ ₄ Δ ≈`) on Main / Adv-Math / Chemistry / Physics / Earth Science (also commit `165599d`) cuts ~40 % of chip-flips across all 84 generated workflows.

## Running this suite

```bash
# Unit-level workflow checks (just verifies the markdowns parse + the
# expected-keys comment matches the keyboard arrays)
npm test workflows

# E2E against live deploy (real WebKit, real network, real pdfjs worker)
npx playwright test --project=desktop e2e/math-workflows

# E2E against tablet viewports (catches viewport-overflow regressions)
npx playwright test --project=ipad-7 --project=ipad-13 e2e/math-workflows
```

## Why two layers

Layer 1 is the canonical step-by-step format that mirrors the user's
algebra reference PDF — a known shape every textbook follows. Layer 2 is
the grade-pinned classroom version with realistic word-problem context.
Together they give us:

- A diagnostic for "is this subject's keyboard rich enough for real Grade-N
  problems?" (Layer 2's `REPORT.md`)
- A regression suite that fails CI when a refactor removes a key the
  workflows depend on (Layer 3's e2e specs)
- A documentation surface that a teacher / SLP can read to know what
  problems the AAC user can plausibly type on this app (Layers 1 + 2 markdowns)

## Adding a new workflow

1. Pick the subject. Open the relevant markdown under `tests/workflows/`.
2. Append a numbered problem with the same step-by-step format as
   the existing entries.
3. Update the `<!-- expected math-panel keys: ... -->` HTML comment if the
   new problem needs a glyph the existing list doesn't have.
4. Mirror the problem in `e2e/math-workflows/<subject>.spec.ts` as a new
   `it()` block — copy an existing one and edit the steps.
5. Run `npx playwright test --project=desktop e2e/math-workflows/<subject>.spec.ts`
   to confirm the keyboard reaches every glyph (or skips gracefully).
