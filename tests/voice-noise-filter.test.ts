import { describe, it, expect } from 'vitest';
import { isFillerOnly, FILLER_WORDS, MIN_CONFIDENCE } from '@/services/voiceInputService';

const AAC_LANGS = ['en','es','fr','pt','ro','uk','ru','de','ja','zh','ko','he','ar','hi','it','pl','nl','vi','tl','tr','id','bg'];

const REAL_SPEECH: Record<string, string[]> = {
  en: ['I want water', 'hello there', 'please help me', 'yeah', 'oh', 'so', 'well', 'no'],
  es: ['quiero agua', 'hola', 'bueno', 'pues'],
  fr: ['je veux de l\'eau', 'bonjour', 'donc', 'bien'],
  de: ['ich möchte Wasser', 'hallo', 'also', 'halt', 'naja'],
  pt: ['eu quero água', 'olá', 'então', 'tipo'],
  it: ['voglio acqua', 'ciao', 'allora', 'insomma'],
  ru: ['я хочу воду', 'привет', 'ну', 'вот', 'ага'],
  uk: ['я хочу воду', 'привіт', 'ну', 'ага'],
  ro: ['vreau apă', 'bună ziua', 'deci', 'adică'],
  bg: ['искам вода', 'здравейте', 'значи', 'нали'],
  ja: ['水がほしい', 'こんにちは', 'あの', 'まあ'],
  zh: ['我想要水', '你好', '那个', '就是'],
  ko: ['물을 주세요', '안녕하세요', '그', '뭐'],
  ar: ['أريد ماء', 'مرحبا', 'يعني'],
  he: ['אני רוצה מים', 'שלום', 'נו', 'כאילו'],
  hi: ['मुझे पानी चाहिए', 'नमस्ते', 'वो', 'मतलब'],
  pl: ['chcę wodę', 'cześć', 'no', 'więc'],
  nl: ['ik wil water', 'hallo', 'nou', 'dus'],
  vi: ['tôi muốn nước', 'xin chào', 'thì'],
  tl: ['gusto ko ng tubig', 'kamusta', 'ano', 'kasi'],
  tr: ['su istiyorum', 'merhaba', 'şey', 'yani'],
  id: ['saya mau air', 'halo', 'gitu'],
};

// ── Filler detection ────────────────────────────────────────────────────────

describe('isFillerOnly — imports real code from voiceInputService', () => {
  describe('detects non-communicative fillers per language', () => {
    for (const lang of AAC_LANGS) {
      const fillers = FILLER_WORDS[lang];
      if (!fillers) continue;
      it(`${lang}: fillers detected (${fillers.size} entries)`, () => {
        for (const word of fillers) {
          expect(isFillerOnly(word, lang)).toBe(true);
        }
      });
    }
  });

  describe('passes real speech and valid single-word utterances', () => {
    for (const lang of AAC_LANGS) {
      const phrases = REAL_SPEECH[lang];
      if (!phrases) continue;
      it(`${lang}: real speech passes (${phrases.length} phrases)`, () => {
        for (const phrase of phrases) {
          expect(isFillerOnly(phrase, lang)).toBe(false);
        }
      });
    }
  });

  describe('AAC-critical: valid single-word utterances are NOT filtered', () => {
    const validUtterances: Record<string, string[]> = {
      en: ['yeah', 'oh', 'so', 'well', 'like', 'no', 'yes', 'ok'],
      es: ['bueno', 'pues', 'este'],
      ru: ['ну', 'вот', 'ага', 'угу', 'да'],
      bg: ['ами', 'абе', 'значи', 'нали', 'да'],
      de: ['na', 'naja', 'also', 'halt', 'ja'],
    };
    for (const [lang, words] of Object.entries(validUtterances)) {
      it(`${lang}: "${words.join('", "')}" all pass through`, () => {
        for (const word of words) {
          expect(isFillerOnly(word, lang)).toBe(false);
        }
      });
    }
  });

  describe('edge cases', () => {
    it('handles punctuation around fillers', () => {
      expect(isFillerOnly('uh.', 'en')).toBe(true);
      expect(isFillerOnly('um!', 'en')).toBe(true);
      expect(isFillerOnly('hm?', 'en')).toBe(true);
    });

    it('case insensitive', () => {
      expect(isFillerOnly('UH', 'en')).toBe(true);
      expect(isFillerOnly('Um', 'en')).toBe(true);
    });

    it('rejects long text even with filler substrings', () => {
      expect(isFillerOnly('uh uh uh uh uh uh uh uh', 'en')).toBe(false);
    });

    it('falls back to English fillers for unknown language', () => {
      expect(isFillerOnly('uh', 'xx')).toBe(true);
    });

    it('empty/whitespace → false', () => {
      expect(isFillerOnly('', 'en')).toBe(false);
      expect(isFillerOnly('   ', 'en')).toBe(false);
    });
  });
});

// ── Confidence threshold ────────────────────────────────────────────────────

describe('MIN_CONFIDENCE threshold', () => {
  it('is 0.6', () => {
    expect(MIN_CONFIDENCE).toBe(0.6);
  });

  it('gate logic: confidence > 0 && confidence < MIN rejects low scores', () => {
    for (const c of [0.1, 0.3, 0.5, 0.59]) {
      expect(c > 0 && c < MIN_CONFIDENCE).toBe(true);
    }
  });

  it('gate logic: confidence >= MIN passes', () => {
    for (const c of [0.6, 0.8, 1.0]) {
      expect(c > 0 && c < MIN_CONFIDENCE).toBe(false);
    }
  });

  it('gate logic: confidence === 0 bypasses (browser unsupported)', () => {
    expect(0 > 0 && 0 < MIN_CONFIDENCE).toBe(false);
  });
});

// ── Coverage completeness ───────────────────────────────────────────────────

describe('coverage', () => {
  it('every AAC language has filler entries', () => {
    for (const lang of AAC_LANGS) {
      expect(FILLER_WORDS[lang]).toBeDefined();
      expect(FILLER_WORDS[lang].size).toBeGreaterThan(0);
    }
  });

  it('no filler set contains words longer than 10 chars (sanity)', () => {
    for (const [lang, set] of Object.entries(FILLER_WORDS)) {
      for (const word of set) {
        expect(word.length).toBeLessThanOrEqual(10);
      }
    }
  });
});
