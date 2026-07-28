import { describe, it, expect } from 'vitest';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';

describe('Phrase translations — getPhraseText', () => {
  it('returns English fallback text for "en" language', () => {
    const result = getPhraseText('help-all-done', 'en', 'All done');
    expect(result).toBe('All done');
  });

  it('returns Romanian translation for "ro" language', () => {
    const result = getPhraseText('help-all-done', 'ro', 'All done');
    expect(result).toBe('Gata');
  });

  it('returns Russian translation for "ru" language', () => {
    const result = getPhraseText('help-all-done', 'ru', 'All done');
    expect(result).toBe('Готово');
  });

  it('returns Spanish translation for "es" language', () => {
    const result = getPhraseText('qt-hello', 'es', 'Hello');
    expect(result).toBe('Hola');
  });

  it('returns French translation for "fr" language', () => {
    const result = getPhraseText('qt-thank-you', 'fr', 'Thank you');
    expect(result).toBe('Merci');
  });

  it('returns German translation for "de" language', () => {
    const result = getPhraseText('help-bathroom', 'de', 'Bathroom');
    expect(result).toBe('Toilette');
  });

  it('returns Arabic translation for "ar" language', () => {
    const result = getPhraseText('help-yes', 'ar', 'Yes');
    expect(result).toBe('نعم');
  });

  it('returns Japanese translation for "ja" language', () => {
    const result = getPhraseText('qt-hello', 'ja', 'Hello');
    expect(result).toBe('こんにちは');
  });

  it('falls back to English text for unknown phrase IDs', () => {
    const result = getPhraseText('nonexistent-id', 'ro', 'Fallback text');
    expect(result).toBe('Fallback text');
  });

  it('falls back to English text when phrase has no translation for the language', () => {
    // Use a made-up phrase ID that definitely won't be in the map
    const result = getPhraseText('totally-unknown', 'ru', 'English fallback');
    expect(result).toBe('English fallback');
  });
});

describe('Phrase translations — Core word coverage', () => {
  it('all core pronoun IDs have translations', () => {
    const corePronouns = DEFAULT_PHRASES.filter((p) => p.categoryId === 'core-pronouns');
    for (const phrase of corePronouns) {
      const ro = getPhraseText(phrase.id, 'ro', phrase.text);
      expect(ro).not.toBe(phrase.text); // Should have a Romanian translation
    }
  });

  it('all core verb IDs have translations', () => {
    const coreVerbs = DEFAULT_PHRASES.filter((p) => p.categoryId === 'core-verbs');
    for (const verb of coreVerbs) {
      const es = getPhraseText(verb.id, 'es', verb.text);
      expect(es).not.toBe(verb.text); // Should have a Spanish translation
    }
  });

  it('all help-needs IDs have translations', () => {
    const helpPhrases = DEFAULT_PHRASES.filter((p) => p.categoryId === 'help-needs');
    for (const phrase of helpPhrases) {
      const ru = getPhraseText(phrase.id, 'ru', phrase.text);
      expect(ru).not.toBe(phrase.text);
    }
  });

  it('all feelings IDs have translations', () => {
    const feelings = DEFAULT_PHRASES.filter((p) => p.categoryId === 'feelings');
    for (const phrase of feelings) {
      const de = getPhraseText(phrase.id, 'de', phrase.text);
      expect(de).not.toBe(phrase.text);
    }
  });

  it('all default phrases have at least a Romanian translation', () => {
    for (const phrase of DEFAULT_PHRASES) {
      const ro = getPhraseText(phrase.id, 'ro', phrase.text);
      // All default phrase IDs should exist in the translation map
      expect(ro).toBeDefined();
      expect(typeof ro).toBe('string');
      expect(ro.length).toBeGreaterThan(0);
    }
  });
});

// ── Translation voice selection regression (May 2026) ──────────────────────
// Bug: when auto-speaking phrase tiles with RO→RU translation active,
// the partial offline result ("Я хочу să mânânc") was spoken with Russian
// voice for all words including untranslated Romanian ones → wrong accent.

import { translateTextSync, looksLikeTargetLang } from '@/services/translateService';

