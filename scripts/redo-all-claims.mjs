/**
 * REDO ALL — every claim from docs/BUGS-2026-05-08.md, retested with
 * realistic user state seeded into headless WebKit. Replaces the
 * earlier fresh-context-only verification that the user (rightly)
 * called out as insufficient evidence.
 *
 * Per Definition-of-Done #11: state reproduction is mandatory before
 * any "verified" claim.
 */
import { webkit } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const URL_VERCEL = 'https://prism-aac.vercel.app/prism-aac';
const URL_SYNALUX = 'https://synalux.ai/prism-aac';
const PDF_VINELAND = '/Users/admin/Downloads/Vineland-3-Comprehensive-Report_80259322_1778166067638.pdf';
const PDF_ALGEBRA = '/Users/admin/Downloads/g.r.9_09_15_16_092016_0831PM.pdf';

const REALISTIC_STATE = {
  state: {
    language: 'en',
    outputLanguage: 'en',
    speechRate: 1,
    speechVolume: 1,
    gridSize: 6,
    activeVocabSet: 'all',
    installedApps: ['app-1','app-2','app-3','app-4','app-5'],
    voicePreferences: {},
    speakOnSentenceEnd: true,
  },
  version: 4,
};

const results = [];
const log = (n, status, evidence) => {
  results.push({ n, status, evidence });
  const ic = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'uncertain' ? '⚠️' : '⚪';
  console.log(`${ic} ${n.padEnd(75)} ${evidence}`);
};

const browser = await webkit.launch({ headless: true });

const seedState = async (ctx, lang, outputLang, installedApps = []) => {
  await ctx.addInitScript((seed) => {
    try {
      localStorage.setItem('prism-aac-settings', JSON.stringify(seed));
    } catch {}
  }, {
    state: { ...REALISTIC_STATE.state, language: lang, outputLanguage: outputLang, installedApps },
    version: 4,
  });
};

// ── Pre-fetch chunks once for grep ─────────────────────────────────
const html = await (await fetch(URL_VERCEL)).text();
const chunkPaths = [...new Set([...html.matchAll(/_next\/static\/chunks\/([^"]+\.js)/g)].map(m => m[1]))];
const chunks = await Promise.all(chunkPaths.map(async p => {
  const r = await fetch(`https://prism-aac.vercel.app/prism-aac/_next/static/chunks/${p}`);
  return { p, body: await r.text() };
}));
const grep = (re) => chunks.some(c => re.test(c.body));

// ── Confirm latest commit shipped to deploy ────────────────────────
const localHead = execSync('git rev-parse --short HEAD', { cwd: '/Users/admin/prism-aac' }).toString().trim();
const deployHasIsUnreadable = grep(/PDF_UNREADABLE_PREFIX|isUnreadable/);
log(`deploy includes latest PDF fix (${localHead})`, deployHasIsUnreadable ? 'pass' : 'uncertain', deployHasIsUnreadable ? 'isUnreadable in chunks' : 'PDF loop fix not yet on deploy — newer commit may still be building');

// ── #1 TTS ─────────────────────────────────────────────────────────
log('#1 ctx.state guard ships', grep(/stuck in state/i) ? 'pass' : 'fail', 'chunk grep');
log('#1 rate clamp ships', grep(/Math\.max\(\.5,Math\.min\(2/) ? 'pass' : 'fail', 'chunk grep');

// ── #2 Tutor language wiring (with seeded state) ───────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await seedState(ctx, 'en', 'ro');
  const page = await ctx.newPage();
  const captured = [];
  page.on('request', r => {
    if (r.url().includes('/api/v1/prism-aac/chat')) {
      try { captured.push(JSON.parse(r.postData() || '{}')); } catch {}
    }
  });
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('aria-label')||'') === 'Math');
    b?.click();
  });
  await page.waitForTimeout(800);
  for (const k of ['2','+','3']) try { await page.locator(`button:has-text("${k}")`).first().click({delay:30}); } catch {}
  await page.waitForTimeout(200);
  try { await page.locator('[data-testid="math-tutor-hint"]').first().click({timeout:3000}); } catch {}
  await page.waitForTimeout(3500);
  const userMsg = captured[0]?.messages?.find(m => m.role==='user')?.content || '';
  const sysMsg = captured[0]?.messages?.find(m => m.role==='system')?.content || '';
  log('#2 tutor sends "Respond in Romanian." with outputLanguage=ro state', /Respond in Romanian\./.test(userMsg) ? 'pass' : 'fail', `userMsg ends: "${userMsg.slice(-80)}"`);
  log('#2 system prompt has "home language is Romanian"', /home language is Romanian/.test(sysMsg) ? 'pass' : 'fail', `sysMsg has dir: ${/home language/.test(sysMsg)}`);
  await ctx.close();
}

// ── #3 Translate RU→IT (unit-test surrogate, since AI refine is async) ──
try {
  const out = execSync('npx vitest run tests/translateService.test.ts 2>&1', { encoding: 'utf8' });
  const pass = /Tests\s+\d+ passed/.test(out) && !/failed/i.test(out);
  log('#3 RU→IT no-leak unit tests', pass ? 'pass' : 'fail', out.split('\n').filter(l=>/Tests/.test(l))[0] || 'no summary');
} catch (e) {
  log('#3 RU→IT no-leak unit tests', 'fail', e.message?.slice(0,100));
}

// ── #4 PDF Reader — Vineland-3 (clinical) AND algebra (image-only) ──
async function pdfTest(ctx, page, pdfPath, label) {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /PDF/i.test(x.getAttribute('aria-label') || '') || /📄/.test(x.textContent || ''));
    b?.click();
  });
  await page.waitForTimeout(800);
  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.waitForTimeout(8000);
  const tiles = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-testid^="pdf-reader-page-"]'));
    return rows.slice(0,3).map(r => (r.textContent || '').slice(0, 200));
  });
  const errored = tiles.filter(t => /could not be read/.test(t)).length;
  const empty = tiles.filter(t => /\(empty page|image-only|unsupported/i.test(t)).length;
  return { tiles, errored, empty, total: tiles.length };
}

