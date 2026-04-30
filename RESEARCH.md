# PrismAAC — Evidence Base and Clinical References

This document provides the scientific foundation for every design decision in PrismAAC. All features are grounded in peer-reviewed research or established clinical standards. Staff implementing this system should review the relevant sections before configuring the app for a client.

**Clinical Safety Statement:** PrismAAC is a communication tool, not a replacement for clinical assessment. All configuration changes must be reviewed by a credentialed BCBA or SLP before implementation with a client. The app follows the principle of nonmaleficence — it is designed to never restrict, reduce, or interfere with a client's existing communication abilities.

---

## 1. Core Vocabulary and Layout

### Evidence: Core vs. Fringe Vocabulary

PrismAAC's default phrase set prioritizes core vocabulary — the small set of words that accounts for the majority of daily communication.

- **Banajee, M., DiCarlo, C., & Stricklin, S. (2003).** Core vocabulary determination for toddlers. *Augmentative and Alternative Communication, 19*(2), 67–73.
  - Finding: 200–400 core words account for approximately 80% of daily communication across all age groups and contexts.

- **Beukelman, D. R., Jones, R. S., & Rowan, M. (1989).** Frequency of word usage by nondisabled peers in integrated preschool classrooms. *Augmentative and Alternative Communication, 5*(4), 243–248.
  - Finding: 50 core words account for 40–50% of all utterances; 100 core words account for ~60%.

- **Recommended ratio:** 4:1 core-to-fringe on any display (speechpathology.com, Article 20283).

**How PrismAAC applies this:** The 52 default phrases are organized around high-frequency communication situations (Help/Needs, Quick Talk) with core vocabulary front-loaded. Predictions default to the five most common sentence starters: I, We, Can, Help, All done.

### Evidence: Motor Planning (LAMP Approach)

- **Light, J., & Drager, K. (2007).** AAC technologies for young children with complex communication needs. *Augmentative and Alternative Communication, 23*(3), 204–216.
  - Finding: Consistent motor plans (same word always in the same location) reduce cognitive load and increase communication speed.

- **ASHA Practice Portal — AAC.** American Speech-Language-Hearing Association.
  - Recommendation: The LAMP (Language Acquisition through Motor Planning) approach emphasizes consistent symbol positions across all pages.

**How PrismAAC applies this:** The prediction bar uses LAMP-stable slots — predictions update content but maintain position stability, so the child builds muscle memory for where each word appears.

---

## 2. Touch Target Sizing and Motor Accessibility

### Evidence: Button Sizes for Motor-Impaired Users

- **Koester, H. H., & Simpson, R. C. (2012).** Effect of button size on accuracy and effort for pointing tasks. *Proceedings of RESNA Annual Conference.* (PMC3572909)
  - Participants: 38 adults with motor disabilities, 15 without.
  - Finding: Non-disabled performance plateaus at 20mm; motor-impaired users show continued improvement up to 30mm. At 20mm, miss rate was 19%; at 25mm, 12%; at 30mm, 8%.
  - Gap size (1mm vs 3mm) was marginally significant — button size was the dominant factor.

- **Bertucco, M., & Sanger, T. D. (2018).** A model for optimizing AAC touchscreen layouts for children with dyskinetic CP. *IEEE Transactions on Neural Systems and Rehabilitation Engineering, 26*(7), 1371–1380.
  - Finding: Fitts's Law-based optimization predicts that communication performance improves when layout parameters (button size, number, spacing) are customized for the individual user.
  - Minimum recommended button size for children with CP: 25–30mm.

- **Sesto, M. E., Irwin, C. B., et al. (2012).** Effect of touch screen button size on performance. *Human Factors, 54*(3), 423–436.
  - Finding: Button size, but not spacing, influenced touch characteristics.

- **WCAG 2.2** — Web Content Accessibility Guidelines.
  - Level AA (2.5.8): Minimum 24×24 CSS pixels.
  - Level AAA (2.5.5): Minimum 44×44 CSS pixels.

**How PrismAAC applies this:** Keyboard keys are 109×88px (≥25mm at standard DPI). Punctuation keys minimum 56px wide. All interactive elements ≥44×44px. Key gaps 10px. Close/back buttons enlarged from 14px to 44px after accessibility audit.

---

## 3. Haptic and Audio Feedback

### Evidence: Multi-Modal Feedback for Motor-Impaired Users

- **Hoggan, E., Brewster, S. A., & Johnston, J. (2008).** Investigating the effectiveness of tactile feedback for mobile touchscreens. *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems,* 1573–1582.
  - Finding: Tactile feedback significantly improves accuracy and user satisfaction on touchscreens, particularly for users who cannot maintain visual attention on the screen during input.

- **Commercial AAC standards:** Proloquo2Go, TouchChat, and TD Snap all provide haptic pulse (10ms vibration), audio click, and visual scale feedback on every button press.

