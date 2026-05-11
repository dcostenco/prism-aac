'use client';
/**
 * WASM TTS Fallback — Tier 4 Last-Resort Speech Engine
 *
 * For AAC users who depend on this app to communicate, we MUST have a
 * TTS path that works even when:
 *   - Azure is offline (no internet)
 *   - Web Speech API crashes (Safari iOS bugs, Chrome OOM)
 *   - No voices are installed on the device
 *
 * This service attempts to load espeak-ng compiled to WebAssembly (~1.5MB).
 * If that fails, it falls back to an AudioContext beep pattern so the child
 * at least produces audible output — a caregiver can hear that communication
 * is being attempted.
 *
 * Tier chain:
 *   1. Azure Neural TTS (online, paid)
 *   2. Web Speech Premium voice (offline)
 *   3. Web Speech any voice (offline)
 *   4. WASM espeak-ng (this service — offline, always works if loaded)
 *   4b. AudioContext beep pattern (absolute last resort)
 */

// ---------------------------------------------------------------------------
// Types & Config
// ---------------------------------------------------------------------------

export interface WasmTTSConfig {
  enabled: boolean;
  volume: number;  // 0–1
  rate: number;    // 0.5–2.0
}

const STORAGE_KEY = 'prism-wasm-tts';

const DEFAULT_CONFIG: WasmTTSConfig = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
};

// ---------------------------------------------------------------------------
// Language mapping: PrismAAC TTS codes → espeak-ng voice identifiers
// ---------------------------------------------------------------------------

const ESPEAK_VOICE_MAP: Record<string, string> = {
  'en-US': 'en',
  'es-ES': 'es',
  'fr-FR': 'fr',
  'pt-BR': 'pt-br',
  'ro-RO': 'ro',
  'uk-UA': 'uk',
  'ru-RU': 'ru',
  'de-DE': 'de',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'zh-CN': 'cmn',
  'ar-SA': 'ar',
  // Short-code fallbacks (if caller passes bare language code)
  en: 'en',
  es: 'es',
  fr: 'fr',
  pt: 'pt-br',
  ro: 'ro',
  uk: 'uk',
  ru: 'ru',
  de: 'de',
  ja: 'ja',
  ko: 'ko',
  zh: 'cmn',
  ar: 'ar',
};

