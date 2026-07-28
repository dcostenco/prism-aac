#!/usr/bin/env node
/**
 * Detect body-part tiles that SOUND identical, not just tiles that ARE identical.
 *
 * Why this exists
 * ---------------
 * tests/body-part-distinctions.test.ts compares translation TEXT, so it is
 * structurally blind to homophones. Japanese proved it: the Foot tile said 足
 * and the Leg tile said あし — two different strings, one spoken word ("ashi").
 * The text test passed happily while the tiles were, to any listener, the same.
 * For a device whose entire output is speech, that is the failure that matters.
 *
 * Method: TTS -> STT round trip
 * -----------------------------
 * Synthesize each tile through a fixed Azure voice, then feed the audio back
 * to Azure speech recognition and compare the TRANSCRIPTS. If the recognizer
 * cannot tell two tiles apart, neither can a caregiver.
 *
 * This measures the thing we actually care about — what a listener hears —
 * rather than a proxy for it. Verified against known cases:
 *
 *   足     -> "芦"        }  identical transcript: genuinely one spoken word
 *   あし    -> "芦"        }
 *   足の裏  -> "芦ノ浦"       distinct
 *   Гърло  -> "Гърло"    }  distinct (see false-positive note below)
 *   Врат   -> "Врат"     }
 *
 * (The recognizer returning 芦 rather than 足 is itself the point: it heard the
 * sound "ashi" and picked some kanji for it. Both inputs produced the same
 * sound, so both produced the same guess.)
 *
 * Two earlier approaches were tried and REJECTED — recorded so nobody
 * reintroduces them:
 *
 *   1. Raw audio length. Useless: Azure pads short utterances, so Bengali "পা"
 *      and "পায়ের পাতা" both returned exactly 82,560 bytes despite being 1 and
 *      5 syllables. This reported 7 collisions, every one false.
 *   2. Voiced duration after trimming silence. Much better, and it correctly
 *      identified 足/あし (382ms vs 379ms) — but duration is only a proxy for
 *      pronunciation. It flagged Bulgarian Гърло (593ms) / Врат (598ms) as a
 *      collision at 0.8% apart when they are plainly different words. Kept
 *      below as a SECONDARY signal only, never as the verdict.
 *
 *   Waveform correlation was also tried: 0.20 for a known homophone vs -0.01
 *   for a control. A real gap, but neural TTS varies prosody run to run, so it
 *   is far too noisy to threshold.
 *
 * Not a unit test: needs network and an Azure key. Run before release.
 *
 *   AZURE_SPEECH_KEY=$(az cognitiveservices account keys list \
 *      -n synalux-speech -g synalux-rg --query key1 -o tsv) \
 *   npm run check:spoken
 *   npm run check:spoken -- --langs=ja,bn --verbose
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REGION = process.env.AZURE_SPEECH_REGION || 'eastus';
const KEY = process.env.AZURE_SPEECH_KEY || '';
if (!KEY) {
  console.error('AZURE_SPEECH_KEY is not set. Local .env files hold empty placeholders');
  console.error('and `vercel env pull` returns [SENSITIVE]; get it from Azure directly:');
  console.error('  az cognitiveservices account keys list -n synalux-speech -g synalux-rg --query key1 -o tsv');
  process.exit(1);
}

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

/**
 * voice / ttsLocale / sttLocale per language.
 *
 * sttLocale is SEPARATE and not always equal to ttsLocale: Azure synthesizes
 * bn-BD but only recognizes bn-IN (bn-BD returns HTTP 400). All 14 locales
 * below were probed and confirmed supported for recognition.
 */
