/**
 * Wizard scenario storyboard — drives the wizard through every phase
 * for each fixture photo and screenshots the result.
 *
 * Pairs with tests/wizard-step-flow.test.tsx. The vitest suite proves
 * the wizard's STEP-FLOW LOGIC is correct given pose events flow.
 * This script captures what the wizard LOOKS LIKE at each phase with
 * each scenario's photo as the visible PIP backdrop, by setting
 * `window.__POSE_TEST_DRIVE = true` (test escape-hatch in
 * services/bodyPoseService.ts) and dispatching synthetic poses via
 * `window.__simulatePose(target, normX, normY, vis?)`.
 *
 * Real MediaPipe Pose CANNOT detect a static photo through
 * canvas.captureStream in headless WebKit — every scenario would stall
 * at "Camera lost — move into frame". The hatch is the only path to
 * deterministic per-phase coverage. Hatch is unreachable in production
 * unless `__POSE_TEST_DRIVE` is set BEFORE the bundle loads, which
 * never happens on prod-served HTML.
 *
 * Output:
 *   e2e/_fixtures/wizard-scenarios/_screenshots/<scenario>-<phase>.png
 *   e2e/_fixtures/wizard-scenarios/_results.json
 *
 * Run:
 *   URL=http://localhost:3030/prism-aac node scripts/wizard-scenarios.mjs
 */
import { webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const FIXTURES = path.join(REPO, 'e2e/_fixtures/wizard-scenarios');
const SCREENSHOTS = path.join(FIXTURES, '_screenshots');
const URL = process.env.URL || 'http://localhost:3030/prism-aac';

// Each scenario describes a sequence of "drive" steps. Each step either
// fires synthetic poses (target + normX/normY range) or simulates a
// lost-state. After steps complete, the wizard is screenshotted in
// whatever phase it ended in.
//
// Note: normX/normY are RAW (un-mirrored) MediaPipe normalized coords.
// User pointing top-left of SCREEN shows up at normX≈0.85 in raw frame.
const SCENARIOS = [
    {
        file: 'person-on-sofa.jpg',
        label: 'baseline — person on sofa, full setup walk-through',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' }, // detect → step 1 (calibrate-center)
        ],
        capturePhase: 'calibrate-center',
    },
    {
        file: 'person-pointing-tl.jpg',
        label: 'pointing top-left — corner 1/4 in step 2',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' },
            { kind: 'capture-center', normX: 0.5, normY: 0.5 },
            { kind: 'pose-burst', normX: 0.85, normY: 0.20, count: 8 },
        ],
        capturePhase: 'calibrate-corners',
    },
    {
        file: 'person-pointing-tr.jpg',
        label: 'pointing top-right — corner 2/4',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' },
            { kind: 'capture-center', normX: 0.5, normY: 0.5 },
            { kind: 'capture-corner', normX: 0.85, normY: 0.20 }, // TL
            { kind: 'pose-burst', normX: 0.15, normY: 0.20, count: 8 },
        ],
        capturePhase: 'calibrate-corners',
    },
    {
        file: 'person-pointing-br.jpg',
        label: 'pointing bottom-right — corner 3/4',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' },
            { kind: 'capture-center', normX: 0.5, normY: 0.5 },
            { kind: 'capture-corner', normX: 0.85, normY: 0.20 }, // TL
            { kind: 'capture-corner', normX: 0.15, normY: 0.20 }, // TR
            { kind: 'pose-burst', normX: 0.15, normY: 0.80, count: 8 },
        ],
        capturePhase: 'calibrate-corners',
    },
    {
        file: 'person-pointing-bl.jpg',
        label: 'pointing bottom-left — corner 4/4 → advances to test',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' },
            { kind: 'capture-center', normX: 0.5, normY: 0.5 },
            { kind: 'capture-corner', normX: 0.85, normY: 0.20 }, // TL
            { kind: 'capture-corner', normX: 0.15, normY: 0.20 }, // TR
            { kind: 'capture-corner', normX: 0.15, normY: 0.80 }, // BR
            { kind: 'capture-corner', normX: 0.85, normY: 0.80 }, // BL → test
        ],
        capturePhase: 'accuracy-test',
    },
    {
        file: 'finger-out-of-frame.jpg',
        label: 'finger out of camera view — wizard holds, no false-advance',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' },
            { kind: 'lost', durationMs: 2000 },
        ],
        capturePhase: 'calibrate-center',
    },
    {
        file: 'head-out-body-only.jpg',
        label: 'head cropped above frame — wizard picks body target',
        target: 'right_wrist', // detection sees wrist, not nose
        steps: [
            { kind: 'detect-and-step1' },
        ],
        capturePhase: 'calibrate-center',
    },
    {
        file: 'person-in-car.jpg',
        label: 'human in a car — jittery poses around center',
        target: 'right_index',
        steps: [
            { kind: 'detect-and-step1' },
            { kind: 'jitter-burst', cx: 0.5, cy: 0.5, jitter: 0.04, count: 10 },
        ],
        capturePhase: 'calibrate-center',
    },
];

