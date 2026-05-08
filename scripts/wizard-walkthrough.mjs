/**
 * Walk the tracking setup wizard end-to-end against live prod.
 * Reports what the wizard actually does at each phase so we can
 * see WHY the user reports the cursor doesn't move / test never
 * registers hits — without speculating.
 *
 * Camera shim: a canvas that draws a moving "fake hand" rectangle
 * across the frame. MediaPipe Pose won't detect a real wrist in
 * random pixels — so we expect detection to fail in this probe.
 * That itself is informative: it confirms the wizard's no-detection
 * code path. The user's bug is on top of a working wizard, so we
 * can sanity-check the no-detection branch and report any structural
 * problems (cursor not rendering, status not updating, phase stuck
 * incorrectly).
 */
import { webkit } from '@playwright/test';

const URL = process.env.URL || 'https://prism-aac.vercel.app/prism-aac';

const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  let stream = null;
  const makeStream = () => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 480;
    const ctx2 = c.getContext('2d');
    let t = 0;
    setInterval(() => {
      if (!ctx2) return;
      // Background — static gray
      ctx2.fillStyle = '#888';
      ctx2.fillRect(0, 0, 640, 480);
      // Fake "face" — center oval
      ctx2.fillStyle = '#ffd1a5';
      ctx2.beginPath();
      ctx2.ellipse(320, 200, 60, 80, 0, 0, Math.PI*2);
      ctx2.fill();
      // Fake "hand" — moves across bottom
      const hx = 100 + (t % 440);
      ctx2.fillStyle = '#ffe0c0';
      ctx2.fillRect(hx, 350, 60, 60);
      t += 8;
    }, 33);
    return c.captureStream ? c.captureStream(15) : null;
  };
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, writable: true });
  }
  navigator.mediaDevices.getUserMedia = async () => {
    if (!stream) stream = makeStream();
    if (!stream) throw new Error('captureStream unavailable');
    return stream;
  };
  navigator.mediaDevices.enumerateDevices = async () => [
    { kind: 'videoinput', deviceId: 'fake-cam', label: 'Fake Camera', groupId: 'g0' },
  ];
});

const consoleLines = [];
page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text().slice(0, 250)}`));
page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.message}`));

console.log('=== Loading prod ===');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });

const snap = async (label) => {
  const state = await page.evaluate(() => {
    const wiz = document.querySelector('[data-testid="tracking-setup-wizard"]');
    const cursor = document.querySelector('[data-testid="tracking-wizard-cursor"]');
    const status = document.querySelector('[data-testid="tracking-wizard-status"]');
    return {
      wizard: wiz ? {
        phase: wiz.getAttribute('data-phase'),
        trackerStatus: wiz.getAttribute('data-tracker-status'),
      } : null,
      cursor: cursor ? {
        rendered: true,
        left: cursor.style.left,
        top: cursor.style.top,
        bg: cursor.style.backgroundColor,
      } : { rendered: false },
      statusText: status?.textContent?.trim() || null,
    };
  });
  console.log(`[${label}]`, JSON.stringify(state));
};

console.log('\n=== Open Settings + enable Camera input + open wizard ===');
await page.evaluate(() => {
  const b = document.querySelector('button[aria-label*="ettings" i]');
  if (b instanceof HTMLElement) b.click();
});
await page.waitForTimeout(600);
const camToggleClicked = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button[aria-label]')).find(b => /camera input/i.test(b.getAttribute('aria-label') || ''));
  if (!t) return false;
  if (t.getAttribute('aria-pressed') === 'false') t.click();
  return true;
});
console.log('Camera input toggled:', camToggleClicked);
await page.waitForTimeout(800);

const wizOpened = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const setup = btns.find(b => /Set Up Tracking/i.test(b.textContent || ''));
  if (!setup) return false;
  setup.click();
  return true;
});
console.log('Set Up Tracking clicked:', wizOpened);
await page.waitForTimeout(800);
await snap('after-open');

console.log('\n=== Click "Get Started" intro button ===');
const introClicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('[data-testid="tracking-setup-wizard"] button'));
  const start = btns.find(b => /Get Started|Start/i.test(b.textContent || ''));
  if (!start) return { found: false, candidates: btns.map(b => b.textContent?.trim()).slice(0, 10) };
  start.click();
  return { found: true };
});
console.log('Intro click:', JSON.stringify(introClicked));

console.log('\n=== Wait through detection phase (8s) ===');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1000);
  await snap(`detect-${i+1}s`);
}

console.log('\n=== Wait for auto-advance to calibrate-center (3s more) ===');
await page.waitForTimeout(3000);
await snap('post-detect');

console.log('\n=== Console (tracking-related, last 40) ===');
consoleLines.filter(l => /track|gesture|head|mediapipe|wasm|camera|getUserMedia|Landmarker|pose|wizard|calibrat|detect/i.test(l)).slice(-40).forEach(l => console.log(l));

await browser.close();
console.log('\nDONE');
