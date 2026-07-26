/**
 * Speech Service — Resilient TTS with offline-first fallback chain
 *
 * Priority chain (highest quality first, degrades gracefully):
 *   1.  Azure Neural TTS (online, best quality, emotional styles)
 *   2.  Web Speech API with premium/enhanced voice (offline, OS-native)
 *   3.  Web Speech API with any available voice (offline, basic)
 *   4.  WASM espeak-ng (last resort — always works)
 *
 * For AAC patients who depend on this for communication, reliability > quality.
 * The system NEVER fails silently — if all TTS fails, it reports the error.
 */

import { speakAzure, stopAzureAudio, ToneStyle } from './azureTTS';
import { autoSwitchTone, toneToAzureStyle, toneToRate } from './adaptiveEngine';
import { getTTSCode, SupportedLanguage } from '@/engine/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { emitTtsHealthEvent, TtsTier } from './ttsHealthBus';
import { fetchVoiceCatalog, defaultVoiceForLanguage } from './voiceCatalogService';

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export type VoiceQuality = 'premium' | 'enhanced' | 'basic' | 'none';

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

// Known high-quality voice names per OS, used as a tie-breaker when the
// generic Premium/Neural/Enhanced filter doesn't find anything. macOS ships
// these as quality variants of base voices (e.g. "Ava (Premium)") but on
// some systems the suffix is missing — match the bare name as a fallback.
const KNOWN_QUALITY_VOICES: Record<string, string[]> = {
  en: ['Ava', 'Allison', 'Samantha', 'Tom', 'Karen', 'Daniel', 'Moira', 'Aria', 'Guy', 'Jenny'],
  es: ['Mónica', 'Paulina', 'Jorge', 'Diego'],
  fr: ['Amélie', 'Thomas', 'Aurélie'],
  de: ['Anna', 'Markus', 'Petra'],
  pt: ['Luciana', 'Joana', 'Felipe'],
  it: ['Alice', 'Federica', 'Luca'],
  ja: ['Kyoko', 'Otoya', 'Nanami'],
  ko: ['Yuna', 'SunHi'],
  zh: ['Ting-Ting', 'Sin-Ji', 'Mei-Jia', 'Xiaoxiao'],
  ru: ['Yuri', 'Milena'],
  // macOS/iOS ships these by default for the right language pack;
  // Windows/Edge typically also has Microsoft variants.
  ro: ['Ioana', 'Andrei', 'Emil'],
  uk: ['Lesya', 'Polina'],
  ar: ['Maged', 'Tarik', 'Laila', 'Naayf', 'Hoda'],
  bg: ['Daria'],
};

export function getBestOfflineVoice(lang: string): { voice: SpeechSynthesisVoice | null; quality: VoiceQuality } {
  if (!isSpeechSupported()) return { voice: null, quality: 'none' };
  const voices = loadVoices();
  const langPrefix = lang.split('-')[0];

  const langVoices = voices.filter(
    (v) => v.lang.startsWith(lang) || v.lang.startsWith(langPrefix),
  );
  if (langVoices.length === 0) return { voice: null, quality: 'none' };

  const premium = langVoices.find((v) => v.name.includes('Premium') || v.name.includes('Neural'));
  if (premium) return { voice: premium, quality: 'premium' };

  const enhanced = langVoices.find((v) => v.name.includes('Enhanced') && !v.name.includes('Compact'));
  if (enhanced) return { voice: enhanced, quality: 'enhanced' };

  // Fallback: search by known quality voice names. macOS basic English voices
  // (Samantha, Ava) sound robotic at AAC speech rates; the Compact/quality
  // variants sound much better. By matching the known-good voice list before
  // accepting `langVoices[0]`, we skip rare junk voices like "Albert" that
  // sometimes top the list alphabetically.
  const knownQualityNames = KNOWN_QUALITY_VOICES[langPrefix] || [];
  for (const name of knownQualityNames) {
    const match = langVoices.find((v) => v.name.includes(name) && !v.name.includes('Compact'));
    if (match) return { voice: match, quality: 'enhanced' };
  }
  // Last resort: prefer non-Compact over Compact (compact = lower quality)
  const nonCompact = langVoices.find((v) => !v.name.includes('Compact'));
  if (nonCompact) return { voice: nonCompact, quality: 'basic' };

  return { voice: langVoices[0], quality: 'basic' };
}

