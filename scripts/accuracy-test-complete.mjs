/**
 * Tests that accuracy test auto-completes (5 targets × 10s each = ≤55s)
 * when cursor stays at center — verifies no user interaction needed.
 */
import { webkit } from '@playwright/test';
const URL = process.env.URL || 'http://localhost:3030/prism-aac';
const browser = await webkit.launch({ headless: true });
const page = await (await browser.newContext({ viewport:{width:1400,height:850} })).newPage();
page.on('console', m => { const t=m.text().slice(0,200); if(/auto-advance|test target|complete|accuracy/i.test(t)) console.log('  LOG:',t); });
await page.addInitScript(() => {
  Object.defineProperty(window,'__POSE_TEST_DRIVE',{value:true});
  navigator.mediaDevices=Object.assign(navigator.mediaDevices||{},{
    getUserMedia:async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;return c.captureStream?c.captureStream(15):null;},
    enumerateDevices:async()=>[{kind:'videoinput',deviceId:'fake',label:'Fake',groupId:'g'}]
  });
});
await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('button[data-key="Q"]',{timeout:20000});
await page.evaluate(()=>document.querySelector('button[aria-label*="ettings" i]')?.click());
await page.waitForTimeout(500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('button[aria-label]')].find(b=>/camera input/i.test(b.getAttribute('aria-label')||''));if(t&&t.getAttribute('aria-pressed')==='false')t.click();});
await page.waitForTimeout(400);
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/Set Up Tracking/i.test(b.textContent||''))?.click());
await page.waitForTimeout(600);
await page.evaluate(()=>document.querySelector('[data-testid="tracking-setup-start"]')?.click());
await page.waitForTimeout(300);
const pump=setInterval(async()=>{await page.evaluate(()=>window.__simulatePose?.('right_index',0.5,0.5,0.9)).catch(()=>{});},200);
const getPhase=()=>page.evaluate(()=>document.querySelector('[data-testid="tracking-setup-wizard"]')?.getAttribute('data-phase'));
// Wait for accuracy-test (≤25s from start)
let t=0; let phase='';
while(t<50){await page.waitForTimeout(1000);t++;phase=await getPhase()||'';if(phase==='accuracy-test')break;}
if(phase!=='accuracy-test'){console.log('FAIL: never reached accuracy-test (phase='+phase+')');clearInterval(pump);await browser.close();process.exit(1);}
console.log('Reached accuracy-test at t='+t+'s. Waiting for auto-complete (5 targets × 10s = 50s max)...');
// Now wait for complete
let t2=0;
while(t2<55){
  await page.waitForTimeout(1000);t2++;
  phase=await getPhase()||'';
  if(t2%5===0)console.log('  t='+t2+'s phase='+phase);
  if(phase==='complete'){console.log('\nPASS: complete at accuracy-test t='+t2+'s (total t='+(t+t2)+'s)');break;}
}
clearInterval(pump);
if(phase!=='complete'){console.log('FAIL: accuracy-test did not auto-complete in 55s');await browser.close();process.exit(1);}
await browser.close();
