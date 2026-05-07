/**
 * Capture documentation screenshots for the Phase 5 math module.
 *
 * Drives /dev/math-grid through several deterministic states and
 * writes PNGs into docs/screenshots/. Idempotent — overwrites on
 * each run. Mocks the Synalux /chat endpoint so the tutor screenshot
 * is reproducible without depending on a live AI response.
 *
 * Usage:
 *   npm run dev   # ensure :3001 is up
 *   node scripts/capture-math-docs.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3001/prism-aac';
const OUT = path.resolve('docs/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1280, height: 800 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function gotoDev() {
  await page.goto(`${BASE}/dev/math-grid`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="math-grid-svg"]');
    return !!svg && svg.getBoundingClientRect().width > 100;
  });
  // Settle one animation frame.
  await page.waitForTimeout(150);
}

async function clearLocalDocs() {
  await page.evaluate(() => {
    try { localStorage.removeItem('prism-aac-math-docs'); } catch {}
  });
}

async function shoot(name) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`  → ${path.relative(process.cwd(), dest)}`);
}

async function tap(testId) {
  await page.locator(`[data-testid="${testId}"]`).click();
  await page.waitForTimeout(80);
}

console.log('▶ Capturing math module screenshots...');

// 1. Empty canvas + keyboard
await gotoDev();
await clearLocalDocs();
await shoot('math-canvas-empty');

// 2. Canvas with content
await tap('math-key-5');
await tap('math-key-plus');
await tap('math-key-7');
await tap('math-key-equals');
await tap('math-key-1');
await tap('math-key-2');
await page.waitForTimeout(120);
await shoot('math-canvas-typed');

// 3. Adv math category — shows the 5 decoration tools
await tap('math-category-adv-math');
await page.waitForTimeout(150);
await shoot('math-keyboard-adv');

// 4. Letters category
await tap('math-category-letters');
await page.waitForTimeout(150);
await shoot('math-keyboard-letters');

// 5. Geometry category
await tap('math-category-geom');
await page.waitForTimeout(150);
await shoot('math-keyboard-geom');

// 6. Two-hit magnify — armed state
await gotoDev();
await clearLocalDocs();
await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  const stores = window.__devMathStores;
  stores.useSettingsStore.getState().update({ mathTwoHitMagnify: true });
});
await page.waitForTimeout(120);
await tap('math-key-7'); // arm
await page.waitForTimeout(150);
await shoot('math-two-hit-armed');

// 7. AI Tutor with mocked SSE response
await gotoDev();
await clearLocalDocs();
// Block local Ollama fallback; mock Synalux chat with a tidy hint.
await page.route('**/11434/**', (route) => route.abort());
await page.route('**/generate', (route) => route.abort());
await page.route('**/chat', async (route) => {
  const sse = [
    'data: {"choices":[{"delta":{"content":"Try adding the ones first: "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"5 + 7 = 12. "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"Write the 2 below, carry the 1."}}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');
  await route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    body: sse,
  });
});
await tap('math-key-5');
await tap('math-key-plus');
await tap('math-key-7');
await page.waitForTimeout(80);
await tap('math-tutor-hint');
await page.locator('[data-testid="math-tutor-response"]').waitFor({ timeout: 5000 });
await page.waitForTimeout(200);
await shoot('math-tutor-hint');

// 8. Math docs Save / Open overlay — wait past the 2.5 s toast
//    auto-clear so the toast doesn't overlap the SAVED DOCS list.
await gotoDev();
await clearLocalDocs();
await tap('math-key-3');
await tap('math-key-plus');
await tap('math-key-4');
await page.waitForTimeout(80);
await tap('math-docs-save');
// Toast auto-clears after 2.5s — wait it out before opening the list
// to keep the screenshot uncluttered.
await page.waitForTimeout(2800);
await tap('math-docs-open-toggle');
await page.locator('[data-testid="math-docs-list"]').waitFor({ timeout: 3000 });
await page.waitForTimeout(200);
await shoot('math-docs-overlay');

// 9. Lock-equation tool armed (mid-flow)
await gotoDev();
await clearLocalDocs();
await tap('math-key-6');
await tap('math-key-plus');
await tap('math-key-2');
await page.waitForTimeout(100);
await page.locator('button', { hasText: /lock/i }).first().click();
await page.waitForTimeout(200);
await shoot('math-lock-armed');

