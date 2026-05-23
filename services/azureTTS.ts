'use client';
// CACHE-NUKE 2026-05-08-08:40 — forces Vercel build cache invalidation
// after multiple identical-output rebuilds where Turbopack reused the
// compiled azureTTS.ts despite source changes.
const _BUILD_NUKE = Date.now().toString();
void _BUILD_NUKE;
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
  // SSML rate: 1.0 = normal. Stored slider range [0.25-4], default 0.5.
  // Formula: ssmlRate = stored × 2, hard-capped at 1.4.
  //   stored 0.25 → SSML 0.50  stored 0.50 → SSML 1.00 (normal, fixes RO/RU slow)
  //   stored 0.70 → SSML 1.40  stored 1.0+ → SSML 1.40 (cap, no chipmunk)
  // Verified live 2026-05-10 via tts-live-diag-rate.mjs: rate=1.40, ✅ SAFE.
  // DO NOT revert to pass-through — stored 0.5 direct → SSML 0.5 = RO/RU 2× slow.
  const rateClamped = Math.max(0.5, Math.min(1.4, Number.isFinite(rate) && rate > 0 ? rate * 2 : 1.0));
  const rateStr = rateClamped.toFixed(2);
  const volumeValue = Math.max(0, Math.min(100, Math.round(volume * 100)));

  let inner = escapeXml(text);
  if (supportsStyles && tone !== 'friendly') {
    inner = `<mstts:express-as style="${tone}">${inner}</mstts:express-as>`;
  }

  // Pitch attribute intentionally omitted — we never vary pitch and
  // every form ("0%", "+0%", "0Hz") is parser-fragile across SSML
  // implementations. Default pitch is correct for every supported voice.
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voice}">
    <prosody rate="${rateStr}" volume="${volumeValue}">
      ${inner}
    </prosody>
  </voice>
