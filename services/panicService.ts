'use client';

/**
 * Global Panic Service — Universal Emergency Stop
 *
 * Activation triggers:
 *   - Press Escape 3 times rapidly (< 1 second)
 *   - Hold 5 fingers on screen for 2 seconds (accommodates palm-resting)
 *   - Programmatic: emergencyStop()
 *
 * What it kills:
 *   - All speech (Azure TTS, Web Speech, WASM beeps)
 *   - Switch scanning (timer, highlights, HID)
 *   - Emergency alarms (SOS audio, flash overlay)
 *   - All active intervals and timeouts tracked by this service
 */

import { stopSpeech } from './speechService';
import { stopWasmSpeech } from './wasmTTS';
import { stopScan } from './switchScanService';
import { stopAlarm, stopFlash, stopEmergencySpeaker } from './emergencyService';

let panicListenersActive = false;
let escapeTimestamps: number[] = [];
let fiveFingerTimer: ReturnType<typeof setTimeout> | null = null;

export function emergencyStop(): void {
  try { stopSpeech(); } catch { /* */ }
  try { stopWasmSpeech(); } catch { /* */ }
  try { stopAlarm(); } catch { /* */ }
  try { stopFlash(); } catch { /* */ }
  try { stopEmergencySpeaker(); } catch { /* */ }
  try { stopScan(); } catch { /* */ }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* */ }
  }

  if (typeof document !== 'undefined') {
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(76,175,80,0.4);pointer-events:none;transition:opacity 0.5s;';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    setTimeout(() => flash.remove(), 700);
  }
}

function onEscapeKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  const now = Date.now();
  escapeTimestamps.push(now);
  escapeTimestamps = escapeTimestamps.filter(t => now - t < 1000);
  if (escapeTimestamps.length >= 3) {
    escapeTimestamps = [];
    emergencyStop();
  }
}

// 5-finger touch must be HELD for 2 seconds to prevent false positives
// from children with spasticity who rest their palm on the screen.
function onFiveFingerTouchStart(e: TouchEvent): void {
  if (e.touches.length >= 5 && !fiveFingerTimer) {
    fiveFingerTimer = setTimeout(() => {
      fiveFingerTimer = null;
      emergencyStop();
    }, 2000);
  }
}

function onFiveFingerTouchEnd(e: TouchEvent): void {
  if (e.touches.length < 5 && fiveFingerTimer) {
    clearTimeout(fiveFingerTimer);
    fiveFingerTimer = null;
  }
}

export function registerPanicListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (panicListenersActive) return () => {};
  panicListenersActive = true;

  window.addEventListener('keydown', onEscapeKey, true);
  window.addEventListener('touchstart', onFiveFingerTouchStart, { passive: true });
  window.addEventListener('touchend', onFiveFingerTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onFiveFingerTouchEnd, { passive: true });
  // Clear panic timer when OS steals focus (Control Center, multitasking)
  const onBlur = () => { if (fiveFingerTimer) { clearTimeout(fiveFingerTimer); fiveFingerTimer = null; } };
  window.addEventListener('blur', onBlur);

  return () => {
    window.removeEventListener('keydown', onEscapeKey, true);
    window.removeEventListener('touchstart', onFiveFingerTouchStart);
    window.removeEventListener('touchend', onFiveFingerTouchEnd);
    window.removeEventListener('touchcancel', onFiveFingerTouchEnd);
    window.removeEventListener('blur', onBlur);
    if (fiveFingerTimer) { clearTimeout(fiveFingerTimer); fiveFingerTimer = null; }
    panicListenersActive = false;
  };
}

export function isPanicServiceActive(): boolean {
  return panicListenersActive;
}
