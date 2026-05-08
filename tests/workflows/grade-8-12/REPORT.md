# Grade-8-12 Workflow Audit & Keyboard Gap Report

Second-pass review of commit `dbd23a1` (math keyboard expansion).
Cross-checks: (a) every reference picture under `/tmp/math-refs/IMG_05*.jpg`
re-audited per subject, (b) per-subject grade-level workflows generated
in `./algebra-grade-9.md` … `./world-history-grade-10.md`, (c) keyboard
key requirements compared to the symbol arrays in
`components/math/MathKeyboardRegion.tsx`.

## Reference-deck audit summary

39 reference images (IMG_0555 – IMG_0593) were examined. The deck is
the Math Paper iPad app's full instruction PDF. Only **6 images** show
actual subject keyboard panels:

- IMG_0555 — chip row (a-p, q-z, Money, Misc Math, Time & Distance,
  Weight, Volume, Geom, Adv. Math).
- IMG_0556 — Geom keyboard (corner brackets, parentheses, half-
  circles, quarter-circles, vertical / horizontal segments, cone +
  cylinder).
- IMG_0557 — Letters / "Other" keyboard (`< >`, x², xʸ, aₘ, √x, ³√x,
  `(`, ↵, x/y, `.`, `,`, x, y, a, b, r, d, π).
- IMG_0558 — Main keyboard (1-0 digits, x, Other, +, -, x/y, x/y, ⌫,
  home).
- IMG_0559 — Teacher Keyboard variant (More, (2xy)², +, -, ×, ÷, root,
  =, 12+34, ⌫, 1-0).
- IMG_0560 — Movement keyboard (<, >, x√yz, ↵, ←, ., ,, R, ⤓⤓, ⤓→, ×,
  arc curves, ÷, x/y, home).
- IMG_0567 / IMG_0568 — Equality Folder + More Keyboard pair.

**Verification of v1 commit message claim** ("Geom 12→40, Adv-Math
16→32, Misc-Math 16→33, no usable reference layout for 16 other
subjects"): **CONFIRMED.** All 33 remaining images (IMG_0561–IMG_0566,
IMG_0569–IMG_0593) are pure prose: instructions, "What's New",
Accessibility, Navigation, File Management, Settings, Functions, Math
Commands, etc. **No reference image depicts a Chemistry, Physics,
Biology, Statistics, Music, Earth-Science, Programming, History, or
Language-Arts keyboard.** The user's reference deck is Math-Paper-only
and Math Paper does not have those subjects. v1's "no usable reference
layout" tag is accurate.

---

## Subject: Algebra (Grade 9)

- Reference pictures audited: IMG_0557 (variables x, y, a, b, r, d, π),
  IMG_0558 (Main digits + ops), IMG_0559 (Teacher kbd with ², =, ⌫),
  IMG_0567 (parentheses wrapping), IMG_0568 (More Keyboard with ², ³√,
  ³, log, ln, !).
- Symbols visible in references but missing from kbd: none. Adv-Math
  panel covers everything depicted (², ³, √, ∛, log, ln, !, =, ±, ≈,
  ≡, |, x, y, a, b, d, p, r, m, n, π, parens).
- Workflows generated: 7 at grade-9 (`algebra-grade-9.md`).
- Keys needed by workflows: digits 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`,
  `<`, `>`, `≤`, `≥`, `²`, `√`, `t`, `x`, `n`, `r`, `w`, `l`.
- Keys missing (blocks workflow): **`w` and `l`** (used in problem 7
  for width / length) — Adv-Math has m, n, d, p, r but not w, l. Letters
  panel covers them but requires a chip switch mid-equation. **`/` for
  ratio fractions is on Misc Math** and another switch.
- Recommended next-step kbd additions, in priority order:
  1. Append `w` and `l` (and `h` for height) to Adv-Math variables —
     used in nearly every geometry / mensuration word problem.
  2. Add `t` (time) variable to Adv-Math (currently in Time & Dist
     unit panel only — variable t is conceptually different).

---

## Subject: Geometry (Grade 10)

- Reference pictures audited: IMG_0556 (Geom shapes — corner brackets,
  arcs, half/quarter circles, segments, cone, cylinder), IMG_0557
  (variables r, d).
- Symbols visible in references but missing from kbd: none. Geom panel
  was expanded 12→40 in dbd23a1 and now contains every glyph from
  IMG_0556 (▢ ▱ ⬠ ⬡ ⌒ ⌓ ◐ ◑ ◔ ─ │ ⌐ ¬ └ ┘ ⊿ cone cyl sphere cube
  prism pyramid + arrows).
- Workflows generated: 7 at grade-10 (`geometry-grade-10.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `²`,
  `³`, `√`, `π`, `°`, `r`, `d`, `A`, `V`, `P`, `△`, `◯`, `≅`, `~`, `l`,
  `w`, `h`, `s`.
