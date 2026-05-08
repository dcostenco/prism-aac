/**
 * Real probe: tracking features against prod. No assumptions — only
 * what the running app does:
 *   1. Toggle "Head tracking" ON via Settings UI
 *   2. Capture every console line + network request related to
 *      tracking / mediapipe / wasm / model
 *   3. Wait for getUserMedia + onMove signals (or timeout)
 *   4. Toggle "Camera input" Set Up Tracking and observe wizard
 *   5. Report: did pose model load? did camera stream resolve? did
 *      cursor.onMove fire? did any error fire?
 */
import { webkit, chromium } from '@playwright/test';
import fs from 'node:fs';

const URL = process.env.URL || 'https://prism-aac.vercel.app/prism-aac';
const TIMEOUT_MS = 60_000;

// Use webkit — matches what the user actually uses (Safari/iPad). Camera
// permission is granted via context permissions API; webkit doesn't have
// the chromium fake-device flags but we shim navigator.mediaDevices in
// the page so getUserMedia resolves with a synthetic MediaStream from a
// canvas. This gives us a real getUserMedia call path + frames so
// MediaPipe FaceLandmarker can attempt to run against fake video.
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  // Webkit's permission set differs from chromium — 'camera' isn't a
  // recognized name. The page-level shim handles permission anyway.
});
const page = await ctx.newPage();

const consoleLines = [];
const networkLines = [];
const errors = [];
page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', r => networkLines.push(`FAIL ${r.failure()?.errorText} ${r.url()}`));
page.on('response', async (r) => {
  const u = r.url();
  if (/mediapipe|wasm|task.*vision|jsdelivr|model|landmark|pose/i.test(u)) {
    networkLines.push(`${r.status()} ${u.slice(0, 140)}`);
  }
});

// Instrument: count getUserMedia invocations + return values. Webkit
// headless has no real camera, so we shim getUserMedia to return a
// synthetic stream from a 320x240 canvas (animated noise) — that gives
// the rest of the pipeline real frames to run against. addInitScript
// registers the shim BEFORE the page navigates so it's installed
// before any app code touches navigator.mediaDevices.
await page.addInitScript(() => {
  const canvas = document.createElement ? document.createElement('canvas') : null;
  // Defer canvas creation until first call (document may not exist yet).
  let stream = null;
  const makeStream = () => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 240;
    const ctx2 = c.getContext('2d');
    setInterval(() => {
      if (!ctx2) return;
      ctx2.fillStyle = `rgb(${Math.random()*255|0},${Math.random()*255|0},${Math.random()*255|0})`;
      ctx2.fillRect(0, 0, 320, 240);
      ctx2.fillStyle = '#fff';
      ctx2.fillRect(140, 80, 40, 80); // fake "face" rect
    }, 33);
    return c.captureStream ? c.captureStream(15) : null;
  };
  let count = 0;
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, writable: true });
  }
  navigator.mediaDevices.getUserMedia = async (c) => {
    count++;
    console.log(`[probe] getUserMedia call#${count} constraint=${JSON.stringify(c)}`);
    try {
      if (!stream) stream = makeStream();
      if (!stream) throw new Error('captureStream unavailable');
      console.log(`[probe] getUserMedia#${count} OK tracks=${stream.getTracks().length}`);
      return stream;
    } catch (e) {
      console.log(`[probe] getUserMedia#${count} FAIL ${e?.message}`);
      throw e;
    }
  };
  navigator.mediaDevices.enumerateDevices = async () => [
    { kind: 'videoinput', deviceId: 'fake-cam-0', label: 'Fake Camera', groupId: 'g0' },
  ];
});

console.log('=== Probe: load page ===');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });

await page.evaluate(() => {
  // Listen for tracker status events on window
  window.__probeTrackerEvents = [];
  ['head-tracker-status', 'camera-input-cursor', 'gesture-event'].forEach(name => {
    window.addEventListener(name, (e) => {
      window.__probeTrackerEvents.push({ name, detail: e.detail, t: Date.now() });
    });
  });
});

console.log('\n=== Probe: open Settings ===');
await page.evaluate(() => {
  // Click the gear button
  const btn = document.querySelector('button[aria-label*="ettings" i], button[aria-label*="Settings" i]');
  if (btn instanceof HTMLElement) btn.click();
});
await page.waitForTimeout(500);
const settingsOpen = await page.evaluate(() => {
  return !!document.querySelector('button[aria-label*="lose settings" i], [data-testid="settings-modal"]');
});
console.log('Settings panel rendered:', settingsOpen);

