/**
 * isSafeAutoCorrection — auto-apply gate test suite.
 *
 * Pinned because every prior session has had a regression here:
 *   • Lane 2 missing → "i Want y" → "i Want you to" rejected, TTS
 *     spoke "y" as the letter "wai".
 *   • Lane 1 too loose → "ok" auto-expanded to "yes please" (paraphrase
 *     replaced authorship).
 *   • Lane 3 too tight → "i wantyy" → "i want to" Levenshtein > cap
 *     correctly rejected (preserved authorship; user must tap).
 *
 * Coverage goals:
 *   • Each lane fires when intended.
 *   • Each lane REJECTS the adversarial inputs it was designed against.
 *   • Cross-language acceptance (RU/RO/ES/UK) — algorithm must not be
 *     English-specific.
 *   • Edge cases: empty, identical, leading/trailing whitespace.
 */
import { describe, it, expect } from 'vitest';
import {
  isSafeAutoCorrection,
  isSubsequence,
  levenshtein,
} from '@/services/autocorrectSafety';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('returns length when one side empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  it('counts single substitution as 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });
  it('counts insertion as 1', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });
  it('counts deletion as 1', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });
  it('handles realistic typo distance', () => {
    // "i wnat" → "i want" — 1 transposition = 2 edits (sub n→a, sub a→n)
    expect(levenshtein('i wnat', 'i want')).toBe(2);
  });
});

