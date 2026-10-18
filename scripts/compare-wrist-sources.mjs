// Bounded read-only detector experiment, not app selection or physical-camera proof.
// Run with scripts/playwright-watchdog.sh --exec node scripts/compare-wrist-sources.mjs <loopback-url> <report-path>
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import ts from 'typescript';

const [base, output] = process.argv.slice(2);
if (!base || !output || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Loopback URL and explicit report path required');
const PREFIX = '/prism-aac/__wrist-source-comparison/';
const PHOTO = 'e2e/_fixtures/wizard-scenarios/person-pointing-br.jpg';
const SETTINGS = { scale: 0.65, drift: 0.015, rampMs: 30_000, durationMs: 34_000,
  moveAt: 3000, moveMs: 900, panX: -22, panY: 30, width: 640, height: 480, roiFraction: 0.4, roiSize: 256 };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route(`**${PREFIX}**`, route => {
    const name = new URL(route.request().url()).pathname.slice(PREFIX.length);
    if (name === 'start') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Local detector coordinate comparison</body>' });
    if (name === 'photo.jpg') return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(PHOTO) });
    if (name === 'vision.mjs') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('node_modules/@mediapipe/tasks-vision/vision_bundle.mjs') });
    if (!['wristMotion.js', 'cameraFrameTiming.js', 'mediapipeRuntime.js'].includes(name)) return route.abort();
    const source = fs.readFileSync(`services/${name.replace('.js', '.ts')}`, 'utf8').replace("from './cameraFrameTiming'", "from './cameraFrameTiming.js'")
      .replaceAll('process.env.NEXT_PUBLIC_BASE_PATH', JSON.stringify('/prism-aac'));
    return route.fulfill({ contentType: 'text/javascript', body: ts.transpileModule(source,
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText });
  });
  await page.goto(`${new URL(base).origin}${PREFIX}start`);
  const result = await page.evaluate(async ({ prefix, cfg }) => {
    const { PoseLandmarker, HandLandmarker, FilesetResolver } = await import(`${prefix}vision.mjs`);
    const { WristMotion, wristCursorTolerance, MIN_WRIST_SELECTION_MS } = await import(`${prefix}wristMotion.js`);
    const { MEDIAPIPE_WASM_URL, POSE_LANDMARKER_LITE_URL, HAND_LANDMARKER_URL } = await import(`${prefix}mediapipeRuntime.js`);
    const files = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    const pose = await PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_LANDMARKER_LITE_URL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 2 });
    const hand = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_LANDMARKER_URL, delegate: 'GPU' },
      runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
    const image = new Image(); image.src = `${prefix}photo.jpg`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = cfg.width; canvas.height = cfg.height;
    const context = canvas.getContext('2d'), proof = document.createElement('canvas'); proof.width = cfg.width; proof.height = cfg.height;
    const proofContext = proof.getContext('2d'), crop = document.createElement('canvas'); crop.width = crop.height = cfg.roiSize;
    const cropContext = crop.getContext('2d'), stream = canvas.captureStream(15);
    const video = document.createElement('video'); video.srcObject = stream; video.muted = true; video.playsInline = true;
    let started = null, running = true;
    function paint() {
      if (!running) return;
      const elapsed = started === null ? 0 : performance.now() - started;
      const move = Math.max(0, Math.min(1, (elapsed - cfg.moveAt) / cfg.moveMs)), bias = cfg.drift * Math.min(elapsed / cfg.rampMs, 1);
      const scale = Math.min(cfg.width / image.width, cfg.height / image.height) * cfg.scale;
      context.fillStyle = 'black'; context.fillRect(0, 0, cfg.width, cfg.height);
      context.drawImage(image, (cfg.width - image.width * scale) / 2 + move * cfg.panX + bias * cfg.width,
        (cfg.height - image.height * scale) / 2 + move * cfg.panY + bias * cfg.height / 2, image.width * scale, image.height * scale);
      requestAnimationFrame(paint);
    }
    paint(); await video.play();
    const projection = { gain: { x: 390 / 0.3, y: 844 / 0.24 }, tolerancePx: wristCursorTolerance(390, 844) };
    const gates = { pose: new WristMotion(), hand: new WristMotion() }, rows = [];
    async function observe(record) {
      await new Promise(resolve => video.requestVideoFrameCallback(resolve));
      const mediaTime = video.currentTime * 1000, inferStart = performance.now();
      proofContext.drawImage(video, 0, 0, cfg.width, cfg.height);
      const point = pose.detectForVideo(proof, performance.now()).landmarks?.[0]?.[16];
      const valid = point && [point.x, point.y].every(Number.isFinite) && point.visibility >= 0.3;
      let measured = null;
      if (valid) {
        const side = Math.min(cfg.width, cfg.height) * cfg.roiFraction;
        const x = Math.max(0, Math.min(cfg.width - side, point.x * cfg.width - side / 2));
        const y = Math.max(0, Math.min(cfg.height - side, point.y * cfg.height - side / 2));
        cropContext.drawImage(proof, x, y, side, side, 0, 0, cfg.roiSize, cfg.roiSize);
        const marks = hand.detectForVideo(crop, performance.now()).landmarks?.[0];
        if (marks?.length === 21 && marks.every(p => [p.x, p.y, p.z].every(Number.isFinite) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) {
          const anchor = { x: (x + marks[0].x * side) / cfg.width, y: (y + marks[0].y * side) / cfg.height };
          const palm = Math.max(Math.hypot(marks[0].x - marks[9].x, marks[0].y - marks[9].y), Math.hypot(marks[5].x - marks[17].x, marks[5].y - marks[17].y)) * side;
          if (palm > 0 && Math.hypot((point.x - anchor.x) * cfg.width, (point.y - anchor.y) * cfg.height) <= palm) measured = anchor;
        }
      }
      if (!record) return;
      const results = {};
      for (const [name, input] of Object.entries({ pose: valid ? point : null, hand: measured })) {
        if (!input) { gates[name].interrupt(); results[name] = null; }
        else results[name] = gates[name].update(input, mediaTime, Math.max(cfg.width, cfg.height), projection);
      }
      rows.push({ elapsedMs: performance.now() - started, mediaTime, processingMs: performance.now() - inferStart,
        pose: valid ? { x: point.x, y: point.y } : null, hand: measured, results });
    }
    try {
      await observe(false); // Warm both models before the timed trajectory, never reset during it.
      started = performance.now();
      while (performance.now() - started < cfg.durationMs) await observe(true);
    } finally { running = false; stream.getTracks().forEach(t => t.stop()); pose.close(); hand.close(); }
    const summary = {};
    for (const name of Object.keys(gates)) {
      let start = null, longest = 0, missing = 0;
      for (const row of rows.filter(r => r.elapsedMs >= cfg.moveAt + cfg.moveMs + 2000 && r.elapsedMs < cfg.rampMs)) {
        if (!row.results[name]) missing++;
        if (row.results[name]?.selectionReady) { start ??= row.mediaTime; longest = Math.max(longest, row.mediaTime - start); }
        else start = null;
      }
      summary[name] = { missing, longestReadyDuringRampMs: longest, completesMinimumHold: longest >= MIN_WRIST_SELECTION_MS };
    }
    return { projection, summary, rows };
  }, { prefix: PREFIX, cfg: SETTINGS });
  const report = { photoSha256: createHash('sha256').update(fs.readFileSync(PHOTO)).digest('hex'), settings: SETTINGS, ...result,
    limitation: 'One photographed subject, SDK coordinate comparison only. No head gate, app selection, physical-device or identity proof; no production coordinate-source change.' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, ...result.summary, frames: result.rows.length, limitation: report.limitation }));
} finally { await browser.close(); }