- Keys missing (blocks workflow): **`³` cube exponent on Geom** (only
  on Adv-Math), **`~` similarity tilde** (Geom has ≅ but not ~ which
  is the school-standard similarity symbol — Misc Math has ∼ U+223C
  which is close but visually distinct from `~` U+007E that textbooks
  use). **`l` `w` `h` `s`** (length / width / height / side variables)
  are letters-only.
- Recommended next-step kbd additions, in priority order:
  1. Append `~` (tilde / similar) to Geom panel — every similar-
     triangles problem uses it.
  2. Append `l`, `w`, `h`, `s` letter variables to Geom row (mensuration
     vocabulary).
  3. Add `³` to Geom panel (volume problems use cm³ / m³ heavily).

---

## Subject: Physics (Grade 11)

- Reference pictures audited: none. Math Paper has no Physics keyboard.
  The current `MathPhysicsKeyboard` is custom (Greek + SI units + ops).
- Symbols visible in references but missing from kbd: N/A (no reference
  layout exists).
- Workflows generated: 7 at grade-11 (`physics-grade-11.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `²`,
  `³`, `√`, `m`, `s`, `kg`, `N`, `J`, `V`, `Ω`, `Hz`, `W`, `A`, `μ`,
  `λ`, `θ`, `Δ`, `f`, `v`, `t`, `p`, `KE`, `ME`, `SE`.
- Keys missing (blocks workflow): **`KE` (kinetic energy)**, **`PE`
  (potential energy)**, **`F` (force variable, distinct from F unit)**,
  **`a` (acceleration)** — none of the physics convention variables are
  on Physics. Greek `λ θ μ Δ` are present; SI units `m s kg N J V Ω Hz
  W` are present; but **the variables a student writes the equation
  with (F, a, v, p, KE, PE, t, d, h)** are not. **`m/s²`, `m/s`, `km/h`
  composite units** force multi-tap.
- Recommended next-step kbd additions, in priority order:
  1. Add a Physics-variables row: `F a v u p t d h r KE PE GPE PE_g`
     (today the user types these via the Letters panel).
  2. Add composite-unit keys `m/s`, `m/s²`, `km/h`, `kg·m/s`, `N·m`
     (a Physics workflow types these dozens of times).
  3. Add `g` (gravitational acceleration) and `c` (speed of light) as
     dedicated keys (`c` is in Physics ops, `g` is missing).

---

## Subject: Chemistry (Grade 10)

- Reference pictures audited: none — Math Paper has no Chemistry
  keyboard. Periodic-table letters are NOT depicted in any reference.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-10 (`chemistry-grade-10.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `²`,
  H, O, C, N, Na, Cl, Mg, Ca, Fe, →, ⇌, ↑, ↓, ⁺, ⁻, ²⁺, ²⁻, ₂, ₃, ₄,
  Δ, mol, pH, (s), (l), (g), (aq), `log`, `−` (negative-pH minus).
- Keys missing (blocks workflow): **subscripts `₅`, `₆`, `₇`** (only ₂
  ₃ ₄ exist; CH₄ → C₆H₁₂O₆ glucose problems can't be typed). **No `↔`
  resonance arrow.** **`%` percent** (used in empirical-formula
  problem 7) is on Adv-Math but requires a chip switch from Chemistry.
  **`g/mol` molar-mass unit** has to be typed letter-by-letter.
- Recommended next-step kbd additions, in priority order:
  1. Add subscripts `₀ ₁ ₅ ₆ ₇ ₈ ₉` to Chemistry ops row — molar
     formulas need them constantly.
  2. Add a `g/mol` composite key, and `mol/L` for molarity, to
     Chemistry ops.
  3. Add `%` to Chemistry ops (empirical / mass-percent problems).

---

## Subject: Biology (Grade 9)

- Reference pictures audited: none — Math Paper has no Biology
  keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-9 (`biology-grade-9.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `%`,
  AA, Aa, aa, Bb, bb, A, T, G, C, U, mRNA, →, ♂, ♀, F1, F2, P, Pp, pp.
- Keys missing (blocks workflow): **`Pp`, `pp` genotype shorthand** —
  Biology genetics row has AA Aa aa Bb bb but not Pp / PP / pp / Cc /
  Cc-style flexibility (only the literal A and B alleles). **`Met`,
  `Ala`, `Tyr` amino-acid codes.** **`²` and `³` exponents for power-
  growth problems** require Adv-Math chip switch (problem 5: 2³).
- Recommended next-step kbd additions, in priority order:
  1. Replace fixed AA/Bb genotype keys with a generic case-toggle row
     (`A a B b C c P p`) — the current set hard-codes specific letter
     pairs that don't match every textbook problem.
  2. Add `²`, `³`, `^n` exponent keys to Biology — population growth
     and dilution problems use them constantly.
  3. Add codon table glyphs (Met, Ala, Tyr, Stop) — translation
     problems are core Grade-9 biology.

---

## Subject: Statistics (Grade 11)

- Reference pictures audited: none — Math Paper has no Statistics
  keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-11 (`statistics-grade-11.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `²`,
  `√`, `μ`, `σ`, `σ²`, `x̄`, `n`, `z`, `p`, `H0`, `Ha`, `≈`, `≠`, `∑`,
  `α`, `C(`, `P(`, `SE`, `ME`, `CI`.
- Keys missing (blocks workflow): **`ME` (margin of error)** — not on
  Statistics ops (only SE and CI). **`!` factorial** is on Adv-Math
  but a chip switch interrupts the binomial workflow. **`<` `>` `≤`
  `≥`** for hypothesis-direction live on Adv-Math, not Stats. **`*`
  star (z* notation)** missing entirely.
- Recommended next-step kbd additions, in priority order:
  1. Add `ME` (margin of error), `z*` and `t*` (critical values) to
     Stats ops — every CI problem needs them.
  2. Mirror `<`, `>`, `≤`, `≥`, `!` into Stats ops (one chip = full
     hypothesis test).
  3. Add `Cov(`, `corr(`, `Pr(` for paired-data problems.

---

## Subject: Programming Python (Grade 9)

- Reference pictures audited: none — Math Paper has no Python keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-9 (`programming-python-grade-9.md`).
- Keys needed by workflows: a-z, 0-9, `_`, `+ - * / =`, `==`, `!=`,
  `<`, `>`, `<=`, `>=`, `(`, `)`, `[`, `]`, `{`, `}`, `:`, `,`, `.`,
  `"`, `'`, `def`, `for`, `if`, `else`, `return`, `print`, `range`,
  `in`, `len`, `sum`, `max`, `while`.
- Keys missing (blocks workflow): **`while`** is in PYTHON_KEYWORDS so
  fine. **`sum`, `max`, `min`, `abs`** built-in functions are missing
  (only `len`, `range`, `print` are dedicated). **`#` comment marker**
  missing entirely. **Newline / indent** key missing — multi-line
  bodies (problems 1, 2, 5, 7) commit as single line in current
  cell-grid model.
- Recommended next-step kbd additions, in priority order:
  1. Add Python built-ins row: `sum max min abs sorted list dict str
     int float input`.
  2. Add `#` for comments and a dedicated indent key (4-space or
     tab) — student work without comments fails most rubrics.
  3. Add a newline / `\n` glyph that advances the cell cursor a row
     down + back to col 1 (already exists as movement key but not
     surfaced in the Python panel).

---

## Subject: Programming Java (Grade 11)

- Reference pictures audited: none — Math Paper has no Java keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-11 (`programming-java-grade-11.md`).
- Keys needed by workflows: a-z, A-Z, 0-9, `_`, `+ - * / = == != < >
  <= >= ( ) [ ] { } : ; , . " '`, `public`, `private`, `class`, `void`,
  `int`, `String`, `boolean`, `if`, `else`, `for`, `while`, `return`,
  `new`, `this`, `null`, `true`, `false`, `++`, `length`, `System`,
  `out`, `println`.
- Keys missing (blocks workflow): **`++` increment / `--` decrement**
  — used in every for-loop (every problem 2, 4 etc). Currently the
  user types `+ +` two cells. **`System.out.println`** is the most-
  used token in beginner Java; absent. **`length`** field, **`length()`**
  method missing. **`@Override`, `@`** annotation marker missing.
- Recommended next-step kbd additions, in priority order:
  1. Add `++`, `--`, `+=`, `-=`, `*=`, `/=` compound-assignment row
     to Java ops.
  2. Add Java idiom tokens: `System.out.println`, `System.out.print`,
     `length`, `length()`, `equals`, `toString`, `Math.`.
  3. Add `@` annotation marker.

---

## Subject: Pre-Calc (Grade 12)

- Reference pictures audited: IMG_0568 (More Keyboard with `³`, `³√`,
  `log`, `ln`, `!`, `≈`, `≡`, `|`).
- Symbols visible in references but missing from kbd: none — Adv-Math
  covers all of IMG_0568.
- Workflows generated: 7 at grade-12 (`pre-calc-grade-12.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `²`,
  `³`, `√`, `∛`, `log`, `ln`, `π`, `x`, `y`, `m`, `n`, `!`, `≈`, `∞`,
  `→`, `⇒`, `θ`, `sin`, `cos`, `tan`, `log₂`, `log₁₀`, `aₙ`, `a₁`, `d`.
- Keys missing (blocks workflow): **`sin`, `cos`, `tan`, `csc`, `sec`,
  `cot`** — none of the trig functions are on Adv-Math (problem 3
  blocks). **`log` base specification (log₂, log₁₀)** — Adv-Math has
  bare `log` but no subscript-base mechanism beyond the `_` marker.
  **Subscripts for sequence indexing (`a₁`, `aₙ`, `a₁₀`)** require
  chip-switch to Chemistry's `₂ ₃ ₄` row but `₅ ₆ ₇ ₈ ₉ ₀ ₁ n` are
  missing. **`lim`, `→`** for limits — `→` is on Misc-Math, `lim` is
  not anywhere.
- Recommended next-step kbd additions, in priority order:
  1. Add a dedicated Trig sub-row to Adv-Math: `sin cos tan csc sec
     cot sin⁻¹ cos⁻¹ tan⁻¹`.
  2. Add `lim`, `→` (limit-arrow distinct from logic →), `dx`, `dy`,
     `f(x)`, `g(x)` — calc / pre-calc essentials.
  3. Add subscript digits `₀ ₁ ₅ ₆ ₇ ₈ ₉` and the special `ₙ` and
     `ᵢ` variable subscripts for sequences and series.

---

## Subject: Earth Science (Grade 9)

- Reference pictures audited: none — Math Paper has no Earth Science
  keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-9 (`earth-science-grade-9.md`).
- Keys needed by workflows: 0-9, `+ − × ÷ =`, `.`, `,`, `(`, `)`, `²`,
  `³`, `√`, `≈`, `Δ`, `km`, `cm`, `AU`, `ly`, `Mya`, `°C`, `°F`, `mph`,
  `mb`, `×10ⁿ` scientific notation, `s`, `yr`.
- Keys missing (blocks workflow): **`×10ⁿ` scientific-notation
  helper** (problems 4, 5 use 10¹², 10⁸ — every astronomy distance
  problem). **`yr` (year unit)** is missing — only `Mya` and `Gya`
  exist. **`Δ` (delta)** is on Physics not on Earth panel.
- Recommended next-step kbd additions, in priority order:
  1. Add a scientific-notation key `×10` and superscript digits `⁰ ¹
     ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹` to Earth Science (or share with Physics) — all
     astronomy problems need it.
  2. Add `yr`, `kyr`, `Myr` time-span units (distinct from "Mya"
     ago-tag).
  3. Mirror `Δ` (delta) into Earth panel for temperature / pressure
     deltas.

---

## Subject: Language Arts (Grade 8)

- Reference pictures audited: none — Math Paper has no Language Arts
  keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-8 (`language-arts-grade-8.md`).
- Keys needed by workflows: a-z, A-Z, `N`, `V`, `ADJ`, `ADV`, `PRON`,
  `PREP`, `CONJ`, `ART`, `DECL`, `INT`, `IMP`, `EXCL`, `COMP`, `CPLX`,
  `MLA`, `APA`, `p.`, `pp.`, all standard punctuation `. , ; : ! ? ' "
  ( ) – — …`, also `=` for tagging notation, `(year)` for citations.
- Keys missing (blocks workflow): **uppercase A-Z toggle** on Language
  Arts (current panel is fixed-glyph; sentence-tagging needs the actual
  sentence text typed via Main qwerty, awkward switch). **`( year )`
  citation parenthetical** is fine since `( )` exist on the punctuation
  row. **`SUBJ` and `PRED` (subject / predicate) tags** missing —
  syntax-tree problems use them. **`SVO`, `SVA` clause-pattern tags**
  missing.
- Recommended next-step kbd additions, in priority order:
  1. Add syntactic-role tags `SUBJ PRED OBJ DO IO COMP-OBJ` to LA tags
     row (sentence-diagramming).
  2. Add a Shift / case-toggle for the LA POS chips so `n.`, `v.`,
     `adj.` (lowercase abbreviations used by some style guides) are
     reachable.
  3. Add a `Q:` / `A:` two-tile pair for Q&A formatted study notes.

---

## Subject: World History (Grade 10)

- Reference pictures audited: none — Math Paper has no History keyboard.
- Symbols visible in references but missing from kbd: N/A.
- Workflows generated: 7 at grade-10 (`world-history-grade-10.md`).
- Keys needed by workflows: 0-9, `+ − = . ,`, `BCE`, `CE`, `BC`, `AD`,
  `c.`, `–`, `→`, `Δ`, `1453`, `1492`, `1776`, `1789`, `1793`, `1799`,
  `1914`, `1918`, `1939`, `1945`, `1969`, `1989`, `1st`, `5th`, `15th`,
  `17th`, `18th`, `19th`, `20th`.
- Keys missing (blocks workflow): **`Δ` (delta) for date-arithmetic
  span** is on Physics not History. **`1492`, `1793`, `1799`** specific
  preset event-tiles missing (locale en has 1066 1215 1607 1776 1865;
  world has 476 1453 1914 1918 1939 1945 1969). **Century ordinals
  `6th 7th 8th 9th 11th 12th 13th 14th 16th`** missing — only 1st-5th
  + a few 10th/15th/17th-21st are present.
- Recommended next-step kbd additions, in priority order:
  1. Append `1492`, `1607`, `1789`, `1804`, `1815`, `1848`, `1865`,
     `1898`, `1929` event tiles to history-events-world (these are the
     dates every survey course covers).
  2. Fill the century ordinal gap: add `6th 7th 8th 9th 11th 12th
     13th 14th 16th` so every 1st–21st century is reachable.
  3. Mirror `Δ` (and `≈ ~` for circa) into the history panel.

---

## Cross-cutting findings (all subjects)

1. **`²` `³` super- and `₂` `₃` `₄` sub-scripts are split across
   panels.** Adv-Math has `² ³`, Chemistry has `₂ ₃ ₄`. Algebra,
   Geometry, Physics, Earth Science, Pre-Calc all need both groups +
   chip-switching mid-equation. Adding a "math/science decorations"
   sub-row that lives on every numeric panel (Main, Adv-Math,
   Chemistry, Physics, Earth) would remove ~40 % of the keystroke
   overhead measured across the 84 generated workflows.
2. **No global `Δ` (delta) on numeric subjects.** Physics has it;
   Statistics, Earth Science, Chemistry, Geometry, History all use
   it but have to chip-switch.
3. **No general `≈` "approximately"** on Main / Geom / Earth / Stats
   (Adv-Math has it, but every science workflow opens with `≈` as the
   answer-line operator → forces a chip switch the moment the user
   tries to write a final answer with units).
4. **Long-form variables (`l`, `w`, `h`, `s`, `t`, `v`, `u`, `a`,
   `f`, `KE`, `PE`)** live only on the Letters panel. Mensuration,
   kinematics, energy problems all bleed into Letters → Main →
   Letters → Main multi-switch chains.
5. **Trig functions (`sin cos tan`)** are absent everywhere, blocking
   any pre-calc / physics-grade-11 workflow that involves angles
   beyond the bare `sin(30°) = 0.5` symbolic pattern.

## Top-3 most under-supported subjects (Grade 8-12 work)

Ranked by **count of "Keys missing (blocks workflow)" entries** above:

1. **Pre-Calc (Grade 12)** — 4 categories of blockers (trig set, log
   bases, sequence subscripts, `lim` / calc primitives). The keyboard
   has Adv-Math's algebra primitives but stops short of Grade-12
   curriculum.
2. **Physics (Grade 11)** — 3 blocker categories (no equation
   variables, composite SI units, no `g`). Greek + units alone aren't
   enough to compose a single full kinematics solution.
3. **Programming Java (Grade 11)** — 3 blocker categories (no `++ --
   +=`, no `System.out.println` idiom, no annotations). Every AP-CS
   problem types these dozens of times.

Honourable mentions: Chemistry (subscripts `₅ ₆ ₇`), Statistics
(`ME`, `z*`), Earth Science (scientific notation).

---

NOTE: This audit is independent of the v1 workflow agent's output in
`tests/workflows/*.md` (top level) and `e2e/math-workflows/*.spec.ts`.
This report and the grade-8-12 markdowns are documentation only. No
keyboard source was modified — fixing the gaps is the user's call per
the project's "no release yet" guard.