**How PrismAAC applies this:** Triple-channel feedback on every interaction: haptic (10ms vibration via `navigator.vibrate`), audio (distinct synthesized tones for keys, buttons, and delete), visual (scale-down transform + color brighten + glow shadow). Respects `prefers-reduced-motion` for users with vestibular sensitivity.

---

## 4. Color Coding — Modified Fitzgerald Key

### Evidence: Color-Coded Word Categories

- **Goossens', C., Crain, S., & Elder, P. (1992).** *Engineering the Preschool Environment for Interactive, Symbolic Communication.* Southeast Augmentative Communication Conference Publications.
  - Established the Modified Fitzgerald Key color system used across the AAC industry:
    - Yellow: Pronouns / People
    - Green: Verbs / Actions
    - Blue: Adjectives / Descriptors
    - Orange: Nouns / Things
    - Pink: Social words
    - White: Miscellaneous grammar
    - Purple: Places

- **Bryan, A. (1997).** Colourful Semantics. In S. Chiat, J. Law, & J. Marshall (Eds.), *Language Disorders in Children and Adults.* Whurr Publishers.
  - Finding: Color-coding by grammatical function provides a visual scaffold for sentence construction. Children can "see" the grammar, improving word ordering and recognition of word functions.

- **Bolderson, S., Dosanjh, C., Milligan, C., Pring, T., & Chiat, S. (2011).** Colourful Semantics. *Child Language Teaching and Therapy, 27*(2), 180–190.
  - Finding: Colourful Semantics improved sentence construction in children with developmental language disorder.

**How PrismAAC applies this:** Phase 2 will implement the Modified Fitzgerald Key color system across all phrase buttons, prediction pills, and AI Chat responses. (Currently documented as a gap test in the test suite.)

---

## 5. Word Prediction

### Evidence: Prediction Count and Communication Rate

- **Trnka, K., & McCoy, K. F. (2008).** Evaluating word prediction. *Proceedings of ACL-08: HLT.* Also published in *ACM Transactions on Accessible Computing, 1*(3).
  - Finding: Word prediction saves up to 40–50% of keystrokes with 3–5 predictions. A 15-word window produces higher prediction rates but increases cognitive scanning cost. Practical sweet spot for motor-impaired children: 3–5 predictions.

- **Cai, Z., Venugopalan, S., Tomanek, K., et al. (2024).** SpeakFaster LLM-powered AAC. *Nature Communications, 15.*
  - Finding: LLM-based prediction achieved text-entry rates 29–60% above baselines for ALS eye-gaze AAC users. Context-aware abbreviation expansion surpassed traditional forward prediction by 30–40%.