console.log('\n=== Probe: find + toggle Head tracking ===');
const headTrackingResult = await page.evaluate(() => {
  const toggles = Array.from(document.querySelectorAll('button[aria-label]'));
  const ht = toggles.find(b => /head[\s-]?tracking/i.test(b.getAttribute('aria-label') || ''));
  if (!ht) return { found: false, candidates: toggles.map(b => b.getAttribute('aria-label')).slice(0, 30) };
  const before = ht.getAttribute('aria-pressed');
  ht.click();
  return { found: true, label: ht.getAttribute('aria-label'), beforeClick: before };
});
console.log('Head tracking toggle:', JSON.stringify(headTrackingResult, null, 2));
await page.waitForTimeout(800);
const afterToggle = await page.evaluate(() => {
  const toggles = Array.from(document.querySelectorAll('button[aria-label]'));
  const ht = toggles.find(b => /head[\s-]?tracking/i.test(b.getAttribute('aria-label') || ''));
  return ht?.getAttribute('aria-pressed');
});
console.log('aria-pressed after 800ms:', afterToggle);

// Wait for tracker side effects
console.log('\n=== Probe: wait 15s for tracker init ===');
await page.waitForTimeout(15_000);

const headOverlay = await page.evaluate(() => {
  const ov = document.querySelector('[data-testid="head-tracking-overlay"]');
  return ov ? { mounted: true, status: ov.getAttribute('data-status'), safeMode: ov.getAttribute('data-safe-mode') } : { mounted: false };
});
console.log('Head tracking overlay:', JSON.stringify(headOverlay));

// Now toggle Camera Input (finger tracking) and observe
console.log('\n=== Probe: toggle Camera Input (finger tracking) ===');
const camToggleResult = await page.evaluate(() => {
  const toggles = Array.from(document.querySelectorAll('button[aria-label]'));
  const t = toggles.find(b => /camera input/i.test(b.getAttribute('aria-label') || ''));
  if (!t) return { found: false, candidates: toggles.map(b => b.getAttribute('aria-label')).slice(0, 30) };
  const before = t.getAttribute('aria-pressed');
  t.click();
  return { found: true, label: t.getAttribute('aria-label'), beforeClick: before };
});
console.log('Camera input toggle:', JSON.stringify(camToggleResult));
await page.waitForTimeout(800);
const camAfter = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button[aria-label]')).find(b => /camera input/i.test(b.getAttribute('aria-label') || ''));
  return t?.getAttribute('aria-pressed');
});
console.log('Camera input aria-pressed after 800ms:', camAfter);

console.log('\n=== Probe: wait 15s for finger tracker init ===');
await page.waitForTimeout(15_000);

const camOverlay = await page.evaluate(() => {
  const ov = document.querySelector('[data-testid="camera-input-overlay"]');
  return ov ? { mounted: true, status: ov.getAttribute('data-status'), target: ov.getAttribute('data-target') } : { mounted: false };
});
console.log('Camera input overlay:', JSON.stringify(camOverlay));

const trackingTargetUiState = await page.evaluate(() => {
  // Inspect the tracking-target chips — which one is highlighted as "selected"?
  const chips = Array.from(document.querySelectorAll('button')).filter(b => /Index|Wrist|Elbow|Nose|Shoulder/i.test(b.textContent || ''));
  return chips.map(c => ({ label: c.textContent?.trim(), selected: c.classList.contains('bg-[#4CAF50]') || c.style?.background?.includes('4CAF50') }));
});
console.log('Tracking target chips state:', JSON.stringify(trackingTargetUiState, null, 2));

const events = await page.evaluate(() => window.__probeTrackerEvents);
console.log('window tracker events captured:', events.length);

console.log('\n=== ALL console errors + warnings ===');
consoleLines.filter(l => l.startsWith('[error]') || l.startsWith('[warning]')).slice(-30).forEach(l => console.log(l));
console.log('\n=== Console (tracking-related) ===');
consoleLines.filter(l => /track|gesture|head|mediapipe|wasm|camera|getUserMedia|Landmarker|pose|probe/i.test(l)).slice(-40).forEach(l => console.log(l));

console.log('\n=== Network (mediapipe / model) ===');
networkLines.slice(-30).forEach(l => console.log(l));

console.log('\n=== Page errors ===');
errors.forEach(l => console.log(l));

const summary = {
  consoleLines: consoleLines.length,
  consoleErrors: consoleLines.filter(l => l.startsWith('[error]')).length,
  trackerEvents: events.length,
  networkRequests: networkLines.length,
  pageErrors: errors.length,
};
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync('/tmp/tracking-probe.json', JSON.stringify({ summary, consoleLines, networkLines, errors, events }, null, 2));

await browser.close();
