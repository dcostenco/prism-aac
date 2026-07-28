/**
 * Body-part tile pairs that MUST produce distinct speech.
 *
 * Why this file exists
 * -------------------
 * The AAC tile set is authored in English, which silently assumes English's
 * lexical distinctions. Many languages do not split the same way: Russian,
 * Ukrainian and Bulgarian use one word for hand and arm (рука/ръка), as do
 * Amharic (እጅ), Swahili (mkono) and Bengali (হাত).
 *
 * When two tiles speak the same word, a non-speaking user cannot tell a
 * caregiver WHICH part hurts. That is a clinical failure, not a cosmetic one
 * — "my arm hurts" and "my hand hurts" lead to different examinations.
 *
 * It is not a translation bug either. The translations are correct; the tile
 * set is what's wrong. So this is a product-level contract, enforced by
 * tests/body-part-distinctions.test.ts, listing which pairs a user must be
 * able to distinguish and which pairs are allowed to collapse.
 */

/**
 * Pairs a user must be able to distinguish. Enforced — collisions fail CI.
 *
 * Note the two tile sets: `hb-*` (category `health-body`) and `hbp-*`
 * (`health-body-parts`). They overlap, and historically only `hbp-*` carried
 * the correct distinct translations in Slavic languages, so the same user
 * could distinguish hand from arm on one screen but not the other.
 */
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
 * Languages where a pair genuinely CANNOT be distinguished in natural speech,
 * so forcing a difference would produce words a child would never say.
 *
 * These are exempt from the contract above, but they are NOT resolved — each
 * one is a real limitation a user lives with, and the fix is a UI-level
 * disambiguator (body-map picker), not a translation.
 */
export const UNRESOLVABLE_IN_LANGUAGE: Array<{
  a: string;
  b: string;
  langs: string[];
  /**
   * 'textual'  — the two tiles literally share a string; the automated
   *              collision test can see it.
   * 'phonetic' — the strings DIFFER but are homophones, so they are identical
   *              the moment TTS speaks them. The collision test is blind to
   *              this class: it compares text, not pronunciation. Japanese
   *              足 / あし is the case in point. Anything listed as 'phonetic'
   *              was found by a human or a reviewer, not by the test, and the
   *              test cannot regress-guard it.
   */
  collisionType: 'textual' | 'phonetic';
  why: string;
}> = [
  {
    a: 'hb-hand',
    b: 'hb-arm',
    langs: ['bn'],
    collisionType: 'textual',
    why: 'Bengali হাত covers hand and arm in ordinary speech. বাহু is the dictionary word for arm but is সাধু (literary) — a child would not say it, and an AAC device that makes them say it is worse than one that cannot distinguish. Needs a body-map picker.',
  },
  {
    a: 'hbp-hand',
    b: 'hbp-arm',
    langs: ['bn'],
    collisionType: 'textual',
    why: 'Bengali হাত covers both hand and arm on this tile set too. Exempted for the same reason as hb-hand/hb-arm: the only distinct word, বাহু, is literary (সাধু) and not something a child would say. Listed separately rather than folded into that entry so removing one exemption cannot silently drop the other.',
  },
  {
    a: 'hb-foot',
    b: 'hbp-leg',
    langs: ['am'],
    collisionType: 'textual',
    why: 'Amharic: no natural, non-clinical word for foot distinct from እግር could be identified with confidence. Deliberately left as a known limitation rather than shipping a guessed phrase into a device that speaks for someone who cannot correct it. Needs a native speaker, ideally a parent.',
  },
  {
    a: 'hb-foot',
    b: 'hbp-leg',
    langs: ['ja'],
    collisionType: 'phonetic',
    why: 'Japanese 足 (hb-foot) and あし (hbp-leg) are different strings but the SAME spoken word, "ashi" — so the tiles are indistinguishable to a listener even though the automated collision test sees two different values. 脚 does not help: it is also read あし. The alternatives are あんよ (baby-talk, wrong register for older users) or 足の裏 ("sole", which misreports an injury to the top of the foot). Needs a body-map picker. NOTE: no test can catch a regression here — text comparison is blind to homophony.',
  },
];

/**
 * Pairs allowed to collapse to one word, with the reason.
 *
 * These are NOT defects. Where the English tiles are themselves synonyms,
 * a language that renders them identically is behaving correctly, and
 * forcing a spurious difference would produce unnatural speech.
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
];
