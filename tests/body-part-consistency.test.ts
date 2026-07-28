/**
 * The same English body part must speak the same translation everywhere.
 *
 * The tile set has two overlapping groups, `hb-*` (health-body) and `hbp-*`
 * (health-body-parts). Fourteen English words appear in BOTH — Hand, Foot,
 * Arm, Neck, Knee, Toe and so on. When those two tiles carry different
 * translations, the same body part is named two different ways on two screens.
 * For a user still learning the vocabulary that is a real cost, and it hides
 * worse bugs underneath.
 *
 * This is how `hbp-foot` slipped through. The distinctness contract covered
 * `hb-foot` vs `hbp-leg`, so `hb-foot` got fixed in ten languages while
 * `hbp-foot` — the SAME English word — kept the old value and stayed identical
 * to `hbp-leg` in Amharic, Swahili and Bengali. Text-distinctness passed,
 * pronunciation passed, and the tile was still broken.
 *
 * The check also surfaces plain data defects, because a disagreement between
 * two spellings of one word is usually one of them being wrong: `tl` neck had
 * "Leeg" vs "Leig", `sw` knee had two non-words, and `bn` neck differed only
 * by Unicode normalization (precomposed ড় vs ড + nukta).
 */
import { describe, it, expect } from 'vitest';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { LANG_META } from '@/engine/i18n';

const LANGS = LANG_META.map((l) => l.code).filter(
  (c) => c !== 'en' && c !== 'zh-Hans' && c !== 'zh-Hant' && c !== 'zh-HK',
);

const BODY = DEFAULT_PHRASES.filter(
  (p) => /^(hb|hbp)-/.test(p.id) && /body/.test(p.categoryId),
);

/** English word -> the tiles that render it. */
const BY_ENGLISH = new Map<string, typeof BODY>();
for (const p of BODY) {
  const k = p.text.toLowerCase();
  if (!BY_ENGLISH.has(k)) BY_ENGLISH.set(k, []);
  BY_ENGLISH.get(k)!.push(p);
}
const DUPLICATED = [...BY_ENGLISH.entries()].filter(([, tiles]) => tiles.length > 1);

describe('Body-part tiles — one English word, one translation', () => {
  it('finds the duplicated English words to check', () => {
    // Guards the suite going vacuously green if the tile sets are merged or
    // renamed — at that point this file should be deleted, not silently pass.
    expect(DUPLICATED.length).toBeGreaterThan(0);
  });

  for (const [english, tiles] of DUPLICATED) {
    it(`"${english}" speaks one value in every language (${tiles.map((t) => t.id).join(' / ')})`, () => {
      const problems: string[] = [];
      for (const lang of LANGS) {
        const values = tiles
          .map((t) => ({ id: t.id, v: getPhraseText(t.id, lang as never, t.text) }))
          .filter((x) => x.v && x.v !== t0Text(tiles)); // ignore untranslated fallbacks
        const distinct = new Set(values.map((x) => x.v));
        if (distinct.size > 1) {
          problems.push(`${lang}: ${values.map((x) => `${x.id}="${x.v}"`).join('  ')}`);
        }
      }
      expect(
        problems,
        `"${english}" is spoken differently on different screens:\n${problems.join('\n')}`,
      ).toEqual([]);
    });
  }
});

/** English source text, used to detect an untranslated fallback. */
function t0Text(tiles: typeof BODY): string {
  return tiles[0].text;
}
