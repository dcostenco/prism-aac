'use client';

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function hapticTap(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function hapticHeavy(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(25);
  }
}

function playTone(freq: number, type: OscillatorType, peak: number, durationSec: number): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(peak, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + durationSec);
  // Without explicit disconnect, finished nodes accumulate refs in the
  // AudioContext graph until GC. On a heavy keystroke session this builds
  // measurable pressure — release them as soon as playback ends.
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

export function playClick(): void { playTone(1200, 'sine', 0.08, 0.06); }
export function playKeyClick(): void { playTone(800, 'sine', 0.05, 0.04); }
export function playDelete(): void { playTone(400, 'triangle', 0.06, 0.08); }

export function tapFeedback(): void {
  hapticTap();
  playClick();
}

export function keyFeedback(): void {
  hapticTap();
  playKeyClick();
}

export function deleteFeedback(): void {
  hapticHeavy();
  playDelete();
}