const LANGS = {
  ja: { voice: 'ja-JP-NanamiNeural', tts: 'ja-JP', stt: 'ja-JP' },
  zh: { voice: 'zh-CN-XiaoxiaoNeural', tts: 'zh-CN', stt: 'zh-CN' },
  ko: { voice: 'ko-KR-SunHiNeural', tts: 'ko-KR', stt: 'ko-KR' },
  ru: { voice: 'ru-RU-SvetlanaNeural', tts: 'ru-RU', stt: 'ru-RU' },
  uk: { voice: 'uk-UA-PolinaNeural', tts: 'uk-UA', stt: 'uk-UA' },
  bg: { voice: 'bg-BG-KalinaNeural', tts: 'bg-BG', stt: 'bg-BG' },
  am: { voice: 'am-ET-MekdesNeural', tts: 'am-ET', stt: 'am-ET' },
  sw: { voice: 'sw-TZ-RehemaNeural', tts: 'sw-TZ', stt: 'sw-TZ' },
  bn: { voice: 'bn-BD-NabanitaNeural', tts: 'bn-BD', stt: 'bn-IN' },
  he: { voice: 'he-IL-HilaNeural', tts: 'he-IL', stt: 'he-IL' },
  vi: { voice: 'vi-VN-HoaiMyNeural', tts: 'vi-VN', stt: 'vi-VN' },
  id: { voice: 'id-ID-GadisNeural', tts: 'id-ID', stt: 'id-ID' },
  ro: { voice: 'ro-RO-AlinaNeural', tts: 'ro-RO', stt: 'ro-RO' },
  pl: { voice: 'pl-PL-ZofiaNeural', tts: 'pl-PL', stt: 'pl-PL' },
  de: { voice: 'de-DE-KatjaNeural', tts: 'de-DE', stt: 'de-DE' },
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

// Read the pairs from the contract rather than duplicating them, so this
// script cannot silently drift from what CI enforces.
const contract = fs.readFileSync(path.join(ROOT, 'constants/bodyPartDistinctions.ts'), 'utf-8');
const startIdx = contract.indexOf('CLINICALLY_DISTINCT_PAIRS');
const endIdx = contract.indexOf('UNRESOLVABLE_IN_LANGUAGE');
const distinctBlock = contract.slice(startIdx, endIdx > startIdx ? endIdx : undefined);
const PAIRS = [...distinctBlock.matchAll(/a: '([^']+)',\s*\n\s*b: '([^']+)'/g)].map((m) => [m[1], m[2]]);

// A PARTIAL parse is the dangerous case, not a total one. If the regex misses
// pairs after someone reformats the contract, this would quietly check a
// subset and still print "0 collisions" — manufacturing confidence over tiles
// it never looked at. Cross-check against a count derived a different way and
// refuse to run on any mismatch.
const declaredCount = (distinctBlock.match(/^\s*a: '/gm) ?? []).length;
if (!PAIRS.length || PAIRS.length !== declaredCount) {
  console.error(
    `Refusing to run: parsed ${PAIRS.length} pair(s) but the contract declares ` +
    `${declaredCount}. The pair-matching regex has drifted from ` +
    `constants/bodyPartDistinctions.ts — fix it rather than trusting a partial run.`,
  );
  process.exit(2);
}

let token = null;
let tokenAt = 0;
async function getToken() {
  // Azure STS tokens expire after 10 minutes; a full run exceeds that.
  if (token && Date.now() - tokenAt < 8 * 60 * 1000) return token;
  const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Length': '0' },
  });
  if (!r.ok) throw new Error(`token failed: HTTP ${r.status}`);
  token = await r.text();
  tokenAt = Date.now();
  return token;
}

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 16 kHz PCM WAV, the format the recognizer wants. */
async function synth(text, voice, locale) {
  const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
      'User-Agent': 'prism-aac-spoken-collision-check',
    },
    body: `<speak version='1.0' xml:lang='${locale}'><voice name='${voice}'>${xmlEsc(text)}</voice></speak>`,
  });
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

async function recognize(wav, sttLocale) {
  const r = await fetch(
    `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${sttLocale}&format=simple`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      },
      body: wav,
    },
  );
  if (!r.ok) return { ok: false, reason: `stt http ${r.status}` };
  const j = await r.json();
  if (j.RecognitionStatus !== 'Success') return { ok: false, reason: j.RecognitionStatus };
  return { ok: true, text: j.DisplayText ?? '' };
}

