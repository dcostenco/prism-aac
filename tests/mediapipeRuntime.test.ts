/**
 * MediaPipe runtime configuration tests — Step 3 of the SOTA-research
 * roadmap. Pins the model-version contract and validates the FPS
 * watchdog state machine.
 *
 * What we pin:
 *   • All MediaPipe URLs are pinned versions (no `@latest`) — the
 *     research review explicitly called this out as a silent-swap
 *     risk we'd hit before.
 *   • FpsWatchdog correctly classifies sustained low FPS as starved
 *     while ignoring isolated slow frames (avoids false alarms).
 *   • Watchdog is robust to NaN / non-monotonic timestamps.
 */
import { describe, it, expect } from 'vitest';
import {
  MEDIAPIPE_TASKS_VISION_VERSION,
  MEDIAPIPE_WASM_URL,
  POSE_LANDMARKER_LITE_URL,
  FACE_LANDMARKER_URL,
  FACE_DETECTOR_URL,
  HAND_LANDMARKER_URL,
  FpsWatchdog,
} from '@/services/mediapipeRuntime';

describe('MediaPipe URL pinning', () => {
  it('wasm URL is self-hosted (no external CDN, no @latest)', () => {
    // Models migrated to Vercel CDN in feat(cdn) commit — served from
    // public/models/mediapipe/ so no external version pin needed in URL.
    expect(MEDIAPIPE_WASM_URL).not.toContain('@latest');
    expect(MEDIAPIPE_WASM_URL).not.toContain('cdn.jsdelivr.net');
    expect(MEDIAPIPE_WASM_URL).not.toContain('storage.googleapis.com');
    // Self-hosted path served from the app's own domain.
    expect(MEDIAPIPE_WASM_URL).toContain('/models/mediapipe/');
  });

  it('all model URLs are self-hosted, no /latest/ external path', () => {
    const urls = [
      POSE_LANDMARKER_LITE_URL,
      FACE_LANDMARKER_URL,
      FACE_DETECTOR_URL,
      HAND_LANDMARKER_URL,
    ];
    for (const u of urls) {
      expect(u).not.toContain('/latest/');
      expect(u).not.toContain('cdn.jsdelivr.net');
      expect(u).toContain('/models/mediapipe/');
    }
  });

  it('face detector uses .tflite (the actually-published file format)', () => {
    expect(FACE_DETECTOR_URL).toContain('.tflite');
    expect(FACE_DETECTOR_URL).not.toContain('.task');
  });

  it('landmarker tasks use .task (the format their respective APIs expect)', () => {
    expect(POSE_LANDMARKER_LITE_URL).toContain('.task');
    expect(FACE_LANDMARKER_URL).toContain('.task');
    expect(HAND_LANDMARKER_URL).toContain('.task');
  });

  it('ships the hand landmarker model referenced by the runtime URL', async () => {
    // A URL-only assertion missed the production 404 that silently skipped
    // hand scanning. Pin the deployment artifact as part of the runtime contract.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const crypto = await import('node:crypto');
    const modelPath = path.join(process.cwd(), 'public/models/mediapipe/hand_landmarker.task');

    expect(fs.existsSync(modelPath)).toBe(true);
    const model = fs.readFileSync(modelPath);
    expect(model.byteLength).toBe(7_819_105);
    expect(crypto.createHash('sha256').update(model).digest('hex'))
      .toBe('fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1');
  });

  it('package.json declared version matches the pin', async () => {
    // Load the lockfile entry rather than importing — keeps the test
    // hermetic. If this drifts, the pinning contract is broken.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const declared = pkg.dependencies?.['@mediapipe/tasks-vision']
      ?? pkg.devDependencies?.['@mediapipe/tasks-vision'];
    expect(declared).toBeDefined();
    // Strip ^ / ~ semver prefix so a `^0.10.35` declaration matches
    // an exact `0.10.35` pin.
    const cleanDeclared = (declared as string).replace(/^[\^~]/, '');
    expect(cleanDeclared).toBe(MEDIAPIPE_TASKS_VISION_VERSION);
  });

  it('applies immutable asset headers to the deployed base-path URLs', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const mediaRoute = vercelConfig.headers.find(route =>
      route.source === '/prism-aac/models/mediapipe/(.*)',
    );
    const wasmRoute = vercelConfig.headers.find(route =>
      route.source === '/prism-aac/models/mediapipe/wasm/(.*\\.wasm)',
    );

    expect(mediaRoute?.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable',
    });
    expect(wasmRoute?.headers).toContainEqual({
      key: 'Content-Type',
      value: 'application/wasm',
    });
  });
});

describe('FpsWatchdog', () => {
  it('returns 0 fps during warmup', () => {
    const w = new FpsWatchdog();
    w.tick(0);
    w.tick(33);
    expect(w.fps()).toBe(0); // < 5 samples
  });

  it('reports correct fps for steady 30fps stream', () => {
    const w = new FpsWatchdog();
    let t = 0;
    for (let i = 0; i < 30; i++) { w.tick(t); t += 33.33; }
    expect(w.fps()).toBeGreaterThan(28);
    expect(w.fps()).toBeLessThan(32);
    expect(w.isStarved()).toBe(false);
  });

  it('does NOT trip on a single slow frame', () => {
    const w = new FpsWatchdog({ starvationThresholdFps: 12, starvationConsecutiveMs: 3000 });
    let t = 0;
    for (let i = 0; i < 30; i++) { w.tick(t); t += 33; } // 30fps
    w.tick(t + 200); // one 200ms frame (= 5fps instantaneous)
    expect(w.isStarved()).toBe(false);
  });

  it('trips when fps stays below threshold for the full window', () => {
    const w = new FpsWatchdog({ starvationThresholdFps: 12, starvationConsecutiveMs: 1000 });
    let t = 0;
    // ~6 fps for 4 seconds — well past the warmup + starvation window.
    for (let i = 0; i < 24; i++) { w.tick(t); t += 167; }
    expect(w.isStarved()).toBe(true);
    expect(w.fps()).toBeLessThan(12);
  });

  it('does NOT trip when fps recovers within the window', () => {
    const w = new FpsWatchdog({ starvationThresholdFps: 12, starvationConsecutiveMs: 2000 });
    let t = 0;
    // 1 second at 6fps
    for (let i = 0; i < 6; i++) { w.tick(t); t += 167; }
    // Recover to 30fps before window expires
    for (let i = 0; i < 10; i++) { w.tick(t); t += 33; }
    expect(w.isStarved()).toBe(false);
  });

  it('reset clears state', () => {
    const w = new FpsWatchdog({ starvationThresholdFps: 12, starvationConsecutiveMs: 100 });
    let t = 0;
    for (let i = 0; i < 12; i++) { w.tick(t); t += 167; }
    expect(w.isStarved()).toBe(true);
    w.reset();
    expect(w.isStarved()).toBe(false);
    expect(w.fps()).toBe(0);
  });

  it('non-monotonic / NaN timestamps are ignored', () => {
    const w = new FpsWatchdog();
    w.tick(0);
    w.tick(100);
    w.tick(NaN);
    w.tick(50); // backward
    w.tick(150);
    // Should not crash; fps is whatever the valid frames produced.
    expect(Number.isFinite(w.fps())).toBe(true);
  });
});
