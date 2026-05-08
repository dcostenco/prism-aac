/**
 * Capture documentation screenshots for ALL prism-aac modules
 * (categories, AI chat, schedule, games, settings, marketplace,
 * AAC chat, hero/home). Idempotent — overwrites on each run.
 *
 * Usage:
 *   PORT=3001 npm run dev
 *   node scripts/capture-modules-docs.mjs
 *
 * Toolbar buttons we need (math, ai_chat, aac_chat, schedule,
 * marketplace, games, notes, history, sound) are hidden by the
 * minimal default in 0.9.0 — script enables every built-in
 * temporarily so each panel can be opened without interacting
 * with Settings.
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

async function gotoApp() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function enableAllToolbarButtons() {
  await page.evaluate(() => {
    try {
      const ls = window.localStorage;
      const cur = { state: { toolbarConfig: { order: [], enabled: {
        categories: true, mic: true, schedule: true, marketplace: true,
        alert: true, math: true, ai_chat: true, aac_chat: true,
        notes: true, games: true, history: true, sound: true, settings: true,
        pdf_reader: true, ocr_capture: true,
      } } }, version: 0 };
      ls.setItem('prism-aac-settings', JSON.stringify(cur));
    } catch {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
}

async function shoot(name) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`  → ${path.relative(process.cwd(), dest)}`);
}

async function closeAnyPanel() {
  // Try clicking the close ✕ on whatever panel is open.
  const closes = page.locator('button[aria-label*="Close"], button[aria-label*="close"]');
  const n = await closes.count();
  for (let i = 0; i < n; i++) {
    const c = closes.nth(i);
    if (await c.isVisible().catch(() => false)) {
      await c.click().catch(() => {});
      await page.waitForTimeout(150);
    }
  }
}

console.log('▶ Capturing prism-aac module screenshots…');

await gotoApp();
await enableAllToolbarButtons();

// 1. Hero / home — full app shell with categories visible.
await page.waitForTimeout(300);
await shoot('app-hero');

// Toolbar aria-labels are short i18n strings ("AI" not "AI Chat",
// "Send a message" not "AAC Chat") so anchor on the icon emoji
// inside the visible button text — those are stable across locales.
async function clickToolbarByIcon(emoji) {
  // The button renders the emoji as the first <span>; its
  // accessible name is the aria-label, but the visible text
  // contains the emoji. textContent match is reliable.
  // Toolbar lives in a flex bar at the top of the AAC shell; emoji
  // text is rendered inside the button. Filtering on visible text
  // works regardless of locale.
  const btn = page.locator(`button:has-text("${emoji}")`).first();
  await btn.click({ timeout: 5000 });
}

// 2. Categories panel.
await clickToolbarByIcon('📂');
await page.waitForTimeout(400);
await shoot('panel-categories');
await closeAnyPanel();

// 3. AI Chat panel — type a question first so the panel doesn't
//    render in compact-empty mode. We write directly into the
//    messageStore via the existing keyboard so the prediction bar
//    + ColoredText render too.
await page.locator('button[data-key="W"]').click();
await page.locator('button[data-key="H"]').click();
await page.locator('button[data-key="Y"]').click();
await page.waitForTimeout(80);
await clickToolbarByIcon('✨');
await page.waitForTimeout(500);
await shoot('panel-ai-chat');
await closeAnyPanel();
// Reset the message bar so other panels see a fresh state.
await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  try { window.localStorage.removeItem('aac-message'); } catch {}
});

// 4. AAC Chat panel — needs at least one contact to render
//    something interesting; if the inbox is empty the panel may
//    show a placeholder. Tap the icon and capture whatever state.
await clickToolbarByIcon('💬');
await page.waitForTimeout(500);
await shoot('panel-aac-chat');
await closeAnyPanel();

// 5. Schedule panel.
await clickToolbarByIcon('📅');
await page.waitForTimeout(500);
await shoot('panel-schedule');
await closeAnyPanel();

// 6. Games panel.
await clickToolbarByIcon('🎮');
await page.waitForTimeout(500);
await shoot('panel-games');
await closeAnyPanel();

// 7. Marketplace panel.
await clickToolbarByIcon('🏪');
await page.waitForTimeout(500);
await shoot('panel-marketplace');
await closeAnyPanel();

// 7a. PDF Reader panel — added in May 2026 as part of Read & Write
//     parity. Empty-state is the most representative — the user
//     hasn't picked a PDF yet so we show the file-picker prompt.
await clickToolbarByIcon('📄');
await page.waitForTimeout(400);
await shoot('panel-pdf-reader');
await closeAnyPanel();

// 7b. OCR Capture panel — also Read & Write parity. Empty-state too
//     since the camera/file picker is the entry point.
await clickToolbarByIcon('👁');
await page.waitForTimeout(400);
await shoot('panel-ocr-capture');
await closeAnyPanel();

// 8. Settings modal — settings has its own gear icon ⚙ rendered
//    as the second-to-last button in the toolbar.
await clickToolbarByIcon('⚙️');
await page.waitForTimeout(400);
await shoot('panel-settings');

// 9. Settings — scroll to math section if present.
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="math-hold-time-slider"]');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
});
await page.waitForTimeout(200);
await shoot('panel-settings-math');

// 10. Settings — scroll to text/voice/input modes section.
await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('h3'));
  const target = headers.find((h) => /input|voice|gesture/i.test(h.textContent || ''));
  if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' });
});
await page.waitForTimeout(200);
await shoot('panel-settings-input-modes');

await closeAnyPanel();

// 11. Toolbar bar alone — capture top toolbar with the chrome.
await gotoApp();
await page.waitForTimeout(300);
await shoot('toolbar');

await browser.close();
console.log('✅ Done.');
