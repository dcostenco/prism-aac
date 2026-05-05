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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    // The portal route accepts voiceId from the catalog and routes to the
    // matching backend (Inworld for paid+supported, Azure otherwise). We
    // forward it here so the user's voice choice is honored end-to-end.
    const reqBody: Record<string, unknown> = {
      ssml,
      format: 'audio-24khz-96kbitrate-mono-mp3',
    };
    if (voiceId) reqBody.voiceId = voiceId;

    // Always use the public endpoint, even for cookie-authenticated
    // users on synalux.ai/prism-aac (same-origin). The private /api/v1/
    // tts gates Inworld behind tier !== 'free' — most AAC users are
    // free tier, so the private route would silently downgrade them to
    // Azure Jenny (neural but flatter than Inworld). The public route
    // allows Inworld for everyone within rate limits, so English voices
    // come through with the same quality as Russian Anya.
    void authToken; // intentionally unused — kept for back-compat callers
    const endpoint = `${SYNALUX_API}/tts/public`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
      signal: controller.signal,
      credentials: 'include',
    });
    clearTimeout(timeout);
    activeControllers.delete(controller);

    if (!res.ok) {
      console.warn(`[AzureTTS] Server returned ${res.status}`);
      return false;
    }

    stopAzureAudio();
    const audioBytes = await res.arrayBuffer();

    // Web Audio API path: decode the MP3/WAV bytes and play via a
    // BufferSourceNode. Unlike `new Audio().play()` after `await fetch()`,
    // BufferSourceNode.start() does NOT need a fresh user-gesture token —
    // only that the AudioContext is in 'running' state. PrismApp.tsx warms
    // up the context on first interaction so this reliably plays even when
    // Speak is tapped seconds after the message was last typed.
    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch (e) {
      console.warn('[AzureTTS] AudioContext unavailable, audio cannot play:', e);
      return false;
    }
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* will fail decode below */ }
    }

    let decoded: AudioBuffer;
    try {
      // decodeAudioData returns a Promise in modern browsers. Older Safari
      // expected a callback-style API; the Promise form has been stable
      // since iOS 14 / Chrome 91 so we don't bother with the legacy form.
      decoded = await ctx.decodeAudioData(audioBytes.slice(0));
    } catch (e) {
      console.warn('[AzureTTS] decodeAudioData failed:', e instanceof Error ? e.message : e);
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
      console.warn('[AzureTTS] source.start failed:', e instanceof Error ? e.message : e);
      activeSources.delete(source);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[AzureTTS] Fetch failed:', e instanceof Error ? e.message : e);
    if (url) releaseBlob(url);
    return false;
  }
}
