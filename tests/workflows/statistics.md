# Statistics workflows — Grade 9-11

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/statistics.spec.ts`.

The math panel categories used: `main` for digits + operators,
`statistics` for μ, σ, n, z, p-value, ≈ ≠, plus the H0/Ha hypothesis
labels.

<!-- expected math-panel keys: 0-9 + − × ÷ = . n μ σ z p H0 Ha ≈ ≠ -->

1. Mean of 4 numbers — 2, 4, 6, 8

   sum = 2 + 4 + 6 + 8
   sum = 20
   n = 4
   μ = sum ÷ n
   μ = 20 ÷ 4
   μ = 5

2. Range — find the range of 3, 7, 12, 4, 9

   max = 12
   min = 3
   range = max − min
   range = 12 − 3
   range = 9

3. Standard deviation step — squared deviation when x = 7, μ = 5

   x − μ = 7 − 5
   x − μ = 2
   σ = 2 × 2
   σ = 4

4. Z-score — x = 70, μ = 60, σ = 5

   z = x − μ ÷ σ
   z = 70 − 60 ÷ 5
   z = 10 ÷ 5
   z = 2

5. Hypothesis decision — p = 0.02 vs α = 0.05

   p ≈ 0.02
   α = 0.05
   p < α
   reject H0

6. Probability of two heads in two coin flips

   p = 1 ÷ 2
   p × p = 1 ÷ 2 × 1 ÷ 2
   p × p = 1 ÷ 4
