'use client';

/**
 * Voice Cursor Service — Move cursor using voice pitch and volume
 *
 * For children who cannot touch the screen, move their head, or use
 * switches. If they can make ANY sound (hum, vowel, pitch change),
 * they can control the cursor.
 *
 * Mapping:
 *   - Pitch (frequency) → cursor Y position (high pitch = up, low = down)
 *   - Volume (amplitude) → cursor X position (loud = right, quiet = left)
 *   - Sustained sound > 1.5s on same element → dwell click
 *   - Silence > 500ms → cursor freezes (prevents drift)
 *
 * Runs entirely in-browser via Web Audio API. No cloud. Works offline.
 */

export interface VoiceCursorOptions {
  onMove: (x: number, y: number) => void;
  onDwell: (element: Element) => void;
  onStatusChange: (status: 'starting' | 'listening' | 'silent' | 'stopped') => void;
  dwellMs: number;
  sensitivity: number; // 1-10
}

export interface VoiceCursorHandle {
  stop: () => void;
}

// ── Feature Detection ──────────────────────────────────────────────────

export function isVoiceCursorSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== 'undefined';
}

// ── Constants ──────────────────────────────────────────────────────────

const FFT_SIZE = 2048;
const SILENCE_THRESHOLD = 0.02;
const SILENCE_TIMEOUT_MS = 500;
const NOISE_FLOOR_SAMPLES = 45; // ~3 seconds at 15fps
const MIN_PITCH_HZ = 80;
const MAX_PITCH_HZ = 600;

// ── Pitch Detection (autocorrelation) ──────────────────────────────────

function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  // Simple autocorrelation pitch detector
  const size = buffer.length;
  let maxCorrelation = 0;
  let bestOffset = -1;

  // Only look for pitches between MIN_PITCH_HZ and MAX_PITCH_HZ
  const minPeriod = Math.floor(sampleRate / MAX_PITCH_HZ);
  const maxPeriod = Math.floor(sampleRate / MIN_PITCH_HZ);

  for (let offset = minPeriod; offset < maxPeriod && offset < size; offset++) {
    let correlation = 0;
    for (let i = 0; i < size - offset; i++) {
      correlation += buffer[i] * buffer[i + offset];
    }
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1 || maxCorrelation < 0.01) return null;
  return sampleRate / bestOffset;
}

// ── RMS Volume ─────────────────────────────────────────────────────────

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

// ── EMA Filter ─────────────────────────────────────────────────────────

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

// ── Main Entry Point ───────────────────────────────────────────────────

export function startVoiceCursor(opts: VoiceCursorOptions): VoiceCursorHandle {
  let stopped = false;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let mediaSource: MediaStreamAudioSourceNode | null = null;
  let rafId = 0;

  // Noise floor (established from first 3 seconds of ambient sound)
  let noiseFloorSamples: number[] = [];
  let noiseFloor = 0;
  let calibrated = false;

  // Smoothed cursor position
  let sx = window.innerWidth / 2;
  let sy = window.innerHeight / 2;

  // Silence detection
  let lastSoundTime = Date.now();

  // Dwell tracking
  let dwellElement: Element | null = null;
  let dwellStart = 0;
  let dwellTriggered = false;

  const sensitivityScale = opts.sensitivity / 5;

  opts.onStatusChange('starting');

  navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((s) => {
    if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s;

    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;

    mediaSource = audioCtx.createMediaStreamSource(s);
    mediaSource.connect(analyser);

    opts.onStatusChange('listening');
    rafId = requestAnimationFrame(tick);
  }).catch(() => {
    opts.onStatusChange('stopped');
  });

  function tick() {
    if (stopped || !analyser || !audioCtx) return;
    rafId = requestAnimationFrame(tick);

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const rms = computeRMS(buffer);

    // Noise floor calibration (first 3 seconds)
    if (!calibrated) {
      noiseFloorSamples.push(rms);
      if (noiseFloorSamples.length >= NOISE_FLOOR_SAMPLES) {
        noiseFloor = noiseFloorSamples.reduce((a, b) => a + b, 0) / noiseFloorSamples.length;
        calibrated = true;
        noiseFloorSamples = [];
      }
      return;
    }

    // Subtract noise floor
    const adjustedRMS = Math.max(0, rms - noiseFloor);

    // Silence detection
    if (adjustedRMS < SILENCE_THRESHOLD) {
      if (Date.now() - lastSoundTime > SILENCE_TIMEOUT_MS) {
        opts.onStatusChange('silent');
      }
      return;
    }

    lastSoundTime = Date.now();
    opts.onStatusChange('listening');

    // Detect pitch
    const pitch = detectPitch(buffer, audioCtx.sampleRate);

    if (pitch !== null) {
      // Map pitch to Y: high pitch → top, low pitch → bottom
      const normalizedPitch = (pitch - MIN_PITCH_HZ) / (MAX_PITCH_HZ - MIN_PITCH_HZ);
      const targetY = (1 - Math.max(0, Math.min(1, normalizedPitch))) * window.innerHeight;

      // Map volume to X: louder → right, quieter → left
      const normalizedVol = Math.min(1, adjustedRMS / 0.15);
      const targetX = normalizedVol * window.innerWidth * sensitivityScale;

      // Smooth cursor movement
      sx = ema(sx, targetX, 0.15);
      sy = ema(sy, targetY, 0.15);

      // Clamp
      sx = Math.max(0, Math.min(window.innerWidth, sx));
      sy = Math.max(0, Math.min(window.innerHeight, sy));

      opts.onMove(sx, sy);

      // Dwell detection
      const elementUnder = document.elementFromPoint(sx, sy);
      const interactiveEl = elementUnder?.closest('button, a, [role="button"], [data-dwell-target], .aac-btn') ?? elementUnder;

      if (interactiveEl && interactiveEl === dwellElement) {
        if (!dwellTriggered && Date.now() - dwellStart >= opts.dwellMs) {
          dwellTriggered = true;
          opts.onDwell(interactiveEl);
          if (interactiveEl instanceof HTMLElement) interactiveEl.click();
        }
      } else {
        dwellElement = interactiveEl ?? null;
        dwellStart = Date.now();
        dwellTriggered = false;
      }
    }
  }

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
      if (mediaSource) { mediaSource.disconnect(); mediaSource = null; }
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
      opts.onStatusChange('stopped');
    },
  };
}
