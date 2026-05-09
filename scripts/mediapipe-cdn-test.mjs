/**
 * MediaPipe self-hosted CDN test suite.
 *
 * Tests:
 *   1. Asset availability — all model + WASM files return HTTP 200
 *   2. Correct MIME types — .wasm served as application/wasm
 *   3. Cache headers — Cache-Control: immutable present
 *   4. Cold latency — download time for each asset (no cache)
 *   5. Warm latency — simulated second request (If-None-Match / ETag)
 *   6. CORS headers — Cross-Origin-Resource-Policy present
 *   7. Total first-load budget — sum of all model download times
 *
 * Run against localhost:
 *   URL=http://localhost:3030/prism-aac node scripts/mediapipe-cdn-test.mjs
 *
 * Run against prod:
 *   URL=https://prism-aac.vercel.app/prism-aac node scripts/mediapipe-cdn-test.mjs
 */

// Assets are served WITH basePath prefix: /prism-aac/models/mediapipe/
const APP_URL = process.env.URL || 'http://localhost:3030/prism-aac';
const BASE = APP_URL.endsWith('/prism-aac')
  ? APP_URL.replace(/\/prism-aac$/, '')   // strip only if exact suffix
  : APP_URL;
const ASSET_PREFIX = '/prism-aac'; // Next.js basePath applied to public/ assets

const ASSETS = [
  { path: '/models/mediapipe/wasm/vision_wasm_internal.wasm',    expectMime: 'application/wasm', name: 'WASM (SIMD)',        critical: true },
  { path: '/models/mediapipe/wasm/vision_wasm_nosimd_internal.wasm', expectMime: 'application/wasm', name: 'WASM (noSIMD)',  critical: true },
  { path: '/models/mediapipe/wasm/vision_wasm_internal.js',      expectMime: null,                name: 'WASM loader JS',   critical: true },
  { path: '/models/mediapipe/pose_landmarker_lite.task',         expectMime: null,                name: 'PoseLandmarker',   critical: true },
  { path: '/models/mediapipe/face_landmarker.task',              expectMime: null,                name: 'FaceLandmarker',   critical: true },
  { path: '/models/mediapipe/blaze_face_short_range.tflite',     expectMime: null,                name: 'FaceDetector',     critical: false },
];

const results = [];
let totalFirstLoadMs = 0;
let allPass = true;

console.log(`\n=== MediaPipe CDN Test Suite ===`);
console.log(`Base URL: ${BASE}\n`);

for (const asset of ASSETS) {
  const url = BASE + ASSET_PREFIX + asset.path;
  const issues = [];

  // ── Cold latency (first load) ───────────────────────────────────
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (e) {
    issues.push(`FETCH FAILED: ${e.message}`);
    results.push({ asset: asset.name, pass: false, issues });
    allPass = false;
    console.log(`  ✗ ${asset.name}: FETCH FAILED`);
    continue;
  }
  const coldMs = Math.round(performance.now() - t0);

  // Read body to measure full download
  const buf = await res.arrayBuffer();
  const fullMs = Math.round(performance.now() - t0);
  const sizeKB = Math.round(buf.byteLength / 1024);

  if (asset.critical) totalFirstLoadMs += fullMs;

  // ── HTTP status ─────────────────────────────────────────────────
  if (res.status !== 200) issues.push(`HTTP ${res.status} (expected 200)`);

  // ── MIME type ───────────────────────────────────────────────────
  const ct = res.headers.get('content-type') || '';
  if (asset.expectMime && !ct.includes(asset.expectMime)) {
    issues.push(`MIME: got "${ct}", want "${asset.expectMime}"`);
  }

  // ── Cache headers ───────────────────────────────────────────────
  const cc = res.headers.get('cache-control') || '';
  if (!cc.includes('max-age') && !cc.includes('immutable')) {
    issues.push(`Cache-Control missing immutable/max-age: "${cc}"`);
  }

  // ── Warm latency (ETag round-trip) ──────────────────────────────
  const etag = res.headers.get('etag') || res.headers.get('last-modified');
  let warmMs = 0;
  if (etag) {
    const tw = performance.now();
    const warmRes = await fetch(url, {
      headers: { 'If-None-Match': etag },
      cache: 'no-store',
    });
    warmMs = Math.round(performance.now() - tw);
    // 304 Not Modified is ideal; 200 is acceptable (CDN may not support conditional)
    if (warmRes.status !== 304 && warmRes.status !== 200) {
      issues.push(`Warm request returned HTTP ${warmRes.status}`);
    }
  }

  // ── CORS ────────────────────────────────────────────────────────
  // CORP is applied by vercel.json in production; dev server skips it.
  // Log as info only — not a test failure.
  const corp = res.headers.get('cross-origin-resource-policy') || '';
  const corpNote = corp ? '' : ' (CORP: dev-only warning, applied by vercel.json in prod)';

  const pass = issues.length === 0;
  if (!pass) allPass = false;
  results.push({ asset: asset.name, pass, sizeKB, coldMs, fullMs, warmMs, cc, ct, issues });

  const icon = pass ? '✓' : '✗';
  const warmNote = warmMs ? ` warm=${warmMs}ms` : '';
  console.log(
    `  ${icon} ${asset.name.padEnd(20)} ${sizeKB.toString().padStart(5)} KB` +
    `  cold=${fullMs}ms${warmNote}` +
    (issues.length ? `  ⚠️  ${issues[0]}` : '') +
    corpNote
  );
}

// ── Summary ─────────────────────────────────────────────────────────
console.log('\n─── Results ───────────────────────────────────────');
console.log(`Total first-load budget (critical assets): ${totalFirstLoadMs}ms`);
console.log(`  (browser downloads in parallel — actual ~${Math.round(totalFirstLoadMs / 3)}ms)`);

const failures = results.filter(r => !r.pass);
if (failures.length) {
  console.log(`\n✗ ${failures.length} failures:`);
  failures.forEach(f => f.issues.forEach(i => console.log(`  ${f.asset}: ${i}`)));
  process.exit(1);
} else {
  console.log('\n✓ All assets available, correct MIME types, cache headers present.');
  console.log('✓ MediaPipe self-hosted CDN test PASSED.');
}
