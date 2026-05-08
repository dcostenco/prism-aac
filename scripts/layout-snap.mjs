import { webkit } from '@playwright/test';
const URL = 'https://prism-aac.vercel.app/prism-aac';
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
await page.waitForTimeout(1000);

// Capture full-page baseline
await page.screenshot({ path: '/tmp/layout-baseline.png', fullPage: false });

// Open Categories
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('aria-label') || '') === 'Categories' || (x.textContent || '').trim() === '📂');
  if (b) b.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/layout-categories.png', fullPage: false });

// Measure all major layout regions and check for overlaps
const layout = await page.evaluate(() => {
  const tags = ['header', 'nav', 'main', 'section', 'footer', 'aside'];
  const out = [];
  for (const t of tags) {
    document.querySelectorAll(t).forEach((el) => {
      const r = el.getBoundingClientRect();
      const id = el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.id || el.className.split(/\s+/)[0] || t;
      if (r.height > 5 && r.width > 5) {
        out.push({
          tag: t, id, top: Math.round(r.top), height: Math.round(r.height),
          bottom: Math.round(r.bottom), width: Math.round(r.width),
          z: getComputedStyle(el).zIndex,
        });
      }
    });
  }
  // also catch divs that look like panels (flex-1 / flex-[3])
  document.querySelectorAll('div[class*="flex-"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 80 && r.width > 200) {
      out.push({
        tag: 'div', id: (el.getAttribute('class')||'').slice(0, 60),
        top: Math.round(r.top), height: Math.round(r.height),
        bottom: Math.round(r.bottom), width: Math.round(r.width),
        z: getComputedStyle(el).zIndex,
      });
    }
  });
  out.push({ tag: 'viewport', id: '-', top: 0, height: window.innerHeight, bottom: window.innerHeight, width: window.innerWidth, z: '-' });
  // Sort by top
  out.sort((a, b) => a.top - b.top);
  return out;
});
console.log(JSON.stringify(layout, null, 2));
// Detect overlaps (sections that share vertical space)
const sections = layout.filter(l => l.tag === 'section');
console.log('\n=== SECTIONS OVERLAP CHECK ===');
for (let i = 0; i < sections.length; i++) {
  for (let j = i+1; j < sections.length; j++) {
    if (sections[i].bottom > sections[j].top && sections[i].top < sections[j].bottom) {
      console.log('OVERLAP:', sections[i].id, 'vs', sections[j].id, '— shared y range', Math.max(sections[i].top, sections[j].top), '-', Math.min(sections[i].bottom, sections[j].bottom));
    }
  }
}

await browser.close();
