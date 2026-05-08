# Python workflows — Grade 7-10

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer (here, the
output value or the function value). Each problem maps to one
Playwright `it()` in `e2e/math-workflows/programming-python.spec.ts`.

The math panel category used: `programming-python` (`def`, `for`, `if`,
`return`, `print`, `range`, `True/False/None`, brackets, and a-z + 0-9
identifiers).

<!-- expected math-panel keys: a-z 0-9 _ + - * / = == ( ) [ ] { } : , . " ' def for if else return print range -->

1. Sum a list using a for loop

   total = 0
   for x in range(1,4):
   total = total + x
   print(total)
   total = 6

2. List comprehension — squares of 1..3

   squares = [x*x for x in range(1,4)]
   squares = [1,4,9]

3. Function definition — return double

   def double(x):
   return x*2
   double(5) = 10

4. String concatenation — greet by name

   name = "ada"
   greet = "hi " + name
   greet = "hi ada"

5. If / else — even or odd for n = 7

   n = 7
   if n%2 == 0:
   print("even")
   else:
   print("odd")
   print = "odd"

6. Length of a list — len([4,5,6])

   nums = [4,5,6]
   n = len(nums)
   n = 3
