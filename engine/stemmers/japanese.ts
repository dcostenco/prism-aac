// Japanese stemmer — verb/adjective conjugation suffix stripping.
//
// Real Japanese morphological analysis (kuromoji.js, lindera-wasm) requires
// shipping a 3-4MB IPADIC dictionary, which is too heavy for a per-language
// PWA chunk. Instead, this heuristic strips the trailing-hiragana endings
// of the most common conjugation patterns. Coverage is ~80% of verb /
// i-adjective inflection — enough for prediction-bar diversity grouping.
//
// What this does NOT handle:
//  - Kanji-only stems with no trailing okurigana (most nouns) — left as-is,
//    which is correct (no inflection to strip).
//  - Honorific / passive / causative compound endings (食べさせられる) —
//    only the outermost suffix is stripped; deeper morphology is missed.
//  - Hiragana-only verbs (たべる) where there's no kanji boundary — handled
//    the same as kanji+okurigana case via greedy longest-suffix match.

// Ordered longest-first so greedy match wins. Grouped by conjugation class.
const JA_SUFFIXES = [
  // Polite & past-polite (-ます group)
  'ませんでした', 'ましょう', 'ましたら', 'ますれば',
  'ました', 'ません', 'まして', 'ますが', 'ますか',
  'ます',
  // Plain forms (-る verbs and irregular)
  'させられる', 'させられた', 'られている', 'させない',
  'られない', 'られた', 'られる', 'させる', 'させた',
  'ている', 'ていた', 'ていない', 'ています',
  'なかった', 'たかった', 'なくて', 'たくて',
  'ました', 'たい', 'たく', 'ない', 'なく',
  'ては', 'ても', 'てる', 'てた',
  'える', 'えた', 'えない', 'えなかった',
  'いる', 'いた', 'いない', 'いなかった',
  // i-adjective inflections
  'かった', 'くない', 'くて', 'く',
  // Common single-mora endings (least specific)
  'る', 'た', 'て', 'ば', 'ぬ', 'ず', 'ね', 'よ',
];

const JA_SUFFIXES_SORTED = [...new Set(JA_SUFFIXES)].sort((a, b) => b.length - a.length);

const MIN_STEM_LEN = 1; // Japanese stems can be a single kanji

export function jaStem(word: string): string {
  for (const suf of JA_SUFFIXES_SORTED) {
    if (word.length - suf.length >= MIN_STEM_LEN && word.endsWith(suf)) {
      return word.slice(0, word.length - suf.length);
    }
  }
  return word;
}
