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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).prismNativeBridge?.startVoice) return true;
  const w = window as VoiceWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface VoiceSession {
  stop: () => void;
}

const LANG_MAP: Record<string, string> = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU',
  ro: 'ro-RO', uk: 'uk-UA', pt: 'pt-BR', 'pt-PT': 'pt-PT',
  zh: 'zh-CN', 'zh-TW': 'zh-TW', ja: 'ja-JP',
  ko: 'ko-KR', ar: 'ar-SA', it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL',
  tr: 'tr-TR', vi: 'vi-VN', th: 'th-TH', hi: 'hi-IN',
};

function computeLang(lang: string): string {
  if (LANG_MAP[lang]) return LANG_MAP[lang];
  return LANG_MAP[lang.split('-')[0]] || 'en-US';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function startNativeVoice(opts: {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onSilence?: () => void;
  onError?: (err: string) => void;
  silenceMs?: number;
  autoStop?: boolean;
}, bridge: any): VoiceSession {
  let stopped = false;
  let speechStarted = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const silenceThreshold = opts.silenceMs ?? 2000;

  const checkSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (stopped) return;
    silenceTimer = setTimeout(() => {
      if (!stopped) opts.onSilence?.();
    }, silenceThreshold);
  };

  const setCallback = (name: string, fn: (arg: unknown) => void) => {
    try {
      Object.defineProperty(window, name, { value: fn, writable: true, configurable: true });
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any)[name] = fn;
    }
  };
  const deleteCallback = (name: string) => {
    try {
      Object.defineProperty(window, name, { value: undefined, writable: true, configurable: true });
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[name];
    }
  };

  const cleanup = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    deleteCallback('prismNativeSpeechResult');
    deleteCallback('prismNativeSpeechError');
  };

  setCallback('prismNativeSpeechResult', (result: unknown) => {
    if (stopped) return;
    if (!result || typeof result !== 'object') return;
    const r = result as Record<string, unknown>;
    const interim = typeof r.interim === 'string' ? r.interim.slice(0, 2000) : '';
    const final = typeof r.final === 'string' ? r.final.slice(0, 2000) : '';
    if (!speechStarted && (interim || final)) {
      speechStarted = true;
      checkSilence();
    }
    if (interim) {
      opts.onInterim(interim);
      checkSilence();
    }
    if (final) {
      opts.onFinal(final);
      checkSilence();
      if (opts.autoStop) {
        stopped = true;
        cleanup();
      }
    }
  });

  setCallback('prismNativeSpeechError', (error: unknown) => {
    if (stopped) return;
    stopped = true;
    try { bridge.stopVoice(); } catch { /* native bridge may be gone */ }
    cleanup();
    opts.onError?.(typeof error === 'string' ? error : 'unknown');
  });

  bridge.startVoice(computeLang(opts.lang || 'en-US'));

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try { bridge.stopVoice(); } catch { /* native bridge may be gone */ }
      cleanup();
    },
  };
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bridge = (window as any).prismNativeBridge;
  if (bridge?.startVoice) {
    return startNativeVoice(opts, bridge);
  }

  const w = window as VoiceWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = !opts.autoStop;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.lang = computeLang(opts.lang || 'en-US');

  let stopped = false;
  let speechStarted = false;
  let lastSpeechTime = Date.now();
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const silenceThreshold = opts.silenceMs ?? 2000;

  // Only arm the silence timer AFTER the engine has produced at least one
  // result. Otherwise the initial post-start `checkSilence()` call would
  // fire onSilence ~2s after tap when the user is still drawing breath,
  // killing the session before they say anything. Same behavior as the
  // native bridge path above (speechStarted flag).
  const checkSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (stopped || !speechStarted) return;
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
    if (interim || final) speechStarted = true;
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
    // no-speech only counts as silence AFTER we've heard something. Before
    // that it just means "user hasn't started speaking yet" — let the
    // session continue rather than stopping it preemptively.
    if (event.error === 'no-speech') {
      if (speechStarted) opts.onSilence?.();
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

  // Note: do NOT call checkSilence() here. The silence timer is armed by
  // the first speech result; arming it on start would race the user.

  return {
    stop: () => {
      stopped = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      try { rec.stop(); } catch {}
    },
  };
}
