/**
 * Multi-press TTS diagnostic — tests if rapid Speak presses all produce audio.
 * Simulates the real user pattern: type → speak → type → speak → speak again.
 * Verifies PROTECT_PLAY_MS is bypassed (interrupt=true on Speak button).
 */
import { chromium } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

await page.addInitScript(() => {
  let count = 0;
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return;
  const origCreate = Orig.prototype.createBufferSource;
  Orig.prototype.createBufferSource = function() {
    const node = origCreate.call(this);
    const origStart = node.start.bind(node);
    node.start = function(...a) { count++; window._sc = count; return origStart(...a); };
    return node;
  };
  window._sc = 0;
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 10000 });
await page.waitForTimeout(2000);

const type = async (word) => {
  for (const ch of word.toUpperCase()) {
    const btn = page.locator(`button[data-key="${ch}"]`).first();
    if (await btn.count()) await btn.click({ delay: 20 });
  }
  await page.waitForTimeout(200);
};
const speak = async () => {
  await page.locator('button.aac-speak').first().click({ delay: 50 });
  await page.waitForTimeout(2000);
};
const sc = async () => page.evaluate(() => window._sc);

// Press 1
await type('HI');
await speak();
const c1 = await sc();

// Press 2 — rapid (within PROTECT_PLAY_MS 600ms window)
await type('YES');
await speak();
const c2 = await sc();

// Press 3 — after pause (outside window)
await page.waitForTimeout(700);
await type('NO');
await speak();
const c3 = await sc();

console.log(`\n=== MULTI-PRESS RESULTS ===`);
console.log(`Press 1: sources=${c1} (expected 1)`);
console.log(`Press 2: sources=${c2} (expected 2 — interrupt=true should bypass PROTECT_PLAY_MS)`);
console.log(`Press 3: sources=${c3} (expected 3)`);
if (c2 < 2) console.log('FAIL: Press 2 produced no audio — PROTECT_PLAY_MS not bypassed');
if (c3 < 3) console.log('FAIL: Press 3 produced no audio');

console.log('\n=== TTS LOGS ===');
logs.filter(l => /TTS|AzureTTS|PROTECT/.test(l)).forEach(l => console.log(l));
await browser.close();
