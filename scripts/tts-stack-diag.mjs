/**
 * Stack-trace diagnostic — find the exact call site of each speakAzure invocation.
 * Run: node scripts/tts-stack-diag.mjs
 */
import { chromium } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const T0 = Date.now();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[TTS]') || t.includes('AzureTTS') || t.includes('DEDUP') || t.includes('[STACK')) {
    logs.push({ ts: Date.now() - T0, type: msg.type(), text: t });
  }
});

const ttsReqs = [];
page.on('request', (r) => {
  if (r.url().includes('/tts/') && r.method() === 'POST')
    ttsReqs.push(`+${Date.now()-T0}ms POST ${r.url()}`);
});

// Inject stack-trace capture for every "Attempting portal TTS" log
await page.addInitScript(() => {
  let n = 0;
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  console.log = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('Attempting portal TTS')) {
      n++;
      // Capture stack — minified so we only get function name hints
      const stack = new Error().stack?.split('\n').slice(2, 8)
        .map(s => s.replace(/\s+at\s+/, '').trim()).join(' → ') ?? '';
      origLog(`[STACK-${n}] +?ms ${msg} || TRACE: ${stack}`);
    } else {
      origLog(...args);
    }
  };
  console.warn = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('AzureTTS') || msg.includes('DEDUP') || msg.includes('TRUNCATED')) {
      origWarn(...args);
    } else {
      origWarn(...args);
    }
  };
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
await page.waitForTimeout(2000);

console.log('Typing HELLO...');
for (const ch of 'HELLO') {
  await page.locator(`button[data-key="${ch}"]`).click({ delay: 30 });
}
const typedAt = Date.now() - T0;
await page.waitForTimeout(500);
const speakAt = Date.now() - T0;
console.log(`Tapping Speak at +${speakAt}ms (typed at +${typedAt}ms)`);
await page.locator('button.aac-speak').first().click({ delay: 50 });
await page.waitForTimeout(5500);

console.log('\n=== TTS FETCHES ===');
ttsReqs.forEach(r => console.log(' ', r));
console.log('\n=== TTS LOGS (with timestamps) ===');
logs.forEach(l => console.log(` +${l.ts}ms [${l.type}] ${l.text}`));
await browser.close();
