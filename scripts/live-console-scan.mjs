/**
 * Live console-error scan: navigate the deploy, exercise the main
 * surfaces (categories, math, ai-chat, aac-chat, marketplace, schedule,
 * pdf-reader, settings), capture every console.error / pageerror.
 */
import { webkit } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

await ctx.addInitScript(() => {
  localStorage.setItem('prism-aac-settings', JSON.stringify({
    state: {
      language: 'en', outputLanguage: 'en', speechRate: 1, speechVolume: 1,
      gridSize: 6, activeVocabSet: 'all', installedApps: [],
    },
    version: 4,
  }));
});

const page = await ctx.newPage();
const errors = [];
const warnings = [];
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  if (m.type() === 'warning' && !/kokoroTTS|404.*huggingface\.co/.test(t)) warnings.push(t);
});
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const surfaces = ['Categories', 'Math', 'AI', 'AAC', 'Marketplace', 'Schedule', 'PDF Reader', 'Settings'];
for (const s of surfaces) {
  console.log(`\n=== Opening ${s} ===`);
  const opened = await page.evaluate((label) => {
    const labelRegex = new RegExp(label === 'AI' ? '^AI$' : label === 'AAC' ? '^AAC$' : label, 'i');
    const b = Array.from(document.querySelectorAll('button')).find(x => labelRegex.test(x.getAttribute('aria-label') || ''));
    if (b) { b.click(); return true; }
    return false;
  }, s);
  console.log(`  found+clicked: ${opened}`);
  await page.waitForTimeout(800);
  // Type a few keys to exercise predict / autocorrect
  for (const k of ['H','E','L']) try { await page.locator(`button[data-key="${k}"]`).first().click({delay:30, timeout: 1500}); } catch {}
  await page.waitForTimeout(400);
  // Close it
  await page.evaluate((label) => {
    const labelRegex = new RegExp(label === 'AI' ? '^AI$' : label === 'AAC' ? '^AAC$' : label, 'i');
    const b = Array.from(document.querySelectorAll('button')).find(x => labelRegex.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  }, s);
  await page.waitForTimeout(400);
}

console.log('\n=== ERRORS ('+errors.length+') ===');
const cleanErrors = errors.filter(e => !/Failed to load resource.*Kokoro|huggingface|preprocessor_config|access control checks/i.test(e));
cleanErrors.forEach(e => console.log(' ', e.slice(0, 240)));
console.log('\n=== WARNINGS ('+warnings.length+') ===');
warnings.forEach(w => console.log(' ', w.slice(0, 200)));
console.log('\nfiltered out: kokoroTTS / huggingface 404 / CORS preflight (known + benign)');

await browser.close();
