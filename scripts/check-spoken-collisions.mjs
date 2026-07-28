#!/usr/bin/env node
/**
 * Detect body-part tiles that SOUND identical, not just tiles that ARE identical.
 *
 * Why this exists
 * ---------------
 * tests/body-part-distinctions.test.ts compares translation TEXT, so it is
 * structurally blind to homophones. Japanese is the proof: the Foot tile says
 * 足 and the Leg tile says あし — two different strings, one spoken word
 * ("ashi"). The text test passes happily while the two tiles are, to any
 * listener, the same. For a device whose entire output is speech, that is the
 * failure mode that matters.
 *
 * Method
 * ------
 * Synthesize both tiles through the SAME Azure voice at a fixed PCM format and
 * compare VOICED duration — the audio with leading/trailing silence trimmed.
 *
 * Trimming is essential and was the bug in the first version of this script.
 * Azure pads short utterances, so raw file length is nearly constant for
 * anything under ~1.7s: Bengali "পা" and "পায়ের পাতা" both returned exactly
 * 82,560 bytes despite being 1 and 5 syllables. Measuring raw length reported
 * every short pair as a collision — 7 false positives in one run.
 *
 * After trimming, the signal is clean and matches linguistic reality:
 *   足 = 382 ms   あし = 379 ms   -> 0.8% apart, genuinely the same word
 *   足の裏 = 736 ms                -> plainly distinct from 足
 *   পা = 206 ms   পায়ের পাতা = 603 ms -> plainly distinct
 *   手 = 137 ms                    -> control
 *
 * Waveform correlation was tried and rejected: neural TTS varies prosody run
 * to run, giving 0.20 for a known homophone vs -0.01 for a control — a real
 * gap, but far too noisy to threshold safely.
 *
 * This is a SCREEN, not a proof. Same duration means "listen to these" — two
 * unrelated words can coincidentally match. It is deliberately tuned to
 * over-report: a false positive costs someone 20 seconds, a false negative
 * ships a device that cannot tell a caregiver which limb is broken.
 *
 * Not a unit test because it needs network and an Azure key. Run before release.
 *
 *   AZURE_SPEECH_KEY=$(az cognitiveservices account keys list \
 *      -n synalux-speech -g synalux-rg --query key1 -o tsv) \
 *   node scripts/check-spoken-collisions.mjs
 *   node scripts/check-spoken-collisions.mjs --langs=ja,zh,ko   # narrow scope
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REGION = process.env.AZURE_SPEECH_REGION || 'eastus';
const KEY = process.env.AZURE_SPEECH_KEY || '';
if (!KEY) {
  console.error('AZURE_SPEECH_KEY is not set. The local .env files hold empty');
  console.error('placeholders and `vercel env pull` returns [SENSITIVE]; get it from Azure:');
  console.error('  az cognitiveservices account keys list -n synalux-speech -g synalux-rg --query key1 -o tsv');
  process.exit(1);
}

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

// One voice per language. Must be a single fixed voice per language or the
// duration comparison is meaningless.
const VOICE = {
  ja: ['ja-JP-NanamiNeural', 'ja-JP'], zh: ['zh-CN-XiaoxiaoNeural', 'zh-CN'],
  ko: ['ko-KR-SunHiNeural', 'ko-KR'], ru: ['ru-RU-SvetlanaNeural', 'ru-RU'],
  uk: ['uk-UA-PolinaNeural', 'uk-UA'], bg: ['bg-BG-KalinaNeural', 'bg-BG'],
  am: ['am-ET-MekdesNeural', 'am-ET'], sw: ['sw-TZ-RehemaNeural', 'sw-TZ'],
  bn: ['bn-BD-NabanitaNeural', 'bn-BD'], he: ['he-IL-HilaNeural', 'he-IL'],
  vi: ['vi-VN-HoaiMyNeural', 'vi-VN'], id: ['id-ID-GadisNeural', 'id-ID'],
  ro: ['ro-RO-AlinaNeural', 'ro-RO'], pl: ['pl-PL-ZofiaNeural', 'pl-PL'],
  de: ['de-DE-KatjaNeural', 'de-DE'],
};

const RE_ENTRY = /^\s*'([^']+)':\s*\{(.*)\}\s*,?\s*$/gm;
const RE_LANG = /(?:^|[,{])\s*'?([a-zA-Z-]{2,7})'?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const unesc = (s) => s.replace(/\\(['"\\])/g, '$1');

const T = {};
for (const m of fs.readFileSync(path.join(ROOT, 'constants/phraseTranslations.ts'), 'utf-8').matchAll(RE_ENTRY)) {
  const L = {};
  for (const lm of m[2].matchAll(RE_LANG)) L[lm[1]] = unesc(lm[2] ?? lm[3]);
  T[m[1]] = L;
}

// Kept in sync with constants/bodyPartDistinctions.ts by the check below.
const PAIRS = [
  ['hb-hand', 'hb-arm'], ['hbp-hand', 'hbp-arm'], ['hb-foot', 'hbp-leg'],
  ['hb-mouth', 'hb-lips'], ['hb-throat', 'hb-neck'],
  ['hb-finger', 'hb-toe'], ['hb-ankle', 'hb-heel'],
];
{
  const src = fs.readFileSync(path.join(ROOT, 'constants/bodyPartDistinctions.ts'), 'utf-8');
  const declared = [...src.matchAll(/a: '([^']+)',\s*\n\s*b: '([^']+)'/g)].map((m) => `${m[1]}|${m[2]}`);
  const missing = PAIRS.map((p) => p.join('|')).filter((p) => !declared.includes(p));
  if (missing.length) {
    console.warn(`WARNING: pairs not found in bodyPartDistinctions.ts: ${missing.join(', ')}`);
    console.warn('This script has drifted from the contract — reconcile before trusting the result.\n');
  }
}

let token = null;
async function getToken() {
  if (token) return token;
  const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Length': '0' },
  });
  if (!r.ok) throw new Error(`token failed: HTTP ${r.status}`);
  token = await r.text();
  return token;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Amplitude below which a sample counts as silence. 250/32768 ≈ -42 dBFS:
// comfortably above the neural vocoder's noise floor, below any real speech.
const SILENCE_THRESHOLD = 250;

/** Voiced duration in ms (silence trimmed), or null if synthesis failed. */
async function durationSamples(text, voice, locale) {
  const ssml = `<speak version='1.0' xml:lang='${locale}'><voice name='${voice}'>${esc(text)}</voice></speak>`;
  const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
      'User-Agent': 'prism-aac-spoken-collision-check',
    },
    body: ssml,
  });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  let o = 12;
  while (o < buf.length - 8) {
    const id = buf.toString('ascii', o, o + 4);
    const sz = buf.readUInt32LE(o + 4);
    if (id === 'data') {
      const pcm = new Int16Array(buf.buffer, buf.byteOffset + o + 8, Math.floor(sz / 2));
      let s = 0;
      let e = pcm.length - 1;
      while (s < pcm.length && Math.abs(pcm[s]) < SILENCE_THRESHOLD) s++;
      while (e > s && Math.abs(pcm[e]) < SILENCE_THRESHOLD) e--;
      return Math.round(Math.max(0, e - s) / 24); // 24 kHz -> ms
    }
    o += 8 + sz + (sz % 2);
  }
  return null;
}

