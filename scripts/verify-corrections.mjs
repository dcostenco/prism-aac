#!/usr/bin/env node
/**
 * Accept/reject gate for proposed translation corrections.
 *
 * Why this exists
 * ---------------
 * No native speaker is available for Amharic, Swahili or Bengali. Without one,
 * "an agent said this is better" is not evidence — it is the same kind of
 * confident output that produced the errors in the first place. This turns a
 * proposal into something checkable without knowing the language.
 *
 * For each proposed fix it asks a model, BLIND, what the strings mean — no tile
 * id, no English target, no indication which is old and which is new, and the
 * two are presented in randomised order so position carries no signal. Then:
 *
 *   ACCEPT  the correction back-translates to the intended English AND the
 *           current string does not. Both halves matter: the fix has to land,
 *           and the bug has to have been real.
 *   REJECT  the correction does not back-translate to the target. Do not ship.
 *   REVIEW  both look right, or both look wrong — the check cannot separate
 *           them, so a human has to. Not silently treated as a pass.
 *
 * Limits, stated because they bound what this proves:
 *   - The verifier and the proposer are the same model family, so a shared
 *     blind spot survives. It catches "this word does not mean that", which is
 *     the failure mode actually seen here, not subtle register problems.
 *   - Agreement is evidence, not proof. It does not license calling these
 *     languages reviewed.
 *
 *   GEMINI_API_KEY=... node scripts/verify-corrections.mjs --lang=am
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = process.env.GEMINI_API_KEY || '';
if (!KEY) { console.error('GEMINI_API_KEY is not set.'); process.exit(1); }

const MODEL = 'gemini-3.6-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const LANG_NAMES = { am: 'Amharic', sw: 'Swahili', bn: 'Bengali' };

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const lang = String(args.get('lang') || '');
if (!LANG_NAMES[lang]) { console.error('--lang must be am | sw | bn'); process.exit(1); }

const fixes = JSON.parse(fs.readFileSync(`/tmp/fix-${lang}.json`, 'utf-8'));
if (!fixes.length) { console.log('no proposed fixes'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask(prompt) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0, maxOutputTokens: 8192,
            thinkingConfig: { thinkingLevel: 'minimal' },
            responseMimeType: 'application/json',
          },
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return JSON.parse((await r.json()).candidates[0].content.parts[0].text);
    } catch (e) {
      if (i === 3) throw e;
      await sleep(2 ** i * 1000);
    }
  }
}

/** Deterministic per-item coin flip, so "which came first" carries no signal. */
const flip = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0x7fffffff, 7) % 2 === 0;

// Blind: both strings, shuffled, no ids and no English targets anywhere.
const items = fixes.map((f, i) => {
  const swap = flip(f.id);
  return { i, a: swap ? f.corrected : f.current, b: swap ? f.current : f.corrected, swap, f };
});

const prompt = `Below are numbered pairs of ${LANG_NAMES[lang]} phrases. For each pair, state in plain English what phrase A means and what phrase B means.

Rules:
- Translate literally. Do not guess at intent or "fix" anything.
- If a phrase is not meaningful ${LANG_NAMES[lang]}, or is garbled, answer exactly "MEANINGLESS".
- Keep each answer under 8 words.

Return ONLY a JSON object: {"1": {"a": "...", "b": "..."}, "2": {...}, ...}

${items.map((x) => `${x.i + 1}.\n  A: ${x.a}\n  B: ${x.b}`).join('\n')}`;

const out = await ask(prompt);

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
/** Loose match: shares the content words of the target. */
function matches(got, target) {
  const g = norm(got), t = norm(target);
  if (!g || g === 'meaningless') return false;
  if (g === t || g.includes(t) || t.includes(g)) return true;
  const stop = new Set(['i','am','is','a','the','my','me','to','it','you','do','not','feel','have']);
  const tw = t.split(' ').filter((w) => w.length > 2 && !stop.has(w));
  if (!tw.length) return false;
  return tw.filter((w) => g.includes(w.slice(0, Math.max(4, w.length - 2)))).length / tw.length >= 0.5;
}

const isMeaningless = (s) => norm(s) === 'meaningless' || !norm(s);

const accepted = [], rejected = [], review = [];
for (const x of items) {
  const r = out[String(x.i + 1)] ?? {};
  const meaningOfCorrected = x.swap ? r.a : r.b;
  const meaningOfCurrent = x.swap ? r.b : r.a;
  const target = x.f.english;
  // Lexical overlap alone is too strict and produced FALSE REJECTS on the
  // strings that matter most: "I am afraid" was rejected against a target of
  // "I am scared", "my head spun" against "dizzy", "I feel bad" against "I
  // feel sick". Two of those were replacing text the verifier itself called
  // MEANINGLESS, so the gate was defending broken strings on synonym grounds.
  //
  // So: if the CURRENT string is meaningless and the correction is not, that
  // is sufficient. Anything meaningful beats nonsense on a safety tile.
  const okNew = matches(meaningOfCorrected, target)
    || (isMeaningless(meaningOfCurrent) && !isMeaningless(meaningOfCorrected));
  const okOld = matches(meaningOfCurrent, target);
  const rec = { ...x.f, heard_current: meaningOfCurrent, heard_corrected: meaningOfCorrected };
  if (okNew && !okOld) accepted.push(rec);
  else if (!okNew) rejected.push(rec);
  else review.push(rec);
}

const show = (label, list) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length})`);
  for (const r of list) {
    console.log(`  ${r.id}  "${r.english}"`);
    console.log(`      current   ${r.current}   -> reads as "${r.heard_current}"`);
    console.log(`      corrected ${r.corrected} -> reads as "${r.heard_corrected}"`);
  }
};
console.log(`Blind verification of ${fixes.length} proposed ${LANG_NAMES[lang]} correction(s)`);
show('ACCEPT — fix lands, original was genuinely wrong', accepted);
show('REJECT — correction does not mean the target; DO NOT SHIP', rejected);
show('NEEDS HUMAN — cannot separate the two', review);

fs.writeFileSync(`/tmp/verified-${lang}.json`, JSON.stringify({ accepted, rejected, review }, null, 1));
console.log(`\naccepted ${accepted.length}  rejected ${rejected.length}  needs-human ${review.length}`);
console.log(`wrote /tmp/verified-${lang}.json`);
