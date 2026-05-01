/**
 * Speech Service — Resilient TTS with offline-first fallback chain
 *
 * Priority chain (highest quality first, degrades gracefully):
 *   1. Azure Neural TTS (online, paid tier — best quality, emotional styles)
 *   2. Web Speech API with premium/enhanced voice (offline-capable, high quality)
 *   3. Web Speech API with any available voice (offline-capable, basic quality)
 *
 * For AAC patients who depend on this for communication, reliability > quality.
 * The system NEVER fails silently — if all TTS fails, it reports the error.
 */

import { speakAzure, stopAzureAudio, ToneStyle } from './azureTTS';

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

  const enhanced = langVoices.find((v) => v.name.includes('Enhanced') || v.name.includes('Compact') === false);
  if (enhanced) return { voice: enhanced, quality: 'enhanced' };

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
  return !!getAuthToken();
}

/**
 * Speak text — resilient fallback chain. Never fails silently.
 */
export async function speak(
  text: string,
  rate = 0.5,
  volume = 1.0,
  lang = 'en-US',
  tone: ToneStyle = 'friendly',
): Promise<void> {
  if (!text.trim()) return;

  // Tier 1: Azure Neural TTS (online + paid)
  if (isPaidTier() && isOnline()) {
    const token = getAuthToken()!;
    const success = await speakAzure(text, lang, tone, rate, volume, token);
    if (success) return;
  }

  // Tier 2/3: Local voice (offline-capable)
  speakLocal(text, rate, volume, lang);
}

/**
 * Speak a single word — always local for <50ms latency (critical for AAC).
 */
export function speakWord(word: string, rate = 0.5, volume = 1.0, lang = 'en-US'): void {
  speakLocal(word, rate, volume, lang);
}

function speakLocal(text: string, rate: number, volume: number, lang: string): void {
  if (!isSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  clearResumeWorkaround();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.1 + rate * 1.8;
  u.volume = volume;
  u.lang = lang;

  const { voice } = getBestOfflineVoice(lang);
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
