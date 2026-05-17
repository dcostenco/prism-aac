// Generates every Chrome Web Store asset the listing needs:
//   • screenshots/screenshot-{1,2,3}.png at 1280×800
//   • promo/small-promo-tile.png at 440×280
//   • promo/marquee-promo-tile.png at 1400×560
//   • video/promo.webm at 1280×720 (≈40 s demo loop)
//
// Approach: composite renders. The demo page (fixtures/demo-page.html)
// runs in a normal Playwright page. The extension's overlay UI is
// re-implemented inline as styled HTML matching the real shadow-DOM
// styles in src/overlay.ts. This sidesteps Chromium's headless
// extension-loading flakiness and gives us pixel-perfect control over
// what each marketing frame looks like.
//
// Run: node scripts/gen-store-assets.mjs

import { chromium } from 'playwright';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'demo-page.html');
const OUT_SHOTS = path.join(ROOT, 'store-screenshots');
const OUT_PROMO = path.join(ROOT, 'store-promo');
const OUT_VIDEO = path.join(ROOT, 'store-video');

const SHOT_SIZE = { width: 1280, height: 800 };

// CSS that mirrors the real shadow-DOM overlay in src/overlay.ts so
// the screenshot looks identical to what the user sees in the wild.
const OVERLAY_CSS = `
  .pc-overlay {
    position: fixed; z-index: 99999;
    display: flex; flex-direction: column; gap: 6px;
    min-width: 360px; max-width: 540px; padding: 10px;
    background: rgba(255, 255, 255, 0.98); color: #1a1a1a;
    border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 12px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px; line-height: 1.45;
  }
  .pc-overlay .row { display: flex; align-items: center; gap: 8px; }
  .pc-overlay .title { flex: 1; font-weight: 700; font-size: 12px; opacity: 0.7; }
  .pc-overlay button {
    cursor: pointer; height: 32px; padding: 0 12px;
    border-radius: 6px; border: 1px solid transparent;
    font-weight: 700; font-size: 13px;
    background: #4caf50; color: white;
  }
  .pc-overlay button.secondary { background: transparent; color: inherit; border-color: rgba(0,0,0,0.2); }
  .pc-overlay .source { font-size: 12px; line-height: 1.4; opacity: 0.65; font-style: italic; padding-bottom: 4px; border-bottom: 1px dashed rgba(0,0,0,0.12); }
  .pc-overlay .status { font-size: 14px; line-height: 1.55; word-break: break-word; }
  .pc-overlay .status .w { padding: 0 1px; border-radius: 3px; }
  .pc-overlay .status .w.active {
    background: rgba(255, 235, 59, 0.85);
    box-shadow: 0 0 0 1px rgba(255, 193, 7, 0.95);
  }
`;

