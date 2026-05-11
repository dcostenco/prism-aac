/**
 * Idle regression test — speaks, waits 35s (past CTX_STALE_MS=30s),
 * then speaks again. Catches the stale-context double-close bug and
 * any Safari auto-suspend regression.
 */
import { webkit } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(m.text()));
await page.addInitScript(() => {
  let ctxCreations = 0, starts = 0;
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return;
  window.AudioContext = window.webkitAudioContext = new Proxy(Orig, {
    construct(T, args) {
      ctxCreations++;
      const inst = new T(...args);
      const origCreate = inst.createBufferSource.bind(inst);
      inst.createBufferSource = () => {
        const n = origCreate();
        const os = n.start.bind(n);
        n.start = (...a) => { starts++; window._st = starts; return os(...a); };
        return n;
      };
      window._ctxC = ctxCreations;
      return inst;
    }
  });
  window._st = 0; window._ctxC = 0;
});
await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 10000 });
await page.waitForTimeout(2000);
const type = async (w) => {
  for (const c of w.toUpperCase()) {
    const b = page.locator(`button[data-key="${c}"]`).first();
    if (await b.count()) await b.click({ delay: 20 });
  }
};
const speak = async () => {
  await page.locator('button.aac-speak').first().click({ delay: 50 });
  await page.waitForTimeout(3000);
};
await type('HI'); await speak();
const [st1, ctx1] = await page.evaluate(() => [window._st, window._ctxC]);
console.log(`After press 1: sources=${st1}, contexts=${ctx1}`);

console.log('Waiting 35s (past CTX_STALE_MS=30s)...');
await page.waitForTimeout(35000);

await type('HELLO'); await speak();
const [st2, ctx2] = await page.evaluate(() => [window._st, window._ctxC]);
console.log(`After press 2 (post-idle): sources=${st2}, contexts=${ctx2}`);
if (st2 === st1) console.log('BUG: No audio after idle — source never started');
if (ctx2 > ctx1 + 1) console.log(`BUG: ${ctx2 - ctx1} AudioContexts created (double-close still present)`);
const ttsLogs = logs.filter(l => /TTS|AzureTTS|AudioContext|stuck|PROTECT|DEDUP/.test(l));
console.log('Relevant logs:\n' + ttsLogs.join('\n'));
await browser.close();
