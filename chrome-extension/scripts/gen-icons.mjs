// Generates the 4 required Chrome-extension icon PNGs (16/32/48/128
// px) by rendering an SVG into a Playwright Chromium page and
// taking a clipped screenshot.
//
// Why Playwright (not sharp / canvas)? Playwright is already installed
// at the repo root for the e2e suite — reusing it means zero new deps
// and no native bindings (sharp).
//
// Run: node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import url from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'icons');
const SIZES = [16, 32, 48, 128];

// Brand mark — a stylized "prism" triangle in PrismAAC green (#4CAF50)
// with a small speaker emoji overlaid. Keeps it readable at 16 px
// (where the speaker glyph collapses) and recognisable at 128 px.
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4CAF50"/>
      <stop offset="100%" stop-color="#2E7D32"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#g)"/>
  <polygon points="64,22 104,98 24,98" fill="white" opacity="0.95"/>
  <polygon points="64,22 104,98 64,98" fill="white" opacity="0.55"/>
  <text x="64" y="118" font-family="-apple-system,system-ui,sans-serif"
        font-size="22" font-weight="900" text-anchor="middle"
        fill="white" letter-spacing="1">AAC</text>
</svg>
`.trim();

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const size of SIZES) {
    const html = `<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .frame { width: ${size}px; height: ${size}px; }
  svg { width: 100%; height: 100%; display: block; }
</style></head>
<body><div class="frame">${SVG}</div></body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    const buf = await page.locator('.frame').screenshot({
      omitBackground: true,
      scale: 'css',
    });
    const file = path.join(OUT, `icon-${size}.png`);
    await writeFile(file, buf);
    console.log(`  → ${path.relative(path.resolve(__dirname, '..'), file)} (${buf.length} bytes)`);
  }
  await browser.close();
  console.log('✅ Icons generated.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