describe('isSubsequence', () => {
  it('matches when every char of o appears in f in order', () => {
    expect(isSubsequence('iwa', 'i want a')).toBe(true);
    expect(isSubsequence('hw', 'how')).toBe(true);
    expect(isSubsequence('ok', 'okay')).toBe(true);
  });
  it('rejects when char missing or out of order', () => {
    expect(isSubsequence('ok', 'yes please')).toBe(false);
    expect(isSubsequence('hw', 'goodbye')).toBe(false);
    expect(isSubsequence('iwa', 'awi')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(isSubsequence('IWA', 'I Want A')).toBe(true);
  });
  it('ignores whitespace in input', () => {
    expect(isSubsequence('i w a', 'i want a')).toBe(true);
  });
});

describe('isSafeAutoCorrection — Lane 1 (whole-input short partial)', () => {
  it('accepts "hw" → "how"', () => {
    expect(isSafeAutoCorrection('hw', 'how')).toBe(true);
  });
  it('accepts "iwa" → "I want a" (subsequence i,w,a preserved)', () => {
    expect(isSafeAutoCorrection('iwa', 'I want a')).toBe(true);
  });
  it('accepts "ok" → "okay" (typo extension)', () => {
    expect(isSafeAutoCorrection('ok', 'okay')).toBe(true);
  });
  it('accepts "hw" → "home work" (2-token expansion preserves h,w)', () => {
    expect(isSafeAutoCorrection('hw', 'home work')).toBe(true);
  });
  it('REJECTS "ok" → "yes please" (no o/k subsequence — preserves authorship)', () => {
    expect(isSafeAutoCorrection('ok', 'yes please')).toBe(false);
  });
  it('REJECTS "hw" → "goodbye" (no h/w subsequence)', () => {
    expect(isSafeAutoCorrection('hw', 'goodbye')).toBe(false);
  });
  it('REJECTS "iwa" → "okay then friend" (i/w/a not all present)', () => {
    expect(isSafeAutoCorrection('iwa', 'okay then friend')).toBe(false);
  });
  it('REJECTS Lane 1 expansion >3 tokens', () => {
    expect(isSafeAutoCorrection('iwa', 'i was a much longer phrase indeed')).toBe(false);
  });
});

describe('isSafeAutoCorrection — Lane 2 (mid-word completion, short trailing partial)', () => {
  it('accepts "i Want y" → "i Want you to" (the screenshot bug)', () => {
    expect(isSafeAutoCorrection('i Want y', 'i Want you to')).toBe(true);
  });
  it('accepts "I want t" → "I want to play"', () => {
    expect(isSafeAutoCorrection('I want t', 'I want to play')).toBe(true);
  });
  it('accepts "she go" → "she goes home"', () => {
    expect(isSafeAutoCorrection('she go', 'she goes home')).toBe(true);
  });
  it('accepts "lets pl" → "lets play outside"', () => {
    expect(isSafeAutoCorrection('lets pl', 'lets play outside')).toBe(true);
  });
  it('REJECTS when prefix tokens differ ("abc def g" → "xyz qrs ghost")', () => {
    expect(isSafeAutoCorrection('abc def g', 'xyz qrs ghost')).toBe(false);
  });
  it('REJECTS when first prefix differs ("hello there w" → "goodbye there world")', () => {
    expect(isSafeAutoCorrection('hello there w', 'goodbye there world')).toBe(false);
  });
  it('REJECTS when partial does not start the matching fixed token ("she go" → "she went home")', () => {
    expect(isSafeAutoCorrection('she go', 'she went home')).toBe(false);
  });
  it('REJECTS when trailing partial >3 chars (falls to Lane 3, lev too high)', () => {
    expect(isSafeAutoCorrection('i Want plea', 'i Want please come')).toBe(false);
  });
  it('REJECTS expansion >+2 tokens', () => {
    expect(isSafeAutoCorrection('hi th', 'hi there my friend please')).toBe(false);
  });
});

describe('isSafeAutoCorrection — Lane 3 (standard cleanup)', () => {
  it('accepts "I wnat to eat" → "I want to eat" (4→4 tokens, 2-char swap)', () => {
    expect(isSafeAutoCorrection('I wnat to eat', 'I want to eat')).toBe(true);
  });
  it('accepts "programachto" → "programa chto" (1→2 tokens, 1 char insert)', () => {
    expect(isSafeAutoCorrection('programachto', 'programa chto')).toBe(true);
  });
  it('REJECTS "i wantyy" → "i want to" (Lev 4 > 30%-cap of 2)', () => {
    expect(isSafeAutoCorrection('i wantyy', 'i want to')).toBe(false);
  });
  it('REJECTS "hello" → "hi there my friend" (1→4 tokens, big rewrite)', () => {
    expect(isSafeAutoCorrection('hello', 'hi there my friend')).toBe(false);
  });
  it('REJECTS token-count diff >1', () => {
    expect(isSafeAutoCorrection('hello world', 'hi')).toBe(false);
  });
});

describe('isSafeAutoCorrection — language coverage', () => {
  it('Russian: "я хочу х" → "я хочу хлеба" (Lane 2)', () => {
    expect(isSafeAutoCorrection('я хочу х', 'я хочу хлеба')).toBe(true);
  });
  it('Russian: typo fix "Болше" → "Больше" (Lane 3)', () => {
    expect(isSafeAutoCorrection('Болше', 'Больше')).toBe(true);
  });
  it('Romanian: "eu vreau a" → "eu vreau apă" (Lane 2)', () => {
    expect(isSafeAutoCorrection('eu vreau a', 'eu vreau apă')).toBe(true);
  });
  it('Romanian: diacritic fix "vreau sa m" → "vreau să mă" (Lane 3)', () => {
    expect(isSafeAutoCorrection('vreau sa m', 'vreau să mă')).toBe(true);
  });
  it('Spanish: "quiero co" → "quiero comida" (Lane 2)', () => {
    expect(isSafeAutoCorrection('quiero co', 'quiero comida')).toBe(true);
  });
  it('Spanish: accent fix "como estas" → "Cómo estás" (Lane 3)', () => {
    expect(isSafeAutoCorrection('como estas', 'Cómo estás')).toBe(true);
  });
  it('Ukrainian: "доброго ра" → "доброго ранку" (Lane 2)', () => {
    expect(isSafeAutoCorrection('доброго ра', 'доброго ранку')).toBe(true);
  });
});

describe('isSafeAutoCorrection — edges', () => {
  it('rejects empty original', () => {
    expect(isSafeAutoCorrection('', 'foo')).toBe(false);
  });
  it('rejects empty fixed', () => {
    expect(isSafeAutoCorrection('foo', '')).toBe(false);
  });
  it('rejects identical', () => {
    expect(isSafeAutoCorrection('foo', 'foo')).toBe(false);
  });
  it('rejects identical after trim', () => {
    expect(isSafeAutoCorrection('  foo  ', 'foo')).toBe(false);
  });
  it('rejects whitespace-only', () => {
    expect(isSafeAutoCorrection('   ', 'foo')).toBe(false);
  });
});
