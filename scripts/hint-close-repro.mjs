import { webkit } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleLines = [];
page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text()}`));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
await page.waitForTimeout(800);

// Open Math panel — find by aria-label="Math" or emoji 🔢
const opened = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const m = btns.find(b => (b.getAttribute('aria-label') || '') === 'Math' || (b.textContent || '').trim() === '🔢');
  if (m) { m.click(); return true; }
  return false;
});
console.log('Math button found+clicked:', opened);
await page.waitForTimeout(800);
const mathPanelBefore = await page.locator('[data-testid="math-panel"]').count();
console.log('math-panel visible before hint:', mathPanelBefore);

// Type 2+3 in math grid
for (const k of ['2','+','3']) {
  try { await page.locator(`button:has-text("${k}")`).first().click({ delay: 30 }); } catch {}
}
await page.waitForTimeout(300);

// Click Hint
await page.locator('[data-testid="math-tutor-hint"]').first().click({ timeout: 3000 });
console.log('Hint clicked, waiting for response...');
await page.waitForTimeout(3000);

const responseVisible = await page.locator('[data-testid="math-tutor-response"]').count();
console.log('hint response visible:', responseVisible);

// Click the X dismiss in the bubble
const dismiss = page.locator('[data-testid="math-tutor-dismiss"]');
const dismissCount = await dismiss.count();
console.log('dismiss button count:', dismissCount);
if (dismissCount > 0) {
  await dismiss.first().click({ delay: 30 });
  await page.waitForTimeout(500);
}

const panelAfter = await page.locator('[data-testid="math-panel"]').count();
const responseAfter = await page.locator('[data-testid="math-tutor-response"]').count();
console.log('\n=== POST-DISMISS STATE ===');
console.log('math-panel visible:', panelAfter, panelAfter === 1 ? '✅ panel still open' : '❌ PANEL CLOSED — THIS IS THE BUG');
console.log('hint-response visible:', responseAfter, responseAfter === 0 ? '✅ hint closed' : '❌ hint still showing');

await browser.close();