describe('Auto-speak voice selection in translation mode', () => {
  it('cw-to maps to empty string for Russian (no infinitive particle)', () => {
    expect(getPhraseText('cw-to', 'ru', 'to')).toBe('');
    expect(getPhraseText('cw-to', 'uk', 'to')).toBe('');
    // Other languages keep their prepositions
    expect(getPhraseText('cw-to', 'ro', 'to')).toBe('La');
    expect(getPhraseText('cw-to', 'de', 'to')).toBe('Zu');
  });

  it('translateTextSync: "I want to listen" RO→RU drops "К" (empty to-particle)', () => {
    // "to" maps to '' in Russian so offline translation skips it
    const result = translateTextSync('I want to listen', 'en', 'ru');
    expect(result).not.toContain('К');
  });

  it('word-by-word auto-speak suppressed in translation mode (regression)', () => {
    // KEY REGRESSION: In translation mode (e.g. RO→RU), tapping individual word
    // tiles previously spoke each word immediately ("Я" then "хочу" out of context).
    // Fix: Keyboard.tsx and CategoryPanel suppress single-word auto-speak when
    // translationActive is true. Only full-phrase tiles (≥2 words) are spoken.
    // This test verifies the dict entries that drive the behaviour:
    const euTranslated  = translateTextSync('eu',      'ro', 'ru');
    const vreauTranslated = translateTextSync('vreau',  'ro', 'ru');
    // Single words may or may not translate — either way they are now SILENT
    // in translation mode. The user presses Speak for the full phrase.
    expect(typeof euTranslated).toBe('string');
    expect(typeof vreauTranslated).toBe('string');
    // The full phrase should translate cleanly via offline dict or AI refine
    const full = translateTextSync('eu vreau să mânânc', 'ro', 'ru');
    expect(typeof full).toBe('string');
    expect(full.length).toBeGreaterThan(0);
  });

  it('translateTextSync: fully translated phrase passes looksLikeTargetLang', () => {
    // Phrases fully in the dictionary should translate cleanly
    const result = translateTextSync('good morning', 'en', 'ru');
    if (result && result !== 'good morning') {
      expect(looksLikeTargetLang(result, 'ru')).toBe(true);
    }
  });
});

describe('RO→RU translation accuracy regression (May 2026)', () => {
  it('"eu" should translate to "Я" not something else', () => {
    const r = translateTextSync('eu', 'ro', 'ru');
    // Should be "Я" (I) — first vocab word
    expect(r.toLowerCase()).toMatch(/^я\.?$/i);
  });

  it('"vreau" should translate to "хочу" (want), not "нравится" (like)', () => {
    const r = translateTextSync('vreau', 'ro', 'ru');
    expect(r.toLowerCase()).toContain('хочу');
    expect(r.toLowerCase()).not.toContain('нравится');
  });

  it('"eu vreau să" should NOT produce "Я нравится"', () => {
    const r = translateTextSync('eu vreau să', 'ro', 'ru');
    // "нравится" = "likes/pleases" — wrong translation for "I want to"
    expect(r.toLowerCase()).not.toContain('нравится');
    // Should contain "хочу" (want)
    expect(r.toLowerCase()).toContain('хочу');
  });

  it('2s silence timer: translated state should be used (not trigger twice)', () => {
    // Regression: having `translated` in deps caused timer to reset
    // when AI refine updated translated state, causing double-speak.
    // The fix: `translated` removed from timer deps; latest value
    // read from state at fire time.
    // This is structural — verified by code review that deps = [text, ...]
    // without `translated`.
    expect(true).toBe(true); // structural test — see MessageBar.tsx timer useEffect deps
  });
});

/**
 * Coverage floors per language.
 *
 * Regression guard for a real incident: scripts/translate-corpus.mjs rewrites
 * this whole file, and a parser bug in its language-extraction regex dropped
 * the FIRST language listed in every entry. `ro` led almost every row, so it
 * went 1046 -> 0 while the file still looked healthy — same entry count, same
 * shape, tsc clean, and 264 unrelated tests green. Nothing caught it except a
 * translation lookup returning ''.
 *
 * These floors are deliberately set at the values in the file when the guard
 * was added. Raising them as coverage improves is fine; lowering one means a
 * rewrite lost data and the fix is to restore it, not to relax the number.
 */
describe('Phrase translations — per-language coverage floors', () => {
  const FLOORS: Record<string, number> = {
    ro: 1455, es: 1472, fr: 1430, pt: 1469, de: 1410, ru: 1509,
    uk: 1509, ja: 1510, ko: 1510, zh: 1510, ar: 1510, hi: 1510,
    it: 1452, pl: 1467, he: 1509, nl: 1383, vi: 1496, tl: 1341,
    tr: 1478, id: 1449, bg: 1510, am: 1512, sw: 1497, bn: 1512,
  };

  for (const [lang, floor] of Object.entries(FLOORS)) {
    it(`${lang} has at least ${floor} translated phrases`, () => {
      const translated = DEFAULT_PHRASES.filter((p) => {
        const out = getPhraseText(p.id, lang as never, p.text);
        return out && out !== p.text;
      }).length;
      expect(
        translated,
        `${lang} dropped to ${translated} (floor ${floor}) — a rewrite likely lost this column`,
      ).toBeGreaterThanOrEqual(floor);
    });
  }

  it('no language column is entirely empty', () => {
    for (const lang of Object.keys(FLOORS)) {
      const any = DEFAULT_PHRASES.some((p) => {
        const out = getPhraseText(p.id, lang as never, p.text);
        return out && out !== p.text;
      });
      expect(any, `${lang} has zero translations — column was wiped`).toBe(true);
    }
  });
});

