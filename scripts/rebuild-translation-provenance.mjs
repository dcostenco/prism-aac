#!/usr/bin/env node
/**
 * Rebuild i18n/provenance/machine-translations.json by DERIVING it from state
 * rather than accumulating it during translation runs.
 *
 * Why derive: the accumulate-during-run approach is racy. Concurrent jobs each
 * hold provenance in memory and write at the end, so the last writer erases the
 * others' surfaces. That happened twice here and both times it under-reported
 * how much of the app was machine-translated — the failure mode points the
 * wrong way, toward "more reviewed than it is".
 *
 * Definition used: anything present at BASELINE (below) predates this work and is
 * treated as pre-existing/human. Anything added since is machine-generated and
 * unreviewed. That is conservative in the safe direction.
 *
 * Re-runnable and idempotent. Preserves any `reviewed` ids already recorded.
 *
 *   node scripts/rebuild-translation-provenance.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROV_DIR = path.join(ROOT, 'i18n', 'provenance');
const PROV_PATH = path.join(PROV_DIR, 'machine-translations.json');
const GENERATOR = 'gemini-3.6-flash';

/**
 * Baseline for "what predates this work".
 *
 * MUST be a pinned commit, not HEAD. Once the language work is committed, HEAD
 * contains it, so diffing against HEAD reports almost nothing as new — this
 * silently collapsed the count from ~68,000 unreviewed strings to 3,897.
 * Under-reporting here is the dangerous direction: it makes machine output
 * look reviewed.
 *
 * d80b42d47 is the merge base, the last commit before Amharic/Swahili/Bengali
 * work began. Override with PROVENANCE_BASELINE if the history is rewritten.
 */
const BASELINE = process.env.PROVENANCE_BASELINE || 'd80b42d47';

const show = (p) => {
  try {
    // stderr piped, not inherited: a path that doesn't exist in HEAD is the
    // normal case for newly added files and shouldn't print `fatal:` noise.
    return execFileSync('git', ['show', `${BASELINE}:${p}`], {
      cwd: ROOT, encoding: 'utf-8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

const RE_ENTRY = /^\s*'([^']+)':\s*\{(.*)\}\s*,?\s*$/gm;
const RE_LANG = /(?:^|[,{])\s*'?([a-zA-Z-]{2,7})'?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;

function parsePhraseMap(src) {
  const out = {};
  if (!src) return out;
  for (const m of src.matchAll(RE_ENTRY)) {
    const langs = {};
    for (const lm of m[2].matchAll(RE_LANG)) langs[lm[1]] = lm[2] ?? lm[3];
    out[m[1]] = langs;
  }
  return out;
}

const prev = fs.existsSync(PROV_PATH) ? JSON.parse(fs.readFileSync(PROV_PATH, 'utf-8')) : { surfaces: {} };
const reviewedOf = (surface, lang) => new Set(prev.surfaces?.[surface]?.[lang]?.reviewed ?? []);

const stamp = new Date().toISOString();
const surfaces = {};

function record(surface, lang, ids) {
  if (!ids.length) return;
  const reviewed = reviewedOf(surface, lang);
  const unreviewed = ids.filter((id) => !reviewed.has(id)).sort();
  surfaces[surface] ??= {};
  surfaces[surface][lang] = {
    generator: GENERATOR,
    generatedAt: stamp,
    reviewed: [...reviewed].sort(),
    unreviewed,
  };
}

// ── ui: i18n/translations.json ───────────────────────────────────────────────
{
  const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'translations.json'), 'utf-8'));
  const old = JSON.parse(show('i18n/translations.json') ?? '{}');
  const byLang = {};
  for (const [key, langs] of Object.entries(cur)) {
    for (const [lang, val] of Object.entries(langs)) {
      if (typeof old[key]?.[lang] === 'string') continue; // pre-existing
      if (typeof val !== 'string') continue;
      (byLang[lang] ??= []).push(key);
    }
  }
  for (const [lang, ids] of Object.entries(byLang)) record('ui', lang, ids);
}

// ── phrases: constants/phraseTranslations.ts ─────────────────────────────────
{
  const cur = parsePhraseMap(fs.readFileSync(path.join(ROOT, 'constants', 'phraseTranslations.ts'), 'utf-8'));
  const old = parsePhraseMap(show('constants/phraseTranslations.ts'));
  const byLang = {};
  for (const [id, langs] of Object.entries(cur)) {
    for (const lang of Object.keys(langs)) {
      if (typeof old[id]?.[lang] === 'string') continue;
      (byLang[lang] ??= []).push(id);
    }
  }
  for (const [lang, ids] of Object.entries(byLang)) record('phrases', lang, ids);
}

