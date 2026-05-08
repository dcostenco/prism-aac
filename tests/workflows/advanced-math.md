# Advanced Math workflows — Grade 10-12

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/advanced-math.spec.ts`.

The math panel categories used: `main` for digits + operators,
`adv-math` for ², ³, √, ±, log, ln, x, y, a, b — the four pillars of
high-school advanced math.

<!-- expected math-panel keys: 0-9 + − × ÷ = ( ) . x y a b ² ³ √ ± log ln -->

1. Quadratic formula — solve x² + 5 x + 6 = 0

   x² + 5 x + 6 = 0
   a = 1
   b = 5
   c = 6
   x = − b ± √( b² − 4 × a × c ) ÷ 2 × a
   x = − 5 ± √(25 − 24) ÷ 2
   x = − 5 ± 1 ÷ 2
   x = − 2 or x = − 3

2. Exponential growth — double 3 times from 5

   y = 5 × 2³
   y = 5 × 8
   y = 40

3. Logarithm identity — log(8) ÷ log(2)

   log(8) = log(2³)
   log(8) = 3 × log(2)
   log(8) ÷ log(2) = 3

4. Natural log of e³

   ln(e³) = 3 × ln(e)
   ln(e) = 1
   ln(e³) = 3

5. Square root of a perfect square sum

   x = √(36 + 64)
   x = √100
   x = 10

6. Derivative shortcut — slope of y = x²  at x = 4

   y = x²
   slope = 2 × x
   slope = 2 × 4
   slope = 8
