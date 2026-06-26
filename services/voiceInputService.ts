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
  bg: 'bg-BG', he: 'he-IL', tl: 'fil-PH', id: 'id-ID',
};

export function computeLang(lang: string): string {
  if (LANG_MAP[lang]) return LANG_MAP[lang];
  return LANG_MAP[lang.split('-')[0]] || 'en-US';
}

const MIN_CONFIDENCE = 0.6;

// Non-communicative filler sounds ONLY — words that double as valid
// single-word utterances (yeah, oh, so, well, no, bueno, ну, etc.)
// are deliberately excluded. AAC users may say just "yeah" as a
// complete affirmative response — dropping it is a communication failure.
const FILLER_WORDS: Record<string, Set<string>> = {
  en: new Set(['uh','um','hm','hmm','er','erm']),
  es: new Set(['eh','um']),
  fr: new Set(['euh','bof']),
  de: new Set(['äh','ähm','hm','hmm']),
  pt: new Set(['hm']),
  it: new Set(['eh','beh','mah']),
  ru: new Set(['э','эм']),
  uk: new Set(['е','ем']),
  ro: new Set(['ă','ăă','hm']),
  bg: new Set(['ъ','ъм','хм']),
  ja: new Set(['えーと','えー','うーん']),
  zh: new Set(['嗯','呃']),
  ko: new Set(['음','어']),
  ar: new Set(['اه']),
  he: new Set(['אה','אמ']),
  hi: new Set(['अं','उम']),
  pl: new Set(['yyy','eee','hmm']),
  nl: new Set(['eh','uhm']),
  vi: new Set(['ờ','ừm']),
  tl: new Set(['ah','eh']),
  tr: new Set(['ıı','eee']),
  id: new Set(['eh','em','hmm']),
};

export { FILLER_WORDS, MIN_CONFIDENCE };

export function isFillerOnly(text: string, lang: string): boolean {
  const cleaned = text.toLowerCase().replace(/[.,!?;:]/g, '').trim();
  if (cleaned.length > 20) return false;
  const base = lang.split(/[-_]/)[0];
  const fillers = FILLER_WORDS[base] ?? FILLER_WORDS.en;
  return fillers.has(cleaned);
}

