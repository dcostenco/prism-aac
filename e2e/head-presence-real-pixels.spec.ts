import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';

// Actual production presence/ownership code + actual installed SDK/models.
// Only module transport and the photographic camera source are test fixtures.
// Serve the entry module's whole relative-import graph, so a new production
// dependency is digested and served instead of silently aborted.
function sourceGraph(entry: string): string[] {
  const seen = new Set<string>(), queue = [entry];
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (seen.has(name)) continue;
    seen.add(name);
    for (const [, dependency] of readFileSync(resolve(process.cwd(), `services/${name}.ts`), 'utf8').matchAll(/from '\.\/(\w+)'/g)) queue.push(dependency);
  }
  return [...seen];
}
const SOURCE_MODULES = sourceGraph('headPresence');
const PIXEL_FIXTURES = {
  head: 'e2e/_fixtures/wizard-scenarios/person-on-sofa.jpg',
  absent: 'e2e/_fixtures/wizard-scenarios/head-out-body-only.jpg',
};
const DRIFT_LEVELS = [0, 0.003, 0.015];
const FRAME_PROFILES = [
  { name: 'requested resolution', sizes: [[320, 240], [240, 320]] },
  { name: 'camera ignored resolution', sizes: [[640, 480], [480, 640]] },
];
const PHOTO_SCALES = [1, 0.5, 0.25];
// Limited preview contract, not unrestricted physical-camera qualification.
// Quarter-scale photos remain in the results to expose the known framing limit.
const PREVIEW_SCALES = [1, 0.5];
const POSITIONS = [0, 0.5, 1];
const PROBE_PREFIX = '/prism-aac/__head-presence-proof/';
const MODEL_RESOURCE_PREFIX = '/prism-aac/models/mediapipe/';
const MODEL_FILES = ['blaze_face_full_range.tflite', 'face_landmarker.task'] as const;

