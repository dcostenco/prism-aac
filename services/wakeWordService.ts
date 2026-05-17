'use client';

/**
 * Wake word detection — listens continuously for "Hey Prism" and fires
 * a callback when heard. WebSpeech-based; not available when the iOS
 * native bridge owns the audio session (native bridge handles auto-listen
 * via the hands-free mode restart loop instead).
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type WakeWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const WAKE_PHRASE = 'hey prism';

function containsWakeWord(text: string): boolean {
  return text.toLowerCase().includes(WAKE_PHRASE);
}

export interface WakeWordSession {
  stop: () => void;
}

export function isWakeWordSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // Native bridge owns the mic — can't run a parallel continuous session.
  if ((window as any).prismNativeBridge?.startVoice) return false;
  const w = window as WakeWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startWakeWordDetection(
  lang: string,
  onWakeWord: () => void,
): WakeWordSession | null {
  if (!isWakeWordSupported()) return null;
  const w = window as WakeWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  // Wake phrase "hey prism" uses English phonemes — must use en-US acoustic
  // model regardless of the UI language. Setting rec.lang = lang (e.g. ro-RO)
  // means the recogniser never matches the English wake phrase for non-English users.
  rec.lang = 'en-US';
  rec.maxAlternatives = 1;

  let stopped = false;
  let triggered = false;
  let restartCount = 0;
  const MAX_RESTARTS = 10;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  rec.onresult = (event) => {
    if (stopped || triggered) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (containsWakeWord(event.results[i][0].transcript)) {
        triggered = true;
        onWakeWord();
        return;
      }
    }
    // A successful recognition result means the session is healthy — reset
    // the transient-error counter so 10 isolated glitches don't silently
    // kill the detector while the UI still shows it as active.
    restartCount = 0;
  };

  rec.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    // Permission errors are permanent — stop the loop immediately rather than
    // letting onend restart and spin indefinitely.
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopped = true;
      return;
    }
    // Other errors are transient — let onend restart with backoff.
  };

  rec.onend = () => {
    triggered = false; // each cycle starts fresh
    if (stopped) return;
    if (restartCount >= MAX_RESTARTS) {
      stopped = true;
      console.warn('[wake-word] max restarts reached — giving up');
      return;
    }
    // Exponential backoff: 200 ms → 400 ms → … → 10 s cap.
    const delay = Math.min(200 * 2 ** restartCount, 10_000);
    restartCount++;
    restartTimer = setTimeout(() => {
      if (!stopped) try { rec.start(); } catch { /* already starting */ }
    }, delay);
  };

  try { rec.start(); } catch {
    rec.onresult = null; rec.onerror = null; rec.onend = null;
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      try { rec.stop(); } catch {}
    },
  };
}
