import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const allResponses = [];
const ttsRequests = [];
page.on('response', async (r) => {
  if (r.url().includes('/chunks/') || r.url().includes('.js')) {
    allResponses.push({ url: r.url(), status: r.status(), size: (await r.body().catch(()=>Buffer.from(''))).length });
  }
  if (r.url().includes('/tts/public')) {
    ttsRequests.push({ url: r.url(), status: r.status() });
  }
});
await page.goto('https://prism-aac.vercel.app/prism-aac', { waitUntil: 'networkidle' });
await page.waitForSelector('button[data-key="Q"]');
await page.locator('button[data-key="H"]').click();
await page.waitForTimeout(500);
await page.locator('button.aac-speak').first().click();
await page.waitForTimeout(5000);
console.log('total .js responses:', allResponses.length);
console.log('TTS POST attempts:', ttsRequests.length);
console.log('All chunk URLs:');
for (const r of allResponses) console.log(`  ${r.size}b  ${r.url}`);
await browser.close();