export function getVoiceStatus(lang: string): { quality: VoiceQuality; needsDownload: boolean; message: string } {
  const { quality } = getBestOfflineVoice(lang);
  if (quality === 'premium') return { quality, needsDownload: false, message: '' };
  if (quality === 'enhanced') return { quality, needsDownload: true, message: 'Premium voice available — download in Settings > Accessibility > Spoken Content for better quality.' };
  if (quality === 'basic') return { quality, needsDownload: true, message: 'Enhanced voice recommended — download in Settings > Accessibility > Spoken Content.' };
  return { quality, needsDownload: true, message: 'No voice installed for this language. Download in Settings > Accessibility > Spoken Content.' };
}

let resumeInterval: ReturnType<typeof setInterval> | null = null;
let localSpeechGeneration = 0;
let resolveActiveLocalSpeech: (() => void) | null = null;

function clearResumeWorkaround() {
  if (resumeInterval) { clearInterval(resumeInterval); resumeInterval = null; }
}

/**
 * Retire the current local utterance before cancelling Web Speech.
 *
 * Safari may dispatch the cancelled utterance's onerror asynchronously. If
 * that stale callback clears the module-global resume timer after a newer
 * utterance starts, the newer utterance loses its keep-alive workaround. The
 * generation makes stale callbacks no-ops, while resolving the previous
 * promise prevents interrupted `speak()` callers from hanging indefinitely.
 */
function retireActiveLocalSpeech() {
  localSpeechGeneration += 1;
  clearResumeWorkaround();
  const resolve = resolveActiveLocalSpeech;
  resolveActiveLocalSpeech = null;
  resolve?.();
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('prism-aac-auth-token') || null;
}

// Catalog defaults — when the user has not picked a voice in Settings,
// pick the best Inworld voice that ACTUALLY exists on Inworld's server.
//
// Audit (probed via /api/v1/tts/public 2026-05-05): only 8 of the 23
// "inworld" entries in portal/src/shared/voice-catalog.ts return 200
// from Inworld's v1.5-mini model. The other 15 (Carmen, Camille, Hans,
// Lena, Luana, Giulia, Lotte, Zofia, Sakura, Jisoo, Anya, Noa, Layla,
// Lucas, Helia) return 502 — they're aspirational catalog entries that
// were never reconciled against Inworld's real voice list.
//
// Confirmed working: Ashley, Sarah, Alex, Dennis, Mark (en),
//                    Diego (es), Mei (zh), Aanya (hi).
//
// Inworld 1.5-mini voices are multilingual — Sarah produces clear
// Russian, Polish, German, etc. So we route all "broken-default"
// languages through Sarah (female, "Clear, professional") to avoid
// the 502. en stays on Alex ("Friendly, natural"), zh on Mei, hi on
// Aanya, es on Diego (the original ones that work).
// One default per language Synalux supports. Missing entries cause
// voiceId=undefined → portal TTS picks an arbitrary catalog default
// (frequently English) → user hears their language read with an
// American accent. Always add a row when adding a new language to
// LANG_META in engine/i18n.ts.
//
// Voice defaults resolved from the portal catalog at runtime. The portal
// is the single source of truth for voice routing. VOICE_FALLBACK is a
// minimal safety net for cold-start (speak before catalog loads), offline,
// free-tier (403), and fetch-failure paths — without it, voiceId=undefined
// falls through to the slow TTS-2 multilingual model (~2× latency).
// Minimal fallback — only languages whose best voice isn't Sarah.
// Everything else falls through to Sarah (confirmed multilingual).
const VOICE_FALLBACK: Record<string, string> = {
  en: 'Alex', es: 'Diego', zh: 'Mei', hi: 'Aanya',
};
const DEFAULT_FALLBACK = 'Sarah';

