'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useT } from '@/engine/useT';
import { tapFeedback } from '@/services/feedback';

/**
 * Music Composer (Voice Recorder) — Phase 5 marketplace module.
 *
 * Records short audio clips via the browser MediaRecorder API and lets a
 * caregiver / SLP attach them to AAC phrases. Produces WebM/Opus blobs
 * (universal in Chromium / Firefox / Safari 14.1+) with a fallback to MP4
 * on the safety path so older Safari builds also work.
 *
 * Scope (MVP):
 *   - One-tap record / stop with running timer
 *   - Waveform-style audio level meter while recording (basic — no canvas
 *     post-processing; we read from an AnalyserNode and render bars)
 *   - Playback before save (audio element, scrubbable)
 *   - Phrase label that sanitizes to a download filename
 *   - Save → triggers a download of the recorded clip
 *
 * Permission flow: getUserMedia is requested on Record press. If the user
 * denies, the panel shows a one-line guidance message and lets the user
 * retry without reloading.
 */

const MAX_DURATION_S = 60;          // bound clip length so we don't OOM the page
const METER_BARS = 24;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] as const;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

function formatDuration(s: number): string {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section
      aria-label={t('mp_music_composer')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {children}
    </section>
  );
}

interface RecordedClip {
  blob: Blob;
  url: string;
  durationMs: number;
  mime: string;
}

export default function MusicComposerPanel() {
  const { t } = useT();
  const sidePanel = useUIStore((s) => s.sidePanel);
  const closeSidePanel = useUIStore((s) => s.closeSidePanel);

  const [phraseLabel, setPhraseLabel] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [meterLevels, setMeterLevels] = useState<number[]>(new Array(METER_BARS).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<RecordedClip | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const startTsRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount or when the user closes the panel.
  useEffect(() => () => stopAndCleanup(), []);

  function stopAndCleanup() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { void audioCtxRef.current.close(); } catch { /* */ }
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }

  if (sidePanel !== 'music-composer') return null;

  const handleStart = async () => {
    if (recording) return;
    tapFeedback();
    setError(null);

    const mime = pickMime();
    if (!mime) {
      setError(t('mc_no_recorder'));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('mc_no_mic_api'));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(t('mc_mic_denied'));
      void e;
      return;
    }
    streamRef.current = stream;

    // Audio level meter via AnalyserNode.
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const bars: number[] = [];
      const step = Math.floor(buf.length / METER_BARS);
      for (let i = 0; i < METER_BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += buf[i * step + j] ?? 0;
        bars.push(sum / step / 255);
      }
      setMeterLevels(bars);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // MediaRecorder.
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      const durationMs = Date.now() - startTsRef.current;
      setClip({ blob, url, durationMs, mime });
      stopAndCleanup();
      setRecording(false);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    startTsRef.current = Date.now();
    setRecording(true);
    setElapsedMs(0);
    setClip(null);

    tickRef.current = setInterval(() => {
      const e = Date.now() - startTsRef.current;
      setElapsedMs(e);
      if (e >= MAX_DURATION_S * 1000) handleStop();
    }, 100);
  };

  const handleStop = () => {
    tapFeedback();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleReset = () => {
    tapFeedback();
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setElapsedMs(0);
  };

  const handleSave = () => {
    if (!clip) return;
    tapFeedback();
    const ext = clip.mime.includes('mp4') ? 'm4a' : 'webm';
    const safe = (phraseLabel.trim() || 'recording').replace(/[^a-z0-9-_]/gi, '_').slice(0, 40);
    const link = document.createElement('a');
    link.href = clip.url;
    link.download = `${safe || 'recording'}.${ext}`;
    link.click();
  };

  return (
    <PanelShell>
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-2xl md:text-3xl">🎵 {t('mp_music_composer')}</span>
        <button
          onClick={() => { tapFeedback(); stopAndCleanup(); closeSidePanel(); }}
          aria-label={t('close_panel')}
          className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <p className="text-muted text-sm">{t('mc_intro')}</p>

        <div className="flex flex-col gap-2">
          <label htmlFor="mc-phrase" className="text-muted text-sm font-bold">{t('pe_phrase_label')}</label>
          <input
            id="mc-phrase"
            type="text"
            data-testid="mc-phrase-input"
            value={phraseLabel}
            onChange={(e) => setPhraseLabel(e.target.value)}
            placeholder={t('pe_phrase_placeholder')}
            className="surface-key border border-theme rounded-xl px-3 py-2 text-primary text-base"
          />
        </div>

        {/* Level meter — animated while recording */}
        <div
          className="surface-key border-2 border-theme rounded-2xl p-3 flex items-end justify-around gap-1 mx-auto w-full max-w-md h-32"
          data-testid="mc-meter"
          role="meter"
          aria-label={t('mc_level_meter')}
          aria-valuenow={Math.round((meterLevels.reduce((a, b) => a + b, 0) / METER_BARS) * 100)}
        >
          {meterLevels.map((lvl, i) => (
            <span
              key={i}
              className="block rounded-sm transition-all"
              style={{
                width: 8,
                height: `${Math.max(4, lvl * 100)}%`,
                background: recording ? `hsl(${120 - lvl * 120}, 90%, 55%)` : '#9E9E9E',
              }}
            />
          ))}
        </div>

        <div className="text-center text-3xl font-mono text-primary" data-testid="mc-timer">
          {formatDuration(elapsedMs / 1000)} <span className="text-muted text-sm">/ {formatDuration(MAX_DURATION_S)}</span>
        </div>

        {error && (
          <div role="alert" className="bg-[#FFEBEE] dark:bg-[#3a1a1a] text-[#C62828] dark:text-[#FF5252] border border-[#EF9A9A] rounded-xl p-3 text-sm" data-testid="mc-error">
            {error}
          </div>
        )}

        {/* Record / stop / reset buttons */}
        <div className="flex items-center gap-2">
          {!recording && !clip && (
            <button
              data-testid="mc-record"
              onClick={() => { void handleStart(); }}
              className="aac-btn flex-1 min-h-[64px] rounded-xl bg-[#E53935] text-white font-bold text-base border border-[#E53935]"
            >
              ⏺ {t('mc_record')}
            </button>
          )}
          {recording && (
            <button
              data-testid="mc-stop"
              onClick={handleStop}
              className="aac-btn flex-1 min-h-[64px] rounded-xl bg-[#212121] text-white font-bold text-base border border-[#212121] animate-pulse"
            >
              ⏹ {t('mc_stop')}
            </button>
          )}
          {clip && !recording && (
            <button
              data-testid="mc-rerecord"
              onClick={handleReset}
              className="aac-btn flex-1 min-h-[56px] rounded-xl surface-key text-primary font-bold text-base border border-theme"
            >
              ↻ {t('mc_rerecord')}
            </button>
          )}
        </div>

        {/* Playback */}
        {clip && !recording && (
          <div className="flex flex-col gap-2" data-testid="mc-clip">
            <p className="text-muted text-sm">{t('mc_recorded')} ({formatDuration(clip.durationMs / 1000)})</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              src={clip.url}
              controls
              className="w-full"
              data-testid="mc-audio"
            />
            <button
              data-testid="mc-save"
              onClick={handleSave}
              className="aac-btn min-h-[56px] rounded-xl bg-[#43A047] text-white font-bold text-base border border-[#43A047]"
            >
              💾 {t('mc_save')}
            </button>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
