# Physics workflows — Grade 9-10

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/physics.spec.ts`.

The math panel categories used: `main` for digits + operators,
`physics` for unit symbols (m, s, kg, N, J, V, Ω) and constants.

<!-- expected math-panel keys: 0-9 + − × ÷ = ( ) . m s kg N J V Ω -->

1. Kinematics — final velocity from u = 0, a = 3, t = 4

   v = u + a × t
   v = 0 + 3 × 4
   v = 12

2. Newton's second law — force on a 5 kg mass at 2 m/s²

   f = m × a
   f = 5 × 2
   f = 10 N

3. Kinetic energy — 4 kg moving at 3 m/s

   k = m × v × v ÷ 2
   k = 4 × 3 × 3 ÷ 2
   k = 36 ÷ 2
   k = 18 J

4. Ohm's law — current through a 12 V source and 4 Ω resistor

   v = i × Ω
   12 = i × 4
   i = 12 ÷ 4
   i = 3

5. Power — 6 V battery driving 2 A

   p = v × a
   p = 6 × 2
   p = 12 W

6. Distance from speed and time — 60 m/s for 5 s

   d = v × s
   d = 60 × 5
   d = 300 m