/** Strip punctuation/space/case so "芦。" and "芦" compare equal. */
const norm = (s) => s.normalize('NFKC').replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase();

/** Voiced duration in ms — SECONDARY signal only, never the verdict. */
function voicedMs(wav) {
  let o = 12;
  while (o < wav.length - 8) {
    const id = wav.toString('ascii', o, o + 4);
    const sz = wav.readUInt32LE(o + 4);
    if (id === 'data') {
      const pcm = new Int16Array(wav.buffer, wav.byteOffset + o + 8, Math.floor(sz / 2));
      let s = 0;
      let e = pcm.length - 1;
      while (s < pcm.length && Math.abs(pcm[s]) < 250) s++;
      while (e > s && Math.abs(pcm[e]) < 250) e--;
      return Math.round(Math.max(0, e - s) / 16); // 16 kHz -> ms
    }
    o += 8 + sz + (sz % 2);
  }
  return null;
}

const only = args.get('langs') ? String(args.get('langs')).split(',') : null;
const langs = Object.keys(LANGS).filter((l) => !only || only.includes(l));
const verbose = args.has('verbose');

console.log(`Spoken-collision check (TTS -> STT round trip)`);
console.log(`${langs.length} language(s) x ${PAIRS.length} pairs from CLINICALLY_DISTINCT_PAIRS\n`);

const collisions = [];
const unverified = [];
let checked = 0;

for (const lang of langs) {
  const cfg = LANGS[lang];
  for (const [a, b] of PAIRS) {
    const ta = T[a]?.[lang];
    const tb = T[b]?.[lang];
    if (!ta || !tb) continue;

    if (ta === tb) {
      collisions.push({ lang, a, b, kind: 'textual', heard: ta });
      console.log(`  ${lang} ${a}/${b}: TEXTUAL — both are "${ta}"`);
      continue;
    }

    const [wa, wb] = [await synth(ta, cfg.voice, cfg.tts), await synth(tb, cfg.voice, cfg.tts)];
    if (!wa || !wb) {
      unverified.push({ lang, a, b, reason: 'tts failed' });
      console.log(`  ${lang} ${a}/${b}: UNVERIFIED — synthesis failed`);
      continue;
    }
    const [ra, rb] = [await recognize(wa, cfg.stt), await recognize(wb, cfg.stt)];
    checked++;

    if (!ra.ok || !rb.ok) {
      unverified.push({ lang, a, b, reason: ra.reason || rb.reason });
      console.log(`  ${lang} ${a}/${b}: UNVERIFIED — ${ra.reason || rb.reason}`);
      continue;
    }

    const same = norm(ra.text) === norm(rb.text) && norm(ra.text) !== '';
    if (same) {
      collisions.push({ lang, a, b, kind: 'phonetic', heard: ra.text, said: [ta, tb] });
      console.log(`  ${lang} ${a}/${b}: SOUNDS THE SAME — "${ta}" and "${tb}" both heard as "${ra.text}"`);
    } else if (verbose) {
      const d = `${voicedMs(wa)}ms/${voicedMs(wb)}ms`;
      console.log(`  ${lang} ${a}/${b}: ok — "${ta}"->"${ra.text}"  "${tb}"->"${rb.text}"  (${d})`);
    }
  }
}

console.log(`\nround-tripped ${checked} pairs`);
console.log(`${collisions.length} collision(s), ${unverified.length} unverified`);

if (unverified.length) {
  console.log('\nUNVERIFIED pairs were NOT checked — do not read silence as a pass:');
  for (const u of unverified) console.log(`  ${u.lang} ${u.a}/${u.b} (${u.reason})`);
}
if (collisions.length) {
  console.log('\nA collision means a user cannot tell a caregiver which part hurts.');
  console.log('Fix the translation, or record it in UNRESOLVABLE_IN_LANGUAGE with a reason.');
}

process.exitCode = collisions.length ? 1 : 0;