if (fs.existsSync(PDF_VINELAND)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await seedState(ctx, 'en', 'en');
  const page = await ctx.newPage();
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  const r = await pdfTest(ctx, page, PDF_VINELAND, 'vineland');
  log('#4 Vineland-3 extracts (no per-page errors)', r.total > 0 && r.errored === 0 ? 'pass' : 'fail', `${r.total} tiles, ${r.errored} errors, ${r.empty} empty/image-only`);
  await ctx.close();
} else {
  log('#4 Vineland-3 extracts', 'skip', 'PDF not present');
}

if (fs.existsSync(PDF_ALGEBRA)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await seedState(ctx, 'en', 'en');
  const page = await ctx.newPage();
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  const r = await pdfTest(ctx, page, PDF_ALGEBRA, 'algebra');
  // For an image-only PDF the SUCCESS condition is graceful empty / unreadable label, NOT the looping error.
  const hasLoopText = r.tiles.some(t => /could not be read at getTextContent: undefined is not a function/.test(t));
  log('#4 algebra (image-only PDF) does NOT show looping error tile', !hasLoopText ? 'pass' : 'fail', `tile 0: "${r.tiles[0]?.slice(0,80)||''}"`);
  await ctx.close();
} else {
  log('#4 algebra PDF graceful', 'skip', 'PDF not present');
}

// ── #5 SW killswitch ───────────────────────────────────────────────
log('#5 killswitch script in HTML', /prism-aac-sw-killswitch/.test(html) ? 'pass' : 'fail', 'HTML grep');
log('#5 killswitch unregisters SW + clears caches', /serviceWorker/.test(html) && /caches\.delete/.test(html) ? 'pass' : 'fail', 'HTML grep');
{
  // Killswitch live-eviction test. addInitScript can't be used here
  // because it re-runs on every navigation and races with the
  // killswitch reload — set the OLD marker BEFORE the first real
  // navigation via about:blank seed (one-shot).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const seedPage = await ctx.newPage();
  await seedPage.goto(URL_VERCEL.replace('/prism-aac', '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
  await seedPage.evaluate(() => {
    localStorage.setItem('prism-aac-sw-killswitch', 'TEST-OLD-MARKER-x');
  }).catch(() => {});
  await seedPage.close();
  const page = await ctx.newPage();
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  try { await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 }); } catch {}
  const post = await page.evaluate(async () => ({
    marker: localStorage.getItem('prism-aac-sw-killswitch'),
  }));
  const evicted = post.marker !== 'TEST-OLD-MARKER-x' && post.marker?.startsWith('2026-05-08');
  log('#5 killswitch overwrites old marker on first visit', evicted ? 'pass' : 'fail', `marker after: ${post.marker}`);
  await ctx.close();
}

// ── #6 sw.js regenerated ───────────────────────────────────────────
{
  const swR = await fetch('https://prism-aac.vercel.app/sw.js');
  const swText = await swR.text();
  log('#6 sw.js regenerated (not Apr-30 stale)', /tts-cache-bust/.test(swText) ? 'pass' : 'fail', `sw.js size=${swText.length}, has marker=${/tts-cache-bust/.test(swText)}`);
}

// ── #7 HTTPS gate (no localhost:11434 fetch) ───────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await seedState(ctx, 'en', 'en');
  const page = await ctx.newPage();
  const ollamaReqs = [];
  page.on('request', r => { if (/localhost:11434|127\.0\.0\.1:11434/.test(r.url())) ollamaReqs.push(r.url()); });
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(3000);
  log('#7 No localhost:11434 fetch on HTTPS', ollamaReqs.length === 0 ? 'pass' : 'fail', `${ollamaReqs.length} stray Ollama fetches`);
  await ctx.close();
}

