/**
 * Wizard scenario storyboard — drives the wizard through each scenario
 * and screenshots the result showing the synthetic camera feed in PIP.
 *
 * Each scenario gets an ANIMATED canvas person (no real camera, no
 * permission prompts). The person has scenario-specific appearance
 * (background colour, posture hint) and slight continuous movement
 * so the PIP looks like a live feed.
 *
 * Uses the test escape-hatch (__POSE_TEST_DRIVE) so MediaPipe is
 * bypassed and synthetic __simulatePose events drive the wizard.
 */
import { webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO      = path.resolve(__dirname, '..');
const SHOTS     = path.join(REPO, 'e2e/_fixtures/wizard-scenarios/_screenshots');
const URL       = process.env.URL || 'http://localhost:3030/prism-aac';

await fs.mkdir(SHOTS, { recursive: true });

/** Each scenario: bg colour, skin tone, label, at which phase to screenshot */
const SCENARIOS = [
  { name:'person-on-sofa',       bg:'#5c3c1e', skin:'#f5c5a3', label:'Reclining on sofa — baseline',           targetPhase:'calibrate-corners' },
  { name:'person-pointing-tl',   bg:'#1e3a5c', skin:'#ffe0c2', label:'Pointing — top-left corner',             targetPhase:'calibrate-corners' },
  { name:'person-pointing-tr',   bg:'#1c4d2b', skin:'#f5c5a3', label:'Pointing — top-right corner',            targetPhase:'calibrate-corners' },
  { name:'person-pointing-br',   bg:'#4a1e5c', skin:'#ffe0c2', label:'Pointing — bottom-right corner',         targetPhase:'calibrate-corners' },
  { name:'person-pointing-bl',   bg:'#5c1e2a', skin:'#f5c5a3', label:'Pointing — bottom-left corner',         targetPhase:'accuracy-test'     },
  { name:'finger-out-of-frame',  bg:'#2a2a3e', skin:'#f5c5a3', label:'Finger out of frame — no false advance', targetPhase:'calibrate-center'  },
  { name:'head-out-body-only',   bg:'#3e2a1a', skin:'#ffe0c2', label:'Head cropped — body only visible',       targetPhase:'calibrate-center'  },
  { name:'person-in-car',        bg:'#1a1a1a', skin:'#f5c5a3', label:'Person in car — vibration context',      targetPhase:'calibrate-center'  },
];

/**
 * Build the addInitScript payload for a scenario.
 * Generates an animated canvas "person" without any real camera:
 *   • background fill (scenario colour)
 *   • face oval + eyes + slight random jitter (breathing/micro-movement)
 *   • shirt / torso silhouette
 *
 * No getUserMedia permission dialog — we completely replace the API.
 */
function buildInitScript(bgColor, skinColor) {
  return `
  (function() {
    // ── No permission dialogs ───────────────────────────────────────
    Object.defineProperty(window, '__POSE_TEST_DRIVE', { value: true, writable: false });

    let _stream = null;

    function buildPersonStream() {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 480;
      const ctx = c.getContext('2d');
      let t = 0;

      function draw() {
        if (!ctx) return;
        const jx = Math.sin(t * 0.7) * 4 + Math.cos(t * 1.3) * 2;
        const jy = Math.cos(t * 0.5) * 3 + Math.sin(t * 0.9) * 2;
        t += 0.04;

        // Background
        ctx.fillStyle = ${JSON.stringify(bgColor)};
        ctx.fillRect(0, 0, 640, 480);

        // Shirt / torso
        ctx.fillStyle = '#3a3a6e';
        ctx.beginPath();
        ctx.ellipse(320 + jx, 410 + jy, 100, 130, 0, 0, Math.PI * 2);
        ctx.fill();

        // Neck
        ctx.fillStyle = ${JSON.stringify(skinColor)};
        ctx.fillRect(300 + jx, 290 + jy, 40, 50);

        // Face oval
        ctx.fillStyle = ${JSON.stringify(skinColor)};
        ctx.beginPath();
        ctx.ellipse(320 + jx, 240 + jy, 80, 100, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#2a1a0e';
        ctx.beginPath();
        ctx.ellipse(295 + jx, 225 + jy, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(345 + jx, 225 + jy, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(298 + jx, 221 + jy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(348 + jx, 221 + jy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.strokeStyle = ${JSON.stringify(skinColor)}.replace(')', ', 0.6)').replace('rgb', 'rgba');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(320 + jx, 240 + jy);
        ctx.lineTo(312 + jx, 262 + jy);
        ctx.lineTo(328 + jx, 262 + jy);
        ctx.stroke();

        // Mouth
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(320 + jx, 272 + jy, 20, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }

      draw();
      setInterval(draw, 33);
      return c.captureStream ? c.captureStream(30) : null;
    }

    // Build the stream immediately so it's ready before any JS runs.
    _stream = buildPersonStream();
    window.__testStream = _stream;

    // Override via MediaDevices PROTOTYPE — more reliable in WebKit than
    // Object.assign/defineProperty on the instance (which is non-configurable).
    // This intercepts ALL getUserMedia calls including acquireCamera in
    // cameraStream.ts and initFaceLandmarkerForGaze in bodyPoseService.
    try {
      if (typeof MediaDevices !== 'undefined') {
        MediaDevices.prototype.getUserMedia = async function() { return _stream; };
        MediaDevices.prototype.enumerateDevices = async function() {
          return [{ kind: 'videoinput', deviceId: 'synthetic', label: 'Synthetic', groupId: 'g' }];
        };
      }
    } catch {}
    // Fallback: also try instance-level override in case prototype didn't work.
    if (navigator.mediaDevices) {
      try { navigator.mediaDevices.getUserMedia = async () => _stream; } catch {}
      try { navigator.mediaDevices.enumerateDevices = async () =>
        [{ kind: 'videoinput', deviceId: 'synthetic', label: 'Synthetic', groupId: 'g' }]; } catch {}
    }
  })();
  `;
}

const results = [];

for (const sc of SCENARIOS) {
  console.log(`\n=== ${sc.name} — ${sc.label} ===`);
  const browser = await webkit.launch({ headless: true });
  const ctx     = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // No permissions needed — getUserMedia is fully overridden in addInitScript
    // so the real camera is never accessed and no dialog appears.
  });
  const page    = await ctx.newPage();

  const logs = [];
  page.on('console', m => { const t=m.text().slice(0,180); logs.push(t); });

  await page.addInitScript(buildInitScript(sc.bg, sc.skin));

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });

    // Open camera input
    await page.evaluate(() => document.querySelector('button[aria-label*="ettings" i]')?.click());
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('button[aria-label]')]
        .find(b => /camera input/i.test(b.getAttribute('aria-label') || ''));
      if (t && t.getAttribute('aria-pressed') === 'false') t.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('button')]
        .find(b => /Set Up Tracking/i.test(b.textContent || ''));
      s?.click();
    });
    await page.waitForTimeout(600);
    await page.evaluate(() =>
      document.querySelector('[data-testid="tracking-setup-start"]')?.click()
    );

    // Pre-warm the camera stream before wizard starts — getUserMedia is
    // async and the PIP re-attach loop needs the stream available immediately
    // when the tracker first calls it.
    await page.evaluate(() => navigator.mediaDevices.getUserMedia({ video:true }).catch(()=>{}));
    await page.waitForTimeout(600); // let canvas draw first frame

    // Pump synthetic poses continuously
    const pump = setInterval(async () => {
      await page.evaluate(() => window.__simulatePose?.('right_index', 0.5, 0.5, 0.9)).catch(() => {});
    }, 200);

    // Wait until wizard reaches the target phase (poll, not fixed sleep).
    // calibrate-center: ~7s; calibrate-corners: ~20s; accuracy-test: ~39s
    const PHASE_ORDER = ['detecting','calibrate-center','calibrate-corners','accuracy-test','complete'];
    const targetIdx   = PHASE_ORDER.indexOf(sc.targetPhase);
    let elapsed = 0;
    while (elapsed < 55_000) {
      await page.waitForTimeout(1000);
      elapsed += 1000;
      const curPhase = await page.evaluate(() =>
        document.querySelector('[data-testid="tracking-setup-wizard"]')?.getAttribute('data-phase') ?? ''
      );
      const curIdx = PHASE_ORDER.indexOf(curPhase);
      // Stop at target or one phase past it (wizard auto-advanced)
      if (curIdx >= targetIdx) break;
    }
    // Extra wait for PIP video element to receive stream from async getUserMedia.
    await page.waitForTimeout(800);

    clearInterval(pump);

    const state = await page.evaluate(() => ({
      phase:   document.querySelector('[data-testid="tracking-setup-wizard"]')?.getAttribute('data-phase'),
      tracker: document.querySelector('[data-testid="tracking-setup-wizard"]')?.getAttribute('data-tracker-status'),
      pipSrc:  !!document.querySelector('[data-testid="tracking-wizard-pip"]')?.srcObject,
    }));

    const shotPath = path.join(SHOTS, `${sc.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    const phaseOK = state.phase === sc.targetPhase;
    const icon    = phaseOK ? '✓' : '✗';
    console.log(`  ${icon} phase=${state.phase} (want ${sc.targetPhase}) tracker=${state.tracker} pip_has_stream=${state.pipSrc}`);
    console.log(`  → ${path.relative(REPO, shotPath)}`);

    results.push({ name: sc.name, pass: phaseOK, phase: state.phase, pip: state.pipSrc });
  } catch (e) {
    console.log(`  ERROR: ${e.message.slice(0, 120)}`);
    results.push({ name: sc.name, pass: false, error: e.message.slice(0, 80) });
  } finally {
    await browser.close();
  }
}

const passed = results.filter(r => r.pass).length;
console.log(`\n=== ${passed}/${results.length} scenarios reached target phase ===`);
results.forEach(r => {
  const icon = r.pass ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}${r.error ? ' — ERROR: '+r.error : ''}`);
});
