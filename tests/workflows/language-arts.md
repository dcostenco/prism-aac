# Language Arts workflows — Grade 5-7

Numbered problems matching the algebra workflow PDF style: every
transformation on its own line, the "answer" being a tag
classification. Each problem maps to one Playwright `it()` in
`e2e/math-workflows/language-arts.spec.ts`.

The math panel category used: `language-arts` (POS tags N, V, ADJ,
ADV, PRON, PREP, CONJ, ART; sentence types DECL, INT, IMP, EXCL;
canonical punctuation).

<!-- expected math-panel keys: N V ADJ ADV PRON PREP CONJ ART DECL INT IMP EXCL . , ! ? -->

1. Tag the parts of speech in "the cat ran fast"

   the = ART
   cat = N
   ran = V
   fast = ADV

2. Tag "she gave him a red book"

   she = PRON
   gave = V
   him = PRON
   a = ART
   red = ADJ
   book = N

3. Identify the sentence type — "go home now."

   go = V
   home = N
   . = period
   type = IMP

4. Identify the sentence type — "are you ready?"

   are = AUX
   you = PRON
   ready = ADJ
   ? = question
   type = INT

5. Identify the sentence type — "we won the game!"

   we = PRON
   won = V
   the = ART
   game = N
   ! = exclamation
   type = EXCL

6. Tag a compound sentence — "he ran and she walked"

   he = PRON
   ran = V
   and = CONJ
   she = PRON
   walked = V
   type = COMP
