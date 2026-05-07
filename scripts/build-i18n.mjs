#!/usr/bin/env node
/**
 * Build per-locale i18n JSON files from the single source of truth:
 * `i18n/translations.json` (a matrix of { key: { locale: value } }).
 *
 * Per-locale files (`i18n/<lang>.json`) are GENERATED ARTIFACTS — they
 * are committed to git for diff visibility and to keep dynamic-import
 * loading fast, but never edit them directly. Edit `translations.json`
 * and re-run this script.
 *
 * Behavior:
 *   - For every locale referenced anywhere in the matrix, write
 *     `i18n/<locale>.json` containing every key present for that locale.
 *   - Locales missing keys are NOT defaulted to English here — that
 *     decision belongs to the runtime fallback in engine/i18n.ts. The
 *     CI test (tests/i18n-completeness.test.ts) fails the build when
 *     gaps exist, so partial generation is the honest output.
 *
 * Usage:
 *   node scripts/build-i18n.mjs            # generate
 *   node scripts/build-i18n.mjs --check    # exit 1 if files don't match matrix
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const I18N_DIR = path.join(ROOT, 'i18n');
const MATRIX_PATH = path.join(I18N_DIR, 'translations.json');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

if (!fs.existsSync(MATRIX_PATH)) {
  console.error('translations.json missing — nothing to build');
  process.exit(1);
}

const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf-8'));
const allKeys = Object.keys(matrix);

// Discover every locale that appears anywhere in the matrix.
const locales = new Set();
for (const k of allKeys) {
  for (const loc of Object.keys(matrix[k])) locales.add(loc);
}

let mismatches = 0;
for (const loc of [...locales].sort()) {
  const out = {};
  for (const k of allKeys) {
    const v = matrix[k][loc];
    if (typeof v === 'string') out[k] = v;
  }
  const filePath = path.join(I18N_DIR, `${loc}.json`);
  const next = JSON.stringify(out, null, 2) + '\n';
  if (checkOnly) {
    const cur = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    if (cur !== next) {
      console.error(`drift: i18n/${loc}.json does not match translations.json`);
      mismatches++;
    }
  } else {
    fs.writeFileSync(filePath, next);
    console.log(`wrote i18n/${loc}.json — ${Object.keys(out).length}/${allKeys.length} keys`);
  }
}

if (checkOnly && mismatches > 0) {
  console.error(`\n${mismatches} locale file(s) drift from matrix. Run: node scripts/build-i18n.mjs`);
  process.exit(1);
}
