# Programming — Java — Grade 11

Real-classroom problems from AP Computer Science A. Solution style
mirrors the reference PDF: every step on its own line, final
"answer" is the printed output or returned value.

Math panel categories used: `programming-java` (a-z A-Z, 0-9, _,
public, private, class, void, int, String, boolean, if, else, for,
while, return, new, this, null, true, false, brackets, ops).

<!-- expected math-panel keys: a-z A-Z 0-9 _ + - * / = == != < > <= >= ( ) [ ] { } : ; , . " ' public private class void int String boolean if else for while return new this null true false static final -->

2. Method — return the sum of two integers.

   public static int add(int a, int b) {
       return a + b;
   }
   add(3, 4)
   output = 7

2. For-loop sum 1..10.

   int total = 0;
   for (int i = 1; i <= 10; i++) {
       total = total + i;
   }
   System.out.println(total);
   output = 55

3. If / else — letter grade for score = 88.

   int score = 88;
   if (score >= 90) {
       System.out.println("A");
   } else if (score >= 80) {
       System.out.println("B");
   } else {
       System.out.println("C");
   }
   output = "B"

4. Array maximum — largest of {12, 7, 23, 19}.

   int[] nums = {12, 7, 23, 19};
   int max = nums[0];
   for (int i = 1; i < nums.length; i++) {
       if (nums[i] > max) max = nums[i];
   }
   max = 23

5. String length — count characters in "Hello".

   String s = "Hello";
   int n = s.length();
   n = 5

6. Class with a constructor — Dog with a name field.

   public class Dog {
       private String name;
       public Dog(String n) {
           this.name = n;
       }
       public String getName() {
           return this.name;
       }
   }
   Dog d = new Dog("Rex");
   d.getName() = "Rex"

7. While loop — first power of 2 greater than 100.

   int p = 1;
   while (p <= 100) {
       p = p * 2;
   }
   p = 128

NOTE: This document must be reviewed and individualized by the
classroom teacher.