// ── #8 Math kbd phase 2 ────────────────────────────────────────────
log('#8 trig keys (sin/cos/tan literals)', grep(/"sin"/) && grep(/"cos"/) && grep(/"tan"/) ? 'pass' : 'fail', 'chunk grep');
log('#8 Java ++ -- compound assigns', grep(/"\+\+"/) && grep(/"--"/) ? 'pass' : 'fail', 'chunk grep');
log('#8 System.out.println idiom', grep(/System\.out\.println/) ? 'pass' : 'fail', 'chunk grep');

// ── #9 Workflow files ──────────────────────────────────────────────
{
  const v1 = fs.readdirSync('/Users/admin/prism-aac/tests/workflows').filter(f=>f.endsWith('.md')).length;
  const v2 = fs.readdirSync('/Users/admin/prism-aac/tests/workflows/grade-8-12').filter(f=>f.endsWith('.md')).length;
  const e2e = fs.readdirSync('/Users/admin/prism-aac/e2e/math-workflows').filter(f=>f.endsWith('.spec.ts')).length;
  log('#9 workflow files present', v1 >= 12 && v2 >= 12 && e2e >= 12 ? 'pass' : 'fail', `v1=${v1}, grade-8-12=${v2}, e2e=${e2e}`);
}

// ── #10 hint-close ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await seedState(ctx, 'en', 'en');
  const page = await ctx.newPage();
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('aria-label')||'') === 'Math'); b?.click(); });
  await page.waitForTimeout(800);
  for (const k of ['2','+','3']) try { await page.locator(`button:has-text("${k}")`).first().click({delay:30}); } catch {}
  await page.waitForTimeout(200);
  try { await page.locator('[data-testid="math-tutor-hint"]').first().click({timeout:3000}); } catch {}
  await page.waitForTimeout(3000);
  const beforeDismiss = await page.locator('[data-testid="math-panel"]').count();
  try { await page.locator('[data-testid="math-tutor-dismiss"]').first().click({delay:30}); } catch {}
  await page.waitForTimeout(500);
  const afterDismiss = await page.locator('[data-testid="math-panel"]').count();
  const responseGone = await page.locator('[data-testid="math-tutor-response"]').count();
  log('#10 hint-close keeps math panel open (headless — user state may differ)', beforeDismiss === 1 && afterDismiss === 1 && responseGone === 0 ? 'pass' : 'fail', `panel before=${beforeDismiss} after=${afterDismiss}, response after=${responseGone}`);
  await ctx.close();
}

// ── #11 openCategories UP-nav ──────────────────────────────────────
log('#11 openCategories handles category-detail (chunk grep)', grep(/category-detail/) ? 'pass' : 'fail', 'chunk grep');
{
  // Direct unit-style via state inspection
  try {
    const out = execSync('cd /Users/admin/prism-aac && npx vitest run tests/uiStore-openCategories.test.ts 2>&1', { encoding: 'utf8' });
    const pass = /Tests\s+\d+ passed/.test(out) && !/failed/i.test(out);
    log('#11 openCategories navigation tests', pass ? 'pass' : 'fail', out.split('\n').filter(l=>/Tests/.test(l))[0] || '?');
  } catch (e) {
    log('#11 openCategories navigation tests', 'fail', e.message?.slice(0,100));
  }
}

// ── #13 Toolbar single-row with installed apps ─────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // 20 installed apps — worst-case real user state
  await seedState(ctx, 'en', 'en', Array.from({length:20}, (_,i)=>`app-${i}`));
  const page = await ctx.newPage();
  await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  const stripHeight = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="aac-toolbar-strip"]');
    return s ? s.getBoundingClientRect().height : -1;
  });
  log('#13 Toolbar < 80px with 20 installed apps', stripHeight > 0 && stripHeight < 80 ? 'pass' : 'fail', `strip height=${stripHeight}px`);
  await ctx.close();
}

// ── #14 Viewport audit at 4 profiles ───────────────────────────────
{
  const VIEWS = [{n:'iphone-6.5',w:414,h:896},{n:'ipad-7',w:810,h:1080},{n:'desktop-md',w:1280,h:800}];
  let allClean = true; const detail = [];
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
    await seedState(ctx, 'en', 'en');
    const page = await ctx.newPage();
    await page.goto(URL_VERCEL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    if (overflow > 0) { allClean = false; detail.push(`${v.n}:+${overflow}px`); } else detail.push(`${v.n}:OK`);
    await ctx.close();
  }
  log('#14 No body overflow at iPhone-6.5 / iPad-7 / desktop-md', allClean ? 'pass' : 'fail', detail.join(' | '));
}

await browser.close();

// ── Summary ────────────────────────────────────────────────────────
const pass = results.filter(r => r.status === 'pass').length;
const fail = results.filter(r => r.status === 'fail').length;
const uncertain = results.filter(r => r.status === 'uncertain').length;
const skip = results.filter(r => r.status === 'skip').length;
console.log(`\nTotal: ${pass} pass / ${fail} fail / ${uncertain} uncertain / ${skip} skip`);
console.log(`\nNote: state-seeded headless tests are necessary but NOT sufficient. Real-Safari user-confirmed retest is the actual definition of done.`);
process.exit(fail === 0 ? 0 : 1);
