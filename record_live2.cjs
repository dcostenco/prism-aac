const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:3001/prism-aac';
const OUT = '/tmp/appstore_video/live';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        recordVideo: { dir: OUT, size: { width: 1024, height: 1366 } }
    });
    
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Scene 1: Home — browse categories (6s)
    console.log('1. Home');
    await page.waitForTimeout(2000);
    // Tap Hello
    const hello = page.locator('button:has-text("Hello")').first();
    if (await hello.isVisible({ timeout: 2000 }).catch(() => false)) {
        await hello.click();
        await page.waitForTimeout(1500);
    }
    // Tap Thank you
    const thanks = page.locator('button:has-text("Thank")').first();
    if (await thanks.isVisible({ timeout: 1500 }).catch(() => false)) {
        await thanks.click();
        await page.waitForTimeout(1500);
    }
    
    // Scene 2: Tap Help category (4s)
    console.log('2. Help category');
    const help = page.locator('button:has-text("HELP"), img[alt*="HELP"]').first();
    if (await help.isVisible({ timeout: 2000 }).catch(() => false)) {
        await help.click();
    } else {
        // Try bottom nav
        const helpNav = page.locator('text=Help').first();
        if (await helpNav.isVisible({ timeout: 1500 }).catch(() => false))
            await helpNav.click();
    }
    await page.waitForTimeout(2000);
    // Tap "I need help"
    const needHelp = page.locator('button:has-text("need"), button:has-text("help")').first();
    if (await needHelp.isVisible({ timeout: 1500 }).catch(() => false)) {
        await needHelp.click();
        await page.waitForTimeout(1500);
    }
    
    // Scene 3: Keyboard (4s)
    console.log('3. Keyboard');
    const kb = page.locator('button:has-text("Keyboard"), [data-tab="keyboard"]').first();
    if (await kb.isVisible({ timeout: 2000 }).catch(() => false)) {
        await kb.click();
        await page.waitForTimeout(800);
    }
    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.click();
        await input.type('I need water please', { delay: 120 });
    }
    await page.waitForTimeout(2000);
    
    // Scene 4: AI Chat (3.7s)
    console.log('4. AI Chat');
    const ai = page.locator('button:has-text("AI")').first();
    if (await ai.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ai.click();
    }
    await page.waitForTimeout(3500);
    
    // Scene 5: Bedside (4.3s)
    console.log('5. Bedside');
    const bed = page.locator('button:has-text("Bedside")').first();
    if (await bed.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bed.click();
        await page.waitForTimeout(1500);
        // Tap pain button
        const pain = page.locator('button:has-text("Pain"), button:has-text("Hurts")').first();
        if (await pain.isVisible({ timeout: 1500 }).catch(() => false)) {
            await pain.click();
        }
    }
    await page.waitForTimeout(2500);
    
    // Scene 6: Schedule (3.6s)
    console.log('6. Schedule');
    const sched = page.locator('button:has-text("Schedule")').first();
    if (await sched.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sched.click();
    }
    await page.waitForTimeout(3400);
    
    // Scene 7: Games (3.8s)
    console.log('7. Games');
    const game = page.locator('button:has-text("Games")').first();
    if (await game.isVisible({ timeout: 2000 }).catch(() => false)) {
        await game.click();
    }
    await page.waitForTimeout(3600);
    
    // Scene 8: School (3.6s)
    console.log('8. School');
    const school = page.locator('button:has-text("School")').first();
    if (await school.isVisible({ timeout: 2000 }).catch(() => false)) {
        await school.click();
    }
    await page.waitForTimeout(3400);
    
    // Scene 9: Settings (6s)
    console.log('9. Settings');
    const settings = page.locator('button:has-text("Settings")').first();
    if (await settings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settings.click();
        await page.waitForTimeout(2000);
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1800);
    
    const videoPath = await page.video().path();
    await page.close();
    await ctx.close();
    await browser.close();
    
    const stat = fs.statSync(videoPath);
    console.log(`\nVideo: ${videoPath} (${(stat.size/1024/1024).toFixed(1)} MB)`);
}

run().catch(console.error);
