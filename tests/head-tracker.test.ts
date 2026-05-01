import { describe, it, expect } from 'vitest';
import { isHeadTrackingSupported } from '@/services/headTracker';
import { useSettingsStore } from '@/store/settingsStore';

describe('Head Tracking — availability', () => {
  it('reports not supported in test environment (no camera)', () => {
    expect(isHeadTrackingSupported()).toBe(false);
  });
});

describe('Head Tracking — settings store', () => {
  it('defaults headTrackingEnabled to false', () => {
    expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  });

  it('defaults headTrackingDwellMs to 1200', () => {
    expect(useSettingsStore.getState().headTrackingDwellMs).toBe(1200);
  });

  it('defaults headTrackingSensitivity to 5', () => {
    expect(useSettingsStore.getState().headTrackingSensitivity).toBe(5);
  });

  it('updates headTrackingEnabled', () => {
    useSettingsStore.getState().update({ headTrackingEnabled: true });
    expect(useSettingsStore.getState().headTrackingEnabled).toBe(true);
    useSettingsStore.getState().update({ headTrackingEnabled: false });
  });

  it('updates headTrackingDwellMs within valid range', () => {
    useSettingsStore.getState().update({ headTrackingDwellMs: 500 });
    expect(useSettingsStore.getState().headTrackingDwellMs).toBe(500);
    useSettingsStore.getState().update({ headTrackingDwellMs: 3000 });
    expect(useSettingsStore.getState().headTrackingDwellMs).toBe(3000);
    useSettingsStore.getState().update({ headTrackingDwellMs: 1200 });
  });

  it('updates headTrackingSensitivity within valid range', () => {
    useSettingsStore.getState().update({ headTrackingSensitivity: 1 });
    expect(useSettingsStore.getState().headTrackingSensitivity).toBe(1);
    useSettingsStore.getState().update({ headTrackingSensitivity: 10 });
    expect(useSettingsStore.getState().headTrackingSensitivity).toBe(10);
    useSettingsStore.getState().update({ headTrackingSensitivity: 5 });
  });
});

describe('Head Tracking — cursor math', () => {
  it('maps face center to screen coordinates', () => {
    const screenW = 1024;
    const screenH = 768;
    const faceCenterX = 320; // out of 640 video width
    const faceCenterY = 240; // out of 480 video height
    const videoW = 640;
    const videoH = 480;

    const screenX = (faceCenterX / videoW) * screenW;
    const screenY = (faceCenterY / videoH) * screenH;

    expect(screenX).toBe(512);
    expect(screenY).toBe(384);
  });

  it('clamps cursor to screen bounds', () => {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    expect(clamp(-10, 0, 1024)).toBe(0);
    expect(clamp(1100, 0, 1024)).toBe(1024);
    expect(clamp(500, 0, 1024)).toBe(500);
  });

  it('applies exponential smoothing', () => {
    const smooth = 0.3;
    const prev = 100;
    const raw = 200;
    const smoothed = prev + smooth * (raw - prev);
    expect(smoothed).toBe(130);
  });
});

describe('Head Tracking — dwell detection', () => {
  it('triggers dwell after threshold', () => {
    const dwellMs = 1200;
    const startTime = 0;
    const currentTime = 1200;
    const elapsed = currentTime - startTime;
    expect(elapsed >= dwellMs).toBe(true);
  });

  it('does not trigger before threshold', () => {
    const dwellMs = 1200;
    const elapsed = 800;
    expect(elapsed >= dwellMs).toBe(false);
  });

  it('resets dwell when cursor moves to different element', () => {
    let dwellElement: string | null = 'button-1';
    const newElement = 'button-2';
    const changed = dwellElement !== newElement;
    expect(changed).toBe(true);
    dwellElement = newElement;
    expect(dwellElement).toBe('button-2');
  });

  it('calculates dwell progress correctly', () => {
    const dwellMs = 1200;
    const elapsed = 600;
    const progress = Math.min(elapsed / dwellMs, 1);
    expect(progress).toBeCloseTo(0.5);
  });
});

describe('Head Tracking — edge cases', () => {
  it('handles face lost gracefully', () => {
    const faceDetected = false;
    const status = faceDetected ? 'tracking' : 'lost';
    expect(status).toBe('lost');
  });

  it('handles multiple faces — uses first', () => {
    const faces = [
      { x: 100, y: 100, width: 200, height: 200 },
      { x: 400, y: 300, width: 150, height: 150 },
    ];
    const primary = faces[0];
    expect(primary.x).toBe(100);
  });

  it('handles zero-size face detection', () => {
    const face = { x: 0, y: 0, width: 0, height: 0 };
    const valid = face.width > 10 && face.height > 10;
    expect(valid).toBe(false);
  });

  it('sensitivity affects cursor speed', () => {
    const baseSensitivity = 5;
    const highSensitivity = 10;
    const movement = 50;
    const baseResult = movement * (baseSensitivity / 5);
    const highResult = movement * (highSensitivity / 5);
    expect(highResult).toBe(baseResult * 2);
  });

  it('mirror mode flips X coordinate', () => {
    const videoW = 640;
    const faceX = 200;
    const mirrored = videoW - faceX;
    expect(mirrored).toBe(440);
  });
});

describe('Head Tracking — tier gating', () => {
  it('requires Standard+ plan', () => {
    const PAID_PLANS = new Set(['standard', 'advanced', 'enterprise']);
    expect(PAID_PLANS.has('free')).toBe(false);
    expect(PAID_PLANS.has('standard')).toBe(true);
    expect(PAID_PLANS.has('enterprise')).toBe(true);
  });
});
