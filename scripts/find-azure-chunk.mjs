import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const chunks = [];
page.on('response', async (r) => {
  if (r.url().includes('/chunks/') && r.status() === 200) {
    chunks.push(r.url());
  }
});
await page.goto('https://prism-aac.vercel.app/prism-aac', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[data-key="Q"]');
// Tap a key to trigger warmup which dynamic-imports azureTTS
await page.locator('button[data-key="H"]').click();
await page.waitForTimeout(2000);
await page.locator('button.aac-speak').first().click();
await page.waitForTimeout(2000);
console.log('chunks loaded:', chunks.length);
for (const c of chunks) console.log(c);
await browser.close();
