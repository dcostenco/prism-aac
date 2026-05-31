const { chromium } = require('playwright');

const BASE = 'http://localhost:3001/prism-aac';
const OUT = '/tmp/appstore_screenshots';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
    });
    
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000); // let everything hydrate
    
    // Home
    await page.screenshot({ path: `${OUT}/ipad_home.png` });
    console.log('home OK');
    
    // Navigate tabs by clicking
    const tabs = [
        ['categories', ['Help', 'Categories']],
        ['keyboard', ['Keyboard', 'Type']],
        ['ai-chat', ['AI', 'AI Chat']],
        ['bedside', ['Bedside']],
        ['schedule', ['Schedule']],
        ['games', ['Games']],
        ['school', ['School']],
        ['settings', ['Settings']],
    ];
    
    for (const [name, labels] of tabs) {
        let clicked = false;
        for (const label of labels) {
            const btn = page.locator(`button:has-text("${label}"), [role="tab"]:has-text("${label}"), nav a:has-text("${label}")`).first();
            try {
                if (await btn.isVisible({ timeout: 3000 })) {
                    await btn.click();
                    clicked = true;
                    break;
                }
            } catch {}
        }
        await page.waitForTimeout(2000);
        
        if (name === 'keyboard') {
            const input = page.locator('textarea, input[type="text"]').first();
            try {
                if (await input.isVisible({ timeout: 2000 })) {
                    await input.click();
                    await input.type('I need water', { delay: 60 });
                    await page.waitForTimeout(1000);
                }
            } catch {}
        }
        
        await page.screenshot({ path: `${OUT}/ipad_${name}.png` });
        console.log(`${name}: ${clicked ? 'OK' : 'nav failed, captured anyway'}`);
    }
    
    await page.close();
    await browser.close();
    
    // List results
    const fs = require('fs');
    const files = fs.readdirSync(OUT).filter(f => f.startsWith('ipad_'));
    console.log(`\n${files.length} iPad screenshots captured`);
    files.forEach(f => {
        const s = fs.statSync(`${OUT}/${f}`);
        console.log(`  ${f} (${(s.size/1024).toFixed(0)} KB)`);
    });
}

run().catch(console.error);
