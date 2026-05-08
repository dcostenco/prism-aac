# Misc Math workflows — Grade 9-11

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/misc-math.spec.ts`.

The math panel categories used: `main` for digits + operators,
`misc-math` for set ops (∈, ∪, ∩, ⊂, ∅), and `adv-math` for x.

<!-- expected math-panel keys: 0-9 + − × ÷ = . x ∈ ∪ ∩ ⊂ ∅ ≠ ≈ -->

1. Union of two sets

   a = (1, 2, 3)
   b = (3, 4, 5)
   a ∪ b = (1, 2, 3, 4, 5)

2. Intersection of two sets

   a = (1, 2, 3)
   b = (2, 3, 4)
   a ∩ b = (2, 3)

3. Subset check — is (1, 2) ⊂ (1, 2, 3)?

   x = (1, 2)
   y = (1, 2, 3)
   x ⊂ y = 1

4. Empty set intersection

   a = (1, 2)
   b = (3, 4)
   a ∩ b = ∅

5. Function composition — f(x) = x + 2, g(x) = 3 × x, find g(f(2))

   f(2) = 2 + 2
   f(2) = 4
   g(4) = 3 × 4
   g(f(2)) = 12

6. Element-of test — is 3 ∈ (1, 2, 3)?

   x = 3
   s = (1, 2, 3)
   x ∈ s = 1
