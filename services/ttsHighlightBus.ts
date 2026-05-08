/**
 * ttsHighlightBus — pub/sub for word-by-word TTS highlight events.
 *
 * Sister bus to ttsHealthBus, but for the *content* of speech rather
 * than the *health* of the chain. AAC users with reading / memory
 * disabilities specifically asked for "highlight the words as they
 * are spoken so I can follow along" (Reddit r/AAC, May 2026, free
 * Read&Write alternatives thread). NVDA was rejected by that user
 * because it's blind-first and skips the visual cue.
 *
 * Two-event protocol:
 *   • 'tts-highlight-start' — fires when a Speak/sentence-end event
 *     kicks off TTS for a string. Carries the text and an estimated
 *     duration in ms so subscribers can schedule the highlight ticks.
 *   • 'tts-highlight-end' — fires when the speak event completes,
 *     or when a NEW speak event interrupts the prior one. Subscribers
 *     should clear their highlight on this signal.
 *
 * Duration is ESTIMATED, not measured. Real TTS playback duration
 * depends on the backend (Inworld v1.5-mini ≠ Azure neural ≠ Kokoro)
 * and isn't returned by the portal route — only an MP3 blob whose
 * decoded duration is available *after* metadata loads. The estimate
 * (~60 ms/char at default rate) is good enough for "follow along"
 * highlighting; precise sync would require threading the <audio>
 * element's `timeupdate` event up to the renderer, which is a much
 * larger refactor than the visible benefit warrants.
 *
 * Listener errors are caught so one bad subscriber can't break the bus.
 */

export interface TtsHighlightStartEvent {
  type: 'tts-highlight-start';
  /** Spoken text — exactly what the renderer should highlight. */
  text: string;
  /** Estimated duration in ms (text.length * ms-per-char heuristic). */
  estimatedDurationMs: number;
  /** ms-since-epoch when the speak request was issued. */
  timestamp: number;
}

export interface TtsHighlightEndEvent {
  type: 'tts-highlight-end';
  timestamp: number;
}

export type TtsHighlightEvent = TtsHighlightStartEvent | TtsHighlightEndEvent;

type Listener = (e: TtsHighlightEvent) => void;
const listeners = new Set<Listener>();

export function subscribeTtsHighlight(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitTtsHighlight(event: TtsHighlightEvent): void {
  for (const fn of listeners) {
    try { fn(event); } catch { /* listener errors must not break the bus */ }
  }
}

/** Heuristic: ~60 ms/char at default PrismAAC rate (0.5). Empirically
 *  Inworld v1.5-mini speaks "Hello world." (12 chars) in ~750 ms; Azure
 *  in ~700 ms. 60 ms/char puts us at ~720 ms. Adjust for rate so the
 *  highlight tracks the actual speed setting (rate=1.0 → 30 ms/char).
 *  rate is the AAC store value (0..1, default 0.5); double-rate ≈ half
 *  duration. */
export function estimateSpeechDurationMs(text: string, rate: number): number {
  const norm = Math.max(0.1, Math.min(2, rate || 0.5));
  // At rate=0.5 → multiplier=1.0 (60 ms/char baseline).
  // At rate=1.0 → multiplier=0.5 (30 ms/char, twice as fast).
  const multiplier = 0.5 / norm;
  const baseMsPerChar = 60;
  return Math.max(300, Math.round(text.length * baseMsPerChar * multiplier));
}
