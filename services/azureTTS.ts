'use client';
/**
 * Azure Neural TTS — Paid tiers only
 *
 * Routes through Synalux /api/v1/tts endpoint (same auth as chat).
 * Server holds the Azure Speech key — no client-side secrets.
 *
 * Supports 9 emotional speaking styles via SSML express-as:
 *   friendly, cheerful, calm, serious, excited, hopeful, empathetic, sad, angry
 *
 * Voice selection per language:
 *   en → en-US-JennyMultilingualNeural (supports styles)
 *   es → es-ES-ElviraNeural
 *   ja → ja-JP-NanamiNeural (supports styles)
 *   zh → zh-CN-XiaoxiaoNeural (supports styles)
 *   ...etc
 *
 * Falls back to Web Speech API if Azure is unavailable.
 */

export type ToneStyle =
  | 'friendly' | 'cheerful' | 'calm' | 'serious' | 'excited'
  | 'hopeful' | 'empathetic' | 'sad' | 'angry';

/**
 * Map AAC tone → Inworld TTS-2 voice style. Returns null for the
 * 'friendly' default so the caller can opt into server-side auto-styling
 * via prism-coder instead of pinning an explicit style.
 *
 * Style enum on the portal side (synalux/lib/tts-inworld.ts):
 *   neutral | warm | cheerful | urgent | whisper | calm | clear
 */
export function toneToInworldStyle(tone: ToneStyle): string | null {
  switch (tone) {
    case 'friendly':   return null;        // → autoStyle path
    case 'cheerful':   return 'cheerful';
    case 'calm':       return 'calm';
    case 'serious':    return 'clear';
    case 'excited':    return 'cheerful';
    case 'hopeful':    return 'warm';
    case 'empathetic': return 'calm';
    case 'sad':        return 'whisper';
    case 'angry':      return 'urgent';    // labeled 'Urgent' in TONE_OPTIONS
    default:           return null;
  }
}

export const TONE_OPTIONS: Array<{ id: ToneStyle; label: string; icon: string }> = [
  { id: 'friendly', label: 'Friendly', icon: '😊' },
  { id: 'cheerful', label: 'Cheerful', icon: '😄' },
  { id: 'calm', label: 'Calm', icon: '😌' },
  { id: 'serious', label: 'Serious', icon: '😐' },
  { id: 'excited', label: 'Excited', icon: '🤩' },
  { id: 'hopeful', label: 'Hopeful', icon: '🙏' },
  { id: 'empathetic', label: 'Empathetic', icon: '🤗' },
  { id: 'sad', label: 'Sad', icon: '😢' },
  { id: 'angry', label: 'Urgent', icon: '😤' },
];

const AZURE_VOICES: Record<string, string> = {
  'en-US': 'en-US-JennyMultilingualNeural',
  'es-ES': 'es-ES-ElviraNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'pt-BR': 'pt-BR-FranciscaNeural',
  'ro-RO': 'ro-RO-AlinaNeural',
  'uk-UA': 'uk-UA-PolinaNeural',
  'ru-RU': 'ru-RU-SvetlanaNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',       // Mainland Mandarin
  'zh-TW': 'zh-TW-HsiaoChenNeural',      // Taiwanese Mandarin
  'zh-HK': 'zh-HK-HiuMaanNeural',        // Hong Kong Cantonese (Yue)
  'ar-SA': 'ar-SA-ZariyahNeural',
};

