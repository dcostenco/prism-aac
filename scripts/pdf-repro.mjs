import { webkit } from '@playwright/test';
import fs from 'node:fs';

const PDF_PATH = '/Users/admin/Downloads/g.r.9_09_15_16_092016_0831PM.pdf';
const URL = process.env.URL || 'https://prism-aac.vercel.app/prism-aac';
console.log('Testing PDF reader against', URL, 'with', PDF_PATH);
console.log('PDF size:', fs.statSync(PDF_PATH).size);

const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleLines = [];
page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.message}\n${(e.stack||'').split('\n').slice(0,4).join('\n')}`));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
await page.waitForTimeout(800);

// Open PDF Reader panel
try { await page.locator('button[aria-label*="PDF" i]').first().click({ timeout: 3000 }); }
catch (e) { console.log('PDF button not found by aria, trying emoji...'); 
  const buttons = await page.locator('header button, .aac-bar button').all();
  for (const b of buttons) { const t = await b.textContent().catch(() => ''); if (/📄|pdf/i.test(t || '')) { await b.click(); break; } }
}
await page.waitForTimeout(800);

// Find file input and upload
const input = await page.locator('input[type="file"]').first();
await input.setInputFiles(PDF_PATH);
console.log('File set; waiting 8s for extraction...');
await page.waitForTimeout(8000);

// Read page content / errors
const tiles = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).filter(b => /Page \d/.test(b.textContent || ''));
  if (buttons.length === 0) {
    return ['(no Page-N buttons found)', `body text snippet: ${document.body.textContent?.slice(0, 300)}`];
  }
  return buttons.slice(0, 5).map(b => (b.parentElement?.textContent || b.textContent || '').slice(0, 250));
});
console.log('\n=== panel tiles (first 3) ===');
tiles.forEach((t, i) => console.log(`tile ${i}: ${t}`));

console.log('\n=== console (filtered) ===');
consoleLines.filter(l => /pdf|worker|error|undefined|read|Page/i.test(l)).slice(0, 25).forEach(l => console.log(l.slice(0, 250)));

await browser.close();