function overlayHtml(opts) {
  const { spokenText, activeIndex, sourceText } = opts;
  const tokens = spokenText.match(/\S+|\s+/g) || [];
  let wordIdx = -1;
  const wordSpans = tokens.map((t) => {
    if (/\s+/.test(t)) return t;
    wordIdx++;
    const cls = wordIdx === activeIndex ? 'w active' : 'w';
    return `<span class="${cls}">${escapeHtml(t)}</span>`;
  }).join('');
  const sourceLine = sourceText
    ? `<div class="source">${escapeHtml(sourceText)}</div>`
    : '';
  return `
    <div class="pc-overlay" style="${opts.positionStyle || ''}">
      <div class="row">
        <span class="title">📣 PrismAAC</span>
        <button>▶ Speak</button>
        <button class="secondary">📌</button>
        <button class="secondary">×</button>
      </div>
      ${sourceLine}
      <div class="status">${wordSpans}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function makeShot(page, fixtureHtml, overlayState, outPath) {
  const html = `${fixtureHtml}\n<style>${OVERLAY_CSS}</style>\n${overlayHtml(overlayState)}`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: outPath, fullPage: false, type: 'png' });
  console.log(`  → ${path.relative(ROOT, outPath)}`);
}

// ── Optionspageshot — render the actual options.html ─────────────
async function makeOptionsShot(page, outPath) {
  const optionsHtml = await readFile(path.join(ROOT, 'src', 'options.html'), 'utf8');
  // Prefix the body with a synthetic chrome window frame so the shot
  // doesn't look bare. Strip the script tag (it requires the bundled
  // options.js + chrome.storage which we don't have here) and render
  // with default values inlined.
  const stripped = optionsHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace('<body>', `<body style="margin:0;padding:0;background:#f0f1f5;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;">
      <div style="background:white;margin-top:40px;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:640px;">`)
    .replace('</body>', `</div></body>`);
  // Pre-fill input states so the screenshot has labels checked +
  // language pickers populated.
  const seeded = stripped.replace('</body>', `
    <script>
      document.getElementById('enabled').checked = true;
      document.getElementById('speakOnSentenceEnd').checked = true;
      document.getElementById('speakOnSpace').checked = false;
      document.getElementById('showOverlay').checked = true;
      const sl = document.getElementById('sourceLanguage');
      const tl = document.getElementById('targetLanguage');
      const langs = [
        ['en','English'], ['es','Spanish'], ['fr','French'], ['ro','Romanian'],
        ['ru','Russian'], ['ja','Japanese'], ['zh-CN','Chinese (Simplified)'],
      ];
      for (const [c, n] of langs) {
        const o1 = document.createElement('option'); o1.value = c; o1.textContent = n + ' (' + c + ')'; sl.append(o1);
        const o2 = document.createElement('option'); o2.value = c; o2.textContent = n + ' (' + c + ')'; tl.append(o2);
      }
      sl.value = 'auto'; tl.value = 'ro';
      document.getElementById('rate').value = '1';
      document.getElementById('volume').value = '0.9';
      document.getElementById('pitch').value = '1';
      document.getElementById('rateNum').textContent = '1.00';
      document.getElementById('volumeNum').textContent = '0.90';
      document.getElementById('pitchNum').textContent = '1.00';
      const v = document.getElementById('voiceURI');
      const o = document.createElement('option'); o.textContent = 'Samantha (en-US)'; o.selected = true; v.append(o);
    </script>
  </body>`);
  await page.setContent(seeded, { waitUntil: 'load' });
  await page.waitForTimeout(120);
  await page.screenshot({ path: outPath, fullPage: false, type: 'png' });
  console.log(`  → ${path.relative(ROOT, outPath)}`);
}

async function takeScreenshots(browser) {
  await rm(OUT_SHOTS, { recursive: true, force: true });
  await mkdir(OUT_SHOTS, { recursive: true });
  const fixtureHtml = await readFile(FIXTURE, 'utf8');
  const ctx = await browser.newContext({ viewport: SHOT_SIZE, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // Position the overlay near the top of the textarea (in the real
  // extension it positions above the focused field).
  const pos = 'top: 220px; left: 250px;';

  // Screenshot 1: speak-as-you-type, mid-sentence, "school" highlighted
  await makeShot(page, fixtureHtml, {
    spokenText: 'I had a really good day at school today.',
    activeIndex: 7, // "school"
    positionStyle: pos,
  }, path.join(OUT_SHOTS, 'screenshot-1.png'));

  // Screenshot 2: translate mode — source line + Romanian translation,
  // 2nd word highlighted
  await makeShot(page, fixtureHtml, {
    spokenText: 'Am avut o zi foarte bună la școală astăzi.',
    activeIndex: 4, // "foarte"
    sourceText: 'I had a really good day at school today.',
    positionStyle: pos,
  }, path.join(OUT_SHOTS, 'screenshot-2.png'));

  // Screenshot 3: options page
  await makeOptionsShot(page, path.join(OUT_SHOTS, 'screenshot-3.png'));

  await ctx.close();
}

// ── Promo tiles ──────────────────────────────────────────────────

function tileSvg(width, height, opts) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1b5e20"/>
      <stop offset="60%" stop-color="#2E7D32"/>
      <stop offset="100%" stop-color="#4CAF50"/>
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g transform="translate(${opts.markX}, ${opts.markY})" filter="url(#shadow)">
    <polygon points="0,${opts.markH} ${opts.markW/2},0 ${opts.markW},${opts.markH}" fill="white" opacity="0.95"/>
    <polygon points="${opts.markW/2},0 ${opts.markW},${opts.markH} ${opts.markW/2},${opts.markH}" fill="white" opacity="0.55"/>
  </g>
  <text x="${opts.titleX}" y="${opts.titleY}" font-family="-apple-system,system-ui,sans-serif"
        font-size="${opts.titleSize}" font-weight="900" fill="white">PrismAAC</text>
  <text x="${opts.subtitleX}" y="${opts.subtitleY}" font-family="-apple-system,system-ui,sans-serif"
        font-size="${opts.subtitleSize}" font-weight="600" fill="white" opacity="0.92">Reading Assistant</text>
  <text x="${opts.taglineX}" y="${opts.taglineY}" font-family="-apple-system,system-ui,sans-serif"
        font-size="${opts.taglineSize}" font-weight="500" fill="white" opacity="0.85">${opts.tagline}</text>
  <g transform="translate(${opts.hlX}, ${opts.hlY})">
    <rect x="0" y="0" width="${opts.hlW}" height="${opts.hlH}" rx="6" fill="rgba(255,235,59,0.85)" stroke="rgba(255,193,7,0.95)" stroke-width="2"/>
    <text x="${opts.hlW/2}" y="${opts.hlH * 0.72}" text-anchor="middle"
          font-family="-apple-system,system-ui,sans-serif"
          font-size="${opts.hlTextSize}" font-weight="700" fill="#222">Speak as you type</text>
  </g>
</svg>`.trim();
}

