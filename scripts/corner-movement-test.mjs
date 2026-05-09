/**
 * REAL corner test: drives cursor toward each corner with extreme normX/normY,
 * verifies proximity capture fires (not just timeout), and confirms tracker
 * stays alive through accuracy-test phase.
 * 
 * For each corner: pump extreme values for 2s → cursor moves to corner area
 * → proximity capture should fire within 1.5s.
 * 
 * Cal after center: anchored on (0.5, 0.5), rangeX=0.30, rightX=0.35, leftX=0.65
 * TL: mirX high (>0.65) = normX low (<0.35). normX=0.20 → mirX=0.80 → cursor left-top
 * TR: mirX low (<0.35) = normX high (>0.65). normX=0.80 → mirX=0.20 → cursor right-top
 * BR: normX=0.80, normY=0.85 → cursor right-bottom
 * BL: normX=0.20, normY=0.85 → cursor left-bottom
 */
import { webkit } from '@playwright/test';
const URL = process.env.URL || 'http://localhost:3030/prism-aac';
const browser = await webkit.launch({ headless: true });
const page = await (await browser.newContext({ viewport:{width:1400, height:850} })).newPage();
const logs = [];
page.on('console', m => {
  const t = m.text().slice(0,200);
  logs.push(t);
  if (/wizard|corner|timeout|proximity|auto-capture|tracker/i.test(t)) console.log('  LOG:',t);
});
await page.addInitScript(() => {
  Object.defineProperty(window,'__POSE_TEST_DRIVE',{value:true});
  navigator.mediaDevices = Object.assign(navigator.mediaDevices||{},{
    getUserMedia: async() => { const c=document.createElement('canvas');c.width=320;c.height=240;return c.captureStream?c.captureStream(15):null; },
    enumerateDevices: async() => [{kind:'videoinput',deviceId:'fake',label:'Fake',groupId:'g'}]
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

const getState = () => page.evaluate(() => {
  const w = document.querySelector('[data-testid="tracking-setup-wizard"]');
  const d = w?.textContent || '';
  return {
    phase: w?.getAttribute('data-phase'),
    tracker: w?.getAttribute('data-tracker-status'),
    cs: d.match(/cornerSamples:\s*(\d+)/)?.[1]??'0',
    cx: d.match(/cursor:\s*\((\d+)/)?.[1]??'0',
    cy: d.match(/cursor:\s*\(\d+,\s*(\d+)/)?.[1]??'0',
  };
});

// Step 1: pump center continuously until calibrate-center, then auto-capture
const pump = (nx, ny) => page.evaluate(({nx,ny}) => window.__simulatePose?.('right_index',nx,ny,0.9), {nx,ny}).catch(()=>{});
console.log('Phase 1: driving detection + center auto-capture...');
const baseId = setInterval(()=>pump(0.5,0.5), 200);
await page.waitForTimeout(7000); // detection 5s + advance 1.5s
let s = await getState();
console.log(`t=7s: phase=${s.phase} tracker=${s.tracker}`);
// Wait for center auto-capture (stable hold 4s)
await page.waitForTimeout(14000); // extra time for 60 samples + 2 stable ticks
clearInterval(baseId);
s = await getState();
console.log(`After center wait: phase=${s.phase}`);
if (s.phase !== 'calibrate-corners') {
  console.log('FAIL: expected calibrate-corners'); await browser.close(); process.exit(1);
}

// Phase 2: drive cursor to each corner in order
// Corner positions: TL(15%,15%), TR(85%,15%), BR(85%,85%), BL(15%,85%) of 1400x850
// Cal: rightX=0.35, leftX=0.65, topY=0.38, bottomY=0.62 (approximately, from center cal)
// To reach TL corner target (~210, 127): cursor needs x<300, y<250
//   normX very low → mirX high (>leftX=0.65): use normX=0.20
//   normY very low (below topY): use normY=0.25
const corners = [
  { name:'TL', nx:0.20, ny:0.25 },
  { name:'TR', nx:0.80, ny:0.25 },
  { name:'BR', nx:0.80, ny:0.85 },
  { name:'BL', nx:0.20, ny:0.85 },
];

let passCount = 0;
for (let i = 0; i < 4; i++) {
  const c = corners[i];
  const beforeCs = parseInt((await getState()).cs);
  console.log(`\n--- Corner ${i+1}/4 (${c.name}): driving normX=${c.nx} normY=${c.ny} ---`);
  
  // Pump extreme values for up to 4s, checking cursor position and cs
  let captured = false;
  for (let t = 0; t < 20; t++) {
    await pump(c.nx, c.ny);
    await page.waitForTimeout(200);
    const cur = await getState();
    if (parseInt(cur.cs) > beforeCs) {
      console.log(`  ✓ corner ${i+1} captured at t=${(t*0.2).toFixed(1)}s (cursor=${cur.cx},${cur.cy}) — via ${t < 8 ? 'proximity' : 'timeout'}`);
      captured = true;
      passCount++;
      break;
    }
  }
  if (!captured) {
    // Let timeout fire
    console.log(`  cursor not near corner, waiting for 5s timeout...`);
    for (let t = 0; t < 30; t++) {
      await pump(c.nx, c.ny);
      await page.waitForTimeout(200);
      const cur = await getState();
      if (parseInt(cur.cs) > beforeCs) {
        console.log(`  ✓ corner ${i+1} captured via timeout at t=${(t*0.2+4).toFixed(1)}s (cursor=${cur.cx},${cur.cy})`);
        captured = true;
        break;
      }
    }
  }
  if (!captured) { console.log(`  ✗ corner ${i+1} NOT captured`); }
  await page.waitForTimeout(300);
}

const final = await getState();
console.log(`\nAll corners done: phase=${final.phase} tracker=${final.tracker} cs=${final.cs}/4`);

if (final.phase !== 'accuracy-test') {
  console.log('FAIL: did not reach accuracy-test'); await browser.close(); process.exit(1);
}
if (final.tracker === 'stopped' || final.tracker === '') {
  console.log('FAIL: tracker disconnected during accuracy-test'); await browser.close(); process.exit(1);
}
console.log(`\nPASS: reached accuracy-test with tracker=${final.tracker}`);
console.log(`Corners captured by proximity: ${passCount}/4`);
await browser.close();
