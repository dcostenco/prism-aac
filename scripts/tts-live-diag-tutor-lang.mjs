/**
 * Live diag for the math-tutor language directive. Confirms the
 * deployed bundle sends "Respond in {lang}." to the chat API for a
 * Romanian-locale user — preventing the May 2026 regression where
 * the hint came back in English even though RO was selected.
 */
import { webkit } from '@playwright/test';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const LANGS = ['ro', 'es', 'fr'];

const browser = await webkit.launch({ headless: true });
for (const lang of LANGS) {
  console.log(`\n=== Testing ${lang} tutor prompt ===`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript((L) => {
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: L, outputLanguage: L, speechRate: 1, speechVolume: 1 },
      version: 4,
    }));
  }, lang);

  const captured = [];
  page.on('request', async (r) => {
    const u = r.url();
    if (u.includes('/api/v1/prism-aac/chat') || u.includes('/api/v1/chat')) {
      try { captured.push(JSON.parse(r.postData() || '{}')); } catch {}
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  // Open Math panel — find the math toolbar button by emoji or aria-label
  // Toolbar emoji for math is 🔢 or similar, aria-label "Math"
  try {
    await page.locator('button[aria-label*="Math" i], button:has-text("🔢")').first().click({ timeout: 3000 });
  } catch {
    console.log('  could not open Math via aria; trying generic toolbar tap');
    const buttons = await page.locator('header button, .aac-bar button').all();
    for (const b of buttons) {
      const txt = await b.textContent().catch(() => '');
      if (txt && /math|🔢|matem|matemati/i.test(txt)) { await b.click(); break; }
    }
  }
  await page.waitForTimeout(800);

  // Type something into the math grid (digit keys)
  for (const ch of '23+5') {
    try { await page.locator(`button:has-text("${ch}")`).first().click({ delay: 30 }); }
    catch {}
  }
  await page.waitForTimeout(300);

  // Click Hint button
  try {
    await page.locator('[data-testid="math-tutor-hint"]').first().click({ timeout: 3000 });
  } catch (e) {
    console.log('  Hint button not found:', e.message?.slice(0, 80));
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(4000);

  console.log(`  captured ${captured.length} chat request(s)`);
  for (const body of captured) {
    const msgs = body.messages || [];
    const userMsg = msgs.find(m => m.role === 'user')?.content || '';
    const sysMsg = msgs.find(m => m.role === 'system')?.content || '';
    const hasRespondIn = /Respond in [A-Z][a-zA-Z]+\./.test(userMsg) || /Respond in [A-Z][a-zA-Z]+\./.test(sysMsg);
    const hasNatural = /natural[^,]+phrasing/.test(userMsg);
    console.log(`  user msg tail: "...${userMsg.slice(-180)}"`);
    console.log(`  system has 'home language is': ${/home language is/.test(sysMsg)}`);
    console.log(`  user prompt has 'Respond in X.': ${hasRespondIn} ${hasRespondIn ? '✅' : '❌'}`);
    console.log(`  user prompt has 'natural phrasing': ${hasNatural} ${hasNatural ? '✅' : '❌'}`);
  }

  await ctx.close();
}
await browser.close();
