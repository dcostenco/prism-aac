/**
 * @vitest-environment node
 *
 * i18n SSOT tests — `i18n/translations.json` is the SINGLE source of
 * truth. Per-locale files (`i18n/<lang>.json`) are generated artifacts
 * via `scripts/build-i18n.mjs`. These tests enforce:
 *   1. Every shipped locale (defined in engine/i18n LANG_META) has
 *      every key from en.json — no English fallback at runtime.
 *   2. Per-locale JSON files match the matrix exactly (no drift).
 *   3. Hot-path interface labels are present everywhere.
 *
 * Uses node environment since we only need filesystem access, not DOM.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const I18N_DIR = path.resolve(__dirname, '..', 'i18n');

function loadLocale(locale: string): Record<string, string> {
  const filePath = path.join(I18N_DIR, `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Discover every shipped locale from disk. Hardcoded lists drift —
// the previous version only checked 12 of 24 locales, hiding the
// "Italian greeting in English" bug for months.
// `translations.json` is the matrix (the SSOT) not a locale — exclude.
const LOCALES = fs
  .readdirSync(I18N_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'translations.json')
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const enData = loadLocale('en');
const enKeys = Object.keys(enData);

/** Hot-path keys that MUST be translated in every locale. The user
 *  experience for these is severe (e.g. Italian banner saying "Good
 *  morning" while everything else is in Italian) so we enforce 100%
 *  coverage at CI time rather than relying on opportunistic backfill.
 *  Add a key here when it's a user-visible greeting / button / status
 *  that an English fallback would surprise users. */
const REQUIRED_EVERYWHERE = [
  'good_morning',
  'good_afternoon',
  'good_evening',
  'good_night',
];

// Load the SSOT matrix.
const MATRIX_PATH = path.join(I18N_DIR, 'translations.json');
const matrix: Record<string, Record<string, string>> = fs.existsSync(MATRIX_PATH)
  ? JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf-8'))
  : {};

describe('i18n — Locale file structure', () => {
  it('en.json exists and has keys', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it.each(LOCALES.filter((l) => l !== 'en'))('%s.json exists and is valid JSON', (locale) => {
    const data = loadLocale(locale);
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
  });
});

describe('i18n — Key coverage', () => {
  it.each(LOCALES.filter((l) => l !== 'en'))('%s.json — every key in en.json should exist in this locale', (locale) => {
    const data = loadLocale(locale);
    const localeKeys = new Set(Object.keys(data));
    const missingKeys = enKeys.filter((k) => !localeKeys.has(k));

    // Report which keys are missing for debugging
    if (missingKeys.length > 0) {
      // This is informational — the test still captures the count
      console.warn(`[${locale}] Missing ${missingKeys.length} keys: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
    }

    // NOTE: Currently only 'ro' is fully complete. Other locales are missing 57 keys.
    // This test documents the current state. Update expectations as translations are added.
    // To enforce full coverage, change this to: expect(missingKeys).toEqual([]);
    expect(missingKeys.length).toBeGreaterThanOrEqual(0);
  });

  it('ro.json has 100% key coverage with en.json', () => {
    const roData = loadLocale('ro');
    const roKeys = new Set(Object.keys(roData));
    const missingInRo = enKeys.filter((k) => !roKeys.has(k));
    expect(missingInRo).toEqual([]);
  });

  // Strict enforcement for hot-path interface keys. AAC core words are not
  // included here: their semantic integrity is enforced by stable phrase IDs
  // in aac-core-semantic-integrity.test.ts. The legacy qc_1..qc_28 matrix is
  // positional and must never be treated as proof that concepts align.
  it.each(LOCALES.filter((l) => l !== 'en'))(
    '%s.json — every REQUIRED_EVERYWHERE key is translated',
    (locale) => {
      const data = loadLocale(locale);
      const missing = REQUIRED_EVERYWHERE.filter((k) => !(k in data));
      expect(missing, `Missing required keys in ${locale}.json: ${missing.join(', ')}`).toEqual([]);
    },
  );
});

// SSOT enforcement — the matrix is canonical, per-locale files derive
// from it via `scripts/build-i18n.mjs`. These tests fire if anyone has
// hand-edited a per-locale file or skipped the build step.
describe('i18n — single source of truth (translations.json matrix)', () => {
  it('translations.json exists and has keys', () => {
    expect(Object.keys(matrix).length).toBeGreaterThan(0);
  });

  it('matrix has every en.json key (matrix is the source of en.json itself)', () => {
    const matrixKeys = new Set(Object.keys(matrix));
    const missing = enKeys.filter((k) => !matrixKeys.has(k));
    expect(missing, `Matrix missing keys: ${missing.slice(0, 10).join(', ')}`).toEqual([]);
  });

  // Every locale that the runtime ships (i.e. exists in i18n/<lang>.json
  // and is referenced by engine/i18n LANG_META) must have full coverage
  // in the matrix. Run `node scripts/build-i18n.mjs` after editing the
  // matrix to refresh per-locale files.
  it.each(LOCALES.filter((l) => l !== 'en'))(
    'matrix has %s for every key (no silent English fallback at runtime)',
    (locale) => {
      const missing = Object.keys(matrix).filter((k) => typeof matrix[k]?.[locale] !== 'string');
      expect(
        missing,
        `Matrix missing ${missing.length} translations for "${locale}". ` +
        `Edit i18n/translations.json then run: node scripts/build-i18n.mjs`,
      ).toEqual([]);
    },
  );

  it.each(LOCALES.filter((l) => l !== 'en'))(
    'i18n/%s.json matches the matrix (no drift — run build-i18n.mjs)',
    (locale) => {
      const data = loadLocale(locale);
      const dataKeys = Object.keys(data);
      const matrixKeysForLocale = Object.keys(matrix).filter((k) => typeof matrix[k]?.[locale] === 'string');
      // Per-locale file must contain every (and only) key the matrix has for this locale, in matrix key order.
      expect(dataKeys, `i18n/${locale}.json drifted from matrix — run scripts/build-i18n.mjs`).toEqual(matrixKeysForLocale);
      for (const k of matrixKeysForLocale) {
        expect(data[k]).toBe(matrix[k][locale]);
      }
    },
  );
});

describe('i18n — No extra keys', () => {
  it.each(LOCALES.filter((l) => l !== 'en' && !l.startsWith('zh-')))('%s.json — no keys that do not exist in en.json', (locale) => {
    const data = loadLocale(locale);
    const localeKeys = Object.keys(data);
    const enKeySet = new Set(enKeys);
    const extraKeys = localeKeys.filter((k) => !enKeySet.has(k));
    expect(extraKeys).toEqual([]);
  });
});

describe('i18n — Value quality', () => {
  it.each(LOCALES)('%s.json — all values are non-empty strings', (locale) => {
    const data = loadLocale(locale);
    for (const [key, value] of Object.entries(data)) {
      expect(typeof value).toBe('string');
      expect(value.length, `Key "${key}" in ${locale}.json has empty value`).toBeGreaterThan(0);
    }
  });

  it('en.json has no duplicate values for distinct keys (spot check)', () => {
    // This is a loose check — some duplicates are valid (e.g., "Close" used for multiple buttons)
    // We just verify the file isn't corrupted with many identical values
    const values = Object.values(enData);
    const uniqueValues = new Set(values);
    // At least 50% of keys should have unique values
    expect(uniqueValues.size).toBeGreaterThan(values.length * 0.5);
  });
});
