'use client';

/**
 * Kokoro TTS Service — In-browser neural TTS via ONNX (Apache-2.0)
 *
 * Slots into the existing speechService.ts fallback chain at TIER 1.5:
 *
 *   1.   Azure Neural TTS                — paid, online, best quality
 *   1.5. Kokoro-82M ONNX  ← THIS         — free, on-device, MOS ~4.5
 *   2.   Web Speech API premium voice    — offline, varies by OS
 *   3.   Web Speech API any voice        — offline, basic
 *   4.   espeak-ng WASM                  — last-resort, robotic but always works
 *
 * Why Kokoro:
 *   - 82M params (~350MB ONNX) — fits comfortably on every modern device
 *   - Apache-2.0 license — no commercial restrictions, OK for AGPL-3.0 host
 *   - Quality on par with Azure Neural for English; multi-voice (Heart, Bella,
 *     Nicole, Sarah, Sky, Adam, Michael — all bundled)
 *   - Runs entirely in-browser via @huggingface/transformers (onnxruntime-web)
 *
 * SAFETY: like every TTS tier, this MUST demote-on-failure. AAC users
 * communicating in an emergency cannot afford a TTS that hangs or crashes.
 * On any error, demote-for-session and let the fallback chain continue.
 *
 * Lazy-loading: the model is NOT loaded at boot — it loads the first time
 * the user actually triggers a Kokoro tier speak (typically Settings ->
 * Voice Quality -> "High Quality (Kokoro)"). The 350MB download happens
 * once, then cached in IndexedDB by the transformers.js library.
 */

let kokoroPipeline: unknown = null;
let kokoroLoadPromise: Promise<unknown> | null = null;
let demoted = false;

/**
 * Kokoro v1.0 supports 9 languages: English (US/UK), Spanish, French,
 * Brazilian Portuguese, Japanese, Mandarin Chinese, Hindi, Italian.
 *
 * Of prism-aac's 12 languages, 6 are covered here. The other 6
 * (Romanian, Ukrainian, Russian, German, Korean, Arabic) are NOT in Kokoro
 * — `getKokoroVoice` returns null for them so the caller falls through to
 * the Web Speech API tier (which DOES cover all 12 on most devices).
 */
const VOICE_BY_LANG: Record<string, string> = {
  en: 'af_heart',       // American English (warm female)
  'en-US': 'af_heart',
  'en-GB': 'bf_emma',   // British English
  es: 'ef_dora',        // Spanish
  fr: 'ff_siwis',       // French
  pt: 'pf_dora',        // Brazilian Portuguese
  'pt-BR': 'pf_dora',
  ja: 'jf_alpha',       // Japanese
  zh: 'zf_xiaobei',           // Chinese (legacy alias for Mandarin)
  'zh-CN': 'zf_xiaobei',      // Simplified / Mainland Mandarin
  'zh-Hans': 'zf_xiaobei',    // Simplified / Mainland Mandarin
  'zh-TW': 'zf_xiaobei',      // Taiwanese Mandarin (uses Mandarin pronunciation)
  'zh-Hant': 'zf_xiaobei',    // Traditional script, Mandarin pronunciation
  // 'zh-HK' (Cantonese) is NOT supported by Kokoro — caller falls through
  // to Azure (zh-HK-HiuMaanNeural) or Web Speech.
};

/** Returns the Kokoro voice id for a lang code, or null if unsupported. */
export function getKokoroVoice(lang?: string): string | null {
  if (!lang) return null;
  if (VOICE_BY_LANG[lang]) return VOICE_BY_LANG[lang];
  const prefix = lang.split('-')[0];
  return VOICE_BY_LANG[prefix] ?? null;
}

/** Languages this service can speak natively. Other prism-aac langs fall through. */
export const KOKORO_LANGS = ['en', 'es', 'fr', 'pt', 'ja', 'zh', 'zh-Hans', 'zh-Hant'] as const;

export function isKokoroSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (demoted) return false;
  // Need WebAssembly + WebGPU OR fallback to WASM-only inference.
  return typeof WebAssembly !== 'undefined';
}

async function loadKokoro(): Promise<unknown> {
  if (kokoroPipeline) return kokoroPipeline;
  if (kokoroLoadPromise) return kokoroLoadPromise;

  kokoroLoadPromise = (async () => {
    try {
      // Dynamic import — keeps the 1MB+ transformers bundle out of the main
      // chunk for users who never pick high-quality TTS.
      // @ts-expect-error — optional dependency, not always installed
      const tx = await import('@huggingface/transformers');
      // KokoroTTS pipeline is registered as text-to-speech with the
      // 'onnx-community/Kokoro-82M-v1.0-ONNX' model id.
      const pipeline = await (tx as { pipeline: (...args: unknown[]) => Promise<unknown> }).pipeline(
        'text-to-speech',
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        { dtype: 'q8' }, // 8-bit quant for browser footprint
      );
      kokoroPipeline = pipeline;
      return pipeline;
    } catch (e) {
      demoted = true;
      console.warn('[kokoroTTS] load failed, demoting for session:', e);
      throw e;
    }
  })();
  return kokoroLoadPromise;
}

export interface KokoroSpeakOptions {
  text: string;
  lang?: string;
  voice?: string;
  rate?: number; // 0.5 - 2.0
}

/**
 * Speak the text via Kokoro and return the resulting AudioBuffer-playing
 * Promise. Resolves when playback ends. Throws if loading or synthesis
 * fails — the caller is responsible for demoting + falling back.
 */
export async function speakWithKokoro(opts: KokoroSpeakOptions): Promise<void> {
  if (!isKokoroSupported()) throw new Error('Kokoro not supported');
  const text = (opts.text || '').trim();
  if (!text) return;

  const voice = opts.voice || getKokoroVoice(opts.lang) || VOICE_BY_LANG.en;
  // If caller passed a lang Kokoro can't speak (ro/uk/ru/de/ko/ar), bail
  // immediately — the speechService chain will fall through to Web Speech.
  if (!opts.voice && opts.lang && !getKokoroVoice(opts.lang)) {
    throw new Error(`Kokoro does not support lang=${opts.lang}; falling through`);
  }

  const pipe = (await loadKokoro()) as (text: string, opts: { voice: string }) => Promise<{ audio: Float32Array; sampling_rate: number }>;

  const out = await pipe(text, { voice });
  const audioBuf = out.audio;
  const sr = out.sampling_rate || 24000;

  if (activeCtx) { try { activeCtx.close(); } catch {} }

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const buffer = ctx.createBuffer(1, audioBuf.length, sr);
  // @ts-expect-error — TS5 strict ArrayBuffer vs ArrayBufferLike mismatch
  buffer.copyToChannel(audioBuf, 0, 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  if (opts.rate && opts.rate > 0) source.playbackRate.value = opts.rate;

  activeCtx = ctx;
  activeSource = source;

  return new Promise<void>((resolve) => {
    source.onended = () => {
      activeCtx = null;
      activeSource = null;
      try { ctx.close(); } catch { /* noop */ }
      resolve();
    };
    source.start();
  });
}

let activeCtx: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

export function stopKokoro(): void {
  if (activeSource) { try { activeSource.stop(); } catch {} activeSource = null; }
  if (activeCtx) { try { activeCtx.close(); } catch {} activeCtx = null; }
}

/** Force-demote the Kokoro tier for the rest of the session. */
export function demoteKokoroForSession(reason: string): void {
  demoted = true;
  if (typeof window !== 'undefined' && window.console) {
    console.info(`[kokoroTTS] demoted: ${reason}`);
  }
}