await fs.mkdir(SCREENSHOTS, { recursive: true });

const results = [];

for (const sc of SCENARIOS) {
    console.log(`\n=== ${sc.file} — ${sc.label} ===`);
    const photoPath = path.join(FIXTURES, sc.file);
    const photoBuf = await fs.readFile(photoPath);
    const photoB64 = photoBuf.toString('base64');

    const browser = await webkit.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    await page.addInitScript(({ b64 }) => {
        // Activate the test escape-hatch BEFORE the bundle evaluates.
        // services/bodyPoseService.ts checks this at startPoseTracker()
        // and routes to startTestDrivenTracker() instead of MediaPipe.
        Object.defineProperty(window, '__POSE_TEST_DRIVE', { value: true, writable: false });

        // Camera stream: serve the fixture photo as a 30Hz canvas
        // captureStream so the PIP shows the scenario backdrop.
        let stream = null;
        const buildStream = async () => {
            const img = new Image();
            const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
            img.src = URL.createObjectURL(blob);
            await new Promise((r, j) => { img.onload = r; img.onerror = j; });
            const c = document.createElement('canvas');
            c.width = 640; c.height = 480;
            const cx = c.getContext('2d');
            const draw = () => {
                if (!cx) return;
                cx.fillStyle = '#000';
                cx.fillRect(0, 0, 640, 480);
                const ar = img.width / img.height;
                let w = 640, h = w / ar;
                if (h < 480) { h = 480; w = h * ar; }
                cx.drawImage(img, (640 - w) / 2, (480 - h) / 2, w, h);
            };
            draw();
            setInterval(draw, 33);
            return c.captureStream ? c.captureStream(15) : null;
        };
        if (!navigator.mediaDevices) {
            Object.defineProperty(navigator, 'mediaDevices', { value: {}, writable: true });
        }
        navigator.mediaDevices.getUserMedia = async () => {
            if (!stream) stream = await buildStream();
            if (!stream) throw new Error('captureStream unavailable');
            return stream;
        };
        navigator.mediaDevices.enumerateDevices = async () => [
            { kind: 'videoinput', deviceId: 'fake-cam', label: 'Fake Camera', groupId: 'g0' },
        ];
    }, { b64: photoB64 });

    const consoleLines = [];
    page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
    page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.message}`));

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });

        // Open Settings + enable Camera input + open wizard.
        await page.evaluate(() => {
            const b = document.querySelector('button[aria-label*="ettings" i]');
            if (b instanceof HTMLElement) b.click();
        });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
            const t = Array.from(document.querySelectorAll('button[aria-label]')).find(b =>
                /camera input/i.test(b.getAttribute('aria-label') || ''));
            if (t && t.getAttribute('aria-pressed') === 'false') t.click();
        });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
            const setup = Array.from(document.querySelectorAll('button')).find(b =>
                /Set Up Tracking/i.test(b.textContent || ''));
            if (setup instanceof HTMLElement) setup.click();
        });
        await page.waitForTimeout(600);
        await page.evaluate(() => {
            const start = document.querySelector('[data-testid="tracking-setup-start"]');
            if (start instanceof HTMLElement) start.click();
        });
        await page.waitForTimeout(400);

        // Drive scenario steps.
        for (const step of sc.steps) {
            if (step.kind === 'detect-and-step1') {
                // Fire 8+ tracking events of the chosen target so detection
                // counts pass the >5 threshold.
                await page.evaluate((target) => {
                    const w = window;
                    if (!w.__simulatePose) throw new Error('__simulatePose not exposed');
                    for (let i = 0; i < 10; i++) w.__simulatePose(target, 0.5, 0.5, 0.9);
                }, sc.target);
                // 5s detection window + 1.5s advance.
                await page.waitForTimeout(5200);
                await page.waitForTimeout(1700);
            } else if (step.kind === 'capture-center') {
                await page.evaluate(({ target, normX, normY }) => {
                    const w = window;
                    for (let i = 0; i < 8; i++) w.__simulatePose(target, normX, normY, 0.9);
                }, { target: sc.target, normX: step.normX, normY: step.normY });
                await page.waitForTimeout(200); // let progress interval render
                await page.evaluate(() => {
                    const btn = document.querySelector('[data-testid="tracking-capture-center"]');
                    if (btn instanceof HTMLElement) btn.click();
                });
                await page.waitForTimeout(200);
            } else if (step.kind === 'capture-corner') {
                await page.evaluate(({ target, normX, normY }) => {
                    const w = window;
                    for (let i = 0; i < 8; i++) w.__simulatePose(target, normX, normY, 0.9);
                }, { target: sc.target, normX: step.normX, normY: step.normY });
                await page.waitForTimeout(200);
                await page.evaluate(() => {
                    const btn = document.querySelector('[data-testid="tracking-capture-corner"]');
                    if (btn instanceof HTMLElement) btn.click();
                });
                await page.waitForTimeout(200);
            } else if (step.kind === 'pose-burst') {
                await page.evaluate(({ target, normX, normY, count }) => {
                    const w = window;
                    for (let i = 0; i < count; i++) w.__simulatePose(target, normX, normY, 0.9);
                }, { target: sc.target, normX: step.normX, normY: step.normY, count: step.count });
                await page.waitForTimeout(200);
            } else if (step.kind === 'lost') {
                await page.evaluate(() => {
                    const w = window;
                    if (w.__simulatePoseLost) w.__simulatePoseLost();
                });
                await page.waitForTimeout(step.durationMs ?? 1000);
            } else if (step.kind === 'jitter-burst') {
                await page.evaluate(({ target, cx, cy, jitter, count }) => {
                    const w = window;
                    for (let i = 0; i < count; i++) {
                        const dx = (Math.random() - 0.5) * 2 * jitter;
                        const dy = (Math.random() - 0.5) * 2 * jitter;
                        w.__simulatePose(target, cx + dx, cy + dy, 0.7);
                    }
                }, { target: sc.target, cx: step.cx, cy: step.cy, jitter: step.jitter, count: step.count });
                await page.waitForTimeout(200);
            }
        }

        // Capture state + screenshot.
        const state = await page.evaluate(() => {
            const wiz = document.querySelector('[data-testid="tracking-setup-wizard"]');
            const status = document.querySelector('[data-testid="tracking-wizard-status"]');
            const captureBtn = document.querySelector('[data-testid="tracking-capture-center"]');
            const cornerBtn = document.querySelector('[data-testid="tracking-capture-corner"]');
            return {
                phase: wiz?.getAttribute('data-phase') || null,
                trackerStatus: wiz?.getAttribute('data-tracker-status') || null,
                statusText: status?.textContent?.trim() || null,
                captureCenterDisabled: captureBtn ? captureBtn.disabled : null,
                captureCornerDisabled: cornerBtn ? cornerBtn.disabled : null,
            };
        });

        const screenshotPath = path.join(SCREENSHOTS, sc.file.replace('.jpg', '.png'));
        await page.screenshot({ path: screenshotPath, fullPage: false });

        const phaseOK = state.phase === sc.capturePhase;
        console.log(`  phase=${state.phase} (expected ${sc.capturePhase}) ${phaseOK ? '✓' : '✗'}`);
        console.log(`  tracker=${state.trackerStatus} status="${state.statusText}"`);
        console.log(`  → ${path.relative(REPO, screenshotPath)}`);

        results.push({
            scenario: sc.file,
            label: sc.label,
            expectedPhase: sc.capturePhase,
            actualPhase: state.phase,
            ok: phaseOK,
            ...state,
        });
    } catch (e) {
        console.log(`  ERROR: ${e.message}`);
        results.push({ scenario: sc.file, label: sc.label, error: e.message });
    } finally {
        // Dump ALL captured console lines (last 30) for diagnostics.
        for (const l of consoleLines.slice(-30)) console.log(`    ${l}`);
        await browser.close();
    }
}

const resultsPath = path.join(FIXTURES, '_results.json');
await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

const okCount = results.filter(r => r.ok).length;
const total = results.length;
console.log(`\n${okCount}/${total} scenarios reached expected phase`);
console.log(`Results: ${path.relative(REPO, resultsPath)}`);
console.log(`Screenshots: ${path.relative(REPO, SCREENSHOTS)}/`);
