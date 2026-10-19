import type { Page, TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installLocalCameraAccess } from './camera-access-fixture';

const PHOTO_ROUTE = '/prism-aac/__camera-mvp-photo/';
const PHOTOS = { head: 'person-on-sofa.jpg', wrist: 'person-pointing-br.jpg', absent: 'head-out-body-only.jpg' };
export const PHOTO_FRAMING_KEY = '__aac_photographic_camera_scale';
export const PHOTO_DRIFT_RAMP_MS = 30_000;
interface CameraMotionPlan {
  startedAt: number; durationMs: number;
  from: { x: number; y: number }; to: { x: number; y: number };
}

/** Actual SDK inference; replace only hardware pixels and loopback cloud access. */
export async function installPhotographicCamera(page: Page, baseURL: string | undefined, info: TestInfo, options: { initialScale?: number; drift?: number; subject?: 'head' | 'wrist' } = {}) {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local photographic camera qualification only');
  await installLocalCameraAccess(page, baseURL, info);
  await page.route(`**${PHOTO_ROUTE}*`, route => {
    const name = new URL(route.request().url()).pathname.slice(PHOTO_ROUTE.length) as keyof typeof PHOTOS;
    if (!PHOTOS[name]) return route.abort();
    return route.fulfill({ contentType: 'image/jpeg', body: readFileSync(resolve('e2e/_fixtures/wizard-scenarios', PHOTOS[name])) });
  });
  await page.addInitScript(({ prefix, framingKey, initialScale, drift, driftRampMs, subject }) => {
    const startedAt = performance.now();
    const state = { absent: false, denied: false, pan: 0, panY: 0, move: null as CameraMotionPlan | null,
      drift, lastBias: 0, scale: Number(sessionStorage.getItem(framingKey) ?? initialScale), jitterPx: 0, lastJitter: 0, frames: 0 };
    Object.assign(window, { cameraMvpPhoto: state });
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (state.denied) throw new DOMException('Camera permission denied by the hardware fixture', 'NotAllowedError');
      if (!constraints.video) throw new DOMException('This fixture has no audio input', 'NotAllowedError');
      const head = new Image(), absent = new Image();
      head.src = `${prefix}${subject}`; absent.src = `${prefix}absent`; await Promise.all([head.decode(), absent.decode()]);
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const g = canvas.getContext('2d')!;
      const stream = canvas.captureStream(15);
      function paint() {
        if (stream.getVideoTracks()[0].readyState === 'ended') return;
        g.fillStyle = 'black'; g.fillRect(0, 0, 640, 480);
        const image = state.absent ? absent : head;
        const factor = Math.min(640 / image.width, 480 / image.height) * state.scale;
        const now = performance.now();
        if (state.move) {
          const progress = Math.max(0, Math.min(1, (now - state.move.startedAt) / state.move.durationMs));
          state.pan = state.move.from.x + (state.move.to.x - state.move.from.x) * progress;
          state.panY = state.move.from.y + (state.move.to.y - state.move.from.y) * progress;
        }
        const bias = state.drift * Math.min((now - startedAt) / driftRampMs, 1);
        state.lastBias = bias;
        // Time-driven, non-harmonic motion avoids the four-rAF/one-camera-frame
        // alias that makes alternating paint-count fixtures look stationary.
        const jitter = state.jitterPx * (0.65 * Math.sin(now / 137) + 0.35 * Math.cos(now / 83));
        state.lastJitter = jitter;
        g.drawImage(image, (640 - image.width * factor) / 2 + state.pan + jitter + bias * 640,
          (480 - image.height * factor) / 2 + state.panY + bias * 480 / 2, image.width * factor, image.height * factor);
        g.fillStyle = state.frames++ % 2 ? '#203040' : '#304050'; g.fillRect(0, 0, 6, 6);
        requestAnimationFrame(paint);
      }
      paint(); return stream;
    };
  }, { prefix: PHOTO_ROUTE, framingKey: PHOTO_FRAMING_KEY, initialScale: options.initialScale ?? 1,
    drift: options.drift ?? 0, driftRampMs: PHOTO_DRIFT_RAMP_MS, subject: options.subject ?? 'head' });
  if (options.subject !== 'wrist') info.annotations.push({ type: 'fixture-limitation', description: 'The sofa photograph has no visible wrists. Inferred wrist readiness from this image is not positive wrist-recognition or selection-accuracy evidence.' });
  info.annotations.push({ type: 'evidence-boundary', description: 'Chromium with simulated viewports; not Safari or physical iOS proof. Only hardware pixels and local cloud-capability response replaced. Installed SDK/model inference and ordinary app UI remain real. One photographic subject, not physical-camera accuracy.' });
}
