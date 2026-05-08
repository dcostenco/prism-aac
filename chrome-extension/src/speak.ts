/**
 * speak — Web Speech API TTS with per-word boundary events.
 *
 * Chrome's SpeechSynthesisUtterance fires `boundary` events with
 * `{ name: 'word', charIndex }` per word — that's what powers the
 * word-by-word highlight in the overlay (no estimation needed unlike
 * the main PrismAAC web app, which uses a duration heuristic because
 * the portal route returns MP3 with no streaming events).
 *
 * Public API:
 *   speak(text, opts) → cancellable handle that emits onWord + onEnd.
 *   cancelSpeech()   → kill any in-flight utterance immediately.
 *
 * The extension uses Web Speech (free, OS-native) rather than Synalux
 * portal TTS so it works without an account or internet. Quality is
 * lower than Inworld neural voices but the read-along benefit is the
 * primary value, not voice fidelity.
 */
import type { ExtSettings } from './storage';

export interface SpeakHandle {
  cancel: () => void;
}

export interface SpeakOptions {
  /** Fires once per word boundary. `wordIndex` counts non-whitespace tokens. */
  onWord?: (wordIndex: number, word: string) => void;
  /** Fires when playback completes naturally OR is cancelled. */
  onEnd?: () => void;
  /** Fires on TTS error. */
  onError?: (error: string) => void;
  /** Voice override — wins over settings.voiceURI when set. Used when
   *  the translator picks a target-language voice automatically. */
  voiceOverride?: SpeechSynthesisVoice | null;
  /** BCP-47 lang attribute for the utterance. When set, this overrides
   *  the voice's intrinsic language (helpful for OS voices marked as
   *  multilingual). */
  langOverride?: string;
}

export function cancelSpeech(): void {
  try { window.speechSynthesis.cancel(); } catch { /* not all OS expose cancel */ }
}

/** Map a charIndex (where the boundary fired) to the word index in the
 *  utterance — number of word tokens before that char. */
function charIndexToWordIndex(text: string, charIndex: number): number {
  if (charIndex <= 0) return 0;
  // Count words ending strictly before charIndex.
  const slice = text.slice(0, charIndex);
  const matches = slice.match(/\S+/g);
  return matches ? matches.length : 0;
}

export function speak(text: string, settings: ExtSettings, opts: SpeakOptions = {}): SpeakHandle {
  if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) {
    queueMicrotask(() => opts.onEnd?.());
    return { cancel: () => {} };
  }

  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = clamp(settings.rate, 0.1, 10);
  utterance.volume = clamp(settings.volume, 0, 1);
  utterance.pitch = clamp(settings.pitch, 0, 2);

  if (opts.voiceOverride) {
    utterance.voice = opts.voiceOverride;
  } else if (settings.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === settings.voiceURI);
    if (voice) utterance.voice = voice;
  }
  if (opts.langOverride) {
    utterance.lang = opts.langOverride;
  } else if (utterance.voice) {
    utterance.lang = utterance.voice.lang;
  }

  const words = text.match(/\S+/g) ?? [];
  utterance.onboundary = (e) => {
    if (e.name && e.name !== 'word') return;
    if (!opts.onWord) return;
    const idx = charIndexToWordIndex(text, e.charIndex);
    const word = words[idx] ?? '';
    opts.onWord(idx, word);
  };
  utterance.onend = () => opts.onEnd?.();
  utterance.onerror = (e) => {
    const reason = (e as SpeechSynthesisErrorEvent).error || 'unknown';
    // 'interrupted' fires when cancelSpeech() pre-empts a prior call —
    // not a user-visible error, just a flow control signal.
    if (reason === 'interrupted' || reason === 'canceled') {
      opts.onEnd?.();
      return;
    }
    opts.onError?.(reason);
  };

  window.speechSynthesis.speak(utterance);
  return { cancel: () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } } };
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}