// ── Phase 6 / 7 / 8 — universal-engine subjects ──────────────────

// 10. Chemistry tab — H + ₂ + O typed.
await gotoDev();
await clearLocalDocs();
await tap('math-category-chemistry');
await page.waitForTimeout(120);
await tap('math-chemistry-elements-hydrogen');
await tap('math-chemistry-ops-subscript-2');
await tap('math-chemistry-elements-oxygen');
await page.waitForTimeout(120);
await shoot('math-keyboard-chemistry');

// 11. Physics tab — α λ μ greek surface.
await gotoDev();
await clearLocalDocs();
await tap('math-category-physics');
await page.waitForTimeout(120);
await shoot('math-keyboard-physics');

// 12. Programming Java tab — `private String` typed (verified char-per-cell).
await gotoDev();
await clearLocalDocs();
await tap('math-category-programming-java');
await page.waitForTimeout(120);
await tap('math-java-kw-private');
await tap('math-java-kw-String');
await page.waitForTimeout(120);
await shoot('math-keyboard-java');

// 13. Programming Python tab.
await gotoDev();
await clearLocalDocs();
await tap('math-category-programming-python');
await page.waitForTimeout(120);
await shoot('math-keyboard-python');

// 14. Biology tab — A + T + G nucleotides.
await gotoDev();
await clearLocalDocs();
await tap('math-category-biology');
await page.waitForTimeout(120);
await tap('math-biology-nucleotides-adenine');
await tap('math-biology-nucleotides-thymine');
await tap('math-biology-nucleotides-guanine');
await page.waitForTimeout(120);
await shoot('math-keyboard-biology');

// 15. Statistics tab — μ + Σ + z.
await gotoDev();
await clearLocalDocs();
await tap('math-category-statistics');
await page.waitForTimeout(120);
await tap('math-stats-params-population-mean');
await page.waitForTimeout(80);
await shoot('math-keyboard-statistics');

// 16. Music tab — treble clef + quarter note.
await gotoDev();
await clearLocalDocs();
await tap('math-category-music');
await page.waitForTimeout(120);
await tap('math-music-clefs-treble-clef');
await tap('math-music-notes-quarter-note');
await tap('math-music-notes-eighth-note');
await page.waitForTimeout(120);
await shoot('math-keyboard-music');

// 17. Earth Science tab — sun + Mars typed.
await gotoDev();
await clearLocalDocs();
await tap('math-category-earth-science');
await page.waitForTimeout(120);
await tap('math-earth-astro-sun-symbol');
await tap('math-earth-astro-mars');
await page.waitForTimeout(120);
await shoot('math-keyboard-earth-science');

// 18. History tab — default `en` locale, no region (national + universal only).
await gotoDev();
await clearLocalDocs();
await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  const stores = window.__devMathStores;
  stores.useSettingsStore.getState().update({ language: 'en', historyRegion: null });
});
await page.waitForTimeout(80);
await tap('math-category-history');
await page.waitForTimeout(150);
await shoot('math-keyboard-history-en');

// 19. History tab — US-TX region (Alamo, Texas annexation, JFK).
await gotoDev();
await clearLocalDocs();
await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  const stores = window.__devMathStores;
  stores.useSettingsStore.getState().update({ language: 'en', historyRegion: 'US-TX' });
});
await page.waitForTimeout(80);
await tap('math-category-history');
await page.waitForTimeout(150);
await shoot('math-keyboard-history-us-tx');

// 20. History tab — ro locale (Romanian curriculum).
await gotoDev();
await clearLocalDocs();
await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  const stores = window.__devMathStores;
  stores.useSettingsStore.getState().update({ language: 'ro', historyRegion: null });
});
await page.waitForTimeout(80);
await tap('math-category-history');
await page.waitForTimeout(150);
await shoot('math-keyboard-history-ro');

// 21. Language Arts tab.
await gotoDev();
await clearLocalDocs();
await tap('math-category-language-arts');
await page.waitForTimeout(120);
await tap('math-la-pos-noun');
await tap('math-la-pos-verb');
await tap('math-la-pos-adjective');
await page.waitForTimeout(120);
await shoot('math-keyboard-language-arts');

await browser.close();
console.log('✅ Done.');
