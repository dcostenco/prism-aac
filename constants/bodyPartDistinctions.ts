/**
 * Body-part tile pairs that MUST produce distinct speech.
 *
 * Why this file exists
 * -------------------
 * The AAC tile set is authored in English, which silently assumes English's
 * lexical distinctions. Many languages do not split the same way: Russian,
 * Ukrainian and Bulgarian used one word for hand and arm (рука/ръка), as did
 * Amharic (እጅ), Swahili (mkono) and Bengali (হাত).
 *
 * When two tiles speak the same word, a non-speaking user cannot tell a
 * caregiver WHICH part hurts. That is a clinical failure, not a cosmetic one
 * — "my arm hurts" and "my hand hurts" lead to different examinations.
 *
 * It is not a translation bug either. The individual translations were
 * correct; the tile set is what assumed too much. So this is a product-level
 * contract, enforced by tests/body-part-distinctions.test.ts (text) and
 * `npm run check:spoken` (pronunciation).
 */

/** Pairs a user must be able to distinguish. Enforced — collisions fail CI. */
export const CLINICALLY_DISTINCT_PAIRS: Array<{ a: string; b: string; why: string }> = [
  {
    a: 'hb-hand',
    b: 'hb-arm',
    why: 'Different injuries and different examinations. A fall onto the hand and a fracture of the arm are not interchangeable reports.',
  },
  {
    a: 'hbp-hand',
    b: 'hbp-arm',
    why: 'Same contract as hb-hand/hb-arm, enforced on the second tile set so the two screens cannot drift apart again.',
  },
  {
    a: 'hb-foot',
    b: 'hbp-leg',
    why: 'Same reasoning as hand/arm — a foot injury and a leg injury are examined and treated differently. There is no hb-leg tile; Leg lives only in the hbp set.',
  },
  {
    a: 'hbp-foot',
    b: 'hbp-leg',
    why: 'Both tiles live in the hbp set. Enforced explicitly rather than relying on the transitive chain (consistency pins hbp-foot to hb-foot, and hb-foot/hbp-leg is enforced) — this is the exact pair that was broken in am/sw/bn while the chain looked intact.',
  },
  {
    a: 'hb-mouth',
    b: 'hb-lips',
    why: 'Lip injury (bleeding, chapping, sting) vs mouth interior (toothache, sore throat, choking) point to different causes.',
  },
  {
    a: 'hb-throat',
    b: 'hb-neck',
    why: 'Sore throat / trouble swallowing (interior) vs neck pain or stiffness (exterior). A caregiver acts differently on each.',
  },
  {
    a: 'hb-finger',
    b: 'hb-toe',
    why: 'Anatomically unrelated; collapsing them would send a caregiver to the wrong limb entirely.',
  },
  {
    a: 'hb-ankle',
    b: 'hb-heel',
    why: 'Sprain vs bruise/spur — adjacent but clinically distinct.',
  },
];

/**
 * Languages where a pair genuinely CANNOT be distinguished in natural speech.
 *
 * Empty by design. Three entries lived here and all three were resolved rather
 * than accepted as permanent limitations:
 *
 *   bn hand/arm — first judged unfixable because হাত covers both and বাহু is
 *     literary. Resolved as Arm = পুরো হাত ("whole hand"), which is real parent
 *     usage. Note the tempting parallel to the foot fix (Hand = হাতের পাতা) was
 *     WRONG: markedness runs the other way. পা defaults to "leg", so narrowing
 *     it to পায়ের পাতা works; হাত already defaults to "hand", so moving হাত onto
 *     Arm would still be heard as "hand" and reproduce the collision.
 *
 *   am foot/leg — resolved as Foot = የእግር መዳፍ, using the construction Amharic
 *     already uses productively in የእጅ መዳፍ ("palm of the hand").
 *
 *   ja foot/leg — 足 and あし really are one spoken word (measured 382 ms vs
 *     379 ms, 0.8% apart). Resolved as Foot = 足の裏, now 48% apart from Leg = 足.
 *
 * Keep this empty unless a limitation is genuinely irreducible. Every entry
 * here is a user who cannot tell a caregiver which part of them hurts.
 */
export const UNRESOLVABLE_IN_LANGUAGE: Array<{
  a: string;
  b: string;
  langs: string[];
  /**
   * 'textual'  — the tiles literally share a string; the unit test sees it.
   * 'phonetic' — the strings differ but sound alike. The unit test is blind to
   *              this class; `npm run check:spoken` screens for it by comparing
   *              voiced duration through real TTS.
   */
  collisionType: 'textual' | 'phonetic';
  why: string;
}> = [];

/**
 * Pairs allowed to collapse to one word, with the reason.
 *
 * These are NOT defects. Where the English tiles are themselves synonyms, a
 * language that renders them identically is behaving correctly, and forcing a
 * spurious difference would produce unnatural speech.
 */
export const PERMITTED_COLLAPSES: Array<{ a: string; b: string; why: string }> = [
  {
    a: 'hb-tummy',
    b: 'hb-belly',
    why: 'English synonyms for the same body part — the redundancy is in the English tile set, not the translations. 19 of 24 languages collapse these and are right to. Consider merging the two English tiles instead.',
  },
  {
    a: 'hb-eye',
    b: 'hbp-eyes',
    why: 'Singular/plural of one body part. Many languages do not mark the distinction on a bare noun, and forcing it adds words an AAC user must pay for.',
  },
  {
    a: 'hb-ear',
    b: 'hbp-ears',
    why: 'Singular/plural, same reasoning as eye/eyes.',
  },
  {
    a: 'hb-tummy',
    b: 'hbp-belly',
    why: 'Third member of the Tummy/Belly synonym group — hb-tummy, hb-belly and hbp-belly all name the same body part, so every pairing among them is a permitted collapse.',
  },
  {
    a: 'hb-belly',
    b: 'hbp-belly',
    why: 'Same word on two tile sets; collapsing is correct, not a defect.',
  },
  {
    a: 'hb-mouth',
    b: 'hbp-mouth',
    why: 'Same English word on both tile sets. Consistency is enforced separately by tests/body-part-consistency.test.ts; sharing a value here is required, not a collision.',
  },
];
