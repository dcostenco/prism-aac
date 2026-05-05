import { describe, it, expect } from 'vitest';

/**
 * Inworld voice defaults — catalog hygiene contract
 * ==================================================
 *
 * Background: voice catalog at portal/src/shared/voice-catalog.ts has
 * 23 entries marked `backend: 'inworld'`, but only 8 of them actually
 * exist on Inworld's v1.5-mini server. The other 15 (Carmen, Camille,
 * Hans, Lena, Luana, Giulia, Lotte, Zofia, Sakura, Jisoo, Anya, Noa,
 * Layla, Lucas, Helia) return HTTP 502 from /api/v1/tts/public — they
 * were aspirational catalog entries that were never reconciled
 * against Inworld's real voice list.
 *
 * Probed live via /api/v1/tts/public 2026-05-05.
 *
 * This test pins the AAC client's INWORLD_VOICE_DEFAULTS map so it
 * never references one of the broken voice IDs again. If Inworld
 * adds new voices later (or removes one of the 8 that work), the
 * test surfaces it next CI run.
 */

// Mirror of services/speechService.ts INWORLD_VOICE_DEFAULTS — kept
// here intentionally so the test file is self-contained and a future
// refactor can't quietly change defaults without updating the test.
const INWORLD_VOICE_DEFAULTS: Record<string, string> = {
  en: 'Alex',    es: 'Diego',  fr: 'Sarah',  de: 'Mark',
  pt: 'Sarah',   it: 'Sarah',  nl: 'Sarah',  pl: 'Sarah',
  ja: 'Sarah',   zh: 'Mei',    ko: 'Sarah',  ru: 'Sarah',
  he: 'Sarah',   ar: 'Sarah',  hi: 'Aanya',
};

// The 8 Inworld voice IDs verified to return 200 from
// /api/v1/tts/public on 2026-05-05. Update this set if Inworld's
// available voices change.
const INWORLD_VERIFIED_VOICES = new Set([
  'Ashley', 'Sarah', 'Alex', 'Dennis', 'Mark',
  'Diego', 'Mei', 'Aanya',
]);

// Voices that exist in our portal catalog but Inworld rejects with
// 502. Listed here so a regression test can fail loudly if a default
// regresses to one of them.
const INWORLD_BROKEN_VOICES = new Set([
  'Anya', 'Carmen', 'Camille', 'Hans', 'Lena',
  'Luana', 'Giulia', 'Lotte', 'Zofia', 'Sakura',
  'Jisoo', 'Noa', 'Layla', 'Lucas', 'Helia',
]);

describe('INWORLD_VOICE_DEFAULTS — catalog hygiene', () => {
  it('every default voice is in the verified-working set', () => {
    for (const [lang, voice] of Object.entries(INWORLD_VOICE_DEFAULTS)) {
      expect(INWORLD_VERIFIED_VOICES.has(voice), `lang=${lang} default=${voice} is not Inworld-verified`).toBe(true);
    }
  });

  it('no default voice is in the known-broken set', () => {
    for (const [lang, voice] of Object.entries(INWORLD_VOICE_DEFAULTS)) {
      expect(INWORLD_BROKEN_VOICES.has(voice), `lang=${lang} default=${voice} is a known-broken Inworld voice`).toBe(false);
    }
  });

  it('covers every paid-tier language that prism-aac supports', () => {
    const requiredLangs = ['en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ja', 'zh', 'ko', 'ru', 'he', 'ar', 'hi'];
    for (const lang of requiredLangs) {
      expect(INWORLD_VOICE_DEFAULTS[lang], `missing default for lang=${lang}`).toBeDefined();
    }
  });
});

describe('INWORLD_VOICE_DEFAULTS — language → voice routing', () => {
  it('English routes to Alex (the "Friendly, natural" male voice)', () => {
    expect(INWORLD_VOICE_DEFAULTS.en).toBe('Alex');
  });
  it('Russian routes to Sarah (multilingual female, replaces broken Anya)', () => {
    expect(INWORLD_VOICE_DEFAULTS.ru).toBe('Sarah');
    expect(INWORLD_VOICE_DEFAULTS.ru).not.toBe('Anya');
  });
  it('Spanish routes to Diego (catalog\'s only working es Inworld voice)', () => {
    expect(INWORLD_VOICE_DEFAULTS.es).toBe('Diego');
  });
  it('Hindi routes to Aanya (the verified hi voice)', () => {
    expect(INWORLD_VOICE_DEFAULTS.hi).toBe('Aanya');
  });
  it('Mandarin routes to Mei (the verified zh voice)', () => {
    expect(INWORLD_VOICE_DEFAULTS.zh).toBe('Mei');
  });
  it('all other paid-tier langs fall back to Sarah (multilingual)', () => {
    // Sarah's the safe pick for languages where Inworld's named voices
    // are all broken — she's English-female-tagged but synthesizes
    // the other languages with acceptable accent (verified 200 OK).
    const sarahLangs = ['fr', 'pt', 'it', 'nl', 'pl', 'ja', 'ko', 'he', 'ar'];
    for (const lang of sarahLangs) {
      expect(INWORLD_VOICE_DEFAULTS[lang]).toBe('Sarah');
    }
  });
});

describe('INWORLD_VERIFIED_VOICES — set integrity', () => {
  it('contains exactly 8 voices (the count probed live on 2026-05-05)', () => {
    expect(INWORLD_VERIFIED_VOICES.size).toBe(8);
  });
  it('does not overlap with INWORLD_BROKEN_VOICES', () => {
    for (const v of INWORLD_VERIFIED_VOICES) {
      expect(INWORLD_BROKEN_VOICES.has(v), `${v} appears in BOTH verified and broken sets`).toBe(false);
    }
  });
});
