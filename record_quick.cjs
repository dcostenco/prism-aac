const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3001/prism-aac';
const OUT = '/tmp/appstore_video/live';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        isMobile: true, hasTouch: true,
        recordVideo: { dir: OUT, size: { width: 1024, height: 1366 } }
    });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(4000);
    
    const click = async (text, ms) => {
        const b = p.locator(`button:has-text("${text}")`).first();
        if (await b.isVisible({ timeout: 2000 }).catch(() => false)) await b.click();
        await p.waitForTimeout(ms);
    };
    
    console.log('Home...');
    await click('Hello', 1500);
    await click('Thank you', 1500);
    
    console.log('Categories...');
    await click('HELP', 2000);
    
    console.log('Keyboard...');
    await click('Keyboard', 1000);
    const input = p.locator('textarea, input[type="text"]').first();
    if (await input.isVisible({timeout:2000}).catch(()=>false)) {
        await input.click();
        await input.type('I need water', { delay: 100 });
    }
    await p.waitForTimeout(2000);
    
    console.log('AI Chat...');
    await click('AI', 3000);
    
    console.log('Bedside...');
    await click('Bedside', 3000);
    
    console.log('Schedule...');
    await click('Schedule', 3000);
    
    console.log('Games...');
    await click('Games', 3000);
    
    console.log('School...');
    await click('School', 3000);
    
    console.log('Settings...');
    await click('Settings', 2000);
    await p.mouse.wheel(0, 400);
    await p.waitForTimeout(3000);
    
    const vp = await p.video().path();
    await p.close();
    await ctx.close();
    await browser.close();
    console.log('DONE: ' + vp);
}
run().catch(e => { console.error(e.message); process.exit(1); });
