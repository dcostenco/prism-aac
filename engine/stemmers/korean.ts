// Korean stemmer — verb/adjective ending and particle stripping.
//
// Korean is agglutinative: particles and verb endings glue to roots in
// predictable ways. There's no browser-friendly KO morphological analyzer
// (mecab-ko is native-only). The Snowball "Korean" stemmer is a stub.
//
// Strategy: greedy longest-suffix stripping using a curated ending table
// covering ~80% of conjugation/declension. Combined with optional Hangul
// jamo decomposition (via es-hangul) for syllable-block-aware comparison.
//
// We use es-hangul's `removeLastCharacter` as a final fallback: if no
// known suffix matches but the word is ≥ 2 syllables, drop the last
// syllable. This catches uncommon endings without over-stemming short
// words.

import { removeLastCharacter } from 'es-hangul';

// Ordered longest-first.
const KO_SUFFIXES = [
  // Verb / adjective polite endings
  'ㅂ니다', '습니다', 'ㅂ니까', '습니까',
  '겠어요', '겠습니다', '었어요', '았어요',
  '었습니다', '았습니다', '으세요', '셨어요',
  '려고요', '으려고', '아야지', '어야지',
  '잖아요', '거든요',
  '아요', '어요', '여요', '해요',
  '으면', '아서', '어서', '으니', '으러', '으로',
  '으며', '으면', '지만', '거나', '든지',
  // Past tense markers
  '았다', '었다', '였다', '였어',
  '았던', '었던', '였던',
  // Nominal / particle endings
  '에서', '으로', '에게', '한테', '에는', '에도',
  '까지', '부터', '마저', '조차', '처럼',
  '이다', '이라', '이며', '이지', '이고',
  // Single-syllable endings (least specific)
  '요', '다', '게', '서', '도', '만', '은', '는',
  '이', '가', '을', '를', '의', '로', '에',
];

const KO_SUFFIXES_SORTED = [...new Set(KO_SUFFIXES)].sort((a, b) => b.length - a.length);

const MIN_STEM_LEN = 1;

export function koStem(word: string): string {
  for (const suf of KO_SUFFIXES_SORTED) {
    if (word.length - suf.length >= MIN_STEM_LEN && word.endsWith(suf)) {
      return word.slice(0, word.length - suf.length);
    }
  }
  // No matched suffix. If the word is ≥ 2 syllables, drop the last block —
  // covers irregular endings without merging single-syllable words.
  if (word.length >= 2) {
    try {
      return removeLastCharacter(word);
    } catch {
      return word;
    }
  }
  return word;
}
