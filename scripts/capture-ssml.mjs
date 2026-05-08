import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const captured = [];
page.on('request', async (r) => {
  if (r.url().includes('/tts/public') && r.method() === 'POST') {
    try { captured.push(JSON.parse(r.postData() || '{}')); } catch {}
  }
});
await page.goto('https://prism-aac.vercel.app/prism-aac', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[data-key="Q"]');
await page.waitForTimeout(800);
for (const ch of 'HELLO') await page.locator(`button[data-key="${ch}"]`).click();
await page.locator('button.aac-speak').first().click();
await page.waitForTimeout(3500);
fs.writeFileSync('/tmp/captured-ssml.json', JSON.stringify(captured, null, 2));
console.log('captured', captured.length, 'TTS POST bodies');
console.log('first ssml rate:', (captured[0]?.ssml || '').match(/rate="([^"]+)"/)?.[1]);
await browser.close();
