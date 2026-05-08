/**
 * Live SSML rate diag — sets speechRate via in-page settings store
 * and intercepts the POST body to /tts/public to confirm the
 * rate="X.XX" the server actually receives. Pin against the
 * chipmunk regression: with slider at MAX (1.0), SSML rate must NOT
 * be ≥ 1.5.
 */
import { chromium } from '@playwright/test';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const ttsBodies = [];
page.on('request', async (r) => {
  if (r.url().includes('/tts/public') && r.method() === 'POST') {
    try {
      const body = JSON.parse(r.postData() || '{}');
      const m = (body.ssml || '').match(/rate="([\d.]+)"/);
      ttsBodies.push({ rate: m ? Number(m[1]) : null, ssmlSnippet: (body.ssml || '').slice(0, 120) });
    } catch { /* ignore */ }
  }
});

console.log('navigating...');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });

// Force speechRate to maximum (1.0) — the slider position the user
// likely has from cranking it up to fight the earlier 2× slow bug.
await page.evaluate(() => {
  const stored = localStorage.getItem('prism-aac-settings') || '{}';
  const parsed = JSON.parse(stored);
  parsed.state = parsed.state || {};
  parsed.state.speechRate = 1.0;
  localStorage.setItem('prism-aac-settings', JSON.stringify(parsed));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });

// Verify the store actually has rate=1.0
const storedRate = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('prism-aac-settings') || '{}');
  return s.state?.speechRate;
});
console.log('speechRate in store:', storedRate);

console.log('typing "morning routine"...');
const word = 'MORNINGROUTINE';
for (const ch of word) await page.locator(`button[data-key="${ch}"]`).click({ delay: 20 });
await page.waitForTimeout(500);

console.log('tapping Speak...');
await page.locator('button.aac-speak').first().click({ delay: 50 });
await page.waitForTimeout(3500);

console.log('\n=== POSTed SSML rates ===');
for (const b of ttsBodies) {
  console.log(`rate=${b.rate}  | ${b.ssmlSnippet}`);
}

const max = Math.max(0, ...ttsBodies.map((b) => b.rate || 0));
console.log('\n=== VERDICT ===');
console.log(`Max SSML rate seen with slider=1.0 (max): ${max}`);
if (max >= 1.5) {
  console.log('❌ CHIPMUNK — rate ≥ 1.5 will sound high-pitched');
} else if (max >= 1.5) {
  console.log('❌ FAST');
} else if (max > 0 && max <= 1.45) {
  console.log('✅ SAFE — fast but intelligible (NOT chipmunk)');
} else {
  console.log('? unexpected: ' + max);
}

await browser.close();
