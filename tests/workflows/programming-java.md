# Java workflows — Grade 8-10

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, units on the final answer (here, the
output or the variable's final value). Each problem maps to one
Playwright `it()` in `e2e/math-workflows/programming-java.spec.ts`.

The math panel category used: `programming-java` (`public`, `class`,
`int`, `void`, `for`, `if`, `return`, `new`, `String`, brackets, and
a-z + 0-9 identifiers).

<!-- expected math-panel keys: a-z 0-9 _ + - * / = == ( ) [ ] { } : ; , . " ' public class void int String for if else return new -->

1. Class with a main method — print hello

   public class Hi {
   public static void main(String[] a) {
   System.out.println("hi");
   }
   }
   output = "hi"

2. For loop — sum 1..3 into total

   int total = 0;
   for (int x = 1; x < 4; x = x + 1) {
   total = total + x;
   }
   total = 6

3. Array creation and length — int[] a = new int[5]

   int[] a = new int[5];
   int n = a.length;
   n = 5

4. Method definition — return double

   public int double(int x) {
   return x*2;
   }
   double(5) = 10

5. If / else — even or odd for n = 7

   int n = 7;
   if (n%2 == 0) {
   return 0;
   } else {
   return 1;
   }
   return = 1

6. String concatenation — name greeting

   String name = "ada";
   String greet = "hi " + name;
   greet = "hi ada"
