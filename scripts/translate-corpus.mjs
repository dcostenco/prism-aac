#!/usr/bin/env node
/**
 * Bulk AAC translation pipeline.
 *
 * Fills the three translation surfaces that drift apart as languages are
 * added, and records provenance for every string it writes so machine
 * output is never silently mistaken for human-reviewed output:
 *
 *   ui       i18n/translations.json          (418 UI keys, SSOT matrix)
 *   phrases  constants/phraseTranslations.ts (per-phrase AAC tile text)
 *   corpus   offline_phrases/<lang>.json     (prediction-seed source corpus)
 *
 * Every string written here lands in i18n/translation-provenance.json as
 * machine-generated and UNREVIEWED. `npm run i18n:review-status` reports what
 * still needs a native speaker. Nothing in this file marks anything reviewed —
 * that transition is a human action, by design.
 *
 * WHY THIS IS GATED ON REVIEW
 * This is an AAC device. A mistranslated tile does not read as a typo; it
 * puts words in a non-speaking user's mouth. Machine translation is the
 * starting draft for a native reviewer, not the shipping artifact.
 *
 * Usage:
 *   node scripts/translate-corpus.mjs --job=ui       --langs=am,sw,bn
 *   node scripts/translate-corpus.mjs --job=phrases  --langs=am,sw,bn
 *   node scripts/translate-corpus.mjs --job=phrases  --langs=all --missing-only
 *   node scripts/translate-corpus.mjs --job=corpus   --langs=he,hi,id,it,nl,pl,tl,tr,vi
 *   ... add --dry-run to print the plan and per-job call/⁠token estimate only.
 *
 * Requires GEMINI_API_KEY (same key/model path as scripts/generate_i18n.py).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const I18N_DIR = path.join(ROOT, 'i18n');
const MATRIX_PATH = path.join(I18N_DIR, 'translations.json');
// Deliberately in a SUBDIRECTORY of i18n/, not i18n/ itself. The locale
// discovery in build-i18n.mjs and tests/i18n-completeness.test.ts globs
// `i18n/*.json` and treats every hit as a shipping locale — a provenance
// file sitting next to en.json gets loaded as a bogus "translation-provenance"
// language and fails every coverage assertion.
const PROVENANCE_DIR = path.join(I18N_DIR, 'provenance');
const PROVENANCE_PATH = path.join(PROVENANCE_DIR, 'machine-translations.json');
const PHRASES_TS = path.join(ROOT, 'constants', 'phrases.ts');
const PHRASE_T_TS = path.join(ROOT, 'constants', 'phraseTranslations.ts');
// The offline phrase corpus lives outside this repo (it feeds the prediction
// seed builder, which is not part of the public tree). Overridable so the path
// isn't baked to one machine's layout.
const CORPUS_DIR =
  process.env.PRISM_CORPUS_DIR ??
  path.resolve(ROOT, '..', 'prism', 'training', 'data', 'offline_phrases');

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// Batch size is a quality knob, not just a throughput one: past ~80 strings
// the model starts drifting register and dropping ids on the tail of the list.
const BATCH_SIZE = 80;
const MAX_RETRIES = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Language metadata. `notes` is injected into the prompt — it is where
// AAC-relevant grammar hazards go, not general language trivia.
// ─────────────────────────────────────────────────────────────────────────────
const LANGS = {
  am: { name: 'Amharic (አማርኛ)', script: "Ge'ez / Ethiopic",
        notes: "Use Ethiopic script only, never transliteration. SOV word order. Amharic distinguishes formal/informal address — AAC users are usually children or peers speaking to caregivers, so use plain informal forms unless the source is explicitly deferential." },
  sw: { name: 'Swahili (Kiswahili)', script: 'Latin',
        notes: 'Standard Kiswahili sanifu, not Sheng or regional slang. Respect noun-class agreement — a wrong class prefix reads as a different word, not an accent.' },
  bn: { name: 'Bengali (বাংলা)', script: 'Bengali',
        notes: 'Use Bengali script only. Prefer the চলিত (colloquial/spoken) register over সাধু (literary) — these strings are spoken aloud, not read.' },
  es: { name: 'Spanish', script: 'Latin', notes: '' },
  fr: { name: 'French', script: 'Latin', notes: '' },
  pt: { name: 'Portuguese (Brazil)', script: 'Latin', notes: '' },
  ro: { name: 'Romanian', script: 'Latin', notes: '' },
  uk: { name: 'Ukrainian', script: 'Cyrillic', notes: '' },
  ru: { name: 'Russian', script: 'Cyrillic', notes: '' },
  de: { name: 'German', script: 'Latin', notes: '' },
  ja: { name: 'Japanese', script: 'Japanese', notes: 'Plain/casual register; these are spoken by a child or peer.' },
  ko: { name: 'Korean', script: 'Hangul', notes: 'Use 해요체 — polite but not formal-stiff.' },
  zh: { name: 'Chinese (Simplified)', script: 'Han (Simplified)', notes: '' },
  ar: { name: 'Arabic', script: 'Arabic', notes: 'Modern Standard Arabic, simple vocabulary.' },
  hi: { name: 'Hindi', script: 'Devanagari', notes: '' },
  it: { name: 'Italian', script: 'Latin', notes: '' },
  pl: { name: 'Polish', script: 'Latin', notes: '' },
  he: { name: 'Hebrew', script: 'Hebrew', notes: '' },
  nl: { name: 'Dutch', script: 'Latin', notes: '' },
  vi: { name: 'Vietnamese', script: 'Latin', notes: '' },
  tl: { name: 'Filipino (Tagalog)', script: 'Latin', notes: 'Natural conversational Tagalog; do not leave English words untranslated where a common Tagalog word exists.' },
  tr: { name: 'Turkish', script: 'Latin', notes: '' },
  id: { name: 'Indonesian', script: 'Latin', notes: '' },
  bg: { name: 'Bulgarian', script: 'Cyrillic', notes: '' },
};

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const JOB = args.get('job');
const DRY_RUN = args.has('dry-run');
const MISSING_ONLY = args.has('missing-only');

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

if (!['ui', 'phrases', 'corpus', 'vision', 'dict'].includes(JOB)) fail('--job must be ui | phrases | corpus | vision | dict');

const rawLangs = String(args.get('langs') ?? '');
if (!rawLangs) fail('--langs is required (comma-separated, or "all")');
const TARGETS = rawLangs === 'all' ? Object.keys(LANGS) : rawLangs.split(',').map((s) => s.trim());
for (const l of TARGETS) if (!LANGS[l]) fail(`unknown language "${l}"`);

const API_KEY = process.env.GEMINI_API_KEY ?? '';
if (!API_KEY && !DRY_RUN) fail('GEMINI_API_KEY is not set');

// ─────────────────────────────────────────────────────────────────────────────
// Gemini call
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(prompt) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingLevel: 'minimal' },
      responseMimeType: 'application/json',
    },
  };
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        // Key in the header, never the URL — a ?key= leaks the secret into
        // every proxy and request log. Same rule as generate_i18n.py.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`empty candidate: ${JSON.stringify(json).slice(0, 300)}`);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      const backoff = 2 ** attempt * 1000;
      console.warn(`    retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms — ${e.message.slice(0, 120)}`);
      await sleep(backoff);
    }
  }
  throw new Error(`gemini failed after ${MAX_RETRIES} attempts: ${lastErr?.message}`);
}

function buildPrompt(lang, items, kind) {
  const meta = LANGS[lang];
  const kindLine = {
    ui: 'These are UI strings for the app shell: buttons, labels, settings, status messages.',
    phrases: 'These are AAC communication tiles. A non-speaking user taps one and the device speaks it aloud in their voice.',
    corpus: 'These are example utterances used to train an on-device word-prediction model.',
  }[kind];

  return `You are translating for PrismAAC, an augmentative and alternative communication (AAC) device used by non-speaking people — many of them children, many with motor or cognitive disabilities.

Target language: ${meta.name}
Script: ${meta.script}
${meta.notes ? `Language notes: ${meta.notes}` : ''}

${kindLine}

Rules:
1. Translate into natural SPOKEN ${meta.name}, not literary or textbook register. These strings are read aloud by a speech synthesizer.
2. Keep it short. AAC users pay a real time cost per word. Match or beat the English length.
3. Use the ${meta.script} script exclusively. Never transliterate into Latin.
4. First person stays first person. "I want water" is the user speaking, not a description of them.
5. Never soften or hedge safety, pain, or refusal strings. "It hurts" must stay direct — this is how a user reports harm. Do not turn a refusal into a request.
6. Preserve any {placeholder} tokens exactly as written.
7. If a term genuinely has no natural equivalent, use the most widely understood loanword rather than inventing a calque.

Return ONLY a JSON object mapping each id to its translation. No commentary, no markdown fence.

Input:
${JSON.stringify(Object.fromEntries(items.map((i) => [i.id, i.en])), null, 0)}`;
}

async function translateBatchSet(lang, items, kind) {
  const out = {};
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));

  for (const [bi, batch] of batches.entries()) {
    process.stdout.write(`  ${lang} ${kind} batch ${bi + 1}/${batches.length} (${batch.length})… `);
    const result = await callGemini(buildPrompt(lang, batch, kind));
    let got = 0;
    for (const item of batch) {
      const v = result[item.id];
      if (typeof v === 'string' && v.trim()) {
        out[item.id] = v.trim();
        got++;
      }
    }
    console.log(`${got}/${batch.length}`);
    if (got < batch.length) {
      const missed = batch.filter((i) => !out[i.id]).map((i) => i.id);
      console.warn(`    MISSING ${missed.length}: ${missed.slice(0, 8).join(', ')}${missed.length > 8 ? '…' : ''}`);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provenance — the audit trail that keeps machine output honest
// ─────────────────────────────────────────────────────────────────────────────

function loadProvenance() {
  if (!fs.existsSync(PROVENANCE_PATH)) {
    return {
      _README: 'Machine-translated strings awaiting native-speaker review. Written by scripts/translate-corpus.mjs. Move an id from `unreviewed` to `reviewed` ONLY after a native speaker has checked it. Never edit this file to make a CI gate pass.',
      surfaces: {},
    };
  }
  return JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf-8'));
}

function recordProvenance(prov, surface, lang, ids, stamp) {
  prov.surfaces[surface] ??= {};
  prov.surfaces[surface][lang] ??= { generator: `${GEMINI_MODEL}`, generatedAt: stamp, reviewed: [], unreviewed: [] };
  const entry = prov.surfaces[surface][lang];
  entry.generator = GEMINI_MODEL;
  entry.generatedAt = stamp;
  const reviewed = new Set(entry.reviewed);
  const unreviewed = new Set(entry.unreviewed);
  for (const id of ids) if (!reviewed.has(id)) unreviewed.add(id);
  entry.unreviewed = [...unreviewed].sort();
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source readers
// ─────────────────────────────────────────────────────────────────────────────

/** DEFAULT_PHRASES from constants/phrases.ts — id, category, English text. */
function readPhrases() {
  const src = fs.readFileSync(PHRASES_TS, 'utf-8');
  const re = /^\s*p\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gm;
  return [...src.matchAll(re)].map((m) => ({
    id: m[1],
    category: m[2],
    en: (m[3] ?? m[4]).replace(/\\'/g, "'").replace(/\\"/g, '"'),
  }));
}

