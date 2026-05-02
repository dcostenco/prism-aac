'use client';

/**
 * Whisper Service — Local mlx-whisper (large-v3-turbo) for high-accuracy STT
 *
 * Why this exists in addition to Web Speech API:
 *   - Web Speech API is fast but accuracy varies wildly across browsers and
 *     fails entirely on iOS Safari for some languages (esp. Russian, Korean,
 *     Arabic).
 *   - Whisper large-v3-turbo on M-series Apple Silicon hits <150ms on a
 *     2-3s utterance with WER ~7% across the 12 languages prism-aac ships.
 *
 * Routing rule (kept simple and conservative):
 *   - "Continuous typing" / "predict-while-speaking" stays on Web Speech API
 *     because the partial-results feedback loop is irreplaceable for AAC UX.
 *   - "Push-to-talk + final transcript" (Settings opt-in toggle) goes through
 *     Whisper for accuracy. Caregiver Notes voice input also goes through
 *     Whisper because the final transcript matters more than typing latency.
 *
 * Demote-on-error: if the first sample fails or runs >800ms total, this
 * service auto-disables for the session and the caller falls back to
 * Web Speech API. The portal STT remains the cloud fallback.
 *
 * Server: whisper_server.py at localhost:8002 (FastAPI + mlx-whisper).
 */

const WHISPER_BASE = 'http://localhost:8002';
const PROBE_TIMEOUT_MS = 600;
const TRANSCRIBE_TIMEOUT_MS = 8000;
const SLOW_SAMPLE_THRESHOLD_MS = 800;

let cachedAvailable: boolean | null = null;
let probePromise: Promise<boolean> | null = null;
let lastProbeAt = 0;
let demotedForSession = false;
const REPROBE_COOLDOWN_MS = 30_000;

async function probe(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${WHISPER_BASE}/health`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function isWhisperAvailable(): Promise<boolean> {
  if (demotedForSession) return Promise.resolve(false);
  if (probePromise) return probePromise;
  const now = Date.now();
  if (cachedAvailable === true) return Promise.resolve(true);
  if (cachedAvailable === false && now - lastProbeAt < REPROBE_COOLDOWN_MS) {
    return Promise.resolve(false);
  }
  lastProbeAt = now;
  probePromise = probe().then((v) => {
    cachedAvailable = v;
    if (!v) probePromise = null;
    return v;
  });
  return probePromise;
}

/** Force demote until next page load. Used after a timeout/failure. */
function demote(reason: string): void {
  demotedForSession = true;
  cachedAvailable = false;
  if (typeof window !== 'undefined' && window.console) {
    console.info(`[whisperService] demoted: ${reason}; falling back to Web Speech API`);
  }
}

export interface TranscribeRequest {
  audio: Blob;
  language?: string; // BCP-47-ish: 'en', 'es', 'ru', etc.
}

export interface TranscribeResult {
  text: string;
  language: string;
  latencyMs: number;
}

/**
 * Transcribe an audio Blob via the local Whisper server.
 * Returns null if Whisper isn't available or the call fails.
 * The caller should fall back to Web Speech API on null.
 */
export async function transcribeAudio(req: TranscribeRequest): Promise<TranscribeResult | null> {
  const available = await isWhisperAvailable();
  if (!available) return null;

  const fd = new FormData();
  fd.append('audio', req.audio, 'sample.wav');
  if (req.language) fd.append('language', req.language);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TRANSCRIBE_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(`${WHISPER_BASE}/v1/transcribe`, {
      method: 'POST',
      body: fd,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      demote(`http ${res.status}`);
      return null;
    }
    const data = await res.json();
    const totalMs = Date.now() - t0;

    // If even the first sample is slow, demote — typing/STT latency budget
    // for AAC is tight. Web Speech is faster on the wire even when less accurate.
    if (totalMs > SLOW_SAMPLE_THRESHOLD_MS && cachedAvailable === true) {
      demote(`slow first sample ${totalMs}ms`);
    }

    return {
      text: (data?.text || '').toString(),
      language: (data?.language || req.language || '?').toString(),
      latencyMs: typeof data?.latency_ms === 'number' ? data.latency_ms : totalMs,
    };
  } catch (e) {
    demote(e instanceof Error ? e.message : 'unknown');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convenience helper: record from the user's mic for `durationMs`, then
 * transcribe. Returns null if recording or transcription fails.
 *
 * The caller is responsible for any UI gating (record button state, etc).
 */
export async function recordAndTranscribe(durationMs: number, language?: string): Promise<TranscribeResult | null> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  const available = await isWhisperAvailable();
  if (!available) return null;

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
    const blob = await stopped;
    return transcribeAudio({ audio: blob, language });
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}
