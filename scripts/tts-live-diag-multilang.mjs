/**
 * Multi-language TTS diagnostic — verifies that switching language in
 * Settings produces correctly-routed SSML (xml:lang, voice) and that
 * the rate stays sane across languages (no chipmunk regression).
 *
 * Tests English, Romanian, Spanish, French in WebKit (the user's actual
 * browser engine).
 *
 * Strategy: seed `prism-aac-settings` in localStorage before each page
 * load with the desired { language, outputLanguage }. This bypasses the
 * UI flag picker entirely — TTS reads `outputLanguage`, which is what
 * we need to vary per test.
 */
import { webkit } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const LANGS = [
  { code: 'en', native: 'English',  expectLang: /^en/, phrase: 'HELLO' },
  { code: 'ro', native: 'Română',   expectLang: /^ro/, phrase: 'BUNA' },
  { code: 'es', native: 'Español',  expectLang: /^es/, phrase: 'HOLA' },
  { code: 'fr', native: 'Français', expectLang: /^fr/, phrase: 'BONJOUR' },
];

const browser = await webkit.launch({ headless: true });
const results = [];

for (const L of LANGS) {
  console.log(`\n=== ${L.native} (${L.code}) ===`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Seed settings BEFORE the app boots. The persist middleware reads
  // localStorage on hydration, so the store starts with our values.
  // Schema: { state: { language, outputLanguage, ... }, version }
  await page.addInitScript((langCode) => {
    const seed = {
      state: {
        language: langCode,
        outputLanguage: langCode,
        speechRate: 1,
        speechVolume: 1,
      },
      version: 4,
    };
    try { localStorage.setItem('prism-aac-settings', JSON.stringify(seed)); } catch {}
  }, L.code);

  const captured = [];
  page.on('request', async (r) => {
    if (r.url().includes('/tts/public') && r.method() === 'POST') {
      try { captured.push(JSON.parse(r.postData() || '{}')); } catch {}
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
  await page.waitForTimeout(800);

  // Type the phrase. Some chars (Ă, Ñ, Ç) are not on the standard
  // QWERTY keyboard — strip to ASCII before clicking.
  const ascii = L.phrase.toUpperCase().replace(/[^A-Z]/g, '');
  for (const ch of ascii) {
    try { await page.locator(`button[data-key="${ch}"]`).first().click({ delay: 30 }); }
    catch {}
  }
  await page.waitForTimeout(200);

  // Tap Speak
  await page.locator('button.aac-speak').first().click({ delay: 50 });
  await page.waitForTimeout(3500);

  console.log(`  posted ${captured.length} TTS request(s)`);
  for (const body of captured) {
    const ssml = body?.ssml || '';
    const xmlLang = ssml.match(/xml:lang="([^"]+)"/)?.[1] || '';
    const rate = ssml.match(/rate="([^"]+)"/)?.[1] || '';
    const voice = body?.voiceId || body?.voice || '';
    const text = ssml.match(/<prosody[^>]*>([^<]+)</)?.[1]?.trim() || '';
    console.log(`  xml:lang=${xmlLang} rate=${rate} voice=${voice} text="${text}"`);
    results.push({ lang: L.code, xmlLang, rate, voice, text, body });
  }

  await ctx.close();
}

await browser.close();

console.log('\n=== Verifying server-side audio (curl + afinfo) ===');
const seen = new Set();
for (const r of results) {
  if (!r.body?.ssml) continue;
  const key = `${r.lang}-${r.text.slice(0, 12)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const tmp = `/tmp/multilang-${r.lang}.mp3`;
  try {
    execSync(
      `curl -s -o ${tmp} -X POST 'https://synalux.ai/api/v1/tts/public' ` +
      `-H 'Origin: https://prism-aac.vercel.app' -H 'Content-Type: application/json' ` +
      `--data-raw ${JSON.stringify(JSON.stringify(r.body))}`,
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const info = execSync(`afinfo ${tmp} 2>&1 || true`).toString();
    const dur = info.match(/estimated duration:\s*([\d.]+)/)?.[1] || '?';
    const bytes = info.match(/audio bytes:\s*(\d+)/)?.[1] || '?';
    console.log(`  ${r.lang} (${r.xmlLang}) rate=${r.rate} → ${dur}s, ${bytes} bytes  [${tmp}]`);
  } catch (e) {
    console.log(`  ${r.lang} curl/afinfo failed: ${String(e.message).slice(0, 80)}`);
  }
}

console.log('\n=== VERDICT ===');
const byLang = {};
for (const r of results) (byLang[r.lang] ||= []).push(r);
for (const L of LANGS) {
  const rs = byLang[L.code] || [];
  if (rs.length === 0) { console.log(`  ${L.code} ${L.native}: ❌ no SSML captured`); continue; }
  const r = rs[0];
  const langOk = L.expectLang.test(r.xmlLang);
  const rateNum = parseFloat(r.rate);
  const rateOk = rateNum >= 0.5 && rateNum <= 1.5;
  console.log(
    `  ${L.code} ${L.native}: xml:lang=${r.xmlLang} ${langOk ? '✅' : '❌ wrong lang'}  ` +
    `rate=${r.rate} ${rateOk ? '✅' : '⚠️ outside [0.5, 1.5]'}  voice=${r.voice}`,
  );
}

fs.writeFileSync('/tmp/multilang-results.json', JSON.stringify(results, null, 2));
console.log('\nfull results: /tmp/multilang-results.json');
