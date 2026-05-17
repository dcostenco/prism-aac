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
  rec.lang = lang;
  rec.maxAlternatives = 1;

  let stopped = false;
  let triggered = false;

  rec.onresult = (event) => {
    if (stopped || triggered) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (containsWakeWord(event.results[i][0].transcript)) {
        triggered = true;
        onWakeWord();
        return;
      }
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    // Other errors are transient — let onend restart the session.
  };

  rec.onend = () => {
    triggered = false; // allow next wake-word cycle
    if (!stopped) {
      try { rec.start(); } catch { /* already starting */ }
    }
  };

  try { rec.start(); } catch { return null; }

  return {
    stop: () => {
      stopped = true;
      try { rec.stop(); } catch {}
    },
  };
}
