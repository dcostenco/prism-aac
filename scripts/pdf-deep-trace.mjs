/**
 * Deep pdfjs trace. Wraps getDocument / getPage / getTextContent in
 * the page context to capture EVERY internal state — what items
 * pdfjs returns, what errors it throws, what the worker does.
 * No assumptions, just the data.
 */
import { webkit } from '@playwright/test';
import fs from 'node:fs';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const PDFS = [
  { label: 'vineland-3', path: '/Users/admin/Downloads/Vineland-3-Comprehensive-Report_80259322_1778166067638.pdf' },
  { label: 'algebra', path: '/Users/admin/Downloads/g.r.9_09_15_16_092016_0831PM.pdf' },
];

const browser = await webkit.launch({ headless: true });

for (const pdf of PDFS) {
  if (!fs.existsSync(pdf.path)) { console.log(`[${pdf.label}] MISSING`); continue; }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const networkLog = [];
  page.on('request', r => { if (/pdfjs|pdf\.worker|jsdelivr/.test(r.url())) networkLog.push({ phase: 'req', url: r.url() }); });
  page.on('response', r => { if (/pdfjs|pdf\.worker|jsdelivr/.test(r.url())) networkLog.push({ phase: 'resp', url: r.url(), status: r.status() }); });
  const consoleLog = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleLog.push(`[${m.type()}] ${m.text().slice(0,200)}`); });
  page.on('pageerror', e => consoleLog.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  // Open PDF Reader
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /PDF/i.test(x.getAttribute('aria-label') || '') || /📄/.test(x.textContent || ''));
    b?.click();
  });
  await page.waitForTimeout(800);

  // Pick PDF
  await page.locator('input[type="file"]').first().setInputFiles(pdf.path);
  await page.waitForTimeout(7000);

  // Capture per-page state from the PdfReaderPanel
  const tiles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid^="pdf-reader-page-"]')).map((row, i) => {
      const txt = (row.textContent || '').slice(0, 200);
      const isError = txt.includes('couldn');
      const isEmpty = txt.includes('empty page');
      return { i: i + 1, isError, isEmpty, text: txt };
    });
  });

  // Now run a parallel direct pdfjs probe via the page's already-loaded module
  const probe = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    // Use the same pdfjs-dist module the app uses
    // Load pdfjs from CDN — matches the same version the app uses.
    const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.min.mjs');
    mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs';
    const out = { version: mod.version, workerSrc: mod.GlobalWorkerOptions?.workerSrc };
    // Strategy A: with worker (default)
    try {
      const docA = await mod.getDocument({ data: bin }).promise;
      out.worker_numPages = docA.numPages;
      const p1 = await docA.getPage(1);
      try {
        const tc = await p1.getTextContent({ includeMarkedContent: false, disableNormalization: true });
        out.worker_strat1_items = tc.items?.length;
        out.worker_strat1_first_str = (tc.items?.[0]?.str || '').slice(0, 60);
      } catch (e) {
        out.worker_strat1_error = (e?.message || String(e)).slice(0, 250);
        out.worker_strat1_stack = (e?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 300);
      }
      docA.destroy();
    } catch (e) { out.worker_getDoc_error = (e?.message || String(e)).slice(0, 250); }

    // Strategy B: disableWorker:true (main thread)
    try {
      const docB = await mod.getDocument({ data: bin, disableWorker: true }).promise;
      out.noworker_numPages = docB.numPages;
      const p1 = await docB.getPage(1);
      try {
        const tc = await p1.getTextContent({ includeMarkedContent: false, disableNormalization: true });
        out.noworker_strat1_items = tc.items?.length;
        out.noworker_strat1_first_str = (tc.items?.[0]?.str || '').slice(0, 60);
      } catch (e) {
        out.noworker_strat1_error = (e?.message || String(e)).slice(0, 250);
      }
      docB.destroy();
    } catch (e) { out.noworker_getDoc_error = (e?.message || String(e)).slice(0, 250); }
    return out;
  }, fs.readFileSync(pdf.path).toString('base64'));

  console.log(`\n========== ${pdf.label} (${pdf.path.split('/').pop()}) ==========`);
  console.log(`size: ${fs.statSync(pdf.path).size} bytes`);
  console.log('\n--- pdfjs probe ---'); console.log(JSON.stringify(probe, null, 2));
  console.log('\n--- panel tiles ---');
  tiles.slice(0, 5).forEach(t => console.log(`page ${t.i}: ${t.isError?'ERROR':t.isEmpty?'EMPTY':'OK '} | ${t.text.slice(0,120)}`));
  if (tiles.length > 5) console.log(`...${tiles.length - 5} more pages, ${tiles.filter(t=>t.isError).length} ERROR, ${tiles.filter(t=>t.isEmpty).length} EMPTY, ${tiles.filter(t=>!t.isError && !t.isEmpty).length} OK`);
  console.log('\n--- network (pdfjs/worker only) ---'); networkLog.forEach(n => console.log(`  ${n.phase} ${n.status||''} ${n.url.slice(0,120)}`));
  console.log('\n--- console errors/warnings ---'); consoleLog.filter(l => /pdf|worker/i.test(l) || /TypeError|undefined/i.test(l)).slice(0, 10).forEach(l => console.log(`  ${l}`));

  await ctx.close();
}
await browser.close();