async function takePromoTiles(browser) {
  await rm(OUT_PROMO, { recursive: true, force: true });
  await mkdir(OUT_PROMO, { recursive: true });
  const tiles = [
    {
      name: 'small-promo-tile.png', w: 440, h: 280,
      svgOpts: {
        markX: 30, markY: 70, markW: 120, markH: 120,
        titleX: 175, titleY: 110, titleSize: 38,
        subtitleX: 175, subtitleY: 145, subtitleSize: 22,
        taglineX: 175, taglineY: 175, taglineSize: 14,
        tagline: 'Free Read & Write alternative',
        hlX: 175, hlY: 195, hlW: 220, hlH: 36, hlTextSize: 16,
      },
    },
    {
      name: 'marquee-promo-tile.png', w: 1400, h: 560,
      svgOpts: {
        markX: 110, markY: 180, markW: 200, markH: 200,
        titleX: 380, titleY: 240, titleSize: 90,
        subtitleX: 380, subtitleY: 310, subtitleSize: 48,
        taglineX: 380, taglineY: 380, taglineSize: 30,
        tagline: 'Speak as you type, with word-by-word highlight, in any text field.',
        hlX: 380, hlY: 420, hlW: 540, hlH: 70, hlTextSize: 30,
      },
    },
  ];
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 600 } });
  const page = await ctx.newPage();
  for (const t of tiles) {
    const html = `<!doctype html><html><head><style>
      html, body { margin: 0; padding: 0; background: transparent; }
      .frame { width: ${t.w}px; height: ${t.h}px; }
      svg { width: 100%; height: 100%; display: block; }
    </style></head><body><div class="frame">${tileSvg(t.w, t.h, t.svgOpts)}</div></body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    const buf = await page.locator('.frame').screenshot({ omitBackground: false, type: 'png' });
    const out = path.join(OUT_PROMO, t.name);
    await writeFile(out, buf);
    console.log(`  → store-promo/${t.name} (${t.w}×${t.h}, ${(buf.length/1024).toFixed(1)} KB)`);
  }
  await ctx.close();
}

// ── Promo video — record an animated demo as WebM ────────────────
//
// Sequence (~40 s total):
//   00-04 s : title card "PrismAAC Reading Assistant"
//   04-14 s : compose page with overlay; word highlight cycles
//             through "I had a really good day at school today"
//   14-24 s : translate mode — source + Romanian translation, word
//             highlight cycles through the translation
//   24-30 s : options page tour (settings checkboxes + lang pickers)
//   30-40 s : outro card with install link

async function recordPromoVideo(browser) {
  await rm(OUT_VIDEO, { recursive: true, force: true });
  await mkdir(OUT_VIDEO, { recursive: true });
  const VW = 1280, VH = 720;
  const fixtureHtml = await readFile(FIXTURE, 'utf8');

  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    recordVideo: { dir: OUT_VIDEO, size: { width: VW, height: VH } },
  });
  const page = await ctx.newPage();

  const titleCard = (heading, sub) => `
    <html><head><style>
      html,body{margin:0;padding:0;height:100%;background:linear-gradient(135deg,#1b5e20,#4caf50);color:white;font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;flex-direction:column;}
      h1{font-size:96px;margin:0 0 12px 0;font-weight:900;}
      p{font-size:36px;opacity:0.85;margin:0;font-weight:500;}
    </style></head><body><h1>${heading}</h1><p>${sub}</p></body></html>`;

  // 1. Title (4s)
  await page.setContent(titleCard('PrismAAC', 'Reading Assistant'), { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  // 2. Compose + overlay, English speak (10s, highlight cycles every 800ms)
  const sentence = 'I had a really good day at school today.';
  const enWords = sentence.split(' ').length;
  for (let i = 0; i < enWords; i++) {
    const html = `${fixtureHtml}\n<style>${OVERLAY_CSS}</style>\n${overlayHtml({ spokenText: sentence, activeIndex: i, positionStyle: 'top: 220px; left: 250px;' })}`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);

  // 3. Translate mode (10s)
  const ro = 'Am avut o zi foarte bună la școală astăzi.';
  const roWords = ro.split(' ').length;
  for (let i = 0; i < roWords; i++) {
    const html = `${fixtureHtml}\n<style>${OVERLAY_CSS}</style>\n${overlayHtml({ spokenText: ro, sourceText: sentence, activeIndex: i, positionStyle: 'top: 220px; left: 250px;' })}`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(900);
  }

  // 4. Options page (6s)
  await makeOptionsShot.bind(null)(page, path.join(OUT_VIDEO, '_options_frame.png')); // re-render to viewport
  await page.waitForTimeout(6000);

  // 5. Outro (5s)
  await page.setContent(titleCard('Free in the Chrome Web Store', 'github.com/dcostenco/prism-aac'), { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  await ctx.close();
  // Locate the recorded webm.
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(OUT_VIDEO);
  const webm = files.find((f) => f.endsWith('.webm'));
  if (webm) {
    const final = 'promo.webm';
    const { rename } = await import('node:fs/promises');
    await rename(path.join(OUT_VIDEO, webm), path.join(OUT_VIDEO, final));
    console.log(`  → store-video/${final}`);
    // Convert to MP4 via ffmpeg if available — YouTube prefers MP4.
    await convertToMp4(path.join(OUT_VIDEO, final));
  }
  // Cleanup the throw-away options frame.
  try { await rm(path.join(OUT_VIDEO, '_options_frame.png')); } catch {}
}

function convertToMp4(webmPath) {
  return new Promise((resolve) => {
    const mp4Path = webmPath.replace(/\.webm$/, '.mp4');
    const proc = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', webmPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path,
    ], { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (e) => {
      if (e.code === 'ENOENT') {
        console.log('  ! ffmpeg not found — skipping MP4 conversion. Install via `brew install ffmpeg` and re-run, or upload promo.webm to YouTube directly (it accepts WebM).');
      } else {
        console.log(`  ! ffmpeg error: ${e.message}`);
      }
      resolve();
    });
    proc.on('close', (code) => {
      if (code === 0) console.log(`  → ${path.relative(ROOT, mp4Path)}`);
      else console.log(`  ! ffmpeg exited ${code}: ${stderr.slice(0, 200)}`);
      resolve();
    });
  });
}

async function main() {
  console.log('▶ Generating Chrome Web Store assets…');
  const browser = await chromium.launch({ headless: true });
  await takeScreenshots(browser);
  await takePromoTiles(browser);
  await recordPromoVideo(browser);
  await browser.close();
  console.log('✅ Done.');
  console.log('   Screenshots → store-screenshots/screenshot-{1,2,3}.png (1280×800)');
  console.log('   Promo tiles → store-promo/{small,marquee}-promo-tile.png');
  console.log('   Promo video → store-video/promo.webm (upload to YouTube; paste URL into the listing)');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
