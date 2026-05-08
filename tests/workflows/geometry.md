# Geometry workflows — Grade 7-9

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer. Each
problem maps to one Playwright `it()` in
`e2e/math-workflows/geometry.spec.ts`.

The math panel categories used: `main` for digits + operators,
`adv-math` for ², √, variables, `geom` for ° and shape names.

<!-- expected math-panel keys: 0-9 + − × ÷ = ( ) . , ² √ a b c r ° -->

1. Pythagorean theorem — find the hypotenuse of a 3-4 right triangle

   a² + b² = c²
   3² + 4² = c²
   9 + 16 = c²
   c² = 25
   c = √25
   c = 5

2. Area of a rectangle — length 12, width 5

   A = l × w
   A = 12 × 5
   A = 60

3. Area of a triangle — base 8, height 6

   A = b × h ÷ 2
   A = 8 × 6 ÷ 2
   A = 48 ÷ 2
   A = 24

4. Perimeter of a rectangle — length 9, width 4

   P = 2 × l + 2 × w
   P = 2 × 9 + 2 × 4
   P = 18 + 8
   P = 26

5. Triangle angle sum — find the third angle if two are 50° and 70°

   a + b + c = 180°
   50 + 70 + c = 180
   c = 180 − 50 − 70
   c = 60°

6. Circumference of a circle — radius 7

   C = 2 × π × r
   C = 2 × π × 7
   C = 14 × π
   C ≈ 44
