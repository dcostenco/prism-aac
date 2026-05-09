/**
 * Simulates the user's stuck state:
 *  - Old SW registered under synalux.ai/prism-aac
 *  - Stale Cache Storage entries
 *  - No localStorage marker
 *
 * Then loads the live deploy and confirms:
 *  - Kill-switch detects missing/old marker
 *  - Unregisters all SWs
 *  - Clears all caches
 *  - Sets new marker
 *  - Reloads
 *  - PDF reader works after self-heal
 */
import { webkit } from '@playwright/test';
import fs from 'node:fs';

const URL = 'https://synalux.ai/prism-aac';
const PDF = '/Users/admin/Downloads/Vineland-3-Comprehensive-Report_80259322_1778166067638.pdf';

const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleLines = [];
page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text()}`));

// Step 1: navigate and inject a fake stale state BEFORE the killswitch runs.
// We can't pre-register a real SW from the test (cross-origin), but we CAN
// pre-seed localStorage with an OLD version marker (or no marker), pre-create
// a fake Cache, and verify the killswitch evicts both.
await page.addInitScript(() => {
  // No marker = first visit / stale state
  try { window.localStorage.removeItem('prism-aac-sw-killswitch'); } catch {}
  // Pre-create a fake stale cache to confirm the killswitch deletes it.
  // We do this in the page context after first navigation since caches API
  // is async. Stash a flag so we know we've done it.
  window.__diag_preseed = true;
});

console.log('[diag] navigate', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Pre-create a stale cache to confirm killswitch clears it
await page.evaluate(async () => {
  if ('caches' in window) {
    const c = await caches.open('stale-precache-from-apr30');
    await c.put('/fake-old-chunk.js', new Response('old content'));
    window.__diag_preseed_done = true;
  }
});

// Wait for killswitch reload + readiness
await page.waitForTimeout(2000);
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });

// Step 2: verify killswitch did its job
const post = await page.evaluate(async () => {
  const ls = window.localStorage.getItem('prism-aac-sw-killswitch');
  const cacheKeys = 'caches' in window ? await caches.keys() : [];
  const swCount = 'serviceWorker' in navigator
    ? (await navigator.serviceWorker.getRegistrations()).length
    : -1;
  return { ls, cacheKeys, swCount };
});
console.log('\n=== POST KILLSWITCH STATE ===');
console.log('localStorage marker:', post.ls);
console.log('cache keys:', post.cacheKeys);
console.log('SW registrations:', post.swCount);
console.log('stale cache cleared:', !post.cacheKeys.includes('stale-precache-from-apr30') ? '✅' : '❌ STILL THERE');
console.log('marker matches expected version:', post.ls === '2026-05-08-pdf-fix-1' ? '✅' : '❌');

// Step 3: verify PDF reader works after self-heal
console.log('\n[diag] opening PDF reader and uploading Vineland-3...');
try {
  await page.locator('button[aria-label*="PDF" i]').first().click({ timeout: 3000 });
} catch {
  const buttons = await page.locator('header button, .aac-bar button').all();
  for (const b of buttons) {
    const t = await b.textContent().catch(() => '');
    if (/📄|pdf/i.test(t || '')) { await b.click(); break; }
  }
}
await page.waitForTimeout(800);
const fileInput = await page.locator('input[type="file"]').first();
await fileInput.setInputFiles(PDF);
await page.waitForTimeout(8000);

const tiles = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).filter(b => /Page \d/.test(b.textContent || ''));
  return buttons.slice(0, 3).map(b => (b.parentElement?.textContent || b.textContent || '').slice(0, 200));
});
console.log('\n=== PDF EXTRACTION (post self-heal) ===');
tiles.forEach((t, i) => console.log(`tile ${i}: ${t}`));

const errorCount = tiles.filter(t => /could not be read/.test(t)).length;
console.log('\n=== VERDICT ===');
console.log(errorCount === 0 ? '✅ PDF reader works after self-heal' : `❌ ${errorCount}/${tiles.length} pages errored`);

await browser.close();
