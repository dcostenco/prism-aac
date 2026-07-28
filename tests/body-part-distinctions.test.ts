/**
 * Body-part tiles must not speak the same word.
 *
 * Found by auditing the Amharic/Swahili/Bengali additions, but it turned out
 * to be a PRE-EXISTING defect in shipped languages: Russian, Ukrainian and
 * Bulgarian have always rendered both "Hand" and "Arm" as рука/ръка, so a
 * user of those languages has never been able to say which one hurts.
 *
 * This is a product contract, not a translation assertion — see
 * constants/bodyPartDistinctions.ts for which pairs must differ and which are
 * allowed to collapse.
 */
import { describe, it, expect } from 'vitest';
import { getPhraseText, hasPhraseTranslation } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { LANG_META } from '@/engine/i18n';
import {
  CLINICALLY_DISTINCT_PAIRS,
  PERMITTED_COLLAPSES,
  UNRESOLVABLE_IN_LANGUAGE,
} from '@/constants/bodyPartDistinctions';

// 'zh' is a back-compat alias resolved to zh-Hans; the Chinese variants all
// share the 'zh' translation bucket, so testing them separately is noise.
const LANGS = LANG_META.map((l) => l.code).filter(
  (c) => c !== 'en' && c !== 'zh-Hans' && c !== 'zh-Hant' && c !== 'zh-HK',
);

function textFor(id: string, lang: string): string | null {
  const phrase = DEFAULT_PHRASES.find((p) => p.id === id);
  if (!phrase) return null;
  // Ask whether a translation EXISTS, rather than inferring it from the text
  // differing from English. German and Dutch render Hand as "Hand" and Arm as
  // "Arm"; the old string comparison treated those as untranslated and skipped
  // the pair entirely, so a regression setting German Arm to "Hand" would have
  // passed. An untranslated tile is a coverage gap, already covered elsewhere.
  if (!hasPhraseTranslation(id, lang as never)) return null;
  return getPhraseText(id, lang as never, phrase.text);
}

describe('Body-part tiles — clinically distinct pairs speak differently', () => {
  for (const { a, b, why } of CLINICALLY_DISTINCT_PAIRS) {
    it(`${a} vs ${b} differ in every language`, () => {
      const exempt = new Set(
        UNRESOLVABLE_IN_LANGUAGE.filter((e) => e.a === a && e.b === b).flatMap((e) => e.langs),
      );
      const collisions: string[] = [];
      for (const lang of LANGS) {
        if (exempt.has(lang)) continue;
        const ta = textFor(a, lang);
        const tb = textFor(b, lang);
        if (ta && tb && ta === tb) collisions.push(`${lang}: both speak "${ta}"`);
      }
      expect(
        collisions,
        `${a}/${b} collide in ${collisions.length} language(s).\n${why}\n${collisions.join('\n')}`,
      ).toEqual([]);
    });
  }

  it('every pair in the contract references real phrase ids', () => {
    // Guards the contract rotting silently if a tile is renamed or removed —
    // a stale id would make the assertion above vacuously pass.
    const ids = new Set(DEFAULT_PHRASES.map((p) => p.id));
    const missing: string[] = [];
    for (const { a, b } of [...CLINICALLY_DISTINCT_PAIRS, ...PERMITTED_COLLAPSES]) {
      if (!ids.has(a)) missing.push(a);
      if (!ids.has(b)) missing.push(b);
    }
    expect(missing).toEqual([]);
  });

  it('permitted collapses are documented, not silent', () => {
    for (const entry of PERMITTED_COLLAPSES) {
      expect(entry.why.length, `${entry.a}/${entry.b} needs a reason`).toBeGreaterThan(40);
    }
  });

  it('every language exemption is justified and still actually collides', () => {
    // A stale exemption quietly masks a future regression on that pair.
    //
    // Only 'textual' exemptions can be checked this way. 'phonetic' ones are
    // homophones with DIFFERENT strings — this test compares text, so it is
    // structurally blind to them and asserting textual equality would fail.
    // That blindness is the point of recording collisionType at all.
    for (const e of UNRESOLVABLE_IN_LANGUAGE) {
      expect(e.why.length, `${e.a}/${e.b} exemption needs a reason`).toBeGreaterThan(60);
      if (e.collisionType !== 'textual') continue;
      for (const lang of e.langs) {
        const ta = textFor(e.a, lang);
        const tb = textFor(e.b, lang);
        expect(
          ta !== null && tb !== null && ta === tb,
          `${e.a}/${e.b} no longer collides textually in ${lang} — remove this exemption`,
        ).toBe(true);
      }
    }
  });

  it('phonetic exemptions are acknowledged as untestable', () => {
    // Documents the known gap rather than pretending coverage exists.
    const phonetic = UNRESOLVABLE_IN_LANGUAGE.filter((e) => e.collisionType === 'phonetic');
    for (const e of phonetic) {
      expect(
        e.why.toLowerCase(),
        `${e.a}/${e.b} (${e.langs.join(',')}) must state that no test can catch it`,
      ).toContain('no test can catch');
    }
  });
});
