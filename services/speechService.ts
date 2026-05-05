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
import { speakWithKokoro, isKokoroSupported, demoteKokoroForSession, getKokoroVoice } from './kokoroTTS';
import { autoSwitchTone, toneToAzureStyle, toneToRate } from './adaptiveEngine';
import { getTTSCode, SupportedLanguage } from '@/engine/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

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
  return localStorage.getItem('prism-aac-auth-token') || null;
}

function isPaidTier(): boolean {
  const profile = useAuthStore.getState().profile;
  const paid = !!(profile?.plan && profile.plan !== 'free');
  const hasToken = !!getAuthToken();
  console.log(`[TTS] isPaidTier: plan=${profile?.plan ?? 'null'} paid=${paid} hasToken=${hasToken} loaded=${useAuthStore.getState().loaded}`);
  return paid || hasToken;
}

// Catalog defaults — when the user has not picked a voice in Settings, ship
// the warmest "default"-tagged voice from portal/src/shared/voice-catalog.ts.
// Without this, paid-tier users hit the portal's Azure fallback (Jenny et al.),
// which is fine but flatter than Inworld. English in particular sounded
// noticeably robotic before this map existed because the portal's
// no-voiceId path is Azure-Neural, not Inworld.
const INWORLD_VOICE_DEFAULTS: Record<string, string> = {
  en: 'Ashley',  es: 'Carmen', fr: 'Camille', de: 'Hans',
  pt: 'Luana',   it: 'Giulia', nl: 'Lotte',   pl: 'Zofia',
  ja: 'Sakura',  zh: 'Mei',    ko: 'Jisoo',   ru: 'Anya',
  he: 'Noa',     ar: 'Layla',  hi: 'Aanya',
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
): Promise<void> {
  if (!text.trim()) return;

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
  const kokoroEnabled = settings.useHighQualityOfflineVoice !== false; // default ON

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
    console.log(`[TTS] Attempting portal TTS: lang=${lang} tone=${effectiveTone} plan=${profile?.plan ?? 'unknown'} voiceId=${voiceId ?? 'auto'} loaded=${useAuthStore.getState().loaded}`);
    const success = await speakAzure(text, lang, effectiveTone, effectiveRate, volume, token || '', voiceId);
    if (success) { console.log('[TTS] Portal TTS succeeded'); return; }
    console.warn('[TTS] Portal TTS failed (server tier-rejected, network, or timeout), falling through');
  }

  // Tier 2: Kokoro neural — offline-capable fallback for the 6 langs it speaks.
  // Fires when: offline, OR Azure failed, OR free-tier user on a Kokoro lang.
  if (kokoroEnabled && kokoroVoice && isKokoroSupported()) {
    try {
      await speakWithKokoro({
        text,
        lang: lang.split('-')[0],
        rate: 0.1 + effectiveRate * 1.8,
      });
      return;
    } catch (e) {
      demoteKokoroForSession(e instanceof Error ? e.message : 'unknown');
      // fall through
    }
  }

  // Tier 3: Web Speech API (offline, all 12 langs on most devices)
  if (isSpeechSupported()) {
    speakLocal(text, effectiveRate, volume, lang);
    return;
  }

  // Tier 4: WASM TTS fallback (if Web Speech API unavailable)
  try {
    const { speakWasm, isWasmTTSReady, initWasmTTS } = await import('./wasmTTS');
    if (!isWasmTTSReady()) await initWasmTTS();
    await speakWasm(text, lang, rate, volume);
  } catch {
    console.warn('[PrismAAC] All TTS tiers failed — child cannot hear output');
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

  u.onend = clearResumeWorkaround;
  u.onerror = clearResumeWorkaround;
  resumeInterval = setInterval(() => window.speechSynthesis.resume(), 10_000);
  window.speechSynthesis.speak(u);
}

export function stopSpeech(): void {
  stopAzureAudio();
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  clearResumeWorkaround();
}
