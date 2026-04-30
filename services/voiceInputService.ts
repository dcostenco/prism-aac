'use client';

/**
 * Voice input — continuous speech-to-text via the Web Speech API.
 *
 * Chrome/Edge/Safari ship `webkitSpeechRecognition`; Firefox does not. The
 * recognizer runs entirely client-side (no audio leaves the device) and
 * streams interim + final transcripts. We use it to power the AI Chat mic
 * button: tap once to start a hands-free conversation, tap again to stop.
 *
 * Why not server-side STT? Latency, cost, and privacy. The browser engine
 * is already there for free, runs offline on most devices, and never has
 * to send a child's voice to a third party.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type VoiceWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function isVoiceInputSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as VoiceWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface VoiceSession {
  stop: () => void;
}

export function startVoiceInput(opts: {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onSilence?: () => void;
  onError?: (err: string) => void;
  silenceMs?: number;
}): VoiceSession | null {
  if (!isVoiceInputSupported()) return null;
  const w = window as VoiceWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = opts.lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

  let stopped = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const armSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (!opts.onSilence || !opts.silenceMs) return;
    silenceTimer = setTimeout(() => { opts.onSilence?.(); }, opts.silenceMs);
  };

  rec.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = res[0].transcript;
      if (res.isFinal) final += transcript;
      else interim += transcript;
    }
    if (interim) opts.onInterim(interim);
    if (final) {
      opts.onFinal(final);
      armSilence();
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    opts.onError?.(event.error);
  };

  rec.onend = () => {
    // Browsers stop after silence even with continuous=true. Auto-restart
    // unless the caller explicitly stopped us.
    if (!stopped) {
      try { rec.start(); } catch { /* already running or blocked */ }
    }
  };

  try { rec.start(); } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : 'failed to start');
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      try { rec.stop(); } catch { /* already stopped */ }
    },
  };
}
