import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const PREFIX = '/prism-aac/__wrist-presence-proof/';
const PHOTOS = { hidden: 'person-on-sofa.jpg', visible: 'person-pointing-br.jpg' };
const SUBJECT_SCALE = 0.65;
const DRIFTS = [0, 0.003, 0.015];
const SIZES = [[640, 480], [480, 640], [320, 240], [240, 320]];
const FRAMES_PER_CASE = 8;

test.use({ serviceWorkers: 'block', browserName: 'chromium' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

test('production wrist confirmation rejects hidden hands and recovers visible hands across framing and drift', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local detector experiment only');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const root = process.cwd();
  await info.attach('candidate-digests', { contentType: 'application/json', body: JSON.stringify([
    'services/wristPresence.ts', 'services/handProfileService.ts', 'services/mediapipeRuntime.ts', 'public/models/mediapipe/hand_landmarker.task',
    'public/models/mediapipe/pose_landmarker_lite.task',
    ...Object.values(PHOTOS).map(name => `e2e/_fixtures/wizard-scenarios/${name}`),
  ].map(name => ({ name, sha256: createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex') }))) });
  await page.route(`**${PREFIX}**`, route => {
    const name = new URL(route.request().url()).pathname.slice(PREFIX.length);
    if (name === 'start') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Local hand detector experiment</body></html>' });
    if (name === 'vision.mjs') return route.fulfill({ contentType: 'text/javascript', body: readFileSync(resolve(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')) });
    if (name === 'hidden.jpg' || name === 'visible.jpg') return route.fulfill({ contentType: 'image/jpeg',
      body: readFileSync(resolve(root, 'e2e/_fixtures/wizard-scenarios', PHOTOS[name === 'hidden.jpg' ? 'hidden' : 'visible'])) });
    if (!['wristPresence.js', 'handProfileService.js', 'mediapipeRuntime.js'].includes(name)) return route.abort();
    const source = readFileSync(resolve(root, 'services', name.replace(/\.js$/, '.ts')), 'utf8')
      .replace("import('@mediapipe/tasks-vision')", "import('./vision.mjs')")
      .replace("import('./mediapipeRuntime')", "import('./mediapipeRuntime.js')")
      .replace("from './handProfileService'", "from './handProfileService.js'")
      .replaceAll('process.env.NEXT_PUBLIC_BASE_PATH', JSON.stringify('/prism-aac'));
    return route.fulfill({ contentType: 'text/javascript', body: ts.transpileModule(source,
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText });
  });
  await page.goto(`${PREFIX}start`);
  const observations = await page.evaluate(async ({ prefix, sizes, drifts, scale, count }) => {
    const { startWristPresence } = await import(`${prefix}wristPresence.js`);
    const presence = await startWristPresence();
    const { PoseLandmarker, FilesetResolver } = await import(`${prefix}vision.mjs`);
    const { MEDIAPIPE_WASM_URL, POSE_LANDMARKER_LITE_URL } = await import(`${prefix}mediapipeRuntime.js`);
    const pose = await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL), {
      baseOptions: { modelAssetPath: POSE_LANDMARKER_LITE_URL, delegate: 'GPU' },
      runningMode: 'VIDEO', numPoses: 2,
    });
    const rows: Array<{ subject: string; size: number[]; drift: number; frame: number;
      poseWrist: { x: number; y: number } | null; associated: boolean; processingMs: number }> = [];
    let sequence = 0;
    for (const [width, height] of sizes) for (const subject of ['hidden', 'visible']) {
      const image = new Image(); image.src = `${prefix}${subject}.jpg`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d')!;
      const proof = document.createElement('canvas'); proof.width = width; proof.height = height;
      const proofContext = proof.getContext('2d')!;
      const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream;
      document.body.append(video); context.fillRect(0, 0, width, height);
      const play = video.play(); track.requestFrame(); await play;
      try {
        for (const drift of drifts) for (let frame = 0; frame < count; frame++) {
          context.fillStyle = 'black'; context.fillRect(0, 0, width, height);
          const factor = Math.min(width / image.width, height / image.height) * scale;
          const bias = drift * frame / (count - 1);
          context.drawImage(image, (width - image.width * factor) / 2 + bias * width,
            (height - image.height * factor) / 2 + bias * height / 2, image.width * factor, image.height * factor);
          const marker = [8 + (++sequence % 16) * 16, 8 + (Math.floor(sequence / 16) % 16) * 16, 8];
          context.fillStyle = `rgb(${marker.join(',')})`; context.fillRect(0, 0, 8, 8);
          let matched = false;
          for (let attempt = 0; attempt < 6; attempt++) {
            const nextFrame = new Promise<void>((resolve, reject) => {
              const deadline = setTimeout(() => reject(new Error('No new camera frame')), 1500);
              video.requestVideoFrameCallback(() => { clearTimeout(deadline); resolve(); });
            });
            track.requestFrame(); await nextFrame;
            proofContext.drawImage(video, 0, 0, width, height);
            const pixel = proofContext.getImageData(3, 3, 1, 1).data;
            if (marker.every((channel, i) => Math.abs(channel - pixel[i]) <= 6)) { matched = true; break; }
          }
          if (!matched) throw new Error('Decoded pixels do not match the commanded photographic frame');
          const started = performance.now();
          const point = pose.detectForVideo(proof, started).landmarks?.[0]?.[16] ?? null;
          const associated = !!point && presence.confirm(proof, point, performance.now());
          rows.push({ subject, size: [width, height], drift, frame,
            poseWrist: point ? { x: point.x, y: point.y } : null, associated, processingMs: performance.now() - started });
        }
      } finally { stream.getTracks().forEach(track => track.stop()); video.remove(); }
    }
    pose.close(); presence.close();
    return rows;
  }, { prefix: PREFIX, sizes: SIZES, drifts: DRIFTS, scale: SUBJECT_SCALE, count: FRAMES_PER_CASE });
  writeFileSync(info.outputPath('hand-detector-observations.json'), JSON.stringify(observations, null, 2));
  await info.attach('hand-detector-observations', { contentType: 'application/json', body: JSON.stringify(observations, null, 2) });
  const summary = SIZES.flatMap(size => Object.keys(PHOTOS).flatMap(subject => DRIFTS.map(drift => {
    const rows = observations.filter(row => row.size[0] === size[0] && row.size[1] === size[1] && row.subject === subject && row.drift === drift);
    return { size, subject, drift, frames: rows.length, found: rows.filter(row => row.associated).length,
      recovered: rows.at(-1)?.associated === true };
  })));
  await info.attach('hand-detector-summary', { contentType: 'application/json', body: JSON.stringify(summary, null, 2) });
  console.info(`HAND_PRESENCE_PROOF ${JSON.stringify(summary)}`);
  expect(errors).toEqual([]);
  expect(observations).toHaveLength(SIZES.length * DRIFTS.length * Object.keys(PHOTOS).length * FRAMES_PER_CASE);
  expect(summary.filter(row => row.subject === 'hidden' && row.found !== 0), 'hidden wrists must not qualify').toEqual([]);
  // A missed frame must be rejected, not filled with an old observation. The
  // application regression separately requires a NEW hold after that miss.
  // Here require recovery by the fixed final frame, not impossible per-frame
  // perfection. Keep every miss in the raw observations and summary.
  expect(summary.filter(row => row.subject === 'visible' && !row.recovered), 'visible hand must recover within the fixed eight-frame sequence').toEqual([]);
  info.annotations.push({ type: 'claim-boundary', description: 'Production wristPresence and installed models on decoded photographic video. Zero hidden-hand confirmations plus bounded visible-hand recovery; all misses retained. This is not physical-device, identity, intent, real-time drift or cursor-selection proof.' });
});