const STYLE_SUPPORTED = new Set([
  'en-US-JennyMultilingualNeural',
  'zh-CN-XiaoxiaoNeural',
  'zh-TW-HsiaoChenNeural',
  'ja-JP-NanamiNeural',
]);

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSSML(text: string, lang: string, tone: ToneStyle, rate: number, volume: number): string {
  const voice = AZURE_VOICES[lang] || AZURE_VOICES['en-US'];
  const supportsStyles = STYLE_SUPPORTED.has(voice);
  const ratePercent = `${Math.round(rate * 100)}%`;
  const pitchPercent = '+0%';
  const volumeValue = Math.round(volume * 100);

  let inner = escapeXml(text);
  if (supportsStyles && tone !== 'friendly') {
    inner = `<mstts:express-as style="${tone}">${inner}</mstts:express-as>`;
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voice}">
    <prosody rate="${ratePercent}" pitch="${pitchPercent}" volume="${volumeValue}">
      ${inner}
    </prosody>
  </voice>
</speak>`;
}

const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API || 'https://synalux.ai/api/v1';

// Singleton AudioContext for all Azure / Inworld TTS playback. Web Audio API
// avoids the iOS Safari intermittent-failure trap where `audio.play()` after
// `await fetch()` is silently rejected because the user-gesture token was
// consumed by the await. AudioBufferSourceNode.start() only needs the
// AudioContext to be in 'running' state, which the warmup in PrismApp.tsx
// already arranges on first user interaction.
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') return sharedAudioCtx;
  const Ctor = (typeof window !== 'undefined' ? window.AudioContext : null)
    || (typeof window !== 'undefined' ? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : null);
  if (!Ctor) throw new Error('AudioContext not available');
  sharedAudioCtx = new Ctor();
  // Some browsers create the context in 'suspended' state — best-effort
  // resume; if it fails the next user gesture will retry via the warmup
  // listener in PrismApp.tsx.
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => { /* awaiting next gesture */ });
  }
  return sharedAudioCtx;
}

/**
 * Create / resume the shared AudioContext. Call inside a user-gesture
 * handler (touchstart, pointerdown, keydown) so iOS Safari unlocks audio
 * for the lifetime of the context. Subsequent BufferSourceNode.start()
 * calls then play even when triggered after async work.
 */
export async function warmupAzureAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
  } catch { /* AudioContext unavailable — silent fail */ }
}

// Track every BufferSourceNode that's currently scheduled or playing so a
// subsequent speak (or panic stop) can silence them — rapid Speak presses on
// AAC are common and we never want overlapping voices.
const activeSources = new Set<AudioBufferSourceNode>();
let currentAudio: HTMLAudioElement | null = null; // legacy back-compat reference
const activeAudioElements = new Set<HTMLAudioElement>();
const liveBlobUrls = new Set<string>();

function releaseBlob(url: string): void {
  if (liveBlobUrls.delete(url)) URL.revokeObjectURL(url);
}

// Track ALL in-flight fetch controllers — not just the latest one.
// A child with spasticity may mash Speak 5 times, launching 5 concurrent
// fetches. Panic stop must kill ALL of them, not just the last.
const activeControllers = new Set<AbortController>();

export function stopAzureAudio(): void {
  for (const ctrl of activeControllers) ctrl.abort();
  activeControllers.clear();
  // Stop every queued / playing BufferSourceNode (Web Audio API path).
  for (const src of activeSources) {
    try { src.stop(); } catch { /* already finished */ }
    try { src.disconnect(); } catch { /* */ }
  }
  activeSources.clear();
  // Legacy: also clean up any HTMLAudioElement instances still tracked from
  // older code paths. Once the new Web Audio path is the only producer this
  // block will be a no-op but it keeps panic stop safe during the rollover.
  for (const audio of activeAudioElements) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  activeAudioElements.clear();
  currentAudio = null;
  for (const url of liveBlobUrls) URL.revokeObjectURL(url);
  liveBlobUrls.clear();
}

/**
 * Decode an audio buffer (MP3 / WAV / Opus / etc. — anything Web Audio
 * decodeAudioData can handle) into the shared AudioContext and play it
 * via a BufferSourceNode. Used by both the Gemini primary path and the
 * Inworld/Azure fallback path. Returns false if anything goes wrong so
 * the caller can fall through to the next tier.
 *
 * Why BufferSourceNode + a singleton AudioContext (not `new Audio()`):
 * iOS Safari silently rejects `audio.play()` after `await fetch()` —
 * the user-gesture token is consumed by the await. BufferSourceNode
 * only needs the AudioContext in 'running' state, which the warmup in
 * PrismApp.tsx arranges on first interaction.
 */
async function decodeAndPlay(audioBytes: ArrayBuffer, volume: number, label: string): Promise<boolean> {
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch (e) {
    console.warn(`[${label}] AudioContext unavailable, audio cannot play:`, e);
    return false;
  }
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* decode below will signal */ }
  }

  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(audioBytes.slice(0));
  } catch (e) {
    console.warn(`[${label}] decodeAudioData failed:`, e instanceof Error ? e.message : e);
    return false;
  }

  const source = ctx.createBufferSource();
  source.buffer = decoded;
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  source.connect(gain).connect(ctx.destination);

  activeSources.add(source);
  source.onended = () => {
    activeSources.delete(source);
    try { source.disconnect(); } catch { /* */ }
    try { gain.disconnect(); } catch { /* */ }
  };

  try {
    source.start(0);
  } catch (e) {
    console.warn(`[${label}] source.start failed:`, e instanceof Error ? e.message : e);
    activeSources.delete(source);
    return false;
  }
  return true;
}

/**
 * Tier 1a — Gemini 2.5 Flash Preview TTS (PRIMARY).
 * Hits /api/v1/prism-aac/tts/public on the portal. Server returns
 * audio/wav (PCM wrapped in a RIFF header so decodeAudioData works).
 * Public route — no auth, CORS allow-*, rate-limited per IP.
 *
 * The portal route is the swap point: a future server-side backend
 * rotation replaces the Gemini fetch on the SERVER side and this
 * client code stays the same. Backend rotation is invisible here.
 *
 * Returns true on play success; false on ANY failure (rate limit,
 * upstream 5xx, decode failure, etc.) so the caller falls through to
 * the Inworld two-tier chain.
 */
async function speakGemini(
  text: string,
  volume: number,
  controller: AbortController,
  lang?: string,
): Promise<boolean> {
  // Gemini doesn't take SSML — it does its own prosody. Send plain text.
  // Keep within the server's 4KB UTF-8 cap; longer messages are very
  // rare on the AAC surface but caps elsewhere will trim if needed.
  // `lang` (e.g. 'ro-RO', 'uk-UA', 'es-ES') tells the server which
  // language instruction to prefix to the prompt — without it, Gemini's
  // prebuilt voices default to English phonemes for non-English text.
  try {
    const res = await fetch(`${SYNALUX_API}/prism-aac/tts/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: controller.signal,
      // NO credentials: include — the response uses ACAO=*, which the
      // CORS spec rejects when combined with credentials. Same fix that
      // landed on the Inworld fetch below.
    });
    if (!res.ok) {
      // 503 = key not configured, 502 = upstream non-ok, 429 = rate-
      // limited — every case the route signals `fallback: 'inworld'`
      // in the JSON body. Caller falls through automatically.
      console.warn(`[Gemini-TTS] non-ok ${res.status} — falling through to Inworld`);
      return false;
    }
    const audioBytes = await res.arrayBuffer();
    if (audioBytes.byteLength === 0) {
      console.warn('[Gemini-TTS] empty audio buffer — falling through to Inworld');
      return false;
    }
    stopAzureAudio();
    return await decodeAndPlay(audioBytes, volume, 'Gemini-TTS');
  } catch (e) {
    // Network / abort / timeout. Speech-service still has Kokoro and
    // Web Speech to fall back to even if Inworld is also down.
    console.warn('[Gemini-TTS] fetch threw:', e instanceof Error ? e.message : e);
    return false;
  }
}

