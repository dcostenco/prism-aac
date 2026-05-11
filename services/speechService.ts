/**
 * Speech Service — Resilient TTS with offline-first fallback chain
 *
 * Priority chain (highest quality first, degrades gracefully):
 *   1.   Azure Neural TTS (online, paid — best quality, emotional styles)
 *   1.5. Kokoro-82M neural TTS (offline, in-browser ONNX — MOS ~4.5)
 *   2.   Web Speech API with premium/enhanced voice (offline, OS-native)
 *   3.   Web Speech API with any available voice (offline, basic)
 *   4.   WASM espeak-ng (last resort — always works)
 *
 * For AAC patients who depend on this for communication, reliability > quality.
 * The system NEVER fails silently — if all TTS fails, it reports the error.
 *
 * Tier 1.5 (Kokoro) is opt-in via Settings → Voice Quality → "High Quality
 * (Kokoro, neural offline)" — the 350MB model downloads on first use, so we
 * don't impose it on every user. Once enabled, it slots above the OS Web
 * Speech path so even free-tier offline users get neural-grade speech.
 */

import { speakAzure, stopAzureAudio, ToneStyle } from './azureTTS';
// kokoroTTS removed — stubs keep v1.5.1 fallback chain intact at no-op cost
const speakWithKokoro = async (_opts: unknown): Promise<boolean> => false;
const isKokoroSupported = (): boolean => false;
const demoteKokoroForSession = (_reason: string): void => {};
const getKokoroVoice = (_lang: string): string | null => null;
import { autoSwitchTone, toneToAzureStyle, toneToRate } from './adaptiveEngine';
import { getTTSCode, SupportedLanguage } from '@/engine/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { emitTtsHealthEvent, TtsTier } from './ttsHealthBus';

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

function clearResumeWorkaround() {
  if (resumeInterval) { clearInterval(resumeInterval); resumeInterval = null; }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('prism-aac-auth-token') || null;
}

