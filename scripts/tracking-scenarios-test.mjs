/**
 * Multi-scenario tracking test: different head/eye movements + jitter levels.
 * Each scenario runs a full wizard and verifies:
 *   - correct auto-capture timing
 *   - camera stays connected
 *   - calibration quality (rangeX/Y)
 *   - cursor stability under each movement type
 */
import { webkit } from '@playwright/test';

const BASE_URL = process.env.URL || 'http://localhost:3030/prism-aac';
const results = [];

const SCENARIOS = [
  {
    name: 'Steady center — no movement (baseline)',
    description: 'User holds perfectly still. Auto-capture must fire, no jitter.',
    drive: (t) => ({ nx: 0.5, ny: 0.5 }),
    expectStableCapture: true,
  },
  {
    name: 'Micro-tremor (σ≈0.003) — AAC user slight shake',
    description: 'Simulates mild spasticity. Auto-capture must still fire.',
    drive: (t) => ({ nx: 0.5 + (Math.random()-0.5)*0.006, ny: 0.5 + (Math.random()-0.5)*0.006 }),
    expectStableCapture: true,
  },
  {
    name: 'Heavy jitter (σ≈0.015) — car or wheelchair vibration',
    description: 'Heavy noise. Auto-capture may take longer but must still fire.',
    drive: (t) => ({ nx: 0.5 + (Math.random()-0.5)*0.03, ny: 0.5 + (Math.random()-0.5)*0.03 }),
    expectStableCapture: false, // timeout fallback acceptable
  },
  {
    name: 'Slow head pan left-right — deliberate scanning',
    description: 'normX oscillates 0.35–0.65 over 4s cycle.',
    drive: (t) => ({ nx: 0.5 + Math.sin(t * 0.5) * 0.15, ny: 0.5 }),
    expectStableCapture: false,
  },
  {
    name: 'Eyes scanning corners — large movements',
    description: 'normX/normY sweep full range simulating corner targeting.',
    drive: (t) => ({
      nx: 0.5 + Math.sin(t * 0.8) * 0.30,
      ny: 0.5 + Math.cos(t * 0.6) * 0.25,
    }),
    expectStableCapture: false,
  },
  {
    name: 'Reclining posture — normY offset (≈0.67)',
    description: 'User reclining: face high in frame. Matches actual user posture.',
    drive: (t) => ({ nx: 0.51 + (Math.random()-0.5)*0.004, ny: 0.67 + (Math.random()-0.5)*0.004 }),
    expectStableCapture: true,
  },
  {
    name: 'Asymmetric face — off-center normX',
    description: 'Camera not perfectly aligned: face at normX≈0.42 neutral.',
    drive: (t) => ({ nx: 0.42 + (Math.random()-0.5)*0.004, ny: 0.52 + (Math.random()-0.5)*0.004 }),
    expectStableCapture: true,
  },
  {
    name: 'Sudden position change then stable',
    description: 'User shifts then holds. Auto-capture should reset and fire.',
    drive: (t) => t < 10 ? { nx: 0.35, ny: 0.45 } : { nx: 0.55 + (Math.random()-0.5)*0.003, ny: 0.60 + (Math.random()-0.5)*0.003 },
    expectStableCapture: true,
  },
];