function toEspeakVoice(lang: string): string {
  return ESPEAK_VOICE_MAP[lang] ?? ESPEAK_VOICE_MAP[lang.split('-')[0]] ?? 'en';
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let espeakModule: any = null;
let wasmReady = false;
let wasmLoadAttempted = false;
let audioCtx: AudioContext | null = null;
let activeBeepTimeout: ReturnType<typeof setTimeout> | null = null;
let beepAbortController: AbortController | null = null;
// Track active oscillators so stopWasmSpeech() can kill them instantly.
// Without this, oscillators scheduled via ctx.currentTime continue playing
// even after abort — causing unstoppable noise for sensory-sensitive children.
let activeOscillators: OscillatorNode[] = [];
// H11: track active BufferSourceNodes so stopWasmSpeech() can kill them immediately
const _activeBufferSources = new Set<AudioBufferSourceNode>();

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

export function getWasmTTSConfig(): WasmTTSConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<WasmTTSConfig>;
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      volume: clamp(parsed.volume ?? DEFAULT_CONFIG.volume, 0, 1),
      rate: clamp(parsed.rate ?? DEFAULT_CONFIG.rate, 0.5, 2.0),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function setWasmTTSConfig(config: Partial<WasmTTSConfig>): void {
  if (typeof window === 'undefined') return;
  const current = getWasmTTSConfig();
  const merged: WasmTTSConfig = {
    enabled: config.enabled ?? current.enabled,
    volume: clamp(config.volume ?? current.volume, 0, 1),
    rate: clamp(config.rate ?? current.rate, 0.5, 2.0),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage full or unavailable — non-fatal
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// AudioContext lifecycle
// ---------------------------------------------------------------------------

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the WASM TTS engine has been loaded and is ready to speak.
 */
export function isWasmTTSReady(): boolean {
  return wasmReady;
}

/**
 * Lazy-load the espeak-ng WASM module. Safe to call multiple times — only
 * the first call triggers the actual load.
 *
 * Returns `true` if espeak-ng loaded successfully, `false` if we fell back
 * to beep mode.
 */
export async function initWasmTTS(): Promise<boolean> {
  if (wasmReady) return true;
  if (typeof window === 'undefined') return false;

  if (!wasmLoadAttempted) {
    wasmLoadAttempted = true;
    try {
      // Dynamic import: works if espeak-ng is installed as an npm dependency
      // or if the WASM files are served from /public.
      // We attempt multiple known package names.
      espeakModule = await tryLoadEspeak();
      if (espeakModule) {
        wasmReady = true;
        console.info('[PrismAAC] WASM TTS: espeak-ng loaded successfully');
        return true;
      }
    } catch (err) {
      console.warn('[PrismAAC] WASM TTS: espeak-ng load failed, beep fallback active', err);
    }
  }

  // Even without espeak, the beep fallback is always "ready"
  return false;
}

/**
 * Speak text via WASM TTS. Falls back to beep pattern if espeak-ng
 * is not available.
 *
 * @returns `true` if audio was produced (espeak or beep), `false` on total failure.
 */
export async function speakWasm(
  text: string,
  lang: string,
  rate?: number,
  volume?: number,
): Promise<boolean> {
  if (!text.trim()) return false;
  if (typeof window === 'undefined') return false;

  const config = getWasmTTSConfig();
  if (!config.enabled) return false;

  const effectiveRate = clamp(rate ?? config.rate, 0.5, 2.0);
  const effectiveVolume = clamp(volume ?? config.volume, 0, 1);

  // Attempt 1: espeak-ng WASM
  if (wasmReady && espeakModule) {
    try {
      const success = await speakWithEspeak(text, lang, effectiveRate, effectiveVolume);
      if (success) return true;
    } catch (err) {
      console.warn('[PrismAAC] WASM TTS: espeak synthesis failed, falling back to beep', err);
    }
  }

  // Attempt 2: Beep pattern — absolute last resort
  try {
    await speakWithBeeps(text, effectiveRate, effectiveVolume);
    return true;
  } catch (err) {
    console.error('[PrismAAC] WASM TTS: even beep fallback failed', err);
    return false;
  }
}

/**
 * Stop any currently playing WASM speech (espeak or beep pattern).
 */
export function stopWasmSpeech(): void {
  // Abort any in-progress beep sequence
  if (beepAbortController) {
    beepAbortController.abort();
    beepAbortController = null;
  }
  if (activeBeepTimeout) {
    clearTimeout(activeBeepTimeout);
    activeBeepTimeout = null;
  }

  // Kill all scheduled oscillators immediately — prevents unstoppable
  // audio loops for children with sensory processing disorders.
  if (audioCtx) {
    for (const osc of activeOscillators) {
      try { osc.stop(audioCtx.currentTime); } catch { /* already stopped */ }
    }
  }
  activeOscillators = [];

  // H11: stop all active BufferSourceNodes (espeak playback)
  for (const src of _activeBufferSources) {
    try { src.stop(); } catch { /* already stopped */ }
  }
  _activeBufferSources.clear();

  // If espeak has a stop mechanism, call it
  if (espeakModule?.stop) {
    try { espeakModule.stop(); } catch { /* best-effort */ }
  }
}

/**
 * Release all resources. Call on app unmount or when disabling WASM TTS.
 */
export function destroyWasmTTS(): void {
  stopWasmSpeech();

  if (espeakModule?.terminate) {
    try { espeakModule.terminate(); } catch { /* best-effort */ }
  }
  espeakModule = null;
  wasmReady = false;
  wasmLoadAttempted = false;

  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close().catch(() => {});
  }
  audioCtx = null;
}

// ---------------------------------------------------------------------------
// espeak-ng WASM integration
// ---------------------------------------------------------------------------

/**
 * Attempt to dynamically import espeak-ng from known npm packages.
 * Returns the module handle or null if unavailable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryLoadEspeak(): Promise<any> {
  // Strategy 1: espeak-ng npm package (most common)
  try {
    // @ts-expect-error — optional dependency; may not be installed
    const mod = await import(/* webpackIgnore: true */ 'espeak-ng');
    if (mod?.default?.init) {
      await mod.default.init();
      return mod.default;
    }
    if (mod?.init) {
      await mod.init();
      return mod;
    }
    return mod?.default ?? mod;
  } catch { /* not installed */ }

  // Strategy 2: espeak-ng-emscripten
  try {
    // @ts-expect-error — optional dependency; may not be installed
    const mod = await import(/* webpackIgnore: true */ 'espeak-ng-emscripten');
    if (mod?.default) return mod.default;
    return mod;
  } catch { /* not installed */ }

  // Strategy 3: Check if espeak is available on globalThis (manually loaded via script tag)
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as unknown as Record<string, unknown>;
    if (g.espeakng || g.espeak || g.eSpeakNG) {
      return g.espeakng ?? g.espeak ?? g.eSpeakNG;
    }
  }

  return null;
}