let _catalogCache: Awaited<ReturnType<typeof fetchVoiceCatalog>> = [];

function loadCatalog() {
  fetchVoiceCatalog().then(c => {
    _catalogCache = c;
  }).catch(() => {
    // Retry once after 5s — a single transient failure shouldn't degrade
    // TTS routing for the entire session.
    setTimeout(() => {
      fetchVoiceCatalog(true).then(c => {
        _catalogCache = c;
      }).catch(() => {});
    }, 5000);
  });
}
loadCatalog();

/**
 * Speak text — quality-first fallback chain. Never fails silently.
 *
 *   Tier 1: Azure Neural TTS (online, best quality, emotional styles)
 *           - Portal decides paid vs free policy server-side.
 *   Tier 2: Web Speech API premium/enhanced voice (offline, OS-native)
 *   Tier 3: WASM espeak-ng (last resort)
 */
export async function speak(
  text: string,
  rate = 0.5,
  volume = 1.0,
  lang = 'en-US',
  tone: ToneStyle | 'auto' = 'auto',
  interrupt = false,
): Promise<void> {
  if (!text.trim()) return;
  // Volume=0 guard — catches mis-stored settings before a silent-success
  if (volume === 0) {
    console.warn('[TTS] volume=0 — audio will be silent. Check Settings → Voice → Volume slider.');
    emitTtsHealthEvent({
      type: 'tts-give-up', lastTier: 'inworld', triedTiers: [],
      reason: 'volume=0 in settings — speech suppressed', timestamp: Date.now(),
    });
    return;
  }

  // Auto tone switch — when caller passes 'auto' (default for new code), the
  // adaptive engine detects emotional context from the text and routes the
  // TTS voice style + rate accordingly. Caller can still pass an explicit
  // ToneStyle to override (e.g. 'cheerful' for a celebration UI).
  let effectiveTone: ToneStyle = tone === 'auto' ? 'friendly' : tone;
  let effectiveRate = rate;
  if (tone === 'auto') {
    const detected = autoSwitchTone(text);
    effectiveTone = toneToAzureStyle(detected) as ToneStyle;
    // Only apply tone-based rate adjustment for English. Foreign language
    // neural voices have their own natural cadence; slowing Spanish by 15%
    // for "serious" tone sounds robotic rather than measured.
    const langPrefix = lang.toLowerCase().split(/[-_]/)[0];
    if (langPrefix === 'en') {
      effectiveRate = toneToRate(detected, rate);
    }
  }

  const settings = useSettingsStore.getState() as { voicePreferences?: Record<string, string> };

  // Bus debug header — only the first 80 chars of utterance, never logged
  // by the bus itself. Used by the debug overlay to correlate events with
  // what the user attempted to say.
  const debugText = text.slice(0, 80);
  const triedTiers: TtsTier[] = [];

  // Tier 1: Azure Neural TTS — try unconditionally when online. The portal
  // route is the source of truth for tier policy: paid tiers always allowed,
  // free tier always attempted (synalux absorbs the cost for baseline langs).
  // Avoids a client-side profile-load race that previously caused enterprise
  // users to skip Azure during the first ~1-2s after page load.
  if (isOnline()) {
    const token = getAuthToken();
    const profile = useAuthStore.getState().profile;
    // Look up the user's preferred voice for the requested language. The
    // portal route validates the id against the catalog and routes to the
    // matching backend (Inworld for paid+supported, Azure otherwise).
    const baseLang = lang.toLowerCase().split(/[-_]/)[0];
    const voicePref = settings.voicePreferences;
    const voiceId = voicePref?.[baseLang]
      || defaultVoiceForLanguage(_catalogCache, baseLang)
      || VOICE_FALLBACK[baseLang] || DEFAULT_FALLBACK;
    console.log(`[TTS] Attempting portal TTS: lang=${lang} tone=${effectiveTone} plan=${profile?.plan ?? 'unknown'} voiceId=${voiceId ?? 'auto'} loaded=${useAuthStore.getState().loaded} vol=${volume} rate=${effectiveRate}`);

    // Tier name reflects the public route's primary backend (Inworld first
    // per speakAzure: it tries /tts/public, then falls back to /tts on 502).
    // The internal Inworld→Azure switch isn't exposed here — at the bus
    // level we treat the whole portal call as one tier.
    triedTiers.push('inworld');
    const tier1Start = Date.now();
    emitTtsHealthEvent({
      type: 'tts-attempt', tier: 'inworld', text: debugText, lang, timestamp: tier1Start,
    });
    const result = await speakAzure(text, lang, effectiveTone, effectiveRate, volume, token || '', voiceId, interrupt);
    if (result && result.success) {
      console.log('[TTS] Portal TTS succeeded');
      const now = Date.now();
      emitTtsHealthEvent({
        type: 'tts-success', tier: 'inworld', latencyMs: now - tier1Start,
        durationMs: 0, timestamp: now,
      });
      if (result.onEnded) await result.onEnded;
      return;
    }
    console.warn('[TTS] Portal TTS failed (server tier-rejected, network, or timeout), falling through');
    // Decide next tier for the fallback event. Mirrors the actual control
    // flow below so the bus reflects what really happens next.
    const nextTier: TtsTier = isSpeechSupported() ? 'web-speech' : 'native-ios';
    emitTtsHealthEvent({
      type: 'tts-fallback', fromTier: 'inworld', toTier: nextTier,
      reason: 'portal failed (tier reject / network / timeout)', timestamp: Date.now(),
    });
  }

  // Tier 2: Web Speech API (offline, all 12 langs on most devices)
  if (isSpeechSupported()) {
    triedTiers.push('web-speech');
    // speakLocal emits its own attempt + success/fallback via the
    // SpeechSynthesisUtterance lifecycle (onend / onerror).
    await speakLocal(text, effectiveRate, volume, lang);
    return;
  }

  // Tier 3: WASM TTS fallback (if Web Speech API unavailable)
  triedTiers.push('native-ios');
  const tier4Start = Date.now();
  emitTtsHealthEvent({
    type: 'tts-attempt', tier: 'native-ios', text: debugText, lang, timestamp: tier4Start,
  });
  try {
    const { speakWasm, isWasmTTSReady, initWasmTTS } = await import('./wasmTTS');
    if (!isWasmTTSReady()) await initWasmTTS();
    await speakWasm(text, lang, rate, volume);
    const now = Date.now();
    emitTtsHealthEvent({
      type: 'tts-success', tier: 'native-ios', latencyMs: now - tier4Start,
      durationMs: 0, timestamp: now,
    });
  } catch (e) {
    console.warn('[PrismAAC] All TTS tiers failed — child cannot hear output');
    emitTtsHealthEvent({
      type: 'tts-give-up', lastTier: 'native-ios', triedTiers: [...triedTiers],
      reason: e instanceof Error ? `wasm-tts failed: ${e.message}` : 'all tiers exhausted',
      timestamp: Date.now(),
    });
  }
}

