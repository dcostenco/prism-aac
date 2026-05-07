/**
 * Standalone visual verifier — opens AI Chat / AAC Chat empty states
 * against the local or live Prism AAC and writes screenshots + a JSON
 * report with rendered heights to /tmp/prism-aac-visual/.
 *
 * IMPORTANT — Auth state coverage:
 *
 *   The AI Chat panel branches on `configured = !!profile`.
 *     • Unconfigured (profile=null) → header + 1-line hint, NO footer.
 *     • Configured + empty messages → header + (hidden body) + footer.
 *
 *   On a fresh Playwright context with cleared localStorage AND no
 *   Synalux session cookie, `fetchSynaluxProfile()` returns null →
 *   the unconfigured branch renders. That's roughly 100px tall and
 *   passes any "is it compact" smell test.
 *
 *   The actual end user is signed in. Their browser has the session
 *   cookie. They hit the configured-empty branch — header + a tall
 *   footer (~150–180px) — for a total of ~230–280px. THAT is the
 *   state to verify, not the unconfigured one.
 *
 *   This script intercepts /api/v1/profile and /api/v1/auth/session
 *   to inject a synthetic configured profile, then opens AI Chat and
 *   measures the panel — matching what the real signed-in user sees.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001/prism-aac';
const OUT = '/tmp/prism-aac-visual';
const VIEWPORT_W = parseInt(process.env.VIEWPORT_W || '1280', 10);
const VIEWPORT_H = parseInt(process.env.VIEWPORT_H || '800', 10);

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VIEWPORT_W, height: VIEWPORT_H } });
const page = await ctx.newPage();

// Intercept the actual auth + role endpoints so we can simulate a
// signed-in user. Paths from services/aiService.ts:fetchSynaluxProfile():
//   GET <synalux>/api/auth/session  →  { user: { email, name }, expires }
//   GET <synalux>/api/v1/roles/me   →  { aac_plan, is_platform_admin }
async function setupProfileMock() {
  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email: 'test@example.com', name: 'Test' }, expires: '2099-01-01' }),
    }),
  );
  await page.route('**/api/v1/roles/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ aac_plan: 'standard', is_platform_admin: false }),
    }),
  );
}

async function bootClean(withProfile = false) {
  if (withProfile) await setupProfileMock();
  await page.goto(BASE);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
  // Allow profile fetch to land
  if (withProfile) await page.waitForTimeout(800);
}

async function snap(label, openerRegex, panelTestId) {
  await page.getByRole('button', { name: openerRegex }).first().click();
  // 2026-05-07: when AI Chat / AAC Chat are in compact (empty) state
  // the panel UNMOUNTS entirely (returns null). We can no longer
  // wait for the testid; instead wait a beat and then probe for
  // existence as a separate measurement.
  await page.waitForTimeout(400);
  const panelLocator = page.locator(`[data-testid="${panelTestId}"]`);
  const panelExists = (await panelLocator.count()) > 0;
  const panel = panelExists ? await panelLocator.boundingBox() : null;
  const kb    = await page.locator('[data-testid="keyboard-shell"]').boundingBox().catch(() => null);
  // Detect which branch is rendering by visible markers.
  const requiresAccountVisible = await page
    .locator('text=/requires a Synalux account|AI Chat requires/i')
    .first()
    .isVisible()
    .catch(() => false);
  const footerHintVisible = await page
    .locator('text=/Type on the keyboard or tap|Type a question/i')
    .first()
    .isVisible()
    .catch(() => false);
  const askAiButtonVisible = await page
    .locator('button:has-text("Ask AI")')
    .first()
    .isVisible()
    .catch(() => false);
  const aacCtaVisible = await page
    .locator('[data-testid="aac-chat-add-contacts-cta"]')
    .first()
    .isVisible()
    .catch(() => false);
  const aacContactListVisible = await page
    .locator('[data-testid="aac-chat-contact-list"]')
    .first()
    .isVisible()
    .catch(() => false);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  // Branch order matters: AAC checks first (panel-specific markers),
  // then AI Chat unconfigured (account hint), then AI configured-empty.
  let branch = 'unknown';
  if (panelTestId === 'aac-chat-panel') {
    branch = aacCtaVisible
      ? 'aac-empty'
      : (aacContactListVisible ? 'aac-populated' : 'unknown');
  } else if (panelTestId === 'ai-chat-panel') {
    // 1) `requiresAccountVisible` → unconfigured branch (auth not loaded).
    // 2) Else if data-state="compact" → configured-empty (footer hidden
    //    in compact mode, so footer markers can't be the discriminator).
    // 3) Else → configured-expanded (user typed something or there's
    //    a conversation in progress).
    if (requiresAccountVisible) {
      branch = 'unconfigured';
    } else {
      const dataState = await page
        .locator('[data-testid="ai-chat-panel"]')
        .getAttribute('data-state')
        .catch(() => null);
      branch = dataState === 'compact'
        ? 'configured-empty'
        : (dataState === 'expanded' ? 'configured-expanded' : 'unknown');
    }
  }
  // MessageBar measurement — when a messaging side panel is open
  // (ai-chat or aac-chat) MessageBar reads sidePanel via uiStore and
  // grows by one line. We measure it so the verifier can confirm the
  // "expand type here panel by 1 line" rule is in effect.
  const msgBarLocator = page.locator('[data-messaging-mode]').first();
  const msgBarExists = (await msgBarLocator.count()) > 0;
  const msgBar = msgBarExists ? await msgBarLocator.boundingBox() : null;
  const msgBarMode = msgBarExists ? await msgBarLocator.getAttribute('data-messaging-mode') : null;
  return {
    label,
    panel: panel ? { x: panel.x, y: panel.y, w: panel.width, h: Math.round(panel.height) } : null,
    panelExists,
    kb: kb ? { y: kb.y, h: Math.round(kb.height) } : null,
    msgBar: msgBar ? { y: msgBar.y, h: Math.round(msgBar.height) } : null,
    msgBarMode,
    branch,
  };
}

