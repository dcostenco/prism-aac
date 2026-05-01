'use client';

/**
 * Voice input — speech-to-text via the Web Speech API.
 *
 * Uses proper BCP-47 language codes (en-US, es-ES, ru-RU) for accurate
 * recognition across all 12 supported languages. Auto-restarts on browser
 * silence stops. Configurable silence detection for auto-stop mode.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
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
  autoStop?: boolean;
}): VoiceSession | null {
  if (!isVoiceInputSupported()) return null;
  const w = window as VoiceWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = !opts.autoStop;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const lang = opts.lang || 'en-US';
  rec.lang = lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`;

  let stopped = false;
  let lastSpeechTime = Date.now();
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const silenceThreshold = opts.silenceMs ?? 2000;

  const checkSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (stopped) return;
    lastSpeechTime = Date.now();
    silenceTimer = setTimeout(() => {
      if (Date.now() - lastSpeechTime >= silenceThreshold && !stopped) {
        opts.onSilence?.();
      }
    }, silenceThreshold);
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
    if (interim) {
      opts.onInterim(interim);
      checkSilence();
    }
    if (final) {
      opts.onFinal(final);
      checkSilence();
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech') {
      opts.onSilence?.();
      return;
    }
    if (event.error === 'aborted') return;
    opts.onError?.(event.error);
  };

  rec.onend = () => {
    if (!stopped && !opts.autoStop) {
      try { rec.start(); } catch { /* already running or blocked */ }
    }
  };

  rec.onspeechend = () => {
    if (opts.autoStop && !stopped) {
      stopped = true;
      try { rec.stop(); } catch {}
    }
  };

  try { rec.start(); } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : 'failed to start');
    return null;
  }

  checkSilence();

  return {
    stop: () => {
      stopped = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      try { rec.stop(); } catch {}
    },
  };
}