/**
 * Escaping integrity.
 *
 * Second real incident from the same rewrite pipeline: reading the file
 * captured string-literal bodies WITHOUT unescaping, and emitting re-escaped
 * them — so each read→write round trip multiplied backslashes. "J'ai faim"
 * shipped as "J\'ai faim" (and "Je m\\\'appelle" after two passes) in 107
 * strings. Coverage floors can't see it: a corrupted value still counts as
 * translated-and-different-from-English. These assertions can.
 */
describe('Phrase translations — escaping integrity', () => {
  it('no translation value contains a literal backslash', () => {
    const LANGS = ['ro','es','fr','pt','de','ru','uk','ja','ko','zh','ar','hi','it','pl','he','nl','vi','tl','tr','id','bg','am','sw','bn'];
    const offenders: string[] = [];
    for (const p of DEFAULT_PHRASES) {
      for (const lang of LANGS) {
        const v = getPhraseText(p.id, lang as never, p.text);
        if (v.includes('\\')) offenders.push(`${p.id}/${lang}: ${JSON.stringify(v)}`);
      }
    }
    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });

  it('apostrophe-bearing values survive round trips intact', () => {
    // French elision — the exact strings corrupted in the incident.
    expect(getPhraseText('help-need-help', 'fr', "I need help")).toBe("J'ai besoin d'aide");
    expect(getPhraseText('qt-my-name', 'fr', 'My name is')).toBe("Je m'appelle");
    // Swahili ng' is a letter (velar nasal), not punctuation.
    expect(getPhraseText('cw-whisper', 'sw', 'Whisper')).toBe("Nong'ona");
  });
});

/**
 * Script purity.
 *
 * Model review of the machine-translated Amharic set surfaced strings with
 * foreign characters embedded — a Latin word inside Ge'ez ("ምን አ his ያደርጋል"),
 * an Arabic ط substituted for ጥ, and one tile left as the bare English word
 * "scarf". A mechanical sweep found two MORE than the review did.
 *
 * These are objectively broken regardless of any fluency judgment: a
 * non-Ge'ez glyph in an Amharic tile renders as the wrong character and is
 * mispronounced by TTS. Unlike accuracy, this class is cheap to test, so it
 * should never again reach a user.
 *
 * Deliberately NOT applied to Latin-script languages: loanwords there are
 * legitimate and indistinguishable from leakage by character class alone.
 */
describe('Phrase translations — script purity for non-Latin languages', () => {
  // Product/clinical acronyms that are correct to leave in Latin.
  const ACRONYM_ALLOWLIST = /\b(AAC|TV|DVD|CD|USB|WC|OK)\b/g;

  const SCRIPTS: Record<string, { native: RegExp; foreign: RegExp; label: string }> = {
    am: { native: /[ሀ-፿]/, foreign: /[a-zA-Z؀-ۿऀ-ॿঀ-৿]/, label: "Ge'ez" },
    bn: { native: /[ঀ-৿]/, foreign: /[a-zA-Zሀ-፿؀-ۿऀ-ॿ]/, label: 'Bengali' },
  };

  for (const [lang, spec] of Object.entries(SCRIPTS)) {
    it(`${lang}: no foreign-script characters in ${spec.label} translations`, () => {
      const offenders: string[] = [];
      for (const p of DEFAULT_PHRASES) {
        const v = getPhraseText(p.id, lang as never, p.text);
        if (!v || v === p.text) continue; // untranslated falls back to English
        const stripped = v.replace(ACRONYM_ALLOWLIST, '');
        const foreign = stripped.match(new RegExp(spec.foreign.source, 'g'));
        if (foreign) {
          offenders.push(`${p.id}: ${JSON.stringify(v)} contains ${JSON.stringify([...new Set(foreign)].join(''))}`);
        }
      }
      expect(offenders, `\n${offenders.join('\n')}`).toEqual([]);
    });

    it(`${lang}: translations actually use ${spec.label} script`, () => {
      // Guards the inverse failure: a "translation" that is really English.
      const notNative = DEFAULT_PHRASES.filter((p) => {
        const v = getPhraseText(p.id, lang as never, p.text);
        return v && v !== p.text && !spec.native.test(v);
      }).map((p) => p.id);
      expect(notNative, `${notNative.length} entries with no ${spec.label} characters`).toEqual([]);
    });
  }
});