</speak>`;
}

const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API || 'https://synalux.ai/api/v1';

/** Hard cap on a single TTS audio response. A hostile / buggy backend
 *  returning a 100 MB blob would otherwise OOM the AAC tablet. 8 MB is
 *  generous: a 4 KB UTF-8 message at 24 kHz mono MP3 96 kbps is < 5 MB
 *  even for a 30-second utterance. Caller treats anything larger as a
 *  failure and falls through to the next TTS tier (Web Speech). */
const MAX_TTS_BYTES = 8 * 1024 * 1024;

/** Read a Response body as ArrayBuffer with a byte cap enforced
 *  via Content-Length pre-check + post-read length check. Returns
 *  null if the body exceeds the cap (caller falls through to next
 *  TTS tier rather than crashing). */
async function readCappedAudio(res: Response): Promise<ArrayBuffer | null> {
  const declaredLen = Number(res.headers?.get?.('content-length') ?? '');
  if (Number.isFinite(declaredLen) && declaredLen > MAX_TTS_BYTES) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_TTS_BYTES) return null;
  return buf;
}

// Singleton AudioContext for all Azure / Inworld TTS playback. Web Audio API
// avoids the iOS Safari intermittent-failure trap where `audio.play()` after
// `await fetch()` is silently rejected because the user-gesture token was
// consumed by the await. AudioBufferSourceNode.start() only needs the
// AudioContext to be in 'running' state, which the warmup in PrismApp.tsx
// already arranges on first user interaction.
let sharedAudioCtx: AudioContext | null = null;
let lastPlayedAt = 0;
const CTX_STALE_MS = 30_000;

// Recreate AudioContext when OS output device changes (USB/BT plug events).
// macOS Sound panel default-switch is covered by the 30s stale timer below.
if (typeof window !== 'undefined' && navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') {
      sharedAudioCtx.close().catch(() => {});
      sharedAudioCtx = null;
    }
  });
}

function getAudioContext(): AudioContext {
  // Stale context: idle > 30s means user may have switched OS audio output.
  // Recreate so next Speak binds to current default device.
  if (
    sharedAudioCtx &&
    sharedAudioCtx.state !== 'closed' &&
    activeSources.size === 0 &&
    lastPlayedAt > 0 &&
    Date.now() - lastPlayedAt > CTX_STALE_MS
  ) {
    sharedAudioCtx.close().catch(() => {});
    sharedAudioCtx = null;
    // Reset lastPlayedAt so this same stale condition cannot fire again on
    // the second getAudioContext() call within the same speak cycle (warmup
    // + decodeAndPlay both call getAudioContext). Without this reset the
    // stale check fires in decodeAndPlay (after await fetch), closes the
    // context that warmup just resumed inside the gesture, creates a new
    // suspended context outside the gesture → silent audio. See: May 2026
    // double-close regression — "web prod silent after 30s idle."
    lastPlayedAt = 0;
  }
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
 *
 * SYNCHRONOUS portion (getAudioContext + ctx.resume invocation) runs
 * before the first await, so callers that invoke this from inside a
 * click handler preserve the gesture token. Do NOT await this from
 * the click handler — `void warmupAzureAudio()` is the right pattern,
 * the click can return while the resume promise resolves in flight.
 */
export async function warmupAzureAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
  } catch { /* AudioContext unavailable — silent fail */ }
}

/** True iff the shared AudioContext exists AND is in 'running' state.
 *  Tier-1 callers (speakAzure → decodeAndPlay) check this immediately
 *  before scheduling a BufferSourceNode; if false, they bail out with
 *  return false so speech-service can fall through to Web Speech tier
 *  (which has its own gesture handling) instead of decoding silently
 *  into a suspended context. */
export function isAudioContextRunning(): boolean {
  return sharedAudioCtx !== null && sharedAudioCtx.state === 'running';
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

// Rapid-duplicate dedup. If the same text fires within DEDUP_MS, drop the
// new request so the current playback isn't killed by stopAzurePlayback.
// User report 2026-05-08 "audio stopped streaming" — autocorrect or
// debounced typing was firing speak() multiple times in <50ms, the second
// call's stopAzurePlayback() killed the first source mid-stream.
let lastSpokenText = '';
let lastSpokenAt = 0;
const DEDUP_MS = 200;

// Minimum time (ms) a source must have been playing before an autoSpeak call
// is allowed to interrupt it. Prevents rapid prediction-tile taps from all
// killing each other so the user hears nothing.
// The explicit Speak button bypasses this guard via markSpeakInterrupt().
const PROTECT_PLAY_MS = 600;
let lastSourceStartedAt = 0;
let _nextSpeakInterrupt = false;

/**
 * Call this immediately before aacSpeak when the user presses the
 * explicit Speak button. Allows the next speakAzure call to interrupt
 * any currently-playing audio regardless of how recently it started.
 * Without this, autoSpeak calls respect PROTECT_PLAY_MS.
 */
export function markSpeakInterrupt(): void {
  _nextSpeakInterrupt = true;
}

/** Stop only ACTIVE PLAYBACK (BufferSourceNodes + HTMLAudioElements +
 *  blob URLs). Does NOT abort in-flight fetch controllers — those
 *  belong to whichever speakAzure call owns them and aborting them
 *  from a peer call cascades into AbortError → tier fall-through →
 *  silent failure (the user-reported "speak frequently loses
 *  streaming" bug). The caller-of-the-moment is responsible for
 *  silencing the previous playback right before its own
 *  decodeAndPlay; stale fetches that still resolve will simply skip
 *  playback when their seq check fails (see speakAzure / speakGemini).
 */
function stopAzurePlayback(): void {
  for (const src of activeSources) {
    try { src.stop(); } catch { /* already finished */ }
    try { src.disconnect(); } catch { /* */ }
  }
  activeSources.clear();
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

/** Full panic stop: aborts pending fetches AND stops playback. Used by
 *  the user-driven "stop speech" button (and emergency cancel) — the
 *  user explicitly wants every TTS path silenced, including the
 *  in-flight fetch that hasn't returned yet. Do NOT call this from
 *  within a successful TTS path; use stopAzurePlayback() instead. */
export function stopAzureAudio(): void {
  for (const ctrl of activeControllers) ctrl.abort();
  activeControllers.clear();
  stopAzurePlayback();
}

export function resetSharedAudioContextIfIdle(): void {
  if (activeSources.size > 0) return;
  if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') {
    try { void sharedAudioCtx.close(); } catch { /* */ }
  }
  sharedAudioCtx = null;
}

// Note: an earlier revision had a `speakSeq` latest-wins guard here
// that bowed out older speakAzure calls when a newer one started. It
// regressed Romanian (and any lang Gemini doesn't speak) — silence-
// detect speech bumps the seq on every keystroke, so by the time the
// slower Inworld/Azure fallback fetch returns, the older call is
// "stale" and bows out → no audio. The split into stopAzurePlayback
// vs stopAzureAudio (above) is sufficient on its own: every fetch
// resolves and calls stopAzurePlayback right before play, so the
// latest one's audio overwrites the older one's with at most ~50ms
// of overlap. No seq tracking needed.

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
async function decodeAndPlay(audioBytes: ArrayBuffer, volume: number, label: string, interrupt = false, playbackRate = 1.0): Promise<boolean> {
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch (e) {
    console.warn(`[${label}] AudioContext unavailable, audio cannot play:`, e);
    return false;
  }
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* state check next */ }
  }
  // 2026-05-08 evidence-based: user's Safari console showed
  // "[TTS] Portal TTS succeeded" ×3 with ZERO audible output. Per
  // the Web Audio spec, BufferSource.start() does NOT throw on a
  // suspended AudioContext — it QUEUES the playback for whenever
  // the context becomes running. If ctx never resumes (Safari's
  // user-gesture-token consumed by `await fetch(...)` before
  // resume() runs), the queued audio is permanently silent. The
  // function then returned `true` and speechService logged
  // "succeeded" — a false positive that prevented the Tier 3 Web
  // Speech fallback (which works without a gesture on Safari) from
  // ever firing.
  //
  // Earlier removal-of-fail-fast (commit a8ea5e0) was wrong: I
  // assumed Web Speech also needed a gesture and would also fail.
  // Real-browser test on Safari proves Web Speech works without
  // gesture. So the right call is to return false here and let
  // speechService fall through.
  if (ctx.state !== 'running') {
    console.warn(`[${label}] AudioContext stuck in state="${ctx.state}" — falling through to Web Speech tier (Safari-safe).`);
    return false;
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
  if (playbackRate !== 1.0) source.playbackRate.value = playbackRate;
  const gain = ctx.createGain();
  // Volume guard: a NaN / undefined / negative input must NOT silence
  // the user. Math.min(1, NaN) is NaN — assigning NaN to gain.value
  // produces a 0-volume node that returns true from decodeAndPlay
  // (silent-success — user hears nothing while [TTS] succeeded logs
  // fire repeatedly, May 2026 user report Image #23). Reject NaN /
  // negative explicitly and default to 1.0.
  const safeVolume =
    typeof volume === 'number' && Number.isFinite(volume) && volume >= 0
      ? Math.min(1, volume)
      : 1;
  gain.gain.value = safeVolume;
  source.connect(gain).connect(ctx.destination);

  // Stop any prior playback synchronously, immediately before our
  // own start. Respect the PROTECT_PLAY_MS guard: if the current source
  // has been playing for less than PROTECT_PLAY_MS (600ms) AND this is
  // not an explicit Speak-button press (markSpeakInterrupt was NOT called),
  // skip the stop and abort this call instead. This prevents rapid autoSpeak
  // calls from prediction-tile taps killing each other — the user would
  // hear nothing because each source played for < 20ms before being killed.
  const playedSoFar = lastSourceStartedAt > 0 ? Date.now() - lastSourceStartedAt : Infinity;
  // Use the parameter, NOT the shared flag (which could be stolen by concurrent calls).
  // _nextSpeakInterrupt is kept as legacy no-op; parameter is the authoritative source.
  _nextSpeakInterrupt = false; // clear regardless
  if (!interrupt && activeSources.size > 0 && playedSoFar < PROTECT_PLAY_MS) {
    // Current audio is still "young" — let it play, silently drop this new request.
    // Returns true so the caller doesn't fall through to Web Speech (which would
    // queue a second voice on top of the still-playing audio).
    // If this fires unexpectedly, the caller should pass interrupt=true (explicit press).
    console.warn(`[AzureTTS] PROTECT_PLAY_MS: dropped call (${Math.round(playedSoFar)}ms < ${PROTECT_PLAY_MS}ms, sources=${activeSources.size}). Use interrupt=true for explicit presses.`);
    try { source.disconnect(); } catch { /* */ }
    try { gain.disconnect(); } catch { /* */ }
    return true;
  }
  stopAzurePlayback();
  activeSources.add(source);
  lastPlayedAt = Date.now();
  // Race-detection: track when the source actually started so a peer
  // call's stopAzurePlayback() that fires within ~30 ms of start() is
  // observable. onended fires on both natural completion AND on
  // .stop(); if it fires too soon, the audio was killed before the
  // user could hear it. We log a warning for diagnosability but do
  // not return false retroactively (the source object is gone).
  const startedAt = Date.now();
  source.onended = () => {
    const playedMs = Date.now() - startedAt;
    const expectedMs = decoded.duration * 1000;
    if (expectedMs > 250 && playedMs < expectedMs * 0.5) {
      console.warn(
        `[${label}] AUDIO TRUNCATED: played ${playedMs}ms of expected ${Math.round(expectedMs)}ms ` +
        `(${Math.round(playedMs / expectedMs * 100)}%). Likely killed by a peer speak call. User heard partial / no audio.`,
      );
    }
    activeSources.delete(source);
    if (activeSources.size === 0) lastSourceStartedAt = 0; // no more active sources
    try { source.disconnect(); } catch { /* */ }
    try { gain.disconnect(); } catch { /* */ }
  };

  try {
    source.start(0);
    lastSourceStartedAt = Date.now();
  } catch (e) {
    console.warn(`[${label}] source.start failed:`, e instanceof Error ? e.message : e);
    activeSources.delete(source);
    lastSourceStartedAt = 0;
    return false;
  }
  return true;
}

/**
 * Last-resort tier — Gemini 2.5 Flash Preview TTS.
 * Hits /api/v1/prism-aac/tts/public on the portal. Server returns
 * audio/wav (PCM wrapped in a RIFF header so decodeAudioData works).
 * Public route — no auth, CORS allow-*, rate-limited per IP.
 *
 * Runs AFTER the Inworld chain because Gemini doesn't speak
 * Romanian / Ukrainian / many other languages. For those the call
 * 503s on the server and wastes a round-trip; we'd rather hit
 * Inworld first (which routes RO/UK to Azure server-side via the
 * /tts/public catalog) and only fall through to Gemini for
 * languages neither covers.
 *
 * Returns true on play success; false on ANY failure (rate limit,
 * upstream 5xx, decode failure, etc.) so the caller falls through to
 * speech-service's Web Speech tiers.
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
    const audioBytes = await readCappedAudio(res);
    if (!audioBytes || audioBytes.byteLength === 0) {
      console.warn('[Gemini-TTS] empty/oversize audio buffer — falling through to Inworld');
      return false;
    }
    // decodeAndPlay handles stopAzurePlayback synchronously right
    // before source.start, so the peer-race window is microseconds.
    return await decodeAndPlay(audioBytes, volume, 'Gemini-TTS');
  } catch (e) {
    // Network / abort / timeout. Speech-service still has Web Speech
    // to fall back to even if Inworld is also down.
    console.warn('[Gemini-TTS] fetch threw:', e instanceof Error ? e.message : e);
    return false;
  }
}

export async function speakAzure(/* DEPLOY_SENTINEL_1778243738_28516 */
  text: string,
  lang: string,
  tone: ToneStyle,
  rate: number,
  volume: number,
  authToken: string,
  voiceId?: string,
  /** Pass true only from the explicit Speak button (handleSpeak). Allows this
   *  call to interrupt audio that is still within PROTECT_PLAY_MS. Uses a
   *  parameter (not a shared flag) so concurrent autoSpeak calls can't steal it. */
  interrupt = false,
): Promise<boolean> {
  // Rapid-duplicate suppression — drop a new speak with the same text
  // if one fired in the last DEDUP_MS. Otherwise the new fetch+decode
  // races the prior playback and stopAzurePlayback() kills the still-
  // streaming source. Returns true (claims success) so speechService
  // doesn't fall through to Web Speech tier — the prior call is the
  // one playing, no fallback needed.
  // Abort all in-flight fetches when the caller explicitly interrupts.
  // Without this, a stale TTS fetch (e.g. OCR Speak while main Speak fires)
  // completes after the interrupt and its decodeAndPlay races or overlaps
  // with the new audio — two simultaneous AudioBufferSources → chipmunk.
  if (interrupt) {
    activeControllers.forEach((c) => c.abort());
    activeControllers.clear();
    stopAzurePlayback();
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }

  const nowMs = Date.now();
  if (text === lastSpokenText && nowMs - lastSpokenAt < DEDUP_MS) {
    if (process.env.NODE_ENV !== 'production') console.log(`[AzureTTS] DEDUP — same text "${text.slice(0, 30)}" within ${nowMs - lastSpokenAt}ms; keeping prior playback alive`);
    return true;
  }
  lastSpokenText = text;
  lastSpokenAt = nowMs;

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
    if (res.ok) {
      // stopAzurePlayback used to run HERE — before `await readCappedAudio`
      // and `await decodeAudioData`. That opened a 50–500 ms window where
      // a peer speakAzure call could ALSO call stopAzurePlayback (no-op
      // since we just cleared activeSources) and then race ahead, end up
      // calling stopAzurePlayback again right when our newly-started
      // source landed in activeSources — killing our audio mid-play.
      // Symptom: console fires "Portal TTS succeeded" repeatedly while
      // the user hears nothing (May 2026 user report Image #23).
      // decodeAndPlay now calls stopAzurePlayback ITSELF, synchronously,
      // immediately before source.start — so the gap between stop and
      // start is microseconds and peer races can't slot in.
      const audioBytes = await readCappedAudio(res);
      if (audioBytes) {
        clearTimeout(timeout);
        activeControllers.delete(controller);
        // Rate is fully encoded in the SSML prosody (buildSSML: stored × 2,
        // clamped 0.5–1.4). Azure applies it natively; the portal converts
        // it to an Inworld steering hint via rateToSteering. Do NOT apply
        // an additional Web Audio playbackRate — that was causing double-slow
        // in translation mode: aacSpeak effectiveRate × 0.6 → SSML rate 0.6
        // → old pbRate 0.6 = 0.36× speed (en-ro regression, May 2026).
        return await decodeAndPlay(audioBytes, volume, 'AzureTTS', interrupt);
      }
      console.warn('[AzureTTS] response oversize, dropping');
    } else {
      console.warn(`[AzureTTS] /tts/public+/tts both failed (${res.status}) — trying Gemini fallback`);
    }

    // ── Last-resort tier: Gemini ──
    // Inworld + auth /tts both failed (or returned an oversize body).
    // Try the Gemini public route — useful for English where Gemini
    // has good voices, never useful for ro/uk/etc. Returns false on
    // any failure → speech-service falls through to Web Speech.
    if (await speakGemini(text, volume, controller, lang)) {
      clearTimeout(timeout);
      activeControllers.delete(controller);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[AzureTTS] Fetch failed:', e instanceof Error ? e.message : e);
    if (url) releaseBlob(url);
    return false;
  } finally {
    // Belt-and-suspenders cleanup. The success path also clears these
    // mid-function (so stopAzureAudio() during a slow play doesn't see a
    // stale controller), but if any throw skipped that cleanup the
    // controller / timeout would leak forever — the AbortController
    // pile would grow unbounded across rapid Speak presses, and the
    // setTimeout would still fire (no-op'ing on an already-aborted
    // controller, but still wasting timer slots).
    clearTimeout(timeout);
    activeControllers.delete(controller);
  }
}
