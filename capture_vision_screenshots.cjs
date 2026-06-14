const { chromium } = require('playwright');
const path = require('path');

const SCENES = [
  {
    name: 'mealtime',
    icon: '🍽️',
    aiPhrase: 'I want more',
  },
  {
    name: 'bedtime',
    icon: '😴',
    aiPhrase: "I'm tired",
  },
  {
    name: 'schoolwork',
    icon: '📚',
    aiPhrase: 'Help please',
  },
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/prism-aac', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-testid="prediction-bar"]', { timeout: 15000 });
  await page.waitForTimeout(4000);

  for (const s of SCENES) {
    console.log(`Capturing ${s.name}...`);

    await page.evaluate(({ icon, aiPhrase }) => {
      const bar = document.querySelector('[data-testid="prediction-bar"]');
      if (!bar) return;
      bar.style.position = 'relative';

      const oldBadge = bar.querySelector('.vision-badge-mock');
      if (oldBadge) oldBadge.remove();
      bar.querySelectorAll('button').forEach(b => b.classList.remove('vision-glow'));

      const badge = document.createElement('span');
      badge.className = 'vision-badge-mock';
      badge.setAttribute('data-testid', 'vision-scene-badge');
      badge.style.cssText = 'position:absolute;top:-24px;right:8px;font-size:14px;opacity:0.9;pointer-events:none;z-index:10;';
      badge.textContent = icon;
      bar.appendChild(badge);

      const tiles = bar.querySelectorAll('button');
      if (tiles.length > 0) {
        const textSpan = tiles[0].querySelector('span:last-child');
        if (textSpan) textSpan.textContent = aiPhrase;
        tiles[0].classList.add('vision-glow');
      }
    }, s);

    await page.waitForTimeout(500);

    const outPath = path.join(__dirname, 'docs', 'screenshots', `vision-${s.name}.png`);
    await page.screenshot({ path: outPath });

    const badgeEl = await page.$('[data-testid="vision-scene-badge"]');
    const badgeText = badgeEl ? await badgeEl.textContent() : 'NONE';
    const firstTile = await page.$('[data-testid="prediction-bar"] button:first-child');
    const tileText = firstTile ? await firstTile.textContent() : 'NONE';
    const hasGlow = firstTile ? await firstTile.evaluate(el => el.classList.contains('vision-glow')) : false;
    console.log(`  Badge: ${badgeText}  Tile: "${tileText}"  Glow: ${hasGlow}`);
  }

  await browser.close();
  console.log('Done.');
})();
