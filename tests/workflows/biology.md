# Biology workflows — Grade 8-10

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/biology.spec.ts`.

The math panel categories used: `main` for digits + operators,
`biology` for genotypes (AA, Aa, aa, Bb), nucleotides (A T G C U), and
the cross × symbol.

<!-- expected math-panel keys: 0-9 + − × ÷ = . AA Aa aa Bb A T G C U DNA RNA → -->

1. Punnett square — Aa × Aa

   Aa × Aa
   AA + Aa + Aa + aa = 4
   AA = 1 ÷ 4
   Aa = 2 ÷ 4
   aa = 1 ÷ 4

2. Phenotype ratio for Aa × Aa (dominant : recessive)

   Aa × Aa
   AA + 2 Aa + aa = 4
   dominant = 3
   recessive = 1
   ratio = 3 ÷ 1

3. DNA → RNA transcription — pair the bases

   DNA = A T G C
   RNA = U A C G

4. Codon length — RNA strand of 12 bases makes how many codons?

   bases = 12
   codon = 3
   n = 12 ÷ 3
   n = 4

5. Photosynthesis molecule ratio — 6 water + 6 carbon dioxide

   H₂O = 6
   CO₂ = 6
   ratio = 6 ÷ 6
   ratio = 1

6. Bb × bb cross — chance of Bb offspring

   Bb × bb
   Bb + Bb + bb + bb = 4
   Bb = 2 ÷ 4
   Bb = 1 ÷ 2
