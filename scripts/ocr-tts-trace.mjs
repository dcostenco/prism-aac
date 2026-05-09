/**
 * Capture exactly what gets sent to /tts/public when the user taps
 * Speak on the OCR result. Run pdfjs+OCR on the algebra PDF, click
 * Speak, intercept the POST body, save the returned MP3, play it
 * locally so we hear what real-Safari users hear.
 */
import { webkit } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const PDF = '/Users/admin/Downloads/g.r.9_09_15_16_092016_0831PM.pdf';

const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const ttsRequests = [];
page.on('request', (r) => {
  if (r.url().includes('/tts/public') || r.url().includes('/api/v1/tts')) {
    try { ttsRequests.push({ url: r.url(), body: JSON.parse(r.postData() || '{}') }); } catch {}
  }
});
const consoleLines = [];
page.on('console', m => {
  if (m.type() === 'log' || m.type() === 'warning' || m.type() === 'error') consoleLines.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
await page.waitForTimeout(800);

// Open PDF Reader
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /PDF/i.test(x.getAttribute('aria-label') || '') || /📄/.test(x.textContent || ''));
  b?.click();
});
await page.waitForTimeout(800);

// Pick the algebra PDF
await page.locator('input[type="file"]').first().setInputFiles(PDF);
await page.waitForTimeout(7000);

// Tap "Read this PDF with OCR"
const ocrBtn = page.locator('[data-testid="pdf-reader-run-ocr"]');
const hasOcr = await ocrBtn.count();
console.log('OCR button found:', hasOcr);
if (hasOcr === 0) {
  console.log('No OCR button — page tile preview:');
  const tiles = await page.locator('[data-testid^="pdf-reader-page-"]').allInnerTexts();
  tiles.slice(0,3).forEach(t => console.log(`  ${t.slice(0,150)}`));
}
await ocrBtn.click({ timeout: 5000 });
console.log('OCR button clicked, waiting for result (model first-load can be 30-60s)…');

// Wait for OCR result to appear
await page.waitForSelector('[data-testid="pdf-reader-ocr-result"]', { timeout: 90_000 });
const ocrText = await page.locator('[data-testid="pdf-reader-ocr-result"]').innerText();
console.log('\n=== OCR RESULT TEXT ===');
console.log(ocrText.slice(0, 400));

// Tap Speak via JS click (bypasses visibility checks; Speak button
// may briefly hide if some other tts-highlight event fired first).
ttsRequests.length = 0;
const clicked = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="pdf-reader-speak-ocr"]');
  if (b instanceof HTMLElement) { b.click(); return true; }
  // Fallback: try finding any green Speak button in the OCR result panel
  const result = document.querySelector('[data-testid="pdf-reader-ocr-result"]');
  const sp = result?.querySelector('button');
  if (sp instanceof HTMLElement) { sp.click(); return 'fallback'; }
  return false;
});
console.log('Speak clicked:', clicked);
await page.waitForTimeout(5000);

console.log('\n=== TTS REQUESTS CAPTURED ===');
ttsRequests.forEach((r, i) => {
  const ssml = r.body?.ssml || JSON.stringify(r.body).slice(0, 300);
  console.log(`req[${i}] url=${r.url}`);
  console.log(`        ssml/body: ${typeof ssml === 'string' ? ssml.slice(0, 400) : ssml}`);
});

console.log('\n=== TTS console lines ===');
consoleLines.filter(l => /TTS|tts|portal|tier|Speak|prose/i.test(l)).slice(0, 15).forEach(l => console.log(l));

// Curl the captured SSML to the public endpoint and play locally
if (ttsRequests.length > 0) {
  const body = ttsRequests[0].body;
  fs.writeFileSync('/tmp/ocr-tts-body.json', JSON.stringify(body));
  try {
    execSync(
      `curl -s -o /tmp/ocr-tts.mp3 -X POST 'https://synalux.ai/api/v1/tts/public' ` +
      `-H 'Origin: https://prism-aac.vercel.app' -H 'Content-Type: application/json' ` +
      `--data-raw "$(cat /tmp/ocr-tts-body.json)"`,
    );
    const info = execSync('afinfo /tmp/ocr-tts.mp3 2>&1 || true').toString();
    console.log('\n=== returned MP3 (afinfo) ===');
    console.log(info.split('\n').filter(l => /duration|byte|sample/i.test(l)).join('\n'));
  } catch (e) { console.log('curl/afinfo failed:', e.message?.slice(0,80)); }
}
await browser.close();
