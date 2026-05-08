import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const chunks = new Set();
page.on('response', async (r) => {
  if (r.url().includes('/chunks/') && r.status() === 200) chunks.add(r.url());
});
await page.goto('https://prism-aac.vercel.app/prism-aac', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.locator('button[data-key="H"]').click();
await page.waitForTimeout(1500);
await page.locator('button[data-key="I"]').click();
await page.waitForTimeout(1000);
await page.locator('button.aac-speak').first().click();
await page.waitForTimeout(5000);
console.log('total chunks:', chunks.size);
for (const u of chunks) console.log(u);
await browser.close();
