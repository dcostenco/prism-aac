import { webkit } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const ttsRequests = [];
const errors = [];
const ttsLogs = [];
page.on('request', r => {
  if (/tts/.test(r.url())) ttsRequests.push({ url: r.url(), method: r.method() });
});
page.on('console', m => {
  const t = m.text().slice(0, 300);
  if (m.type() === 'error') errors.push(t);
  if (/tts|TTS|speak|Speak|Audio|AudioContext|decode/i.test(t)) ttsLogs.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', e => errors.push(`PAGE-ERROR: ${e.message}`));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
await page.waitForTimeout(2500);
// Type a word then speak via Enter on Q letter
const result = await page.evaluate(() => {
  const acState = (window as unknown as { ___audioCtx?: AudioContext }).___audioCtx;
  // Click the Q key to add a letter
  const Q = document.querySelector('button[data-key="Q"]') as HTMLElement;
  Q?.click();
  // Find the speak / play button on the bar
  const btns = Array.from(document.querySelectorAll('button'));
  const speak = btns.find(b => /speak/i.test(b.getAttribute('aria-label') || '') || /^▶/.test(b.textContent || '') || /play/i.test(b.getAttribute('aria-label') || ''));
  speak?.click();
  return { qFound: !!Q, speakFound: !!speak, audioCtxState: acState?.state ?? 'no-global' };
});
console.log('Click result:', JSON.stringify(result));
await page.waitForTimeout(4000);
console.log('\n=== TTS network requests captured ===');
ttsRequests.forEach(r => console.log(`  ${r.method} ${r.url.slice(0, 130)}`));
console.log('\n=== TTS / audio logs ===');
ttsLogs.slice(-20).forEach(l => console.log(' ' + l));
console.log('\n=== Page errors ===');
errors.slice(-10).forEach(e => console.log(' ' + e));
await browser.close();