**How PrismAAC applies this:** 5 prediction slots (matching Trnka's optimal range). Three-tier scoring: bigram context (0.5 weight), global frequency (0.3), recency (0.2). Predictions persist via localStorage and Supabase for cross-device continuity.

---

## 6. Speech Recognition for Dysarthric Speakers

### Evidence: ASR Accuracy on Atypical Speech

- **WhisperX for Pediatric Dysarthric Speech (2025).** *Journal of Speech, Language, and Hearing Research.*
  - Finding: WhisperX models generalize more effectively to atypical pediatric speech than Wav2Vec2 without disorder-specific fine-tuning.

- **Improved Dysarthric Speech to Text via TTS Personalization (2025).** *EUSIPCO 2025.*
  - Finding: Fine-tuning Whisper on real + synthesized dysarthric speech data reduced word error rate from 76% to 18.3%.

- **Bashar, M. A., et al. (2024).** Hypernetworks for personalizing ASR to atypical speech. *Transactions of the ACL* (MIT Press).
  - Finding: Speaker-specific LoRA adaptation of Whisper dramatically reduces word error rates for dysarthric speakers.

- **Vocabulary-constrained recognition.** *Scientific Reports, Nature (2024).*
  - Finding: Speaker-dependent systems with a 25-word restricted vocabulary achieved 81% word recognition accuracy for dysarthric speakers, vs. ~25% with open vocabulary.

**How PrismAAC plans to apply this (Phase 3):** Vocabulary-constrained recognition using the child's known AAC vocabulary as the search space. Long silence tolerance (8–10 seconds). Top-3 candidate UI for the child to confirm. Keyboard fallback always available.

---

## 7. AI in AAC — Preserving Authorship

### Evidence: LLM-Assisted Communication

- **Valencia, S., Cave, R., Kallarackal, K., et al. (2023).** "The less I type, the better." *CHI 2023, ACM.*
  - Finding: AI can significantly reduce typing effort, but AI-generated suggestions can feel inauthentic. AAC users worry about authorship and voice. Effort in communication is sometimes a symbol of caring — too much automation can undermine perceived effort.
  - Recommendation: Always present AI suggestions as options, never auto-insert. The user must confirm.

- **Holyfield, C., Zimmerman, K., MacNeil, K., et al. (2024).** Context-aware AAC with automated response options. *Folia Phoniatrica et Logopaedica, 77*(3), 269–283.
  - Finding: Context-aware AAC technologies have the potential to enhance participation for young emerging symbolic communicators.

- **Gaines, A., & Vertanen, K. (2025).** Adapting LLMs for character-based AAC. *EMNLP Findings.*
  - Finding: Domain-adapted LLMs significantly outperform base models for AAC-style communication. Fine-tuning on simple, conversational text improves prediction quality.

**How PrismAAC applies this:** The caregiver notes system requires explicit [Apply] confirmation for every configuration change. The child's message bar is never auto-modified by AI. All AI suggestions are presented as tappable options, never inserted automatically.

---

## 8. PECS and Verbal Operant Framework

### Evidence: Functional Communication Training

- **Bondy, A., & Frost, L. (2001).** The Picture Exchange Communication System. *Behavior Modification, 25*(5), 725–744.
  - Over 240 published research articles support PECS as an evidence-based practice.
  - Phase 3 (picture discrimination) is the critical milestone for intentional communication.

- **BACB Task List (5th Edition), Section B-14:** Requires BCBAs to "define and provide examples of the verbal operants" — mand, tact, echoic, intraverbal, listener responding, imitation.

**How PrismAAC applies this:** Categories support multiple verbal operant types — Help/Needs (mands), Quick Talk (social/tacts), Food/Ordering (mands in structured sequences). The caregiver notes system documents all AAC modifications as required by BACB ethics.

---

## 9. Clinical Safety — Do No Harm

### Governing Principles

- **BACB Ethics Code for Behavior Analysts, Section 2.01:** Behavior analysts provide effective treatment — selecting procedures supported by empirical evidence.

- **BACB Ethics Code, Section 2.09:** Behavior analysts use least restrictive procedures that are effective.

- **ASHA Position Statement on AAC:** Communication is a fundamental human right. AAC systems should never restrict, reduce, or remove a person's existing communication abilities.

### Safety Guardrails in PrismAAC

1. **Communication access is never restricted.** The keyboard is always visible and usable regardless of what panels are open. No feature gates communication behind configuration.

2. **All changes are documented.** The caregiver notes system creates an audit trail of every modification to the child's AAC configuration, including who made the change and when.

3. **Changes require confirmation.** The action execution engine shows a preview of proposed changes and requires explicit [Apply] before modifying phrases, categories, or ordering flows.

4. **Default phrases cannot be deleted.** Only custom phrases can be removed. Default vocabulary remains available as a safety net.

5. **Undo is always available.** The message bar undo button recovers accidentally cleared text.

6. **Offline-first.** The app works fully without internet connectivity. Supabase sync is background and non-blocking. A child is never left without their communication device because of a network issue.

7. **No data loss.** localStorage is the primary store. Supabase is backup. Prediction data decays gradually (5% per week for inactive words) rather than being deleted.

---

## References (Alphabetical)

1. Banajee, M., DiCarlo, C., & Stricklin, S. (2003). Core vocabulary determination for toddlers. *AAC, 19*(2), 67–73.
2. Bashar, M. A., et al. (2024). Hypernetworks for personalizing ASR. *TACL*, MIT Press.
3. Bertucco, M., & Sanger, T. D. (2018). Optimizing AAC touchscreen layouts. *IEEE TNSRE, 26*(7), 1371–1380.
4. Bolderson, S., et al. (2011). Colourful Semantics. *CLTT, 27*(2), 180–190.
5. Bondy, A., & Frost, L. (2001). PECS. *Behavior Modification, 25*(5), 725–744.
6. Bryan, A. (1997). Colourful Semantics. In *Language Disorders in Children and Adults.* Whurr.
7. Cai, Z., et al. (2024). SpeakFaster LLM-powered AAC. *Nature Communications, 15.*
8. Gaines, A., & Vertanen, K. (2025). Adapting LLMs for AAC. *EMNLP Findings.*
9. Goossens', C., Crain, S., & Elder, P. (1992). *Engineering the Preschool Environment.* SEAC Publications.
10. Hoggan, E., Brewster, S. A., & Johnston, J. (2008). Tactile feedback for mobile touchscreens. *CHI 2008*, 1573–1582.
11. Holyfield, C., et al. (2024). Context-aware AAC. *Folia Phoniatrica et Logopaedica, 77*(3), 269–283.
12. Koester, H. H., & Simpson, R. C. (2012). Button size for pointing tasks. *RESNA.* (PMC3572909)
13. Light, J., & Drager, K. (2007). AAC technologies for young children. *AAC, 23*(3), 204–216.
14. Sesto, M. E., et al. (2012). Touch screen button size. *Human Factors, 54*(3), 423–436.
15. Trnka, K., & McCoy, K. F. (2008). Evaluating word prediction. *ACL-08: HLT.*
16. Valencia, S., et al. (2023). "The less I type, the better." *CHI 2023*, ACM.
17. WCAG 2.2. W3C Web Content Accessibility Guidelines.
18. BACB Ethics Code for Behavior Analysts (2022). Behavior Analyst Certification Board.
19. ASHA Practice Portal — AAC. American Speech-Language-Hearing Association.