/**
 * Speak a single word — always local for <50ms latency (critical for AAC).
 * Dynamically pulls user's language if no lang provided — never hardcodes en-US.
 */
export function speakWord(word: string, rate = 0.5, volume = 1.0, lang?: string): void {
  const actualLang = lang || getTTSCode((useSettingsStore.getState().language || 'en') as SupportedLanguage);
  void speakLocal(word, rate, volume, actualLang);
}

function speakLocal(text: string, rate: number, volume: number, lang: string): Promise<void> {
  return new Promise<void>((resolve) => {
  if (!text.trim()) return resolve();
  if (!isSpeechSupported()) {
    console.warn('[PrismAAC] Speech synthesis not available on this browser');
    return resolve();
  }
  stopAzureAudio();
  retireActiveLocalSpeech();
  window.speechSynthesis.cancel();
  const generation = localSpeechGeneration;
  resolveActiveLocalSpeech = resolve;

  const u = new SpeechSynthesisUtterance(text);
  const baseLang = lang.split('-')[0];
  const isEn = baseLang === 'en';
  u.rate = isEn ? (0.2 + rate * 1.2) : (0.1 + rate * 1.8) * 0.85;
  u.volume = volume;
  u.lang = lang;

  const { voice, quality } = getBestOfflineVoice(lang);
  // Surface which OS voice the system landed on so users reporting a
  // "robotic" complaint can grep their console and tell us what installed
  // voice was picked.
  console.log(`[TTS] Tier 2 Web Speech: lang=${lang} voice=${voice?.name ?? 'none'} quality=${quality}`);
  if (voice) {
    u.voice = voice;
  } else {
    const all = loadVoices();
    const prefix = lang.split('-')[0];
    const any = all.find((v) => v.lang.startsWith(prefix));
    if (any) u.voice = any;
  }

  // Emit attempt + capture timing so onend / onerror can publish accurate
  // latency. SpeechSynthesisUtterance has no "audible audio start" event
  // in WebSpeech — the closest proxy is `onstart` (utterance dequeued,
  // about to speak). We use onstart for latency and onend for duration.
  const attemptStart = Date.now();
  let audibleStart: number | null = null;
  let settled = false;
  const finish = (publish: (() => void) | null) => {
    if (settled || generation !== localSpeechGeneration) return;
    settled = true;
    clearResumeWorkaround();
    resolveActiveLocalSpeech = null;
    publish?.();
    resolve();
  };
  emitTtsHealthEvent({
    type: 'tts-attempt', tier: 'web-speech', text: text.slice(0, 80),
    lang, timestamp: attemptStart,
  });

  u.onstart = () => {
    if (generation === localSpeechGeneration) audibleStart = Date.now();
  };
  u.onend = () => {
    finish(() => {
      const now = Date.now();
      emitTtsHealthEvent({
        type: 'tts-success', tier: 'web-speech',
        latencyMs: (audibleStart ?? now) - attemptStart,
        durationMs: audibleStart != null ? now - audibleStart : 0,
        timestamp: now,
      });
    });
  };
  u.onerror = (ev) => {
    finish(() => {
      // SpeechSynthesisErrorEvent.error is a string code (e.g. 'not-allowed',
      // 'language-unavailable', 'synthesis-failed'). Surface it so the
      // overlay can show the actual reason — every recent regression had
      // a different code.
      const code = (ev as SpeechSynthesisErrorEvent | undefined)?.error || 'unknown';
      emitTtsHealthEvent({
        type: 'tts-give-up', lastTier: 'web-speech', triedTiers: ['web-speech'],
        reason: `speech-synthesis error: ${code}`, timestamp: Date.now(),
      });
    });
  };
  resumeInterval = setInterval(() => {
    if (generation === localSpeechGeneration) window.speechSynthesis.resume();
  }, 10_000);
  try {
    window.speechSynthesis.speak(u);
  } catch (error) {
    finish(() => {
      const reason = error instanceof Error ? error.message : String(error);
      emitTtsHealthEvent({
        type: 'tts-give-up', lastTier: 'web-speech', triedTiers: ['web-speech'],
        reason: `speech-synthesis threw: ${reason}`, timestamp: Date.now(),
      });
    });
  }
  });
}

export function stopSpeech(): void {
  stopAzureAudio();
  retireActiveLocalSpeech();
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