const only = args.get('langs') ? String(args.get('langs')).split(',') : null;
const langs = Object.keys(VOICE).filter((l) => !only || only.includes(l));

console.log(`Spoken-collision screen — ${langs.length} language(s), ${PAIRS.length} pairs\n`);
const findings = [];
let checked = 0;

for (const lang of langs) {
  const [voice, locale] = VOICE[lang];
  for (const [a, b] of PAIRS) {
    const ta = T[a]?.[lang];
    const tb = T[b]?.[lang];
    if (!ta || !tb) continue;
    if (ta === tb) {
      findings.push({ lang, a, b, ta, tb, kind: 'textual' });
      console.log(`  ${lang} ${a}/${b}: TEXTUAL collision — both "${ta}"`);
      continue;
    }
    const [da, db] = [await durationSamples(ta, voice, locale), await durationSamples(tb, voice, locale)];
    checked++;
    if (da == null || db == null) {
      console.log(`  ${lang} ${a}/${b}: synthesis failed, skipped`);
      continue;
    }
    // Relative tolerance: two renderings of the SAME word land within a few
    // percent (足/あし measured 382 vs 379 ms = 0.8%). Distinct words are far
    // apart. 5% is set above the observed same-word noise and well below the
    // smallest genuine difference seen.
    const rel = Math.abs(da - db) / Math.max(da, db);
    if (rel < 0.05) {
      findings.push({ lang, a, b, ta, tb, kind: 'phonetic', ms: [da, db] });
      console.log(`  ${lang} ${a}/${b}: SOUND-ALIKE — "${ta}" (${da}ms) vs "${tb}" (${db}ms), ${(rel * 100).toFixed(1)}% apart`);
    } else if (args.has('verbose')) {
      console.log(`  ${lang} ${a}/${b}: ok — ${da}ms vs ${db}ms (${(rel * 100).toFixed(0)}% apart)`);
    }
  }
}

console.log(`\nsynthesized ${checked} pairs`);
const textual = findings.filter((f) => f.kind === 'textual').length;
const phonetic = findings.filter((f) => f.kind === 'phonetic').length;
console.log(`${textual} textual collision(s), ${phonetic} suspected sound-alike(s)`);
if (phonetic) {
  console.log('\nSuspected sound-alikes need a human to LISTEN. Equal duration is a');
  console.log('screen, not proof — but on an AAC device a false negative means a user');
  console.log('cannot tell a caregiver which limb is hurt.');
}
process.exitCode = findings.length ? 1 : 0;