export async function speakAzure(
  text: string,
  lang: string,
  tone: ToneStyle,
  rate: number,
  volume: number,
  authToken: string,
  voiceId?: string,
): Promise<boolean> {
  const ssml = buildSSML(text, lang, tone, rate, volume);

  let url: string | null = null;
  const controller = new AbortController();
  activeControllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // ── Tier 1a: Gemini 2.5 Flash Preview (primary) ──
    // The Gemini public route runs ahead of Inworld. On any failure
    // (key missing, rate limit, decode error, network) we fall through
    // to the existing Inworld two-tier chain — the AAC user never
    // notices the rotation.
    if (await speakGemini(text, volume, controller, lang)) {
      clearTimeout(timeout);
      activeControllers.delete(controller);
      return true;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    // The portal route accepts voiceId from the catalog and routes to the
    // matching backend (Inworld for paid+supported, Azure otherwise). We
    // forward it here so the user's voice choice is honored end-to-end.
    const reqBody: Record<string, unknown> = {
      ssml,
      format: 'audio-24khz-96kbitrate-mono-mp3',
      // Surface tag — biases the server-side picker toward AAC-appropriate
      // safe defaults if prism-coder is unavailable.
      surface: 'aac',
    };
    if (voiceId) reqBody.voiceId = voiceId;

    // Map the user's chosen AAC tone to an Inworld TTS-2 voice style.
    // 'friendly' (the default) → no explicit style, let the server-side
    // prism-coder picker choose from the message content. Any other
    // tone → explicit style, which always wins over autoStyle.
    const tts2Style = toneToInworldStyle(tone);
    if (tts2Style) {
      reqBody.style = tts2Style;
    } else {
      // Default tone — opt into auto-styling so the picker can choose
      // urgent / cheerful / calm / etc. from the actual text.
      // (Authenticated /tts honors this unconditionally; /tts/public
      // requires PRISM_PUBLIC_AUTOSTYLE_ENABLED=1 on the portal env.)
      reqBody.autoStyle = true;
    }

    // ── Tier 1b: Inworld → Azure (fallback when Gemini is unavailable) ──
    // Two-tier endpoint strategy (matches portal's tier policy):
    //   1. /api/v1/tts/public — Inworld for everyone, no auth, rate-
    //      limited. Natural neural voices for free + paid tiers.
    //   2. /api/v1/tts (cookie auth) — Inworld for paid + Azure Neural
    //      fallback for paid only when Inworld fails. Falls through
    //      silently for free tier requests so they don't get billable
    //      Azure quota.
    // We always try public first. If Inworld returns 502 (it errored on
    // this voice/lang) we retry on the auth route — a cookie-bearing
    // paid user gets Azure Neural; a free user gets a 403 and we
    // surface that to the speech-service tier-2/3 fallback chain.
    const publicRes = await fetch(`${SYNALUX_API}/tts/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
      // NO credentials: include — the route returns ACAO=*, which the
      // browser CORS check rejects when combined with credentials=include.
      // Without this fix the cross-origin call from prism-aac.vercel.app
      // failed silently before even reaching the server.
    });
    let res = publicRes;
    if (!publicRes.ok && publicRes.status === 502) {
      // Inworld choked. Try the auth route — paid users get Azure here.
      // This route is NOT cross-origin-CORS'd; it relies on the
      // synalux.ai NextAuth cookie, which only flows when prism-aac
      // is served same-site (cookie domain). Cross-origin from
      // prism-aac.vercel.app this fetch will be 401 — that's fine,
      // the speech-service tier 2/3 chain takes over.
      const authRes = await fetch(`${SYNALUX_API}/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
        signal: controller.signal,
        credentials: 'include',
      });
      if (authRes.ok) res = authRes;
      // else: keep the original public 502; speech service will fall
      // through to Tier 2/3.
    }
    clearTimeout(timeout);
    activeControllers.delete(controller);

    if (!res.ok) {
      console.warn(`[AzureTTS] Server returned ${res.status}`);
      return false;
    }

    stopAzureAudio();
    const audioBytes = await res.arrayBuffer();
    return await decodeAndPlay(audioBytes, volume, 'AzureTTS');
  } catch (e) {
    console.warn('[AzureTTS] Fetch failed:', e instanceof Error ? e.message : e);
    if (url) releaseBlob(url);
    return false;
  }
}
