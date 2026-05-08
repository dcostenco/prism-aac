import { webkit } from '@playwright/test';
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('https://prism-aac.vercel.app/prism-aac', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[data-key="Q"]', { timeout: 15000 });
await page.waitForTimeout(800);

// What buttons are accessible by name "AI"?
const matches = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).filter(b => /AI/i.test(b.getAttribute('aria-label') || '')).map(b => ({
    aria: b.getAttribute('aria-label'),
    title: b.getAttribute('title'),
    text: (b.textContent || '').trim().slice(0, 40),
  }));
});
console.log('Buttons matching /AI/i aria:'); console.log(JSON.stringify(matches, null, 2));

// Try clicking the AI button
try {
  await page.getByRole('button', { name: 'AI' }).click({ timeout: 3000 });
  await page.waitForTimeout(800);
  const panelExists = await page.locator('[data-testid="ai-chat-panel"]').count();
  const sidePanel = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('prism-aac-ui') || '{}').state?.sidePanel; }
    catch { return 'no-storage'; }
  });
  // What text is visible?
  const aiChatText = await page.locator('text=/AI Chat/i').count();
  console.log('After click — aiChat panel count:', panelExists);
  console.log('After click — sidePanel state:', sidePanel);
  console.log('After click — text "AI Chat" matches:', aiChatText);
  // Snapshot
  await page.screenshot({ path: '/tmp/ai-chat-snap.png', fullPage: false });
} catch (e) {
  console.log('Click failed:', e.message?.slice(0, 200));
}

await browser.close();
