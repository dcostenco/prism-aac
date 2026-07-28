#!/usr/bin/env node
/**
 * Multi-signal audit of the core + safety vocabulary.
 *
 * The problem this addresses
 * -------------------------
 * No native speaker is available for Amharic, Swahili or Bengali, and 4,536
 * machine-translated strings cannot be made trustworthy by any amount of
 * checking. But the AAC evidence base — including the Universal Core 36 this
 * repo already cites — says a small core carries most real communication. So
 * the tractable goal is not "verify everything", it is "verify the 43% that
 * users actually speak with, and be honest about the rest".
 *
 * Signals, deliberately from independent sources so this is not one model
 * grading its own output:
 *
 *   1. BACK-TRANSLATION (Gemini)     — cheap, batched. Used to TRIAGE.
 *   2. ASR ROUND-TRIP (Microsoft)    — different vendor entirely. Synthesize
 *      the string, feed the audio back to speech recognition, and see whether
 *      a listener hears the same words. Catches the class where a string is
 *      correct on paper but heard as a different real word — টাখনু heard as
 *      তখনও ("even then"), አቁም heard as አልኩ ("I said").
 *   3. WIKTIONARY (human-curated)    — vendor-neutral, but partial: measured
 *      ~50% coverage for single Amharic/Swahili words and near zero for
 *      Bengali script, so it can corroborate but never adjudicate alone.
 *
 * Triage order matters for cost: signal 1 runs over everything (~25 batched
 * requests), signals 2 and 3 run only on what signal 1 flags. Round-tripping
 * all 1,956 strings would be ~3,900 requests and several hours.
 *
 * A string is reported only when at least TWO signals agree it is wrong, or
 * when back-translation calls it outright meaningless.
 *
 *   GEMINI_API_KEY=... AZURE_SPEECH_KEY=... node scripts/audit-core-vocabulary.mjs --lang=am
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GKEY = process.env.GEMINI_API_KEY || '';
const AKEY = process.env.AZURE_SPEECH_KEY || '';
const REGION = process.env.AZURE_SPEECH_REGION || 'eastus';
if (!GKEY) { console.error('GEMINI_API_KEY is required'); process.exit(1); }

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const LANGS = {
  am: { name: 'Amharic', voice: 'am-ET-MekdesNeural', tts: 'am-ET', stt: 'am-ET', wik: 'am' },
  sw: { name: 'Swahili', voice: 'sw-TZ-RehemaNeural', tts: 'sw-TZ', stt: 'sw-TZ', wik: 'sw' },
  bn: { name: 'Bengali', voice: 'bn-BD-NabanitaNeural', tts: 'bn-BD', stt: 'bn-IN', wik: 'bn' },
};
const lang = String(args.get('lang') || '');
if (!LANGS[lang]) { console.error('--lang must be am | sw | bn'); process.exit(1); }
const cfg = LANGS[lang];
const LIMIT = Number(args.get('limit')) || Infinity;

// ── the vocabulary under audit: core set + safety set ────────────────────────
const CORE_CATEGORIES = ['core-pronouns', 'core-verbs', 'core-descriptors',
  'core-little-words', 'help-needs', 'quick-talk', 'feelings', 'questions'];
const unesc = (s) => s.replace(/\\(['"\\])/g, '$1');

const phraseSrc = fs.readFileSync(path.join(ROOT, 'constants/phrases.ts'), 'utf-8');
const PHRASES = [...phraseSrc.matchAll(/^\s*p\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/gm)]
  .map((m) => ({ id: m[1], cat: m[2], en: unesc(m[3] ?? m[4]) }));

const RE_ENTRY = /^\s*'([^']+)':\s*\{(.*)\}\s*,?\s*$/gm;
const RE_LANG = /(?:^|[,{])\s*'?([a-zA-Z-]{2,7})'?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const T = {};
for (const m of fs.readFileSync(path.join(ROOT, 'constants/phraseTranslations.ts'), 'utf-8').matchAll(RE_ENTRY)) {
  const L = {};
  for (const lm of m[2].matchAll(RE_LANG)) L[lm[1]] = unesc(lm[2] ?? lm[3]);
  T[m[1]] = L;
}

const SAFETY = /^(help-|hb-|hbp-|fe-)/;
const items = PHRASES
  .filter((p) => CORE_CATEGORIES.includes(p.cat) || SAFETY.test(p.id))
  .filter((p) => typeof T[p.id]?.[lang] === 'string' && T[p.id][lang] !== '')
  .map((p) => ({ ...p, cur: T[p.id][lang] }))
  .slice(0, LIMIT);

console.log(`Auditing ${items.length} ${cfg.name} strings (core + safety vocabulary)\n`);

// ── signal 1: back-translation, batched ──────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gemini(prompt) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GKEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 65536, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'minimal' } },
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return JSON.parse((await r.json()).candidates[0].content.parts[0].text);
    } catch (e) { if (i === 3) throw e; await sleep(2 ** i * 1000); }
  }
}

const BATCH = 60;
const heard = new Map();
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  process.stdout.write(`  back-translating ${i + 1}-${i + batch.length}… `);
  const prompt = `Translate each numbered ${cfg.name} phrase into plain English, literally.

Rules:
- Translate ONLY what is written. Do not repair, guess intent, or be charitable.
- If it is not meaningful ${cfg.name}, answer exactly "MEANINGLESS".
- Under 8 words each.

Return ONLY JSON: {"1":"...","2":"..."}

${batch.map((x, n) => `${n + 1}. ${x.cur}`).join('\n')}`;
  const out = await gemini(prompt);
  batch.forEach((x, n) => heard.set(x.id, String(out[String(n + 1)] ?? '').trim()));
  console.log('ok');
}

// ── triage ───────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const STOP = new Set(['i','am','is','a','the','my','me','to','it','you','do','not','have','feel','please','can','want']);
function overlaps(got, want) {
  const g = norm(got), w = norm(want);
  if (!g || g === 'meaningless') return false;
  if (g === w || g.includes(w) || w.includes(g)) return true;
  const tw = w.split(' ').filter((x) => x.length > 2 && !STOP.has(x));
  if (!tw.length) return true;
  return tw.filter((x) => g.includes(x.slice(0, Math.max(4, x.length - 2)))).length / tw.length >= 0.5;
}

const meaningless = items.filter((x) => norm(heard.get(x.id)) === 'meaningless');
const mismatched = items.filter((x) => norm(heard.get(x.id)) !== 'meaningless' && !overlaps(heard.get(x.id), x.en));
console.log(`\ntriage: ${meaningless.length} meaningless, ${mismatched.length} possible mismatch, ${items.length - meaningless.length - mismatched.length} look fine`);

// ── signal 2: ASR round-trip (only on flagged) ───────────────────────────────
let token = null, tokenAt = 0;
async function azureToken() {
  if (!AKEY) return null;
  if (token && Date.now() - tokenAt < 8 * 60 * 1000) return token;
  const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': AKEY, 'Content-Length': '0' },
  });
  if (!r.ok) return null;
  token = await r.text(); tokenAt = Date.now(); return token;
}
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function roundTrip(text) {
  const tk = await azureToken();
  if (!tk) return null;
  const synth = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm', 'User-Agent': 'prism-aac-audit' },
    body: `<speak version='1.0' xml:lang='${cfg.tts}'><voice name='${cfg.voice}'>${xml(text)}</voice></speak>`,
  });
  if (!synth.ok) return null;
  const wav = Buffer.from(await synth.arrayBuffer());
  const rec = await fetch(`https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${cfg.stt}&format=simple`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AKEY, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000' },
    body: wav,
  });
  if (!rec.ok) return null;
  const j = await rec.json();
  return j.RecognitionStatus === 'Success' ? (j.DisplayText ?? '') : null;
}

// ── signal 3: Wiktionary (single words only) ─────────────────────────────────

/**
 * Strip HTML from a Wiktionary definition.
 *
 * A single `replace(/<[^>]+>/g, '')` is NOT sufficient and CodeQL is right to
 * flag it: an unterminated `<script` has no closing bracket so the pattern
 * never matches it, and nesting like `<<b>script>` reassembles into a tag once
 * the inner one is removed. Loop until the output stops changing, then drop
 * any surviving angle brackets — whatever is left cannot be well-formed markup
 * and has no business in a console report.
 */