// ── dict: constants/offlineDictionary.ts (whole rows are added at once) ──────
{
  const langsIn = (src) =>
    new Set(src ? [...src.matchAll(/^ {2}'?([a-zA-Z-]{2,7})'?:\s*\[/gm)].map((m) => m[1]) : []);
  const cur = fs.readFileSync(path.join(ROOT, 'constants', 'offlineDictionary.ts'), 'utf-8');
  const before = langsIn(show('constants/offlineDictionary.ts'));
  const enRow = cur.match(/^ {2}en:\s*\[([\s\S]*?)^ {2}\],$/m);
  const n = enRow ? [...enRow[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].length : 0;
  for (const lang of langsIn(cur)) {
    if (before.has(lang)) continue;
    record('dict', lang, Array.from({ length: n }, (_, i) => String(i)));
  }
}

// ── vision: constants/visionPhrases.ts ───────────────────────────────────────
{
  const cur = fs.readFileSync(path.join(ROOT, 'constants', 'visionPhrases.ts'), 'utf-8');
  const old = show('constants/visionPhrases.ts') ?? '';
  const scenes = [...cur.matchAll(/^ {2}([a-zA-Z_]+):\s*\{$/gm)].map((m) => m[1]);
  const rowsFor = (src, lang) => {
    const found = {};
    for (const scene of scenes) {
      const m = src.match(new RegExp(`^ {2}${scene}:\\s*\\{[\\s\\S]*?^ {4}'?${lang}'?:\\s*\\[(.*?)\\],$`, 'm'));
      if (m) found[scene] = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].length;
    }
    return found;
  };
  const allLangs = new Set([...cur.matchAll(/^ {4}'?([a-zA-Z-]{2,7})'?:\s*\[/gm)].map((m) => m[1]));
  for (const lang of allLangs) {
    const nowRows = rowsFor(cur, lang);
    const oldRows = rowsFor(old, lang);
    const ids = [];
    for (const [scene, count] of Object.entries(nowRows)) {
      if (oldRows[scene]) continue;
      for (let i = 0; i < count; i++) ids.push(`${scene}#${i}`);
    }
    record('vision', lang, ids);
  }
}

// ── corpus: offline_phrases/<lang>.json (outside the repo, so compare to the
//    locale set the committed prediction seeds were built from) ──────────────
{
  const CORPUS_DIR =
    process.env.PRISM_CORPUS_DIR ??
    path.resolve(ROOT, '..', 'prism', 'training', 'data', 'offline_phrases');
  // Which languages had a corpus BEFORE this work? Not SUPPORTED_SEED_LANGS —
  // the nine stub locales were listed there while having no corpus at all.
  // The seed file header distinguishes them exactly: corpus-derived seeds open
  // with "// Auto-generated for locale ... N source phrases", hand-written
  // stubs with "// Skeleton seed for locale".
  const preexisting = new Set();
  const seedDir = path.join(ROOT, 'constants', 'predictionSeeds');
  for (const f of fs.readdirSync(seedDir).filter((x) => x.endsWith('.ts') && x !== 'index.ts')) {
    const lang = f.replace(/\.ts$/, '');
    const head = (show(`constants/predictionSeeds/${f}`) ?? '').slice(0, 400);
    if (/^\/\/ Auto-generated for locale/.test(head) && /\d+ source phrases/.test(head)) {
      preexisting.add(lang);
    }
  }

  if (fs.existsSync(CORPUS_DIR)) {
    for (const f of fs.readdirSync(CORPUS_DIR).filter((x) => x.endsWith('.json'))) {
      const lang = f.replace(/\.json$/, '');
      if (lang === 'en' || preexisting.has(lang)) continue;
      const data = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, f), 'utf-8'));
      const ids = [];
      for (const [section, list] of Object.entries(data)) {
        (list ?? []).forEach((_, i) => ids.push(`${section}#${i}`));
      }
      record('corpus', lang, ids);
    }
  }
}

fs.mkdirSync(PROV_DIR, { recursive: true });
fs.writeFileSync(
  PROV_PATH,
  JSON.stringify(
    {
      _README:
        'DERIVED FILE — regenerate with scripts/rebuild-translation-provenance.mjs. ' +
        'Lists strings added by machine translation and not yet checked by a native speaker. ' +
        'Anything present in git HEAD before this work is treated as pre-existing and is not listed. ' +
        'Move an id into `reviewed` only after a native speaker has actually checked it.',
      surfaces,
    },
    null,
    2,
  ) + '\n',
);

let n = 0;
for (const s of Object.values(surfaces)) for (const l of Object.values(s)) n += l.unreviewed.length;
console.log(`rebuilt provenance: ${n} unreviewed strings across ${Object.keys(surfaces).length} surfaces`);
