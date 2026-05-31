const { chromium } = require('playwright');

const BASE = 'http://localhost:3001/prism-aac';
const OUT = '/tmp/appstore_video/live';
const fs = require('fs');

async function run() {
    fs.mkdirSync(OUT, { recursive: true });
    
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: OUT, size: { width: 2048, height: 2732 } }
    });
    
    const page = await ctx.newPage();
    
    // Load app
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    
    // Scene 1: Home — scroll around categories (6s)
    console.log('Scene 1: Home (6s)');
    await page.waitForTimeout(1500);
    // Tap a few phrase buttons
    const phrases = page.locator('.phrase-card, .category-item, button').all();
    const pList = await page.locator('button').all();
    for (const p of pList.slice(0, 3)) {
        try {
            if (await p.isVisible()) {
                await p.hover();
                await page.waitForTimeout(400);
            }
        } catch {}
    }
    await page.waitForTimeout(2000);
    
    // Scene 2: Tap Help category, show phrases (4.1s)
    console.log('Scene 2: Categories (4.1s)');
    const helpBtn = page.locator('button:has-text("Help"), text=Help').first();
    if (await helpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await helpBtn.click();
        await page.waitForTimeout(2500);
        // Tap a phrase
        const firstPhrase = page.locator('.phrase-card, button').nth(5);
        if (await firstPhrase.isVisible({ timeout: 1500 }).catch(() => false)) {
            await firstPhrase.click();
            await page.waitForTimeout(1500);
        }
    }
    
    // Scene 3: Keyboard — type a message (4s)
    console.log('Scene 3: Keyboard (4s)');
    const kbBtn = page.locator('button:has-text("Keyboard")').first();
    if (await kbBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await kbBtn.click();
        await page.waitForTimeout(1000);
    }
    const textarea = page.locator('textarea, input[type="text"]').first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.click();
        await textarea.type('I need water please', { delay: 100 });
        await page.waitForTimeout(1500);
    }
    
    // Scene 4: AI Chat (3.7s)
    console.log('Scene 4: AI Chat (3.7s)');
    const aiBtn = page.locator('button:has-text("AI")').first();
    if (await aiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await aiBtn.click();
        await page.waitForTimeout(3500);
    }
    
    // Scene 5: Bedside (4.3s)
    console.log('Scene 5: Bedside (4.3s)');
    const bedBtn = page.locator('button:has-text("Bedside")').first();
    if (await bedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bedBtn.click();
        await page.waitForTimeout(2000);
        // Tap pain scale or nurse call
        const painBtn = page.locator('button:has-text("Pain"), button:has-text("Nurse"), button:has-text("Help")').first();
        if (await painBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await painBtn.click();
            await page.waitForTimeout(2000);
        }
    }
    
    // Scene 6: Schedule (3.6s)
    console.log('Scene 6: Schedule (3.6s)');
    const schedBtn = page.locator('button:has-text("Schedule")').first();
    if (await schedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await schedBtn.click();
        await page.waitForTimeout(3400);
    }
    
    // Scene 7: Games (3.8s)
    console.log('Scene 7: Games (3.8s)');
    const gameBtn = page.locator('button:has-text("Games")').first();
    if (await gameBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await gameBtn.click();
        await page.waitForTimeout(3600);
    }
    
    // Scene 8: School (3.6s)
    console.log('Scene 8: School (3.6s)');
    const schoolBtn = page.locator('button:has-text("School")').first();
    if (await schoolBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await schoolBtn.click();
        await page.waitForTimeout(3400);
    }
    
    // Scene 9: Settings / Languages (6s)
    console.log('Scene 9: Settings (6s)');
    const setBtn = page.locator('button:has-text("Settings")').first();
    if (await setBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await setBtn.click();
        await page.waitForTimeout(2000);
        // Scroll settings to show language options
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(2000);
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(1800);
    }
    
    // Close to save
    const videoPath = await page.video().path();
    await page.close();
    await ctx.close();
    await browser.close();
    
    console.log(`\nLive video: ${videoPath}`);
    const stat = fs.statSync(videoPath);
    console.log(`Size: ${(stat.size/1024/1024).toFixed(1)} MB`);
}

run().catch(console.error);