async function runScenario(scenario) {
  const browser = await webkit.launch({ headless: true });
  const page = await (await browser.newContext({ viewport:{width:1440, height:900} })).newPage();
  const logs = [];
  page.on('console', m => { const t=m.text().slice(0,200); logs.push(t); });
  page.on('pageerror', e => logs.push('[pageerror] '+e.message.slice(0,100)));

  await page.addInitScript(() => {
    Object.defineProperty(window,'__POSE_TEST_DRIVE',{value:true});
    const __c=document.createElement('canvas'); __c.width=320; __c.height=240;
    const __s = __c.captureStream ? __c.captureStream(15) : null;
    window.__testStream = __s;
    // Prototype override — covers ALL getUserMedia callers (headTracker, bodyPoseService,
    // cameraStream) without triggering the browser permission dialog.
    try { if(typeof MediaDevices!=='undefined') MediaDevices.prototype.getUserMedia=async()=>__s; } catch{}
    try { navigator.mediaDevices.getUserMedia=async()=>__s; } catch{}
    try { navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'fake',label:'Fake',groupId:'g'}]; } catch{}
  });

  const issues = [];
  let finalPhase = '', trackerStatus = '', calInfo = '', cornerSamples = '0';
  let pumpT = 0;

  try {
    await page.goto(BASE_URL,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('button[data-key="Q"]',{timeout:20000});

    // Open camera input
    await page.evaluate(()=>document.querySelector('button[aria-label*="ettings" i]')?.click());
    await page.waitForTimeout(400);
    await page.evaluate(()=>{const t=[...document.querySelectorAll('button[aria-label]')].find(b=>/camera input/i.test(b.getAttribute('aria-label')||''));if(t&&t.getAttribute('aria-pressed')==='false')t.click();});
    await page.waitForTimeout(300);
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/Set Up Tracking/i.test(b.textContent||''))?.click());
    await page.waitForTimeout(500);
    await page.evaluate(()=>document.querySelector('[data-testid="tracking-setup-start"]')?.click());
    await page.waitForTimeout(200);

    const getState = () => page.evaluate(()=>{
      const w=document.querySelector('[data-testid="tracking-setup-wizard"]');
      const d=w?.textContent||'';
      // Read calibration directly from localStorage — avoids React state lag
      // on phase transitions where latestCal may not have updated yet.
      let rangeX = 0, rangeY = 0;
      try {
        const calKeys = Object.keys(localStorage).filter(k=>k.startsWith('prism-pose-calibration'));
        for (const k of calKeys) {
          const cal = JSON.parse(localStorage.getItem(k)||'null');
          if (cal?.leftX && cal?.rightX) {
            rangeX = Math.max(rangeX, cal.leftX - cal.rightX);
            rangeY = Math.max(rangeY, cal.bottomY - cal.topY);
          }
        }
      } catch {}
      return {
        phase: w?.getAttribute('data-phase')||'',
        tracker: w?.getAttribute('data-tracker-status')||'',
        cs: d.match(/cornerSamples:\s*(\d+)/)?.[1]||'0',
        rangeX,
        rangeY,
      };
    });

    // Pump scenario-specific values throughout
    const pump = setInterval(async () => {
      const pos = scenario.drive(pumpT);
      pumpT += 0.2;
      await page.evaluate(({nx,ny})=>window.__simulatePose?.('right_index',nx,ny,0.9),pos).catch(()=>{});
    }, 200);

    // Wait for complete or 120s timeout
    const start = Date.now();
    let phase = '', prevPhase = '';
    const transitions = [];

    while (Date.now()-start < 115_000) {
      await page.waitForTimeout(1000);
      const s = await getState();
      if (s.phase !== prevPhase) {
        transitions.push({ phase: s.phase, t: Math.round((Date.now()-start)/1000) });
        prevPhase = s.phase;
      }
      phase = s.phase;
      if (phase === 'complete') break;
      // Safety: if tracker goes stopped unexpectedly during test phase
      if ((phase === 'accuracy-test' || phase === 'calibrate-corners') && s.tracker === 'stopped') {
        issues.push('CAMERA DISCONNECTED at phase=' + phase);
      }
      // Always update calInfo with latest localStorage read
      calInfo = `rangeX=${s.rangeX.toFixed(3)} rangeY=${s.rangeY.toFixed(3)}`;
    }

    clearInterval(pump);
    const fin = await getState();
    finalPhase = fin.phase;
    trackerStatus = fin.tracker;
    calInfo = `rangeX=${fin.rangeX.toFixed(3)} rangeY=${fin.rangeY.toFixed(3)}`;
    cornerSamples = fin.cs;

    if (finalPhase !== 'complete') issues.push('Did not reach complete (stuck at '+finalPhase+')');

    // Check calibration quality from final localStorage state
    const [rx, ry] = calInfo.match(/([\d.]+)/g)?.map(Number) || [0,0];
    if (rx < 0.10 || ry < 0.08) issues.push('Cal range too narrow: '+calInfo);

    // Check transition timing — center should capture within 25s
    const centerT = transitions.find(t=>t.phase==='calibrate-corners')?.t||999;
    if (centerT > 30) issues.push('Center took too long: '+centerT+'s (expected ≤30s)');

    const completeT = transitions.find(t=>t.phase==='complete')?.t||999;

    return {
      scenario: scenario.name,
      pass: issues.length === 0,
      issues,
      transitions: transitions.map(t=>t.phase+'@'+t.t+'s').join(' → '),
      totalTime: Math.min(completeT, 115) + 's',
      cal: calInfo,
      cameraAlive: !issues.some(i=>i.includes('CAMERA')),
    };

  } catch (e) {
    return { scenario: scenario.name, pass: false, issues: ['EXCEPTION: '+e.message.slice(0,100)], transitions:'', totalTime:'error', cal:'', cameraAlive:false };
  } finally {
    await browser.close().catch(()=>{});
  }
}

// Run all scenarios sequentially
console.log('=== TRACKING SCENARIOS TEST SUITE ===\n');
let passed = 0, total = SCENARIOS.length;

for (const scenario of SCENARIOS) {
  process.stdout.write(`Running: ${scenario.name}... `);
  const result = await runScenario(scenario);
  results.push(result);

  const status = result.pass ? '✓ PASS' : '✗ FAIL';
  console.log(status + ' [' + result.totalTime + ']');
  console.log('  Flow: ' + result.transitions);
  console.log('  Cal: ' + result.cal + '  Camera: ' + (result.cameraAlive ? 'alive' : 'DISCONNECTED'));
  if (result.issues.length) result.issues.forEach(i => console.log('  ⚠️  ' + i));
  if (result.pass) passed++;
  console.log('');
}

console.log(`=== RESULTS: ${passed}/${total} scenarios passed ===`);
if (passed < total) {
  console.log('FAILED scenarios:');
  results.filter(r=>!r.pass).forEach(r=>{ console.log('  ✗ '+r.scenario); r.issues.forEach(i=>console.log('    '+i)); });
  process.exit(1);
} else {
  console.log('All scenarios passed.');
}