/**
 * Synthesize speech with espeak-ng and play it via AudioContext.
 *
 * espeak-ng WASM typically provides a `synthesize()` method that returns
 * raw PCM samples (Int16Array at 22050 Hz). We convert those to a float
 * AudioBuffer and play through AudioContext.
 */
async function speakWithEspeak(
  text: string,
  lang: string,
  rate: number,
  volume: number,
): Promise<boolean> {
  if (!espeakModule) return false;

  const voice = toEspeakVoice(lang);

  // espeak-ng rate: words per minute. Default ~175. Scale by our 0.5–2.0 range.
  const espeakRate = Math.round(175 * rate);

  // Attempt synthesis — different packages expose different APIs
  let pcmSamples: Int16Array | null = null;
  const sampleRate = 22050; // espeak-ng default

  try {
    if (typeof espeakModule.synthesize === 'function') {
      // Common API: synthesize(text, voice, options) → { audio: Int16Array }
      const result = await espeakModule.synthesize(text, {
        voice,
        rate: espeakRate,
        pitch: 50,
        volume: Math.round(volume * 100),
      });
      pcmSamples = result?.audio ?? result?.samples ?? result;
    } else if (typeof espeakModule.speak === 'function') {
      // Alternative API
      const result = await espeakModule.speak(text, { voice, speed: espeakRate });
      pcmSamples = result?.audio ?? result;
    } else if (typeof espeakModule.synth === 'function') {
      pcmSamples = await espeakModule.synth(text, voice, espeakRate);
    }
  } catch {
    return false;
  }

  if (!pcmSamples || pcmSamples.length === 0) return false;

  // Convert Int16 PCM → Float32 AudioBuffer
  const ctx = getAudioContext();
  const floats = new Float32Array(pcmSamples.length);
  for (let i = 0; i < pcmSamples.length; i++) {
    floats[i] = pcmSamples[i] / 32768;
  }

  const audioBuffer = ctx.createBuffer(1, floats.length, sampleRate);
  audioBuffer.getChannelData(0).set(floats);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  // H11: track source so stopWasmSpeech() can kill it immediately
  _activeBufferSources.add(source);

  return new Promise<boolean>((resolve) => {
    // Add timeout to prevent indefinite hang (buffer duration + 2s grace)
    const timeoutId = setTimeout(() => {
      _activeBufferSources.delete(source);
      resolve(true); // resolve (not reject) to allow fallback chain to continue normally
    }, Math.ceil(audioBuffer.duration * 1000) + 2000);

    source.onended = () => {
      clearTimeout(timeoutId);
      _activeBufferSources.delete(source);
      resolve(true);
    };
    try {
      source.start(0);
    } catch {
      clearTimeout(timeoutId);
      _activeBufferSources.delete(source);
      resolve(false);
    }
  });
}

// ---------------------------------------------------------------------------
// Beep-pattern fallback — absolute last resort
// ---------------------------------------------------------------------------

/**
 * When all TTS engines fail, we produce a beep pattern using AudioContext
 * oscillators. Each character maps to a short tone so that:
 *   - The child hears SOMETHING and knows the app responded
 *   - A trained caregiver can distinguish different words by their
 *     rhythmic pattern (length, pauses between words)
 *
 * Encoding:
 *   - Space       → 200ms silence (word boundary)
 *   - Vowel       → 440 Hz, 120ms (lower, longer — distinctive)
 *   - Consonant   → 660 Hz, 80ms  (higher, shorter)
 *   - Digit       → 550 Hz, 100ms (mid-range)
 *   - Punctuation  → 330 Hz, 60ms  (quick low blip)
 *   - Start beep  → 880 Hz, 150ms (attention signal)
 *   - End beep    → 220 Hz, 200ms (completion signal)
 *
 * This is not morse code per se, but a simplified phonetic-rhythm encoding
 * that gives each word a unique audible "shape".
 */
