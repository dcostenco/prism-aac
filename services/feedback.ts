'use client';

let audioCtx: AudioContext | null = null;
// Persistent near-silent oscillator that keeps the AudioContext from
// auto-suspending while a long-running task (the schedule timer) is
// pending. Required because iOS Safari and Chrome both suspend
// AudioContext after ~30s of silence, and resume() then often fails
// without a fresh user gesture — which would silently swallow the
// timer's chime when it fires a minute later.
let warmOsc: OscillatorNode | null = null;
let warmGain: GainNode | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx && audioCtx.state === 'closed') audioCtx = null;  // re-create if killed by iOS
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  return audioCtx;
}

/**
 * Attach a near-silent (gain ≈ 0.0001) oscillator to the destination so the
 * AudioContext stays in `running` state. Idempotent — safe to call multiple
 * times. Pair with stopAudioWarmup() when the long task ends.
 */
export function startAudioWarmup(): void {
  const ctx = getAudioCtx();
  if (!ctx || warmOsc) return;
  try {
    warmOsc = ctx.createOscillator();
    warmGain = ctx.createGain();
    warmGain.gain.value = 0.0001; // inaudible — far below any reasonable speaker output
    warmOsc.connect(warmGain);
    warmGain.connect(ctx.destination);
    warmOsc.frequency.value = 1; // sub-audible
    warmOsc.start();
  } catch {
    // Some environments (older browsers, locked-down WebViews) refuse this.
    // Best-effort — fall through; playTimerRing's async resume() is still
    // a usable second line of defense.
  }
}

export function stopAudioWarmup(): void {
  if (warmOsc) {
    try { warmOsc.stop(); } catch { /* already stopped */ }
    try { warmOsc.disconnect(); } catch { /* already disconnected */ }
    warmOsc = null;
  }
  if (warmGain) {
    try { warmGain.disconnect(); } catch { /* */ }
    warmGain = null;
  }
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

/** Double-tap vibration pattern for the Speak action. */
export function hapticSpeak(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([15, 30, 15]);
  }
}

/** Urgent vibration pattern for Emergency / Alert actions. */
export function hapticAlert(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([50, 50, 50, 50, 100]);
  }
}

async function playTone(freq: number, type: OscillatorType, peak: number, durationSec: number): Promise<void> {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* iOS may refuse without gesture */ }
  }
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

/**
 * Three-note rising chime — used by the schedule timer to signal that the
 * timer has expired and the user should look at the screen. Louder + longer
 * than playClick so it registers across the room. Three tones avoid sounding
 * like an alarm (single sustained tone) which is dysregulating for many AAC
 * users.
 *
 * Async so we can await ctx.resume() — the previous fire-and-forget version
 * silently failed when iOS Safari had auto-suspended the AudioContext after
 * ~30s of silence, because osc.start(ctx.currentTime) ran against a still-
 * suspended context (currentTime frozen, schedule ignored). Calling
 * startAudioWarmup() at timer-start is the primary defense; the awaited
 * resume() here is the second.
 */
export async function playTimerRing(): Promise<void> {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* iOS may refuse without gesture */ }
  }
  if (ctx.state !== 'running') return; // give up rather than schedule into the void
  const notes: Array<[number, number]> = [[660, 0], [880, 0.16], [1320, 0.32]];
  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    osc.start(start);
    osc.stop(start + 0.2);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}

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

export function speakFeedback(): void {
  hapticSpeak();
  playClick();
}

export function alertFeedback(): void {
  hapticAlert();
  playClick();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    stopAudioWarmup();
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  });
}

// Reset AudioContext when output device changes (speaker plugged in, BT headset connected)
// Mirrors the pattern in azureTTS.ts to ensure click/chime feedback plays through the new device.
if (typeof window !== 'undefined' && navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    stopAudioWarmup(); // H12: stop warmOsc before closing AudioContext to prevent node leak
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  });
}
