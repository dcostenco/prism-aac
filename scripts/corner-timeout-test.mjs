import { webkit } from '@playwright/test';
const URL = process.env.URL || 'http://localhost:3030/prism-aac';
const browser = await webkit.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 850 } })).newPage();
page.on('console', m => { const t = m.text().slice(0,200); if(/wizard|corner|timeout|auto-capture/i.test(t)) console.log('  LOG:',t); });
await page.addInitScript(() => {
  Object.defineProperty(window,'__POSE_TEST_DRIVE',{value:true});
  navigator.mediaDevices = Object.assign(navigator.mediaDevices||{},{
    getUserMedia: async () => { const c=document.createElement('canvas');c.width=320;c.height=240;return c.captureStream?c.captureStream(15):null; },
    enumerateDevices: async () => [{kind:'videoinput',deviceId:'fake',label:'Fake',groupId:'g'}]
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
const pump=setInterval(async()=>{await page.evaluate(()=>{window.__simulatePose?.('right_index',0.5,0.5,0.9);}).catch(()=>{});},200);
const getState=()=>page.evaluate(()=>({
  phase:document.querySelector('[data-testid="tracking-setup-wizard"]')?.getAttribute('data-phase'),
  cs:document.querySelector('[data-testid="tracking-wizard-diag"]')?.textContent?.match(/cornerSamples:\s*(\d+)/)?.[1]??'0'
}));
let t=0,prevPhase='',prevCs='';
console.log('Polling every second. Corners should all timeout in ~20s after entering calibrate-corners...');
while(t<50){
  await page.waitForTimeout(1000); t++;
  const s=await getState();
  if(s.phase!==prevPhase||s.cs!==prevCs){
    console.log(`  t=${t}s phase=${s.phase} corners=${s.cs}/4`);
    prevPhase=s.phase; prevCs=s.cs;
  }
  if(s.phase==='accuracy-test'||s.phase==='complete'){
    console.log(`\nPASS: ${s.phase} at t=${t}s`);
    clearInterval(pump); await browser.close(); process.exit(0);
  }
}
clearInterval(pump);
const fin=await getState();
console.log(`\nFINAL t=${t}s phase=${fin.phase} corners=${fin.cs}/4`);
console.log('FAIL: did not reach accuracy-test in 50s');
await browser.close(); process.exit(1);
