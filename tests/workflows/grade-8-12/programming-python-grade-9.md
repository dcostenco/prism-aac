# Programming — Python — Grade 9

Real-classroom problems from an intro CS class. Solution style
mirrors the reference PDF: every step on its own line, final
"answer" is the printed output or returned value.

Math panel categories used: `programming-python` (a-z, 0-9, _, def,
for, if, else, return, print, range, in, True, False, None, brackets,
ops).

<!-- expected math-panel keys: a-z 0-9 _ + - * / = == != < > <= >= ( ) [ ] { } : , . " ' def for if else elif return print range in import from -->

1. Sum of integers 1..10 using a for loop.

   total = 0
   for i in range(1,11):
       total = total + i
   print(total)
   output = 55

2. Even / odd checker — n = 14.

   n = 14
   if n % 2 == 0:
       print("even")
   else:
       print("odd")
   output = "even"

3. Function — return the square of x.

   def square(x):
       return x * x
   square(7)
   output = 49

4. List length — count students in a roster.

   roster = ["Ada", "Ben", "Chen", "Dani"]
   n = len(roster)
   print(n)
   output = 4

5. Average of a list of grades.

   grades = [80, 90, 70, 100]
   total = sum(grades)
   total = 340
   n = len(grades)
   n = 4
   avg = total / n
   avg = 85.0

6. Find the maximum — largest of 12, 7, 23, 19.

   nums = [12, 7, 23, 19]
   biggest = max(nums)
   print(biggest)
   output = 23

7. While loop — count down from 5.

   n = 5
   while n > 0:
       print(n)
       n = n - 1
   output = 5 4 3 2 1

NOTE: This document must be reviewed and individualized by the
classroom teacher.
