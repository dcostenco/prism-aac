const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3001/prism-aac';
const OUT = '/tmp/appstore_video/scene_frames';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: true, hasTouch: true,
    });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(5000);
    
    // Take multiple screenshots per scene to create motion
    const shot = async (name) => await p.screenshot({ path: `${OUT}/${name}.png` });
    
    // Scene 1: Home (3 frames showing different states)
    console.log('Scene 1: Home');
    await shot('01_home_a');
    await p.mouse.click(8, 345);  // Hello
    await p.waitForTimeout(800);
    await shot('01_home_b');
    await p.mouse.click(623, 345); // Thank you
    await p.waitForTimeout(800);
    await shot('01_home_c');
    await p.mouse.click(8, 491);  // Please
    await p.waitForTimeout(800);
    await shot('01_home_d');
    
    // Scene 2: Help category
    console.log('Scene 2: Help');
    await p.mouse.click(818, 197); // Help strip
    await p.waitForTimeout(1500);
    await shot('02_help_a');
    await p.waitForTimeout(1000);
    await shot('02_help_b');
    
    // Scene 3: AI Chat - tap ✨
    console.log('Scene 3: AI Chat');
    await p.mouse.click(396, 4);
    await p.waitForTimeout(2000);
    await shot('03_ai_a');
    await p.waitForTimeout(1000);
    await shot('03_ai_b');
    
    // Scene 4: Emergency/Bedside - tap 🚨
    console.log('Scene 4: Bedside');
    await p.mouse.click(172, 4);
    await p.waitForTimeout(2000);
    await shot('04_bedside_a');
    await p.waitForTimeout(1000);
    await shot('04_bedside_b');
    
    // Scene 5: Schedule - tap 📅
    console.log('Scene 5: Schedule');
    await p.mouse.click(228, 4);
    await p.waitForTimeout(2000);
    await shot('05_schedule_a');
    await p.waitForTimeout(1000);
    await shot('05_schedule_b');
    
    // Scene 6: Games - tap 🎮
    console.log('Scene 6: Games');
    await p.mouse.click(508, 4);
    await p.waitForTimeout(2000);
    await shot('06_games_a');
    
    // Scene 7: School/Math - tap 🔢
    console.log('Scene 7: School');
    await p.mouse.click(340, 4);
    await p.waitForTimeout(2000);
    await shot('07_school_a');
    
    // Scene 8: Marketplace - tap 🏪
    console.log('Scene 8: Marketplace');
    await p.mouse.click(284, 4);
    await p.waitForTimeout(2000);
    await shot('08_market_a');
    
    // Scene 9: Settings - tap ⚙️
    console.log('Scene 9: Settings');
    await p.mouse.click(844, 4);
    await p.waitForTimeout(2000);
    await shot('09_settings_a');
    await p.mouse.wheel(0, 400);
    await p.waitForTimeout(1500);
    await shot('09_settings_b');
    
    // Back to home
    console.log('Scene 10: Back to Home');
    await p.mouse.click(4, 4);  // 📂 categories
    await p.waitForTimeout(2000);
    await shot('10_home_final');
    
    await p.close();
    await browser.close();
    
    const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
    console.log(`\n${files.length} frames captured:`);
    files.forEach(f => console.log('  ' + f));
}
run().catch(e => { console.error(e.message); process.exit(1); });
