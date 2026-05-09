/**
 * Live TTS diagnostic — IDLE path.
 *
 * Tests the failure mode the user actually hits: load page, make
 * a brief gesture (the page-load warmup arms), THEN sit idle for
 * 30 s so the browser auto-suspends the AudioContext, then tap
 * Speak. With `{ once: true }` the page-load warmup can't re-fire
 * — so audio is silent. With the f4ef65f fix the warmup re-arms
 * on every gesture, so the click that taps Speak ALSO warms the
 * context synchronously.
 */
import { chromium } from '@playwright/test';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleLines = [];
page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));

await page.addInitScript(() => {
  const w = window;
  let sourceStartCount = 0;
  let lastGainValue = null;
  let lastCtxState = null;
  let resumeCallCount = 0;
  const OrigCtor = w.AudioContext || w.webkitAudioContext;
  if (OrigCtor) {
    const Wrapped = function (...args) {
      const c = new OrigCtor(...args);
      const origResume = c.resume.bind(c);
      c.resume = function () { resumeCallCount++; return origResume(); };
      const origCreateSource = c.createBufferSource.bind(c);
      c.createBufferSource = function () {
        const src = origCreateSource();
        const origStart = src.start.bind(src);
        src.start = function (...a) { sourceStartCount++; lastCtxState = c.state; return origStart(...a); };
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
  w.__diag = () => ({ sourceStartCount, lastGainValue, lastCtxState, resumeCallCount });
  w.__forceSuspend = async () => {
    // Find the singleton AudioContext via any source the app already created.
    // The app's getAudioContext() lazy-creates on first speak; we'll trigger
    // a synthetic suspend by closing & reopening — actually just expose a
    // way to read the current ctx by hooking createBufferSource.
    const ctx = w.__lastCtx;
    if (ctx && ctx.state === 'running') await ctx.suspend();
  };
});

await page.addInitScript(() => {
  // Stash the most recent AudioContext so we can suspend it later.
  const w = window;
  const OrigWrapped = w.AudioContext;
  w.AudioContext = function (...args) {
    const c = new OrigWrapped(...args);
    w.__lastCtx = c;
    return c;
  };
  if (w.webkitAudioContext) w.webkitAudioContext = w.AudioContext;
});

console.log('navigating to', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });

// First gesture — types HELLO so page-load warmup fires.
console.log('first gesture: typing HELLO (should arm warmup)...');
for (const ch of 'HELLO') await page.locator(`button[data-key="${ch}"]`).click({ delay: 30 });
await page.waitForTimeout(1000);

// Force-suspend the AudioContext to simulate browser auto-suspend.
console.log('force-suspending AudioContext to simulate idle...');
await page.evaluate(async () => { await (window).__forceSuspend?.(); });
const beforeSpeak = await page.evaluate(() => (window).__diag());
const ctxStateBeforeSpeak = await page.evaluate(() => (window).__lastCtx?.state);
console.log('before Speak:', { ...beforeSpeak, ctxStateBeforeSpeak });

// Tap Speak. With f4ef65f, the click handler's warmup re-arms.
// Without it, ctx stays suspended and audio is silent.
console.log('tapping Speak...');
await page.locator('button.aac-speak').first().click({ delay: 50 });
await page.waitForTimeout(4500);

const after = await page.evaluate(() => (window).__diag());
const ctxStateAfter = await page.evaluate(() => (window).__lastCtx?.state);
console.log('\n=== AFTER SPEAK ===');
console.log({ ...after, ctxStateAfter });
console.log('\n=== TTS console ===');
for (const l of consoleLines) {
  if (/TTS|Azure|Inworld|AudioContext|warmup/i.test(l)) console.log(l);
}

const sourcesAfter = after.sourceStartCount - beforeSpeak.sourceStartCount;
console.log('\n=== VERDICT ===');
console.log(`Sources started AFTER Speak click: ${sourcesAfter}`);
console.log(`Final ctx state: ${ctxStateAfter}`);
console.log(`Resume calls total: ${after.resumeCallCount}`);
if (sourcesAfter > 0 && ctxStateAfter === 'running') {
  console.log('✅ FIX WORKS — gesture re-armed warmup, audio plays after idle');
} else {
  console.log('❌ STILL BROKEN — ctx stayed suspended or no source started');
}

await browser.close();
