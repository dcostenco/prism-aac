# History workflows — Grade 5-8

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, the "answer" being a date or era
label. Each problem maps to one Playwright `it()` in
`e2e/math-workflows/history.spec.ts`.

The math panel category used: `history` for era markers (BCE, CE, AD,
BC), century ordinals (1st, 5th, 17th, 20th), and the date-range dash.

<!-- expected math-panel keys: 0-9 + − × ÷ = . BCE CE BC AD c. – 1st 5th 17th 20th 21st -->

1. Years between 50 BCE and 50 CE

   start = 50 BCE
   end = 50 CE
   span = 50 + 50
   span = 100

2. Years between 1492 and 1776

   start = 1492
   end = 1776
   span = 1776 − 1492
   span = 284

3. Identify the century of 1850

   year = 1850
   century = 1850 ÷ 100
   century = 19
   answer = 19th

4. Identify the century of 50 CE

   year = 50 CE
   century = 1
   answer = 1st

5. Order three eras — BCE, CE, AD

   1st = BCE
   2nd = CE
   3rd = AD

6. Difference between 476 CE and 1453 CE (rome → constantinople)

   start = 476
   end = 1453
   span = 1453 − 476
   span = 977
