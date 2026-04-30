/**
 * Speech Service — Unified TTS routing
 *
 * Free tier:  Web Speech API (browser built-in, offline-capable)
 * Paid tiers: Azure Neural TTS with emotional tone styles → fallback to Web Speech API
 *
 * Azure routes through Synalux /api/v1/tts — same auth pattern as chat.
 * The Azure Speech key is stored server-side (Synalux env), not in the client.
 */

import { speakAzure, stopAzureAudio, ToneStyle } from './azureTTS';

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
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
 * Speak text — routes to Azure (paid) or Web Speech API (free).
 */
export async function speak(
  text: string,
  rate = 0.5,
  volume = 1.0,
  lang = 'en-US',
  tone: ToneStyle = 'friendly',
): Promise<void> {
  if (!text.trim()) return;

  // Paid tier: try Azure Neural TTS with tone
  if (isPaidTier()) {
    const token = getAuthToken()!;
    const success = await speakAzure(text, lang, tone, rate, volume, token);
    if (success) return;
    // Azure failed — fall through to Web Speech API
  }

  // Free tier / fallback: Web Speech API
  speakLocal(text, rate, volume, lang);
}

/**
 * Speak a single word (auto-speak mode) — always uses Web Speech API for speed.
 */
export function speakWord(word: string, rate = 0.5, volume = 1.0, lang = 'en-US'): void {
  speakLocal(word, rate, volume, lang);
}

/**
 * Local Web Speech API — works offline, no auth needed.
 */
function speakLocal(text: string, rate: number, volume: number, lang: string): void {
  if (!isSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  clearResumeWorkaround();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.1 + rate * 1.8;
  u.volume = volume;
  u.lang = lang;
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
