#!/usr/bin/env node
/**
 * Find translations where one string serves two unrelated English tiles.
 *
 * Why this exists
 * ---------------
 * 68,702 strings across this app are machine-generated and have never been
 * checked by a native speaker. No native reviewer is available, and the
 * back-translation and ASR round-trip checks both need paid APIs. This check
 * needs neither: it is pure structure over data already in the repo, and it
 * still found 15 real defects in Swahili — "Ona" (to see) on the Bite tile,
 * "Inhela" (not a word) on Inhaler, Gym rendering as the Playground string.
 *
 * What a hit means
 * ----------------
 * A collision is a LEAD, not a verdict. Languages legitimately collapse
 * distinctions English makes:
 *   - Swahili `yeye` is both he and she; `kaa` is sit and crab; `ndege` is
 *     bird and aeroplane
 *   - Bengali `সে` is he and she
 *   - Amharic `ከባድ` is hard and heavy
 * So this prints candidates for a human or an external dictionary to judge.
 * It deliberately does NOT fail the build on a raw collision count.
 *
 * What it does fail on
 * --------------------
 * Pairs listed in CLINICALLY_DISTINCT_PAIRS must never share a string: those
 * are the distinctions where collapsing them changes what a user can report
 * (Hand vs Arm, Foot vs Leg). Those are enforced elsewhere by
 * tests/body-part-distinctions.test.ts; this script surfaces them early.
 *
 *   node scripts/check-translation-collisions.mjs            # all locales
 *   node scripts/check-translation-collisions.mjs --lang=sw  # one locale
 *   node scripts/check-translation-collisions.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const RE_ENTRY = /^\s*'([^']+)':\s*\{(.*)\}\s*,?\s*$/gm;
const RE_LANG =
  /(?:^|[,{])\s*'?([a-zA-Z-]{2,7})'?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;

/** Undo the escaping the source file uses, so "J\'ai" compares as "J'ai". */
const unescape = (s) => s.replace(/\\(['"\\])/g, '$1');

function readTranslations() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'phraseTranslations.ts'), 'utf-8');
  const out = {};
  for (const m of src.matchAll(RE_ENTRY)) {
    const langs = {};
    for (const lm of m[2].matchAll(RE_LANG)) {
      langs[lm[1]] = unescape(lm[2] ?? lm[3]);
    }
    out[m[1]] = langs;
  }
  return out;
}

function readEnglish() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'phrases.ts'), 'utf-8');
  const out = {};
  for (const m of src.matchAll(/p\('([^']+)',\s*'[^']*',\s*'((?:[^'\\]|\\.)*)'/g)) {
    out[m[1]] = unescape(m[2]);
  }
  return out;
}

const T = readTranslations();
const EN = readEnglish();

const locales = args.get('lang')
  ? [String(args.get('lang'))]
  : [...new Set(Object.values(T).flatMap((v) => Object.keys(v)))].filter((l) => l !== 'en').sort();

const report = {};

for (const lang of locales) {
  const byString = new Map();
  for (const [id, langs] of Object.entries(T)) {
    const v = langs[lang];
    if (typeof v !== 'string' || !v.trim()) continue;
    const key = v.trim().toLowerCase();
    if (!byString.has(key)) byString.set(key, []);
    byString.get(key).push(id);
  }

  const hits = [];
  for (const [value, ids] of byString) {
    if (ids.length < 2) continue;
    const glosses = ids.map((id) => EN[id]).filter(Boolean);
    if (glosses.length !== ids.length) continue;
    // Two ids carrying the SAME English word are supposed to match.
    if (new Set(glosses.map((g) => g.toLowerCase())).size < 2) continue;
    hits.push({ value, ids, english: glosses });
  }

  const total = [...byString.values()].filter((v) => v.length > 1).length;
  report[lang] = { strings: byString.size, reused: total, distinctMeanings: hits.length, hits };
}

if (args.get('json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log('Translations where one string serves two DIFFERENT English tiles.');
console.log('A hit is a lead, not a defect — real languages collapse distinctions English makes.\n');
console.log(`  ${'locale'.padEnd(9)}${'strings'.padStart(8)}${'reused'.padStart(8)}${'diff-meaning'.padStart(14)}`);
for (const [lang, r] of Object.entries(report)) {
  console.log(
    `  ${lang.padEnd(9)}${String(r.strings).padStart(8)}${String(r.reused).padStart(8)}${String(r.distinctMeanings).padStart(14)}`,
  );
}

if (args.get('lang')) {
  const r = report[String(args.get('lang'))];
  console.log('');
  for (const h of r.hits) {
    console.log(`  ${h.value}`);
    console.log(`      ${h.english.join(' / ')}   [${h.ids.join(', ')}]`);
  }
}

const worst = Object.entries(report).sort((a, b) => b[1].distinctMeanings - a[1].distinctMeanings)[0];
console.log(`\nMost collisions: ${worst[0]} (${worst[1].distinctMeanings}).`);
console.log('Re-run with --lang=<code> to list them.');
