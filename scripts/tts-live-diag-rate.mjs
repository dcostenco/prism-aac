/**
 * Live persisted-rate diagnostic. Seeds the legacy version-18 rate=1 value,
 * then confirms the current app migrates it to stored 0.5 and sends portal
 * JSON rate=1.0 (normal), not the old fast 1.4.
 *
 * Run through scripts/playwright-watchdog.sh --exec.
 */
import { webkit } from '@playwright/test';

const URL = process.env.TARGET_URL || 'https://synalux.ai/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const ttsBodies = [];
page.on('request', (r) => {
  if (r.url().includes('/tts/public') && r.method() === 'POST') {
    try {
      const body = JSON.parse(r.postData() || '{}');
      ttsBodies.push({ text: body.text, rate: body.rate, lang: body.lang });
    } catch { /* ignore */ }
  }
});

await page.addInitScript(() => {
  localStorage.setItem('prism-aac-settings', JSON.stringify({
    state: {
      language: 'en',
      outputLanguage: 'en',
      speechRate: 1,
      speechVolume: 1,
    },
    version: 18,
  }));
  sessionStorage.setItem('prism-greeting-dismissed', '1');
});

console.log('navigating...');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
await page.waitForTimeout(1000);

const storedSettings = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('prism-aac-settings') || '{}');
  return { rate: s.state?.speechRate, version: s.version };
});
console.log('persisted settings:', storedSettings);

console.log('typing "morning routine"...');
const word = 'MORNINGROUTINE';
for (const ch of word) await page.locator(`button[data-key="${ch}"]`).click({ delay: 20 });
await page.waitForTimeout(500);

console.log('tapping Speak...');
await page.locator('button.aac-speak').first().click({ delay: 50 });
await page.waitForTimeout(3500);

console.log('\n=== POSTed JSON rates ===');
for (const b of ttsBodies) {
  console.log(JSON.stringify(b));
}

const max = Math.max(0, ...ttsBodies.map((b) => b.rate || 0));
console.log('\n=== VERDICT ===');
console.log(`Max portal rate after legacy migration: ${max}`);
const passed =
  storedSettings.version === 19
  && storedSettings.rate === 0.5
  && ttsBodies.length > 0
  && max <= 1;
console.log(passed
  ? '✅ legacy rate migrated and portal receives normal-or-slower speech'
  : '❌ legacy rate migration or outgoing portal rate is wrong');

await browser.close();
if (!passed) process.exitCode = 1;