/** Existing phraseTranslations.ts entries: id -> { lang: text }. */
function readPhraseTranslations() {
  const src = fs.readFileSync(PHRASE_T_TS, 'utf-8');
  const entries = {};
  for (const m of src.matchAll(/^\s*'([^']+)':\s*\{(.*)\}\s*,?\s*$/gm)) {
    const [, id, body] = m;
    const langs = {};
    // `\s*` must sit OUTSIDE the alternation. The captured body excludes the
    // opening brace and begins with a space, so `(?:^|[,{]\s*)` failed to
    // match the very first language in every entry — silently dropping `ro`
    // (or whichever language led) from all 1261 rows on rewrite.
    for (const lm of body.matchAll(/(?:^|[,{])\s*'?([a-zA-Z-]{2,7})'?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
      // UNESCAPE the captured source text. The regex hands back the raw
      // string-literal body ("J\'ai"), and esc() re-escapes on emit — reading
      // without unescaping means every read→write round trip multiplies
      // backslashes: J'ai → J\\'ai → J\\\\'ai. That corruption shipped once
      // (107 strings) and only a value-level diff against HEAD caught it.
      langs[lm[1]] = (lm[2] ?? lm[3]).replace(/\\(['"\\])/g, '$1');
    }
    entries[id] = langs;
  }
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jobs
// ─────────────────────────────────────────────────────────────────────────────

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function jobUI(stamp, prov) {
  const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf-8'));
  const keys = Object.keys(matrix);
  for (const lang of TARGETS) {
    const items = keys
      .filter((k) => !MISSING_ONLY || typeof matrix[k][lang] !== 'string')
      .map((k) => ({ id: k, en: matrix[k].en }))
      .filter((i) => typeof i.en === 'string' && i.en.length);
    console.log(`\n${lang}: ${items.length} UI keys to translate`);
    if (DRY_RUN || !items.length) continue;
    const got = await translateBatchSet(lang, items, 'ui');
    for (const [k, v] of Object.entries(got)) matrix[k][lang] = v;
    recordProvenance(prov, 'ui', lang, Object.keys(got), stamp);
    fs.writeFileSync(MATRIX_PATH, JSON.stringify(matrix, null, 2) + '\n');
    console.log(`  wrote ${Object.keys(got).length} keys into translations.json`);
  }
  if (!DRY_RUN) console.log('\nNow run: node scripts/build-i18n.mjs');
}

async function jobPhrases(stamp, prov) {
  const phrases = readPhrases();
  const existing = readPhraseTranslations();
  const byId = new Map(phrases.map((p) => [p.id, p]));

  for (const lang of TARGETS) {
    // Presence, not truthiness — see the emit filter below. `cw-to` is
    // deliberately '' for ru/uk, and a truthiness test reports it as missing,
    // re-translates it, and reintroduces the preposition those languages
    // don't use.
    const items = phrases.filter((p) => !MISSING_ONLY || typeof existing[p.id]?.[lang] !== 'string');
    console.log(`\n${lang}: ${items.length} phrases to translate (of ${phrases.length})`);
    if (DRY_RUN || !items.length) continue;
    const got = await translateBatchSet(lang, items, 'phrases');
    for (const [id, v] of Object.entries(got)) {
      existing[id] ??= {};
      existing[id][lang] = v;
    }
    recordProvenance(prov, 'phrases', lang, Object.keys(got), stamp);
    console.log(`  translated ${Object.keys(got).length}`);
  }

  if (DRY_RUN) return;

  // Rewrite phraseTranslations.ts from the merged map. Ordering follows
  // phrases.ts so the file diffs cleanly and stays reviewable; ids present
  // only in the translation map (e.g. orderingSequences chip-*/gen-* keys)
  // are preserved at the end rather than dropped.
  const LANG_ORDER = ['ro', 'es', 'fr', 'pt', 'de', 'ru', 'uk', 'ja', 'ko', 'zh', 'ar', 'hi', 'it', 'pl', 'he', 'nl', 'vi', 'tl', 'tr', 'id', 'bg', 'am', 'sw', 'bn'];
  const orderedIds = [...phrases.map((p) => p.id), ...Object.keys(existing).filter((id) => !byId.has(id))];
  const seen = new Set();
  const lines = [];
  for (const id of orderedIds) {
    if (seen.has(id) || !existing[id]) continue;
    seen.add(id);
    const langs = existing[id];
    // Test for presence, not truthiness. An empty string is a MEANINGFUL
    // translation here: 'cw-to' is deliberately '' for ru/uk because those
    // languages have no infinitive particle, and a truthiness filter silently
    // deletes it, resurrecting the English "to" via the fallback path.
    const body = LANG_ORDER.filter((l) => typeof langs[l] === 'string').map((l) => `${/^[a-z]+$/.test(l) ? l : `'${l}'`}: '${esc(langs[l])}'`).join(', ');
    if (body) lines.push(`  '${id}': { ${body}},`);
  }
  const src = fs.readFileSync(PHRASE_T_TS, 'utf-8');
  const header = src.slice(0, src.indexOf('const T: Record<'));
  const footer = src.slice(src.indexOf('export function getPhraseText'));
  fs.writeFileSync(
    PHRASE_T_TS,
    `${header}const T: Record<string, Partial<Record<SupportedLanguage, string>>> = {\n${lines.join('\n')}\n};\n\n${footer}`,
  );
  console.log(`\nwrote ${lines.length} entries into phraseTranslations.ts`);
}

async function jobCorpus(stamp, prov) {
  const en = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, 'en.json'), 'utf-8'));
  const sections = Object.keys(en);
  for (const lang of TARGETS) {
    const outPath = path.join(CORPUS_DIR, `${lang}.json`);
    const current = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : {};
    const items = [];
    for (const s of sections) {
      const have = current[s]?.length ?? 0;
      if (MISSING_ONLY && have > 0) continue;
      en[s].forEach((text, i) => items.push({ id: `${s}#${i}`, en: text }));
    }
    console.log(`\n${lang}: ${items.length} corpus utterances to translate`);
    if (DRY_RUN || !items.length) continue;
    const got = await translateBatchSet(lang, items, 'corpus');
    for (const s of sections) {
      if (MISSING_ONLY && (current[s]?.length ?? 0) > 0) continue;
      current[s] = en[s].map((_, i) => got[`${s}#${i}`]).filter(Boolean);
    }
    recordProvenance(prov, 'corpus', lang, Object.keys(got), stamp);
    fs.writeFileSync(outPath, JSON.stringify(current, null, 2) + '\n');
    console.log(`  wrote ${outPath}`);
  }
  if (!DRY_RUN) console.log('\nNow run build_prediction_seeds.py from the training repo.');
}

/**
 * visionPhrases.ts — scene-conditioned quick phrases, shaped
 * { [scene]: { [lang]: string[8] } }. Insert each new language directly
 * after the `en` row of its scene so the file stays readable.
 */
async function jobVision(stamp, prov) {
  const VISION_TS = path.join(ROOT, 'constants', 'visionPhrases.ts');
  let src = fs.readFileSync(VISION_TS, 'utf-8');

  const scenes = {};
  for (const m of src.matchAll(/^ {2}([a-zA-Z_]+):\s*\{$/gm)) scenes[m[1]] = null;
  for (const scene of Object.keys(scenes)) {
    const re = new RegExp(`^ {2}${scene}:\\s*\\{[\\s\\S]*?^ {4}en:\\s*\\[(.*?)\\],$`, 'm');
    const m = src.match(re);
    if (!m) fail(`could not read en row for scene ${scene}`);
    scenes[scene] = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map(
      (x) => (x[1] ?? x[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'),
    );
  }

  for (const lang of TARGETS) {
    if (MISSING_ONLY && new RegExp(`^ {4}'?${lang}'?:\\s*\\[`, 'm').test(src)) {
      console.log(`\n${lang}: already present, skipping`);
      continue;
    }
    const items = [];
    for (const [scene, list] of Object.entries(scenes)) {
      list.forEach((text, i) => items.push({ id: `${scene}#${i}`, en: text }));
    }
    console.log(`\n${lang}: ${items.length} vision phrases to translate`);
    if (DRY_RUN) continue;
    const got = await translateBatchSet(lang, items, 'phrases');

    for (const [scene, list] of Object.entries(scenes)) {
      const row = list.map((_, i) => got[`${scene}#${i}`]).filter(Boolean);
      if (row.length !== list.length) {
        console.warn(`  ${scene}: got ${row.length}/${list.length} — skipping scene to keep rows aligned`);
        continue;
      }
      const key = /^[a-z]+$/.test(lang) ? lang : `'${lang}'`;
      const line = `    ${key}: [${row.map((s) => `'${esc(s)}'`).join(', ')}],`;
      const anchor = new RegExp(`(^ {2}${scene}:\\s*\\{[\\s\\S]*?^ {4}en:\\s*\\[.*?\\],$)`, 'm');
      src = src.replace(anchor, `$1\n${line}`);
    }
    recordProvenance(prov, 'vision', lang, Object.keys(got), stamp);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(VISION_TS, src);
    console.log('\nwrote constants/visionPhrases.ts');
  }
}

/**
 * offlineDictionary.ts — 500 INDEX-ALIGNED words per language. The file has a
 * runtime guard that throws when arrays disagree in length, so a partial row
 * is worse than no row: we drop the language rather than emit a short array.
 */
async function jobDict(stamp, prov) {
  const DICT_TS = path.join(ROOT, 'constants', 'offlineDictionary.ts');
  let src = fs.readFileSync(DICT_TS, 'utf-8');

  const enMatch = src.match(/^ {2}en:\s*\[([\s\S]*?)^ {2}\],$/m);
  if (!enMatch) fail('could not read the en row of offlineDictionary');
  const enWords = [...enMatch[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  console.log(`en dictionary row: ${enWords.length} words`);

  for (const lang of TARGETS) {
    if (MISSING_ONLY && new RegExp(`^ {2}'?${lang}'?:\\s*\\[`, 'm').test(src)) {
      console.log(`\n${lang}: already present, skipping`);
      continue;
    }
    const items = enWords.map((en, i) => ({ id: String(i), en }));
    console.log(`\n${lang}: ${items.length} dictionary words to translate`);
    if (DRY_RUN) continue;
    const got = await translateBatchSet(lang, items, 'phrases');
    const row = enWords.map((_, i) => got[String(i)]);
    if (row.some((w) => !w)) {
      const missing = row.filter((w) => !w).length;
      console.warn(`  ${lang}: ${missing} words missing — SKIPPING, a short row trips the runtime length guard`);
      continue;
    }
    const key = /^[a-z]+$/.test(lang) ? lang : `'${lang}'`;
    const line = `  ${key}: [\n    ${row.map((s) => `'${esc(s)}'`).join(',')}\n  ],\n`;
    src = src.replace(/^};$/m, `${line}};`);
    recordProvenance(prov, 'dict', lang, Object.keys(got), stamp);
    console.log(`  added ${row.length} words`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(DICT_TS, src);
    console.log('\nwrote constants/offlineDictionary.ts');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString();
const prov = loadProvenance();

console.log(`job=${JOB} langs=${TARGETS.join(',')} missingOnly=${MISSING_ONLY} dryRun=${DRY_RUN}`);

if (JOB === 'ui') await jobUI(stamp, prov);
else if (JOB === 'phrases') await jobPhrases(stamp, prov);
else if (JOB === 'vision') await jobVision(stamp, prov);
else if (JOB === 'dict') await jobDict(stamp, prov);
else await jobCorpus(stamp, prov);

if (!DRY_RUN) {
  fs.mkdirSync(PROVENANCE_DIR, { recursive: true });
  // Re-read and merge instead of writing `prov` straight out. Jobs are run
  // concurrently (they touch different source files), and each one loaded
  // provenance at startup — a blind write makes the last job to finish erase
  // every other job's entries, silently marking machine output as if it had
  // never been generated. Merge by surface+lang, union the id lists, and let
  // `reviewed` win over `unreviewed` so a human decision is never undone.
  const onDisk = fs.existsSync(PROVENANCE_PATH)
    ? JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf-8'))
    : { _README: prov._README, surfaces: {} };
  for (const [surface, langs] of Object.entries(prov.surfaces)) {
    onDisk.surfaces[surface] ??= {};
    for (const [lang, entry] of Object.entries(langs)) {
      const prev = onDisk.surfaces[surface][lang] ?? { reviewed: [], unreviewed: [] };
      const reviewed = new Set([...(prev.reviewed ?? []), ...(entry.reviewed ?? [])]);
      const unreviewed = new Set([...(prev.unreviewed ?? []), ...entry.unreviewed]);
      for (const id of reviewed) unreviewed.delete(id);
      onDisk.surfaces[surface][lang] = {
        generator: entry.generator,
        generatedAt: entry.generatedAt,
        reviewed: [...reviewed].sort(),
        unreviewed: [...unreviewed].sort(),
      };
    }
  }
  onDisk._README ??= prov._README;
  const prov2 = onDisk;
  fs.writeFileSync(PROVENANCE_PATH, JSON.stringify(prov2, null, 2) + '\n');
  let pending = 0;
  for (const s of Object.values(prov2.surfaces)) for (const l of Object.values(s)) pending += l.unreviewed.length;
  console.log(`\nprovenance updated — ${pending} strings awaiting native-speaker review`);
  console.log('these are NOT reviewed translations. run `npm run i18n:review-status` for the breakdown.');
}