const results = [];

console.error('--- Pass 1: UNCONFIGURED (no profile) ---');
await bootClean(false);
results.push({ pass: 'ai-unconfigured', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snap('ai-chat-unconfigured', /^(AI|IA)$/, 'ai-chat-panel')) });

console.error('--- Pass 2: CONFIGURED-EMPTY (with mocked profile) ---');
await bootClean(true);
results.push({ pass: 'ai-configured-empty', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snap('ai-chat-configured-empty', /^(AI|IA)$/, 'ai-chat-panel')) });

console.error('--- Pass 3: AAC empty contacts ---');
await bootClean(false);
results.push({ pass: 'aac-empty', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snap('aac-chat-compact', /Send|Mesaj|AAC/i, 'aac-chat-panel')) });

// Math panel — TWO branches: showMore=false (default, 3-row keyboard)
// and showMore=true (5-row keyboard with templates+categories+symbols).
// User feedback 2026-05-07: showMore=true rendering had the canvas
// crushed to ~120px because the 5-row keyboard ate the panel.
async function snapMath(label, openMore) {
  await bootClean(false);
  await page.getByRole('button', { name: /^(Math|Matemat)/i }).first().click();
  await page.waitForSelector('[data-testid="math-panel"]');
  if (openMore) {
    await page.locator('[data-testid="math-more-button"]').click();
  }
  await page.waitForTimeout(400);
  const panel = await page.locator('[data-testid="math-panel"]').boundingBox();
  const canvas = await page.locator('[data-testid="math-canvas"]').boundingBox();
  const keyboard = await page.locator('[data-testid="math-keyboard"]').boundingBox();
  const showMoreAttr = await page.locator('[data-testid="math-panel"]').getAttribute('data-show-more');
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  return {
    label,
    panel: panel ? { y: panel.y, h: Math.round(panel.height) } : null,
    canvas: canvas ? { y: canvas.y, h: Math.round(canvas.height) } : null,
    keyboard: keyboard ? { y: keyboard.y, h: Math.round(keyboard.height) } : null,
    branch: showMoreAttr === '1' ? 'math-more-open' : 'math-more-closed',
  };
}

console.error('--- Pass 4: Math, More closed (default) ---');
results.push({ pass: 'math-more-closed', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snapMath('math-more-closed', false)) });

console.error('--- Pass 5: Math, More open ---');
results.push({ pass: 'math-more-open', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snapMath('math-more-open', true)) });

// Phase 1A — MathGrid dev harness at /dev/math-grid. Confirms the new
// cell-grid canvas mounts standalone without depending on the AAC shell.
async function snapMathGridDev(label, fillExpression = false) {
  await page.goto(`${BASE}/dev/math-grid`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-grid"]');
  await page.waitForTimeout(300);
  if (fillExpression) {
    // Type "5+7=" via the on-screen keyboard so we exercise both grid
    // and keyboard, plus the glyph render path.
    for (const k of ['math-key-5', 'math-key-plus', 'math-key-7', 'math-key-equals']) {
      await page.locator(`[data-testid="${k}"]`).click();
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(150);
  }
  const grid = await page.locator('[data-testid="math-grid"]').boundingBox();
  const svg = await page.locator('[data-testid="math-grid-svg"]').boundingBox();
  const keyboard = await page.locator('[data-testid="math-main-keyboard"]').boundingBox().catch(() => null);
  const hasGridLines = (await page.locator('[data-testid="math-grid-lines"] line').count()) > 0;
  const hasCursor = (await page.locator('[data-testid="math-grid-cursor"]').count()) > 0;
  const glyphCount = await page.locator('[data-testid="math-grid-glyphs"] text').count();
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  return {
    label,
    panel: grid ? { y: grid.y, h: Math.round(grid.height) } : null,
    svg: svg ? { w: Math.round(svg.width), h: Math.round(svg.height) } : null,
    keyboard: keyboard ? { y: keyboard.y, h: Math.round(keyboard.height) } : null,
    hasGridLines,
    hasCursor,
    glyphCount,
    branch: hasGridLines && hasCursor ? (glyphCount > 0 ? 'with-glyphs' : 'mounted') : 'unknown',
  };
}

console.error('--- Pass 6: MathGrid dev empty (Phase 1A) ---');
results.push({ pass: 'math-grid-empty', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snapMathGridDev('math-grid-empty', false)) });

console.error('--- Pass 7: MathGrid dev with expression typed via keyboard (Phase 1B) ---');
results.push({ pass: 'math-grid-typed', viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, ...(await snapMathGridDev('math-grid-typed', true)) });

console.log(JSON.stringify(results, null, 2));
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
await browser.close();
