/**
 * WebKit-engine (Safari) live diagnostic — reproduces the user's
 * actual browser, not headless Chromium. Captures whether
 * BufferSource.start() actually plays audio or queues silently into
 * a suspended AudioContext.
 */
import { webkit } from '@playwright/test';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleLines = [];
page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));

await page.addInitScript(() => {
  const w = window;
  let sourceStartCount = 0;
  let lastGainValue = null;
  let stateAtStart = null;
  let stateAfterStart = null;
  let onendedAtMs = null;
  let startAtMs = null;
  const OrigCtor = w.AudioContext || w.webkitAudioContext;
  if (OrigCtor) {
    const Wrapped = function (...args) {
      const c = new OrigCtor(...args);
      w.__lastCtx = c;
      const origCreateSource = c.createBufferSource.bind(c);
      c.createBufferSource = function () {
        const src = origCreateSource();
        const origStart = src.start.bind(src);
        src.start = function (...a) {
          sourceStartCount++;
          stateAtStart = c.state;
          startAtMs = Date.now();
          const prevOn = src.onended;
          src.onended = function () {
            onendedAtMs = Date.now();
            stateAfterStart = c.state;
            if (prevOn) prevOn();
          };
          return origStart(...a);
        };
        return src;
      };
      const origCreateGain = c.createGain.bind(c);
      c.createGain = function () {
        const g = origCreateGain();
        const origConnect = g.connect.bind(g);
        g.connect = function (dst) { lastGainValue = g.gain.value; return origConnect(dst); };
        return g;
      };
      return c;
    };
    Wrapped.prototype = OrigCtor.prototype;
    w.AudioContext = Wrapped;
    if (w.webkitAudioContext) w.webkitAudioContext = Wrapped;
  }
  w.__diag = () => ({
    sourceStartCount, lastGainValue, stateAtStart, stateAfterStart,
    startAtMs, onendedAtMs, ctxStateNow: w.__lastCtx?.state,
  });
});

console.log('[webkit] navigating to', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
await page.waitForTimeout(1000);

console.log('[webkit] typing "HI"...');
for (const ch of 'HI') await page.locator(`button[data-key="${ch}"]`).click({ delay: 30 });
await page.waitForTimeout(300);

console.log('[webkit] tapping Speak...');
await page.locator('button.aac-speak').first().click({ delay: 50 });
await page.waitForTimeout(5000);

const diag = await page.evaluate(() => (window).__diag());
console.log('\n=== WEBKIT DIAG ===');
console.log(JSON.stringify(diag, null, 2));
console.log('\n=== TTS console ===');
for (const l of consoleLines) {
  if (/TTS|AudioContext|Azure|Web Speech|warmup|stuck/i.test(l)) console.log(l);
}

console.log('\n=== VERDICT ===');
if (diag.stateAtStart === 'suspended') {
  console.log('🎯 REPRODUCED: BufferSource.start() called with ctx.state=' + diag.stateAtStart);
  console.log('   → Web Audio queues silently, nothing audible.');
  console.log('   → My fix gates source.start on ctx.state === running and falls to Web Speech.');
} else if (diag.stateAtStart === 'running') {
  console.log('Source started with ctx.state=running — should produce audible audio.');
  if (diag.onendedAtMs && diag.startAtMs) {
    const elapsed = diag.onendedAtMs - diag.startAtMs;
    console.log(`   onended fired ${elapsed} ms after start.`);
    if (elapsed < 100) console.log('   ⚠️  Premature onended — peer-race kill?');
  }
} else {
  console.log('source.start was never called. Different failure path.');
}

await browser.close();
