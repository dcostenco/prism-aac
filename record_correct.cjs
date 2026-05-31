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
    await p.waitForTimeout(5000);
    
    // Helper: click by coordinates (top bar icons)
    const tap = async (x, y, ms) => {
        await p.mouse.click(x, y);
        await p.waitForTimeout(ms);
    };
    
    // Scene 1: HOME — tap some phrases (6s)
    console.log('1. Home + phrases');
    await tap(8, 345, 1000);    // Hello
    await tap(623, 345, 1000);  // Thank you
    await tap(8, 491, 1000);    // Please
    await tap(315, 637, 1500);  // Come here
    await p.waitForTimeout(1500);
    
    // Scene 2: Categories — tap Help (top row) (4s)
    console.log('2. Help category');
    await tap(818, 197, 2000);  // Help (top strip)
    await p.waitForTimeout(2000);
    
    // Scene 3: Keyboard — type (4s)
    console.log('3. Keyboard typing');
    // Clear and type in the text bar
    const input = p.locator('textarea, input[type="text"]').first();
    if (await input.isVisible({timeout:2000}).catch(()=>false)) {
        await input.click();
        await input.fill('');
        await input.type('I need water please', { delay: 100 });
    }
    await p.waitForTimeout(2000);
    
    // Scene 4: AI Chat — tap ✨ icon (3.7s)
    console.log('4. AI Chat');
    await tap(396, 4, 3500);  // ✨ AI
    
    // Scene 5: Bedside/Emergency — tap 🚨 (4.3s)
    console.log('5. Bedside');
    await tap(172, 4, 4100);  // 🚨 Emergency/Bedside
    
    // Scene 6: Schedule — tap 📅 (3.6s)
    console.log('6. Schedule');
    await tap(228, 4, 3400);  // 📅 Schedule
    
    // Scene 7: Games — tap 🎮 (3.8s)
    console.log('7. Games');
    await tap(508, 4, 3600);  // 🎮 Games
    
    // Scene 8: School/Math — tap 🔢 (3.6s)
    console.log('8. School');
    await tap(340, 4, 3400);  // 🔢 Math/School
    
    // Scene 9: Settings — tap ⚙️, scroll (6s)
    console.log('9. Settings');
    await tap(844, 4, 2000);  // ⚙️ Settings
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(2000);
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(1800);
    
    const vp = await p.video().path();
    await p.close();
    await ctx.close();
    await browser.close();
    
    const stat = fs.statSync(vp);
    console.log('DONE: ' + vp + ' (' + (stat.size/1024/1024).toFixed(1) + ' MB)');
}
run().catch(e => { console.error(e.message); process.exit(1); });
