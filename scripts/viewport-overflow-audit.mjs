import { webkit } from '@playwright/test';

const URL = 'https://prism-aac.vercel.app/prism-aac';
const VIEWPORTS = [
  { name: 'iphone-6.5',  w: 414,  h: 896 },
  { name: 'ipad-7',      w: 810,  h: 1080 },
  { name: 'ipad-13',     w: 1024, h: 1366 },
  { name: 'desktop-md',  w: 1280, h: 800 },
];

const browser = await webkit.launch({ headless: true });
for (const v of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(700);

  // Check for overflow / clipping at 4 panel states: none, math, marketplace, categories
  const states = ['none', 'math', 'marketplace', 'categories'];
  const findings = [];
  for (const state of states) {
    if (state !== 'none') {
      const opened = await page.evaluate((wantPanel) => {
        const map = { math: 'Math', marketplace: 'Marketplace', categories: 'Categories' };
        const label = map[wantPanel];
        const b = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('aria-label') || '') === label);
        if (b) { b.click(); return true; }
        return false;
      }, state);
      if (!opened) { findings.push(`${state}: button not found`); continue; }
      await page.waitForTimeout(700);
    }

    const layout = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) }; };
      const out = { viewport: window.innerHeight, scrollHeight: document.body.scrollHeight, sections: [] };
      document.querySelectorAll('header, section, nav, main, [data-testid$="-panel"], [data-testid="aac-toolbar-strip"]').forEach((el) => {
        const id = el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.tagName.toLowerCase();
        const x = r(el);
        if (x.height > 0) out.sections.push({ id, ...x });
      });
      return out;
    });

    // Detect overflow: any section bottom > viewport height
    const overflows = layout.sections.filter(s => s.bottom > layout.viewport + 1);
    const totalScroll = layout.scrollHeight - layout.viewport;
    findings.push({
      state,
      viewport: layout.viewport,
      scrollHeight: layout.scrollHeight,
      bodyOverflow: totalScroll > 0 ? totalScroll : 0,
      sectionOverflows: overflows.map(s => `${s.id} bottom=${s.bottom}`),
    });
  }

  console.log(`\n=== ${v.name} (${v.w}×${v.h}) ===`);
  for (const f of findings) console.log(JSON.stringify(f));
  await ctx.close();
}
await browser.close();
