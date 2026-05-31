const { chromium } = require('playwright');

const BASE = 'http://localhost:3001/prism-aac';
const OUT_SS = '/tmp/appstore_screenshots';
const OUT_FRAMES = '/tmp/appstore_video/frames';

// iPad Pro 12.9" at 2x = 1024x1366 CSS → 2048x2732 pixels
async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
    });
    
    const scenes = [
        { name: 'home', nav: null, wait: 3000 },
        { name: 'categories', nav: 'Help', wait: 3000 },
        { name: 'keyboard', nav: 'Keyboard', wait: 2000, type: 'I need water please' },
        { name: 'ai-chat', nav: 'AI', wait: 3000 },
        { name: 'bedside', nav: 'Bedside', wait: 3000 },
        { name: 'schedule', nav: 'Schedule', wait: 3000 },
        { name: 'games', nav: 'Games', wait: 3000 },
        { name: 'school', nav: 'School', wait: 3000 },
        { name: 'settings', nav: 'Settings', wait: 3000 },
        { name: 'marketplace', nav: 'Marketplace', wait: 3000 },
    ];
    
    for (const scene of scenes) {
        const page = await ctx.newPage();
        try {
            await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
            await page.waitForTimeout(2000);
            
            if (scene.nav) {
                // Try multiple selectors
                const selectors = [
                    `button:has-text("${scene.nav}")`,
                    `[data-tab="${scene.nav.toLowerCase()}"]`,
                    `text=${scene.nav}`,
                    `a:has-text("${scene.nav}")`,
                ];
                for (const sel of selectors) {
                    const el = page.locator(sel).first();
                    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await el.click();
                        await page.waitForTimeout(1500);
                        break;
                    }
                }
            }
            
            if (scene.type) {
                const input = page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
                if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await input.click();
                    await input.type(scene.type, { delay: 80 });
                }
            }
            
            await page.waitForTimeout(scene.wait);
            
            // Save raw screenshot (no overlay)
            await page.screenshot({ path: `${OUT_SS}/ipad_${scene.name}.png`, fullPage: false });
            console.log(`${scene.name}: captured (${page.viewportSize().width}x${page.viewportSize().height})`);
            
        } catch (e) {
            console.log(`${scene.name}: FAILED — ${e.message.slice(0, 60)}`);
        }
        await page.close();
    }
    
    await browser.close();
    console.log('All screenshots done');
}

run().catch(console.error);
