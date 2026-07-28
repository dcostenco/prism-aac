#!/usr/bin/env node
/**
 * Report which machine-generated translations still need a native speaker.
 *
 * Reads i18n/provenance/machine-translations.json, written by
 * scripts/translate-corpus.mjs. Exists so "we support 28 languages" and
 * "28 languages have been checked by someone who speaks them" stay
 * visibly different claims.
 *
 *   node scripts/i18n-review-status.mjs            # summary
 *   node scripts/i18n-review-status.mjs --lang=am  # one language, with ids
 *   node scripts/i18n-review-status.mjs --strict   # exit 1 if anything unreviewed
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROV = path.join(ROOT, 'i18n', 'provenance', 'machine-translations.json');

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

if (!fs.existsSync(PROV)) {
  console.log('No provenance file — nothing machine-generated has been recorded.');
  process.exit(0);
}

const prov = JSON.parse(fs.readFileSync(PROV, 'utf-8'));
const only = args.get('lang');

const perLang = {};
for (const [surface, langs] of Object.entries(prov.surfaces ?? {})) {
  for (const [lang, entry] of Object.entries(langs)) {
    if (only && lang !== only) continue;
    perLang[lang] ??= { reviewed: 0, unreviewed: 0, surfaces: {} };
    perLang[lang].reviewed += entry.reviewed?.length ?? 0;
    perLang[lang].unreviewed += entry.unreviewed?.length ?? 0;
    perLang[lang].surfaces[surface] = {
      reviewed: entry.reviewed?.length ?? 0,
      unreviewed: entry.unreviewed?.length ?? 0,
      generator: entry.generator,
      generatedAt: entry.generatedAt,
    };
  }
}

const rows = Object.entries(perLang)
  .map(([lang, v]) => {
    const total = v.reviewed + v.unreviewed;
    return {
      lang,
      total,
      reviewed: v.reviewed,
      unreviewed: v.unreviewed,
      pctReviewed: total ? `${((v.reviewed / total) * 100).toFixed(1)}%` : 'n/a',
      surfaces: Object.keys(v.surfaces).join(','),
    };
  })
  .sort((a, b) => b.unreviewed - a.unreviewed);

console.log('\nMachine-translated strings awaiting native-speaker review\n');
console.table(rows);

const totalUnreviewed = rows.reduce((n, r) => n + r.unreviewed, 0);
const totalAll = rows.reduce((n, r) => n + r.total, 0);
console.log(`${totalUnreviewed} of ${totalAll} machine-generated strings are UNREVIEWED.`);

if (only) {
  const detail = perLang[only];
  if (!detail) {
    console.log(`\nNo machine-generated strings recorded for "${only}".`);
  } else {
    console.log(`\nBy surface for ${only}:`);
    console.table(detail.surfaces);
    for (const [surface, langs] of Object.entries(prov.surfaces ?? {})) {
      const e = langs[only];
      if (!e?.unreviewed?.length) continue;
      console.log(`\n  ${surface} — first 25 unreviewed ids:`);
      console.log('   ', e.unreviewed.slice(0, 25).join(', '));
      if (e.unreviewed.length > 25) console.log(`    …and ${e.unreviewed.length - 25} more`);
    }
  }
}

console.log(
  '\nThese are machine drafts. This is an AAC device — a mistranslated tile speaks\n' +
  'for someone who cannot correct it. Do not describe a language as "supported"\n' +
  'on the strength of this file alone.\n',
);

if (args.has('strict') && totalUnreviewed > 0) process.exit(1);