// Incremented on every startNativeVoice call. Each session captures its own
// generation at creation time; callbacks discard tokens if a newer session
// has since replaced the window handler (native thread still mid-emit from
// the previous session when hands-free restarts the next one).
let _nativeVoiceGeneration = 0;

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
  let lastInterimText = '';
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const silenceThreshold = opts.silenceMs ?? 2000;
  const myGeneration = ++_nativeVoiceGeneration;

  // Re-arm silence timer only when transcript text changes — mirrors the
  // web path guard. iOS SFSpeechRecognizer can re-emit identical partials
  // during silence; re-arming on every emit prevents auto-stop from firing.
  const armSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (stopped || !speechStarted) return;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[name];
    } catch {
      (window as any)[name] = undefined;
    }
  };

  const cleanup = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    deleteCallback('prismNativeSpeechResult');
    deleteCallback('prismNativeSpeechError');
  };

  const nativeLang = computeLang(opts.lang || 'en-US');
  setCallback('prismNativeSpeechResult', (result: unknown) => {
    if (stopped || _nativeVoiceGeneration !== myGeneration) return;
    if (!result || typeof result !== 'object') return;
    const r = result as Record<string, unknown>;
    const interim = typeof r.interim === 'string' ? r.interim.slice(0, 2000) : '';
    let final = typeof r.final === 'string' ? r.final.slice(0, 2000) : '';
    const confidence = typeof r.confidence === 'number' ? r.confidence : 1.0;
    if (final && confidence > 0 && confidence < MIN_CONFIDENCE) final = '';
    if (final && isFillerOnly(final, nativeLang)) final = '';
    if (!speechStarted && (interim || final)) {
      speechStarted = true;
    }
    if (interim) {
      opts.onInterim(interim);
      if (interim !== lastInterimText) {
        lastInterimText = interim;
        armSilence();
      }
    }
    if (final) {
      opts.onFinal(final);
      armSilence();
      if (opts.autoStop) {
        stopped = true;
        cleanup();
      }
    }
  });

  setCallback('prismNativeSpeechError', (error: unknown) => {
    if (stopped || _nativeVoiceGeneration !== myGeneration) return;
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

type VoiceOpts = {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onSilence?: () => void;
  onError?: (err: string) => void;
  silenceMs?: number;
  autoStop?: boolean;
};

export function startVoiceInput(opts: VoiceOpts): VoiceSession | null {
  if (!isVoiceInputSupported()) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bridge = (window as any).prismNativeBridge;
  if (bridge?.startVoice) {
    return startNativeVoice(opts, bridge);
  }

  return startWebSpeech(opts);
}

function startWebSpeech(opts: VoiceOpts): VoiceSession | null {
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
  let lastInterimText = '';
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let restartCount = 0;
  const MAX_RESTARTS = 10;
  const silenceThreshold = opts.silenceMs ?? 2000;

  // Arm the silence timer ONLY when the transcript text changes. iOS
  // WKWebView's Web Speech API polls onresult repeatedly with the same
  // interim text every few hundred ms even when the user is silent —
  // resetting the timer on every fire would prevent silence from EVER
  // triggering. Re-arm only when text actually advances.
  const armSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (stopped || !speechStarted) return;
    silenceTimer = setTimeout(() => {
      if (!stopped) opts.onSilence?.();
    }, silenceThreshold);
  };

  rec.onresult = (event) => {
    if (stopped) return;
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const confidence = res[0].confidence;
      const transcript = res[0].transcript;
      if (res.isFinal) {
        if (confidence > 0 && confidence < MIN_CONFIDENCE) continue;
        if (isFillerOnly(transcript, rec.lang)) continue;
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (interim || final) speechStarted = true;
    if (interim) {
      opts.onInterim(interim);
      if (interim !== lastInterimText) {
        lastInterimText = interim;
        armSilence();
      }
    }
    if (final) {
      restartCount = 0;
      opts.onFinal(final);
      armSilence();
    }
  };

  rec.onerror = (event) => {
    // Ignore errors that arrive after a deliberate stop() — the browser may
    // fire trailing 'network' or 'audio-capture' events after rec.stop().
    if (stopped) return;
    // no-speech only counts as silence AFTER we've heard something. Before
    // that it just means "user hasn't started speaking yet" — let the
    // session continue rather than stopping it preemptively.
    if (event.error === 'no-speech') {
      if (speechStarted) opts.onSilence?.();
      return;
    }
    if (event.error === 'aborted') return;
    // Permanent errors — set stopped so onend does not restart and spin
    // indefinitely. Includes permission denials, hardware conflicts (audio-capture),
    // network failures (reconnect spam causes orphaned sessions), and
    // configuration errors (language-not-supported, bad-grammar).
    if (
      event.error === 'not-allowed' || event.error === 'service-not-allowed' ||
      event.error === 'audio-capture' || event.error === 'network' ||
      event.error === 'language-not-supported' || event.error === 'bad-grammar'
    ) {
      stopped = true;
      if (silenceTimer) clearTimeout(silenceTimer);
    }
    opts.onError?.(event.error);
  };

  rec.onend = () => {
    if (stopped || opts.autoStop) return;
    if (restartCount >= MAX_RESTARTS) {
      stopped = true;
      opts.onError?.('recognition-restart-limit');
      return;
    }
    const delay = Math.min(200 * 2 ** restartCount, 10_000);
    restartCount++;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!stopped) try { rec.start(); } catch { /* already running or blocked */ }
    }, delay);
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
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      try { rec.stop(); } catch {}
    },
  };
}