test.use({ serviceWorkers: 'block' });
for (const profile of FRAME_PROFILES) test(`limited head preview acquires supported framing and rejects hands-only pixels: ${profile.name}`, async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local model qualification only');
  const root = process.cwd();
  await info.attach('candidate-digests', { body: JSON.stringify([...MODEL_FILES.map(name => {
    const bytes = readFileSync(resolve(root, 'public/models/mediapipe', name));
    return { name, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  }), ...SOURCE_MODULES.map(name => ({ name, sha256: createHash('sha256').update(readFileSync(resolve(root, `services/${name}.ts`))).digest('hex') }))]), contentType: 'application/json' });
  page.on('console', message => { if (message.text().startsWith('HEAD_PROOF ') || message.text().startsWith('HEAD_MESH ')) process.stdout.write(`${message.text()}\n`); });
  // Serve the committed runtime/model bytes directly. Qualification must
  // not depend on a separate, possibly stopped local application server.
  await page.route(`**${MODEL_RESOURCE_PREFIX}**`, route => {
    const resource = new URL(route.request().url()).pathname.slice(MODEL_RESOURCE_PREFIX.length);
    if (!/^(?:wasm\/vision_wasm_[a-z_]+\.(?:js|wasm)|[a-z_]+\.(?:tflite|task))$/.test(resource)) return route.abort();
    return route.fulfill({ contentType: resource.endsWith('.js') ? 'text/javascript' :
      resource.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      body: readFileSync(resolve(root, 'public/models/mediapipe', resource)) });
  });
  await page.route(`**${PROBE_PREFIX}**`, async route => {
    const name = new URL(route.request().url()).pathname.slice(PROBE_PREFIX.length);
    if (name === 'start') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Head presence model qualification</body></html>' });
    if (name === 'vision.mjs') return route.fulfill({ contentType: 'text/javascript', body: readFileSync(resolve(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')) });
    if (name === 'head.jpg' || name === 'absent.jpg') return route.fulfill({ contentType: 'image/jpeg', body: readFileSync(resolve(root, PIXEL_FIXTURES[name === 'head.jpg' ? 'head' : 'absent'])) });
    const module = SOURCE_MODULES.find(m => name === `${m}.js`);
    if (!module) return route.abort();
    let source = readFileSync(resolve(root, `services/${module}.ts`), 'utf8');
    source = source.replace(/from '\.\/(\w+)'/g, "from './$1.js'")
      .replace("import('@mediapipe/tasks-vision')", "import('./vision.mjs')")
      .replaceAll('process.env.NEXT_PUBLIC_BASE_PATH', JSON.stringify('/prism-aac'));
    return route.fulfill({ contentType: 'text/javascript', body: ts.transpileModule(source,
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText });
  });
  await page.goto(`${PROBE_PREFIX}start`);
  const results = await page.evaluate(async ({ prefix, drifts, sizes, scales, positions }) => {
    const { startHeadPresence } = await import(`${prefix}headPresence.js`);
    const keepAlive = await startHeadPresence();
    let sequence = 0;
    const observations: Array<{ kind: string; width: number; height: number; scale: number; position: number; drift: number; found: boolean; acquisitionMs: number }> = [];
    for (const drift of drifts) for (const [width, height] of sizes) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const g = canvas.getContext('2d')!;
      const proof = document.createElement('canvas'); proof.width = width; proof.height = height;
      const proofContext = proof.getContext('2d')!;
      const stream = canvas.captureStream(0), video = document.createElement('video');
      const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      video.muted = true; video.playsInline = true; video.srcObject = stream;
      document.body.append(video); g.fillRect(0, 0, width, height);
      const play = video.play(); track.requestFrame(); await play;
      const nextFrame = () => new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Photographic source did not produce a native video frame')), 1500);
        video.requestVideoFrameCallback(() => { clearTimeout(deadline); resolve(); });
        track.requestFrame();
      });
      try {
        for (const kind of ['head', 'absent']) {
          const image = new Image(); image.src = `${prefix}${kind}.jpg`; await image.decode();
          for (const scale of scales) for (const position of positions) {
            const head = await startHeadPresence();
            const started = performance.now(); let found = false;
            try {
              for (let frame = 0; frame < 12; frame++) {
                g.fillStyle = 'black'; g.fillRect(0, 0, width, height);
                const factor = Math.min(width / image.width, height / image.height) * scale;
                const dx = Math.max(0, Math.min(width - image.width * factor, (width - image.width * factor) * position + drift * width * frame / 12));
                const dy = Math.max(0, Math.min(height - image.height * factor, (height - image.height * factor) * position + drift * height * frame / 12));
                g.drawImage(image, dx, dy, image.width * factor, image.height * factor);
                const marker = [8 + (++sequence % 16) * 16, 8 + (Math.floor(sequence / 16) % 16) * 16, 8];
                g.fillStyle = `rgb(${marker.join(',')})`; g.fillRect(0, 0, 8, 8);
                let matched = false;
                for (let attempt = 0; attempt < 6; attempt++) {
                  await nextFrame(); proofContext.drawImage(video, 0, 0, width, height);
                  const pixel = proofContext.getImageData(3, 3, 1, 1).data;
                  if (marker.every((channel, i) => Math.abs(channel - pixel[i]) <= 6)) { matched = true; break; }
                }
                if (!matched) throw new Error('Decoded video does not match the intended photographic frame');
                const observation = head.detect(video, performance.now());
                if (observation.present) {
                  found = true;
                  if (kind === 'absent') console.info(`HEAD_PROOF_FALSE ${JSON.stringify({ width, height, scale, position, drift, observation })}`);
                  if (kind === 'head') break;
                }
              }
              const result = { kind, width, height, scale, position, drift, found, acquisitionMs: performance.now() - started };
              observations.push(result); console.info(`HEAD_PROOF ${JSON.stringify(result)}`);
            } finally { head.close(); }
          }
        }
      } finally { stream.getTracks().forEach(t => t.stop()); video.remove(); }
    }
    keepAlive.close();
    return observations;
  }, { prefix: PROBE_PREFIX, drifts: DRIFT_LEVELS, sizes: profile.sizes, scales: PHOTO_SCALES, positions: POSITIONS });
  await info.attach('head-presence-real-pixels', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  await info.attach('preview-boundary', { body: JSON.stringify({ previewScales: PREVIEW_SCALES,
    unrestrictedHeadMisses: results.filter(r => r.kind === 'head' && !r.found),
    limitation: 'Scaled photographs of one person are not physical-camera, population, angle or distance qualification.' }), contentType: 'application/json' });
  expect(results).toHaveLength(108);
  expect(results.filter(r => r.kind === 'head' && PREVIEW_SCALES.includes(r.scale) && !r.found), 'limited preview head acquisition failures').toEqual([]);
  expect(results.filter(r => r.kind === 'absent' && r.found), 'false head presence').toEqual([]);
  await page.close();
});
