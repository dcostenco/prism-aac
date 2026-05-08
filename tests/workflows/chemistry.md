# Chemistry workflows — Grade 8-10

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/chemistry.spec.ts`.

The math panel categories used: `main` for digits + operators,
`chemistry` for element symbols (H, O, C, Na, Cl), reaction arrow →,
subscripts ₂ ₃ ₄, and unit `mol`.

<!-- expected math-panel keys: 0-9 + − × ÷ = . H O C Na Cl ₂ ₃ ₄ → mol -->

1. Balance the formation of water

   H₂ + O₂ → H₂O
   2 H₂ + O₂ → 2 H₂O

2. Balance the burning of methane

   C + O₂ → C O₂
   C + O₂ → CO₂

3. Molar mass of water (H = 1, O = 16)

   H × 2 + O = mass
   1 × 2 + 16 = mass
   2 + 16 = 18

4. Moles from grams — 36 g of water (M = 18)

   n = g ÷ M
   n = 36 ÷ 18
   n = 2 mol

5. Stoichiometry — 4 mol H₂ reacts; how many mol H₂O form?

   2 H₂ + O₂ → 2 H₂O
   H₂ ÷ H₂O = 1
   H₂O = 4 × 1
   H₂O = 4 mol

6. Salt formation — sodium plus chlorine

   Na + Cl → NaCl
   2 Na + Cl₂ → 2 NaCl