function isPaidTier(): boolean {
  const profile = useAuthStore.getState().profile;
  const paid = !!(profile?.plan && profile.plan !== 'free');
  const hasToken = !!getAuthToken();
  console.log(`[TTS] isPaidTier: plan=${profile?.plan ?? 'null'} paid=${paid} hasToken=${hasToken} loaded=${useAuthStore.getState().loaded}`);
  return paid || hasToken;
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
// One default per language Synalux supports. Values are the catalog's
// `voiceId` field (NOT displayName). For Inworld voices the two are
// the same string (Sarah, Alex, Diego, Mei, …); for Azure voices the
// voiceId is the full BCP-47 + voice-name ('ro-RO-AlinaNeural'). The
// portal /tts/public route looks up via getVoiceEntry(voiceId) and
// rejects unknown ids with 400.
//
// Romanian + Ukrainian: re-pinned to Azure neural voices after the
// rate-percent bug at azureTTS.ts:97-104 was fixed (multiplier syntax,
// no more chipmunk Romanian). Without this pin the portal sees
// voiceId=undefined and routes to Inworld TTS-2's multilingual model
// — which produces correct phonemes but is ~2× slower than the
// dedicated v1.5-mini voices used for ru/de/etc. AAC users reported
// "Romanian translation is twice as slow as Russian", and this
// asymmetry was the root cause: ru went through Sarah on v1.5-mini,
// ro fell through to TTS-2. Pinning ro/uk to their dedicated Azure
// neural voices (the same names as the original 2025 setup) restores
// per-language parity — Azure handles ro-RO and uk-UA natively.
const INWORLD_VOICE_DEFAULTS: Record<string, string> = {
  en: 'Alex',    es: 'Diego',  fr: 'Sarah',  de: 'Mark',
  pt: 'Sarah',   it: 'Sarah',  nl: 'Sarah',  pl: 'Sarah',
  ja: 'Sarah',   zh: 'Mei',    ko: 'Sarah',  ru: 'Sarah',
  he: 'Sarah',   ar: 'Sarah',  hi: 'Aanya',
  ro: 'ro-RO-AlinaNeural',
  uk: 'uk-UA-PolinaNeural',
};

/**
 * Speak text — quality-first fallback chain. Never fails silently.
 *
 *   Tier 1: Azure Neural TTS (online, best quality, emotional styles)
 *           - Paid tiers: all 12 langs
 *           - Free tier:  ro/uk/ru/de/ko/ar (the 6 Kokoro-unsupported langs).
 *             Synalux absorbs the cost — low volume, ensures every user in
 *             those countries gets neural-grade TTS.
 *   Tier 2: Kokoro-82M neural (offline, MOS ~4.5)
 *           - Only the 6 langs it speaks: en/es/fr/pt/ja/zh
 *           - Used when offline OR when Azure fails
 *   Tier 3: Web Speech API premium/enhanced voice (offline, OS-native)
 *   Tier 4: WASM espeak-ng (last resort)
 *
 * Quality > offline preference: when online, paid users always get Azure
 * Neural's emotional styles (friendly/calm/empathetic/etc.) — Kokoro lacks
 * those. Offline, Kokoro is the best free option for its 6 langs.
 *
 * Settings flag `useHighQualityOfflineVoice` (default ON) gates Kokoro —
 * users on a low-spec device can disable it to skip the 350MB download.
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
    effectiveRate = toneToRate(detected, rate);
  }

  const settings = useSettingsStore.getState() as { useHighQualityOfflineVoice?: boolean };
  const kokoroVoice = getKokoroVoice(lang);
  // Kokoro disabled: model unavailable (huggingface 404 + unsupported model
  // type style_text_to_speech_2). Falls through to Azure/Portal TTS (Alex).
  const kokoroEnabled = false;

  // Bus debug header — only the first 80 chars of utterance, never logged
  // by the bus itself. Used by the debug overlay to correlate events with
  // what the user attempted to say.
  const debugText = text.slice(0, 80);
  const triedTiers: TtsTier[] = [];

  // Tier 1: Azure Neural TTS — try unconditionally when online. The portal
  // route is the source of truth for tier policy: paid tiers always allowed,
  // free tier allowed for the 6 non-Kokoro langs (synalux absorbs that cost
  // per design). This avoids a client-side profile-load race that previously
  // caused enterprise users to skip Azure during the first ~1-2s after page
  // load (profile=null → isPaidTier=false → for en-US, kokoroVoice exists →
  // Azure was skipped → fell through to Web Speech robotic).
  if (isOnline()) {
    const token = getAuthToken();
    const profile = useAuthStore.getState().profile;
    // Look up the user's preferred voice for the requested language. The
    // portal route validates the id against the catalog and routes to the
    // matching backend (Inworld for paid+supported, Azure otherwise).
    const baseLang = lang.toLowerCase().split(/[-_]/)[0];
    const voicePref = (settings as { voicePreferences?: Record<string, string> }).voicePreferences;
    const voiceId = voicePref?.[baseLang] || INWORLD_VOICE_DEFAULTS[baseLang];
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
    const success = await speakAzure(text, lang, effectiveTone, effectiveRate, volume, token || '', voiceId, interrupt);
    if (success) {
      console.log('[TTS] Portal TTS succeeded');
      const now = Date.now();
      emitTtsHealthEvent({
        type: 'tts-success', tier: 'inworld', latencyMs: now - tier1Start,
        durationMs: 0, timestamp: now,
      });
      return;
    }
    console.warn('[TTS] Portal TTS failed (server tier-rejected, network, or timeout), falling through');
    // Decide next tier for the fallback event. Mirrors the actual control
    // flow below so the bus reflects what really happens next.
    const nextTier: TtsTier = (kokoroEnabled && kokoroVoice && isKokoroSupported())
      ? 'kokoro'
      : (isSpeechSupported() ? 'web-speech' : 'native-ios');
    emitTtsHealthEvent({
      type: 'tts-fallback', fromTier: 'inworld', toTier: nextTier,
      reason: 'portal failed (tier reject / network / timeout)', timestamp: Date.now(),
    });
  }

  // Tier 2: Kokoro neural — offline-capable fallback for the 6 langs it speaks.
  // Fires when: offline, OR Azure failed, OR free-tier user on a Kokoro lang.
  if (kokoroEnabled && kokoroVoice && isKokoroSupported()) {
    triedTiers.push('kokoro');
    const tier2Start = Date.now();
    emitTtsHealthEvent({
      type: 'tts-attempt', tier: 'kokoro', text: debugText, lang, timestamp: tier2Start,
    });
    try {
      await speakWithKokoro({
        text,
        lang: lang.split('-')[0],
        rate: 0.1 + effectiveRate * 1.8,
      });
      const now = Date.now();
      emitTtsHealthEvent({
        type: 'tts-success', tier: 'kokoro', latencyMs: now - tier2Start,
        durationMs: 0, timestamp: now,
      });
      return;
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      demoteKokoroForSession(reason);
      const next: TtsTier = isSpeechSupported() ? 'web-speech' : 'native-ios';
      emitTtsHealthEvent({
        type: 'tts-fallback', fromTier: 'kokoro', toTier: next,
        reason, timestamp: Date.now(),
      });
      // fall through
    }
  }

  // Tier 3: Web Speech API (offline, all 12 langs on most devices)
  if (isSpeechSupported()) {
    triedTiers.push('web-speech');
    // speakLocal emits its own attempt + success/fallback via the
    // SpeechSynthesisUtterance lifecycle (onend / onerror).
    speakLocal(text, effectiveRate, volume, lang);
    return;
  }

  // Tier 4: WASM TTS fallback (if Web Speech API unavailable)
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
  speakLocal(word, rate, volume, actualLang);
}

function speakLocal(text: string, rate: number, volume: number, lang: string): void {
  if (!text.trim()) return;
  if (!isSpeechSupported()) {
    console.warn('[PrismAAC] Speech synthesis not available on this browser');
    return;
  }
  window.speechSynthesis.cancel();
  clearResumeWorkaround();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.1 + rate * 1.8;
  u.volume = volume;
  u.lang = lang;

  const { voice, quality } = getBestOfflineVoice(lang);
  // Surface which OS voice the system landed on so users reporting a
  // "robotic" complaint can grep their console and tell us what installed
  // voice was picked. If quality is 'basic' on en, the system's English
  // premium voice is missing — Tier 1 must have failed AND Kokoro isn't
  // loaded for us to be here.
  console.log(`[TTS] Tier 3 Web Speech: lang=${lang} voice=${voice?.name ?? 'none'} quality=${quality}`);
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
  emitTtsHealthEvent({
    type: 'tts-attempt', tier: 'web-speech', text: text.slice(0, 80),
    lang, timestamp: attemptStart,
  });

  u.onstart = () => { audibleStart = Date.now(); };
  u.onend = () => {
    clearResumeWorkaround();
    const now = Date.now();
    emitTtsHealthEvent({
      type: 'tts-success', tier: 'web-speech',
      latencyMs: (audibleStart ?? now) - attemptStart,
      durationMs: audibleStart != null ? now - audibleStart : 0,
      timestamp: now,
    });
  };
  u.onerror = (ev) => {
    clearResumeWorkaround();
    // SpeechSynthesisErrorEvent.error is a string code (e.g. 'not-allowed',
    // 'language-unavailable', 'synthesis-failed'). Surface it so the
    // overlay can show the actual reason — every recent regression had
    // a different code.
    const code = (ev as SpeechSynthesisErrorEvent | undefined)?.error || 'unknown';
    emitTtsHealthEvent({
      type: 'tts-give-up', lastTier: 'web-speech', triedTiers: ['web-speech'],
      reason: `speech-synthesis error: ${code}`, timestamp: Date.now(),
    });
  };
  resumeInterval = setInterval(() => window.speechSynthesis.resume(), 10_000);
  window.speechSynthesis.speak(u);
}

export function stopSpeech(): void {
  stopAzureAudio();
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  clearResumeWorkaround();
}
