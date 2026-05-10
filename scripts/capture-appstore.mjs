/**
 * App Store screenshot capture — production web app at correct device resolutions.
 * Uses Playwright WebKit (closest to WKWebView) with iPhone frame-free viewport.
 */
import { chromium, webkit } from 'playwright';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const DEST = '/Users/admin/prism-aac/ios-native/screenshots/appstore';
const URL  = 'https://prism-aac.vercel.app/prism-aac';

const DEVICES = [
  // iPhones — portrait
  { file: 'iphone-6.9-promax.png', w: 1320, h: 2868, dpr: 3, label: 'iPhone 17 Pro Max 6.9"' },
  { file: 'iphone-6.3-pro.png',    w: 1206, h: 2622, dpr: 3, label: 'iPhone 17 Pro 6.3"'     },
  { file: 'iphone-air.png',        w: 1179, h: 2556, dpr: 3, label: 'iPhone Air'              },
  { file: 'iphone-6.1.png',        w: 1170, h: 2532, dpr: 3, label: 'iPhone 17e 6.1"'         },
  // iPads — portrait
  { file: 'ipad-pro-13.png',  w: 2064, h: 2752, dpr: 2, label: 'iPad Pro 13"'    },
  { file: 'ipad-pro-11.png',  w: 1668, h: 2388, dpr: 2, label: 'iPad Pro 11"'    },
  { file: 'ipad-air-13.png',  w: 2064, h: 2752, dpr: 2, label: 'iPad Air 13" M4' },
  { file: 'ipad-air-11.png',  w: 1668, h: 2388, dpr: 2, label: 'iPad Air 11" M4' },
  { file: 'ipad-mini.png',    w: 1488, h: 2266, dpr: 2, label: 'iPad mini A17'   },
  { file: 'ipad-a16.png',     w: 1640, h: 2360, dpr: 2, label: 'iPad A16'        },
  // Apple Watch — use native simctl screenshots (already saved)
];

const browser = await webkit.launch({ headless: true });

for (const d of DEVICES) {
  console.log(`  Capturing ${d.label}...`);
  const ctx = await browser.newContext({
    viewport: { width: d.w / d.dpr, height: d.h / d.dpr },
    deviceScaleFactor: d.dpr,
    isMobile: !d.file.startsWith('ipad'),
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  // Wait for AAC content to fully hydrate
  await page.waitForTimeout(3000);
  // Blur any focused input so the virtual keyboard state is dismissed
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.waitForTimeout(500);
  const shot = await page.screenshot({ fullPage: false });
  writeFileSync(`${DEST}/${d.file}`, shot);
  console.log(`    ✓ ${d.file} (${d.w}×${d.h})`);
  await ctx.close();
}

await browser.close();
console.log('\nAll screenshots done.');