function stripTags(html) {
  let out = String(html);
  let prev;
  do { prev = out; out = out.replace(/<[^>]*>/g, ''); } while (out !== prev);
  return out.replace(/[<>]/g, '');
}

async function wiktionary(word) {
  if (/\s/.test(word)) return null;
  try {
    const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
    if (!r.ok) return null;
    const j = await r.json();
    const sec = j[cfg.wik];
    if (!sec?.length) return null;
    return stripTags(String(sec[0].definitions?.[0]?.definition ?? '')).slice(0, 70);
  } catch { return null; }
}

const flagged = [...meaningless, ...mismatched];
console.log(`\nconfirming ${flagged.length} flagged strings with independent signals…\n`);
const confirmed = [];
for (const x of flagged) {
  const [rt, wk] = [await roundTrip(x.cur), await wiktionary(x.cur)];
  const strip = (s) => norm(s).replace(/[።۔]/g, '');
  const asrAgrees = rt === null ? null : strip(rt) === strip(x.cur);
  const wikAgrees = wk === null ? null : overlaps(wk, x.en);
  const votes = [
    norm(heard.get(x.id)) === 'meaningless' || !overlaps(heard.get(x.id), x.en),
    asrAgrees === false,
    wikAgrees === false,
  ].filter((v) => v === true).length;
  const known = 1 + (asrAgrees !== null ? 1 : 0) + (wikAgrees !== null ? 1 : 0);
  if (votes >= 2 || norm(heard.get(x.id)) === 'meaningless') {
    confirmed.push({ ...x, heard: heard.get(x.id), asr: rt, wiktionary: wk, votes, signals: known });
    console.log(`  ${x.id}  "${x.en}"`);
    console.log(`      says "${x.cur}"  reads as "${heard.get(x.id)}"`);
    if (rt !== null) console.log(`      heard by ASR as "${rt}"${asrAgrees ? '' : '  <-- differs'}`);
    if (wk !== null) console.log(`      wiktionary: ${wk}`);
  }
}

fs.writeFileSync(`/tmp/audit-${lang}.json`, JSON.stringify(confirmed, null, 1));
console.log(`\n${confirmed.length} confirmed problem(s) of ${items.length} audited`);
console.log(`wrote /tmp/audit-${lang}.json`);
