/**
 * Owner report 2026-10-31 ("check others romanian, etc"): French, Spanish,
 * Portuguese, Dutch and Filipino keyboards lacked letters of their own
 * alphabets (à, où, cœur; está, sí, qué; é, você, água; één, ideeën; niño).
 * Every letter is now on the keyboard, a phone wraps the accented letters
 * into rows of at most ten, and words with them reach the prediction bar.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildKeyboardRows, getLetterRows, getSymbolRows, NARROW_ROW_TARGETS, UTIL_ROW_INDEX } from '@/constants/keyboardLayouts';
import type { SupportedLanguage } from '@/engine/i18n';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';

const BASIC = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
// Letters each alphabet needs beyond A-Z (Unicode CLDR exemplar sets).
const EXTRA: Partial<Record<SupportedLanguage, string[]>> = {
  fr: [...'ÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ'],
  es: [...'ÑÁÉÍÓÚÜ'],
  pt: [...'ÇÁÀÂÃÉÊÍÓÔÕÚ'],
  nl: [...'ÁÄÉËÍÏÓÖÚÜ'],
  tl: [...'Ñ'],
};
const LANGS = Object.keys(EXTRA) as SupportedLanguage[];

describe('Latin keyboards carry their whole alphabet', () => {
  it.each(LANGS)('%s: every letter is a key, once', (lang) => {
    const keys = getLetterRows(lang).flat();
    const letters = new Set(keys.flatMap(key => (key === 'IJ' ? [key] : [...key])));
    for (const letter of [...BASIC, ...EXTRA[lang]!]) expect(letters.has(letter), `${lang} ${letter}`).toBe(true);
    expect(new Set(keys).size, `${lang} has a duplicate key`).toBe(keys.length);
  });

  it('keeps rows 1-3 of French and Portuguese exactly as before on wide screens', () => {
    expect(getLetterRows('fr').slice(0, 3)).toEqual([
      ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
      ['W', 'X', 'C', 'V', 'B', 'N', 'É', 'È', 'Ê', 'Ç'],
    ]);
    expect(getLetterRows('pt').slice(0, 3)).toEqual([
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ã', 'Õ'],
    ]);
    expect(getLetterRows('es')[1].at(-1)).toBe('Ñ');
    expect(getLetterRows('tl')[1].at(-1)).toBe('Ñ');
  });

  it.each([...LANGS, 'ro', 'de', 'tr', 'pl', 'vi', 'pt', 'it'] as SupportedLanguage[])(
    '%s on a phone: basic letters stay in their rows, the rest wrap in order into rows of at most ten', (lang) => {
      const source = getLetterRows(lang);
      const rows = buildKeyboardRows(source, true);
      const base = rows.filter(row => !row.continuation);
      const wrapped = rows.filter(row => row.continuation);
      expect(base).toHaveLength(3);
      expect(base[UTIL_ROW_INDEX].util).toBe(true);
      for (const row of base) for (const key of row.keys) expect(key).toMatch(/^[A-Z]+$/);
      for (const row of wrapped) expect(row.keys.length).toBeLessThanOrEqual(NARROW_ROW_TARGETS);
      // Nothing lost or repeated, and the locale letters keep their order.
      expect(rows.flatMap(row => row.keys).sort()).toEqual(source.flat().sort());
      expect(wrapped.flatMap(row => row.keys)).toEqual(source.flat().filter(key => !/^[A-Z]+$/.test(key)));
    });

  it('French on a phone: sixteen accented letters in two rows, ten then six, the old four first', () => {
    const wrapped = buildKeyboardRows(getLetterRows('fr'), true).filter(row => row.continuation);
    expect(wrapped.map(row => row.keys)).toEqual([
      ['É', 'È', 'Ê', 'Ç', 'À', 'Â', 'Î', 'Ô', 'Ù', 'Û'],
      ['Œ', 'Ë', 'Ï', 'Æ', 'Ü', 'Ÿ'],
    ]);
  });

  it('offers ¿ and ¡ on the Spanish symbols page only', () => {
    expect(getSymbolRows('es').flat()).toEqual(expect.arrayContaining(['¿', '¡']));
    expect(getSymbolRows('en').flat()).not.toContain('¿');
    expect(getSymbolRows('fr').flat()).not.toContain('¡');
  });
});

describe('the language check accepts words with the new letters', () => {
  beforeAll(async () => {
    for (const lang of ['fr', 'nl'] as const) await ensureLangCorpusLoaded(lang);
  });

  it.each([['cæcum', 'fr'], ['æquo', 'fr'], ['kärcher', 'nl']] as const)('%s is %s', (word, lang) => {
    expect(isAllowedInLang(word, lang)).toBe(true);
  });
});

// A word typed with each new letter is learned and completes like any other.
// Together the words of a language contain every letter in EXTRA (checked below).
const WORDS: Array<[SupportedLanguage, string[]]> = [
  ['fr', ['voilà', 'pâte', 'cæcum', 'garçon', 'été', 'très', 'fête', 'noël', 'île', 'naïve', 'hôpital', 'cœur', 'où', 'piqûre', 'capharnaüm', 'aÿant']],
  ['es', ['está', 'qué', 'sí', 'canción', 'tú', 'pingüino', 'niño']],
  ['pt', ['água', 'voltà', 'câmera', 'médico', 'você', 'saída', 'avó', 'avô', 'saúde', 'mãe', 'põe', 'coração']],
  ['nl', ['dát', 'kärcher', 'één', 'ideeën', 'híj', 'naïef', 'vóór', 'coördinatie', 'zúlke', 'reünie']],
  ['tl', ['niño']],
];

it('the sample words cover every added letter', () => {
  for (const [lang, words] of WORDS) {
    const seen = new Set(words.join('').toLocaleUpperCase(lang));
    for (const letter of EXTRA[lang]!) expect(seen.has(letter), `${lang} ${letter}`).toBe(true);
  }
});

describe.each(WORDS)('%s words with the new letters reach the bar', (lang, words) => {
  beforeAll(async () => {
    useSettingsStore.setState({ language: lang });
    await ensureLangCorpusLoaded(lang);
    usePredictionStore.getState().updatePredictions('', lang);
    await loadPredictionSeed(lang);
    await Promise.resolve();
  });

  it.each(words)('%s', (word) => {
    for (let i = 0; i < 3; i++) usePredictionStore.getState().learnWord(word);
    const prefix = [...word].slice(0, Math.max(1, [...word].length - 1)).join('');
    usePredictionStore.getState().updatePredictions(prefix, lang);
    const shown = usePredictionStore.getState().predictions
      .filter(candidate => isAllowedInLang(candidate, lang, { allowUnknown: true }))
      .map(candidate => candidate.toLowerCase());
    expect(shown).toContain(word);
  });
});
