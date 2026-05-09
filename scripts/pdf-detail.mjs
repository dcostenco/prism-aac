import { webkit } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const PDF = '/Users/admin/Downloads/g.r.9_09_15_16_092016_0831PM.pdf';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type()==='error') pageErrors.push(`[console.error] ${m.text()}`); });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
await page.waitForTimeout(800);

// Probe pdfjs directly with this exact PDF — capture every error path
const buf = (await import('node:fs')).readFileSync(PDF);
const result = await page.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const out = { version: pdfjs.version, phases: [] };
  try {
    out.phases.push('getDocument start');
    const doc = await pdfjs.getDocument({ data: bin }).promise;
    out.numPages = doc.numPages;
    out.phases.push(`numPages=${doc.numPages}`);
    const p = await doc.getPage(1);
    out.phases.push('getPage(1) ok');
    // Try with disableNormalization=true (current code path)
    try {
      const tcA = await p.getTextContent({ includeMarkedContent: false, disableNormalization: true });
      out.disableNorm_items = tcA.items?.length;
      out.disableNorm_first = (tcA.items?.[0]?.str || '').slice(0, 60);
    } catch (e) {
      out.disableNorm_error = e.message + '\n' + (e.stack||'').split('\n').slice(0,5).join('\n');
    }
    // Try with NO options (older code path)
    try {
      const tcB = await p.getTextContent();
      out.default_items = tcB.items?.length;
    } catch (e) {
      out.default_error = e.message;
    }
    // Try with different options
    try {
      const tcC = await p.getTextContent({ includeMarkedContent: true, disableNormalization: false });
      out.markedContent_items = tcC.items?.length;
    } catch (e) {
      out.markedContent_error = e.message;
    }
    // Inspect the PDF — does it have text layer?
    const ops = await p.getOperatorList();
    out.opCount = ops.fnArray?.length;
  } catch (e) {
    out.fatal = e.message;
  }
  return out;
}, buf.toString('base64'));
console.log(JSON.stringify(result, null, 2));
console.log('\nERRORS:'); pageErrors.slice(0, 10).forEach(e => console.log(e.slice(0, 200)));
await browser.close();
