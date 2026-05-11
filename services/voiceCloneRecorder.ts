/**
 * voiceCloneRecorder — caregiver-side audio capture for voice cloning.
 *
 * CUSTOMER_FEEDBACK § #5 — caregivers want their child to hear their own
 * voice through the AAC. This service handles the FRONT half of that
 * pipeline: capture clean audio, validate it meets the cloning provider's
 * minimum requirements, and produce a Blob the upload endpoint can post.
 *
 * The cloning provider (ElevenLabs / Inworld TTS-2) integration lives
 * behind the portal endpoint — this service stays provider-agnostic so
 * we can swap providers without touching the UI.
 *
 * Browser-only — uses MediaRecorder + getUserMedia. Imports are lazy
 * via type-only references so SSR doesn't blow up.
 */

/** Minimum seconds of usable audio for a quality voice clone. */
export const MIN_CLONE_SECONDS = 30;
/** Cap to keep upload size reasonable + match provider limits. */
export const MAX_CLONE_SECONDS = 180;

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'error';

export interface RecordingResult {
    blob: Blob;
    durationMs: number;
    mimeType: string;
}

export interface RecorderApi {
    start(): Promise<void>;
    stop(): Promise<RecordingResult>;
    cancel(): void;
    getState(): RecorderState;
    /** Subscribe to state changes — returns disposer. */
    onStateChange(listener: (state: RecorderState) => void): () => void;
    /**
     * Subscribe to elapsed-time ticks (ms) while recording. ~10/sec.
     * Useful for the "X seconds recorded — Y to go" UI.
     */
    onTick(listener: (ms: number) => void): () => void;
}

/**
 * Pick the best supported audio MIME type the browser will produce.
 * Order matters: provider quality + transcoding cost favor opus/webm.
 */
function pickMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ];
    for (const c of candidates) {
        // isTypeSupported is the well-known guard; absence of it means
        // we're in a polyfill / test env, fall through to default.
        if (typeof (MediaRecorder as any).isTypeSupported === 'function'
            && (MediaRecorder as any).isTypeSupported(c)) {
            return c;
        }
    }
    return 'audio/webm';
}

/**
 * Validate a recording result against the cloning provider's minimums.
 * Returns null if OK, or a human-readable reason string if not.
 *
 * Pure function — exported separately so the UI can preview the verdict
 * without committing to the upload.
 */
export function validateRecording(result: RecordingResult): string | null {
    const seconds = result.durationMs / 1000;
    if (seconds < MIN_CLONE_SECONDS) {
        return `Recording is ${seconds.toFixed(0)}s — need at least ${MIN_CLONE_SECONDS}s for a quality clone.`;
    }
    if (seconds > MAX_CLONE_SECONDS) {
        return `Recording is ${seconds.toFixed(0)}s — please keep under ${MAX_CLONE_SECONDS}s.`;
    }
    if (result.blob.size < 16 * 1024) {
        // ~16KB lower bound — anything smaller is silence or a glitch.
        return `Recording is too small (${result.blob.size} bytes) — please re-record.`;
    }
    return null;
}

/**
 * Build a recorder bound to a fresh microphone stream. Returns the API
 * surface the UI uses; caller is responsible for disposing via stop()
 * or cancel() so the mic stream is released.
 *
 * Throws if getUserMedia / MediaRecorder is unavailable. UI should
 * catch and surface a "browser doesn't support recording" message.
 */
export async function createVoiceCloneRecorder(): Promise<RecorderApi> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not available in this browser.');
    }
    if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder API is not available in this browser.');
    }

    const mimeType = pickMimeType();
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    let state: RecorderState = 'idle';
    let startedAt = 0;

    const stateListeners = new Set<(s: RecorderState) => void>();
    const tickListeners = new Set<(ms: number) => void>();
    let tickInterval: ReturnType<typeof setInterval> | null = null;

    const setState = (next: RecorderState) => {
        state = next;
        for (const fn of stateListeners) {
            try { fn(next); } catch { /* swallow */ }
        }
    };

    const releaseStream = () => {
        if (stream) {
            for (const track of stream.getTracks()) {
                try { track.stop(); } catch { /* */ }
            }
            stream = null;
        }
        if (tickInterval) {
            clearInterval(tickInterval);
            tickInterval = null;
        }
    };

    return {
        getState: () => state,
        onStateChange: (fn) => {
            stateListeners.add(fn);
            return () => { stateListeners.delete(fn); };
        },
        onTick: (fn) => {
            tickListeners.add(fn);
            return () => { tickListeners.delete(fn); };
        },
        async start() {
            if (state === 'recording') return;
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // Echo cancellation + noise suppression DRAMATICALLY
                    // improve clone quality — most caregivers record in
                    // home environments with HVAC + child noise. Browser
                    // defaults are usually fine; we set them explicitly
                    // so the recording quality is consistent.
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 44100,
                },
                video: false,
            });
            recorder = new MediaRecorder(stream, { mimeType });
            chunks.length = 0;
            recorder.ondataavailable = (ev) => {
                if (ev.data && ev.data.size > 0) chunks.push(ev.data);
            };
            recorder.onerror = () => {
                setState('error');
                releaseStream();
            };
            recorder.start(100); // 100ms timeslice — keeps chunks small
            startedAt = Date.now();
            setState('recording');
            tickInterval = setInterval(() => {
                const ms = Date.now() - startedAt;
                for (const fn of tickListeners) {
                    try { fn(ms); } catch { /* swallow */ }
                }
                if (ms >= MAX_CLONE_SECONDS * 1000) {
                    // Auto-stop at the cap so we never produce an
                    // unusable over-long blob. UI will see the
                    // 'stopped' transition + a finished result.
                    if (recorder && state === 'recording') {
                        recorder.stop();
                    }
                }
            }, 100);
        },
        stop(): Promise<RecordingResult> {
            return new Promise((resolve, reject) => {
                if (!recorder || state !== 'recording') {
                    return reject(new Error('Recorder is not active.'));
                }
                // M17: guard against onstop never firing (browser bug, device removal)
                const timeoutId = setTimeout(() => {
                    releaseStream();
                    reject(new Error('Recording stop timed out'));
                }, 10_000);

                recorder.onerror = () => {
                    clearTimeout(timeoutId);
                    releaseStream();
                    reject(new Error('Recording error'));
                };

                const handle = () => {
                    clearTimeout(timeoutId);
                    const durationMs = Date.now() - startedAt;
                    const blob = new Blob(chunks, { type: mimeType });
                    setState('stopped');
                    releaseStream();
                    resolve({ blob, durationMs, mimeType });
                };
                recorder.onstop = handle;
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                } else {
                    handle();
                }
            });
        },
        cancel() {
            if (recorder && recorder.state !== 'inactive') {
                try { recorder.stop(); } catch { /* */ }
            }
            chunks.length = 0;
            setState('idle');
            releaseStream();
        },
    };
}