async function speakWithBeeps(
  text: string,
  rate: number,
  volume: number,
): Promise<void> {
  const ctx = getAudioContext();

  // SAFETY: if context is suspended (device slept, background tab),
  // resume it first. If resume fails, abort — never schedule nodes
  // against a frozen currentTime (causes all tones to blast simultaneously
  // when the device wakes, risking acoustic trauma for sensory-sensitive children).
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return; }
    if ((ctx.state as string) !== 'running') return;
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = clamp(volume, 0, 1);
  masterGain.connect(ctx.destination);

  // Speed factor: rate 1.0 = normal, 2.0 = double speed (halved durations)
  const speedFactor = 1 / rate;

  // Abort controller so stopWasmSpeech() can cancel mid-sequence
  beepAbortController = new AbortController();
  const signal = beepAbortController.signal;

  const VOWELS = new Set('aeiouAEIOUàáâãäåèéêëìíîïòóôõöùúûüÿаеёиоуыэюяіїєґ');

  interface ToneSpec {
    freq: number;
    duration: number; // ms
  }

  // Build the tone sequence
  const sequence: ToneSpec[] = [];

  // Attention signal: two quick high beeps
  sequence.push({ freq: 880, duration: 80 * speedFactor });
  sequence.push({ freq: 0, duration: 40 * speedFactor }); // tiny gap
  sequence.push({ freq: 880, duration: 80 * speedFactor });
  sequence.push({ freq: 0, duration: 120 * speedFactor }); // pause before content

  for (const ch of text) {
    if (signal.aborted) return;

    if (ch === ' ' || ch === '\n' || ch === '\t') {
      // Word boundary — silence
      sequence.push({ freq: 0, duration: 200 * speedFactor });
    } else if (VOWELS.has(ch)) {
      sequence.push({ freq: 440, duration: 120 * speedFactor });
      sequence.push({ freq: 0, duration: 30 * speedFactor });
    } else if (/\d/.test(ch)) {
      sequence.push({ freq: 550, duration: 100 * speedFactor });
      sequence.push({ freq: 0, duration: 30 * speedFactor });
    } else if (/[a-zA-ZÀ-ɏЀ-ӿ぀-ゟ゠-ヿ一-鿿가-힯؀-ۿ]/.test(ch)) {
      // Consonant or non-Latin letter
      sequence.push({ freq: 660, duration: 80 * speedFactor });
      sequence.push({ freq: 0, duration: 30 * speedFactor });
    } else {
      // Punctuation / symbol
      sequence.push({ freq: 330, duration: 60 * speedFactor });
      sequence.push({ freq: 0, duration: 30 * speedFactor });
    }
  }

  // Completion signal: low descending tone
  sequence.push({ freq: 0, duration: 100 * speedFactor });
  sequence.push({ freq: 440, duration: 100 * speedFactor });
  sequence.push({ freq: 220, duration: 200 * speedFactor });

  // Schedule all tones using AudioContext timing for sample-accurate playback
  let offset = ctx.currentTime + 0.02; // tiny lead-in to avoid click

  for (const tone of sequence) {
    if (signal.aborted) return;

    const durationSec = tone.duration / 1000;

    if (tone.freq > 0) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = tone.freq;

      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, offset);
      envelope.gain.linearRampToValueAtTime(1, offset + 0.005);
      envelope.gain.setValueAtTime(1, offset + durationSec - 0.005);
      envelope.gain.linearRampToValueAtTime(0, offset + durationSec);

      osc.connect(envelope);
      envelope.connect(masterGain);

      osc.start(offset);
      osc.stop(offset + durationSec);
      activeOscillators.push(osc);
      osc.onended = () => { activeOscillators = activeOscillators.filter(o => o !== osc); };
    }

    offset += durationSec;
  }

  // Wait for the full sequence to finish
  const totalDuration = (offset - ctx.currentTime) * 1000;
  await new Promise<void>((resolve) => {
    activeBeepTimeout = setTimeout(() => {
      activeBeepTimeout = null;
      resolve();
    }, totalDuration + 50);

    // If aborted while waiting, resolve immediately
    signal.addEventListener('abort', () => {
      if (activeBeepTimeout) {
        clearTimeout(activeBeepTimeout);
        activeBeepTimeout = null;
      }
      resolve();
    }, { once: true });
  });
}
