/**
 * Standalone visual verifier — opens AI Chat / AAC Chat empty states
 * against the local dev server and writes screenshots + a JSON report
 * with rendered heights to /tmp.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001/prism-aac';
const OUT = '/tmp/prism-aac-visual';

await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

async function bootClean() {
  await page.goto(BASE);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
}

async function snap(label, openerRegex, panelTestId) {
  await bootClean();
  await page.getByRole('button', { name: openerRegex }).first().click();
  await page.waitForSelector(`[data-testid="${panelTestId}"]`);
  const panelBox = await page.locator(`[data-testid="${panelTestId}"]`).boundingBox();
  const kbBox    = await page.locator('[data-testid="keyboard-shell"]').boundingBox().catch(() => null);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  return { label, panel: panelBox, kb: kbBox };
}

const results = [];
results.push(await snap('ai-chat-compact', /^(AI|IA)$/, 'ai-chat-panel'));
results.push(await snap('aac-chat-compact', /Send|Mesaj|AAC/i, 'aac-chat-panel'));

console.log(JSON.stringify(results, null, 2));
await browser.close();
