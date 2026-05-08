# Earth Science workflows — Grade 7-9

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/earth-science.spec.ts`.

The math panel categories used: `main` for digits + operators,
`earth-science` for AU, ly, Mya, km, °C, mph (units a high-school
earth-science class actually uses).

<!-- expected math-panel keys: 0-9 + − × ÷ = . AU ly Mya km °C mph -->

1. Light-year to kilometers — approximate scale (1 ly ≈ 9 trillion km)

   1 ly = 9 km
   2 ly = 2 × 9
   2 ly = 18 km

2. AU to km — Earth-Sun distance (1 AU ≈ 150 million km)

   1 AU = 150 km
   3 AU = 3 × 150
   3 AU = 450 km

3. Plate tectonic rate — 5 cm/year for 200 years

   rate = 5
   years = 200
   distance = 5 × 200
   distance = 1000

4. Temperature change — drop from 25 °C to 10 °C

   start = 25 °C
   end = 10 °C
   Δ = 25 − 10
   Δ = 15 °C

5. Wind speed conversion — 30 mph for 2 hours

   speed = 30 mph
   time = 2
   distance = 30 × 2
   distance = 60 mi

6. Geologic time — fossil aged 65 Mya, today is 0 Mya

   start = 65 Mya
   end = 0
   age = 65 − 0
   age = 65 Mya
