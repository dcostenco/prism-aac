/**
 * Live TTS diagnostic — opens prism-aac on the production deploy,
 * captures every console line + every fetch to synalux.ai, taps the
 * Speak button, and reports whether audio actually reaches the
 * Web Audio destination. No mocks; this is L4 evidence.
 *
 * Run: node /tmp/tts-live-diag.mjs
 */
import { chromium } from '@playwright/test';

const URL = 'https://prism-aac.vercel.app/prism-aac';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: [],
});
const page = await ctx.newPage();

const consoleLines = [];
page.on('console', (msg) => {
  consoleLines.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));

const ttsRequests = [];
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/tts/') || u.includes('/chat')) {
    ttsRequests.push({ url: u, method: r.method() });
  }
});
page.on('response', async (r) => {
  const u = r.url();
  if (u.includes('/tts/') || u.includes('/chat')) {
    const idx = ttsRequests.findIndex((x) => x.url === u && !x.status);
    if (idx >= 0) ttsRequests[idx].status = r.status();
  }
});

// Spy on AudioContext / source.start to see if BufferSourceNode actually starts.
await page.addInitScript(() => {
  const w = window;
  let sourceStartCount = 0;
  let lastGainValue = null;
  let lastCtxState = null;
  let onendedFireTooSoon = false;

  const OrigCtor = w.AudioContext || w.webkitAudioContext;
  if (OrigCtor) {
    const Wrapped = function (...args) {
      const ctx = new OrigCtor(...args);
      const origCreateSource = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = function () {
        const src = origCreateSource();
        const origStart = src.start.bind(src);
        let startedAt = 0;
        src.start = function (...a) {
          sourceStartCount++;
          startedAt = Date.now();
          lastCtxState = ctx.state;
          // Hook onended to detect premature termination.
          const prevOn = src.onended;
          src.onended = function () {
            const elapsed = Date.now() - startedAt;
            if (elapsed < 50) onendedFireTooSoon = true;
            if (prevOn) prevOn();
          };
          return origStart(...a);
        };
        return src;
      };
      const origCreateGain = ctx.createGain.bind(ctx);
      ctx.createGain = function () {
        const g = origCreateGain();
        const origConnect = g.connect.bind(g);
        g.connect = function (dst) {
          lastGainValue = g.gain.value;
          return origConnect(dst);
        };
        return g;
      };
      return ctx;
    };
    Wrapped.prototype = OrigCtor.prototype;
    w.AudioContext = Wrapped;
    if (w.webkitAudioContext) w.webkitAudioContext = Wrapped;
  }

  w.__ttsDiag = () => ({ sourceStartCount, lastGainValue, lastCtxState, onendedFireTooSoon });
});

console.log('navigating to', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
await page.waitForTimeout(2000);

// Type "hello" via QWERTY data-key buttons.
console.log('typing "hello"...');
for (const ch of 'HELLO') {
  await page.locator(`button[data-key="${ch}"]`).click({ delay: 30 });
}
await page.waitForTimeout(500);

// Tap the Speak button.
console.log('tapping Speak...');
const speak = page.locator('button.aac-speak').first();
await speak.click({ delay: 50 });

// Give TTS time: fetch + decode + start.
await page.waitForTimeout(4500);

const diag = await page.evaluate(() => (window).__ttsDiag());
console.log('\n=== DIAG ===');
console.log(JSON.stringify(diag, null, 2));
console.log('\n=== TTS NETWORK REQUESTS ===');
for (const r of ttsRequests) console.log(`${r.method} ${r.status ?? '???'} ${r.url}`);
console.log('\n=== CONSOLE (TTS-related only) ===');
for (const l of consoleLines) {
  if (/TTS|Azure|Inworld|Gemini|Kokoro|speech|AudioContext/i.test(l)) console.log(l);
}
console.log('\n=== CONSOLE ERRORS ===');
for (const l of consoleLines) {
  if (/^\[(error|pageerror)\]/.test(l)) console.log(l);
}

await browser.close();
