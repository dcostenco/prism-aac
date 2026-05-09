/**
 * TTS diagnostic against synalux.ai/prism-aac (production proxy).
 * Tests the actual user environment: same-origin TTS calls, CSP, proxy chain.
 *
 * Run: node scripts/tts-synalux-diag.mjs
 */
import { chromium } from '@playwright/test';

const TARGET = process.env.URL || 'https://synalux.ai/prism-aac';

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: [],
  // Full network capture
  recordVideo: undefined,
});
const page = await ctx.newPage();

const allConsole = [];
const errors = [];
page.on('console', (m) => allConsole.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => { errors.push(e.message); allConsole.push(`[pageerror] ${e.message}`); });

// Capture ALL network requests (not just TTS) so we see the full picture.
const requests = [];
page.on('request',  (r) => requests.push({ url: r.url(), method: r.method() }));
page.on('response', async (r) => {
  const entry = requests.find(x => x.url === r.url() && !x.status);
  if (entry) {
    entry.status = r.status();
    if (r.url().includes('/tts/')) {
      try { entry.bodyBytes = (await r.body()).length; } catch { entry.bodyBytes = -1; }
    }
  }
});

// Deep AudioContext + Gain spy.
await page.addInitScript(() => {
  const w = window;
  const state = {
    sourceStartCount: 0,
    sourceEndedCount: 0,
    onendedTooSoon: false,
    lastCtxState: null,
    lastGainValue: null,
    resumeCallCount: 0,
    resumeErrors: [],
    decodeCount: 0,
    decodeErrors: [],
    playLog: [],
  };

  const OrigCtor = w.AudioContext || w.webkitAudioContext;
  if (OrigCtor) {
    const Wrapped = function (...args) {
      const c = new OrigCtor(...args);

      // Spy resume
      const origResume = c.resume.bind(c);
      c.resume = async function () {
        state.resumeCallCount++;
        try { await origResume(); state.playLog.push(`resume ok state=${c.state}`); }
        catch (e) { state.resumeErrors.push(e.message); state.playLog.push(`resume ERR ${e.message}`); }
      };

      // Spy decodeAudioData
      const origDecode = c.decodeAudioData.bind(c);
      c.decodeAudioData = function (buf, ok, err) {
        state.decodeCount++;
        return origDecode(buf,
          (decoded) => { state.playLog.push(`decode ok duration=${decoded?.duration?.toFixed(2)}s`); ok?.(decoded); },
          (e) => { state.decodeErrors.push(e?.message); state.playLog.push(`decode ERR ${e?.message}`); err?.(e); }
        );
      };

      // Spy createBufferSource → source.start
      const origCreateSource = c.createBufferSource.bind(c);
      c.createBufferSource = function () {
        const src = origCreateSource();
        const origStart = src.start.bind(src);
        let t0 = 0;
        src.start = function (...a) {
          state.sourceStartCount++;
          state.lastCtxState = c.state;
          t0 = Date.now();
          state.playLog.push(`source.start ctxState=${c.state}`);
          src.onended = function () {
            const dur = Date.now() - t0;
            state.sourceEndedCount++;
            if (dur < 80) state.onendedTooSoon = true;
            state.playLog.push(`source.ended after ${dur}ms`);
          };
          return origStart(...a);
        };
        return src;
      };

      // Spy createGain
      const origCreateGain = c.createGain.bind(c);
      c.createGain = function () {
        const g = origCreateGain();
        const origConnect = g.connect.bind(g);
        g.connect = function (dst) { state.lastGainValue = g.gain.value; return origConnect(dst); };
        return g;
      };

      return c;
    };
    Wrapped.prototype = OrigCtor.prototype;
    w.AudioContext = Wrapped;
    if (w.webkitAudioContext) w.webkitAudioContext = Wrapped;
  }
  w.__ttsState = () => state;
});

console.log(`\n[diag] TARGET: ${TARGET}`);
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
console.log('[diag] page loaded');
await page.waitForTimeout(1500);

// Type "hello"
for (const ch of 'HELLO') {
  await page.locator(`button[data-key="${ch}"]`).click({ delay: 40 });
}
await page.waitForTimeout(500);

// Speak
const speakBtn = page.locator('button.aac-speak').first();
await speakBtn.click();
console.log('[diag] Speak clicked');

// Wait long enough for full TTS round-trip + audio to complete
await page.waitForTimeout(8_000);

const s = await page.evaluate(() => window.__ttsState());
const ttsReqs = requests.filter(r => r.url.includes('/tts/'));
const allErrors = requests.filter(r => r.status >= 400);

console.log('\n=== AUDIO STATE ===');
console.log(JSON.stringify(s, null, 2));

console.log('\n=== TTS REQUESTS ===');
for (const r of ttsReqs) {
  console.log(`  ${r.method} ${r.status ?? '???'} ${r.url}  bytes=${r.bodyBytes ?? '-'}`);
}

console.log('\n=== ALL 4xx/5xx ===');
for (const r of allErrors) {
  console.log(`  ${r.status} ${r.url}`);
}

console.log('\n=== TTS CONSOLE ===');
for (const l of allConsole) {
  if (/TTS|Azure|Inworld|Gemini|Kokoro|speech|Audio|tts|sound/i.test(l)) console.log(l);
}

console.log('\n=== ERRORS ===');
for (const l of allConsole.filter(l => /\[error\]|\[pageerror\]/.test(l))) {
  console.log(l);
}

await browser.close();
