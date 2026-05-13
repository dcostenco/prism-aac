'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import {
  useComfortPlayerStore, ComfortMediaItem,
  MAX_ITEMS, MAX_FILE_SIZE, MAX_TOTAL_STORAGE, ALLOWED_MIME_TYPES,
} from '@/store/comfortPlayerStore';
import { saveBlob, getBlob } from '@/services/comfortMediaStorage';
import { tapFeedback } from '@/services/feedback';

export default function ComfortPlayerPanel() {
  const sidePanel = useUIStore((s) => s.sidePanel);
  const closeSidePanel = useUIStore((s) => s.closeSidePanel);
  if (sidePanel !== 'comfort-player') return null;
  return <ComfortPlayerInner onClose={closeSidePanel} />;
}

function ComfortPlayerInner({ onClose }: { onClose: () => void }) {
  const items = useComfortPlayerStore((s) => s.items);
  const isPlaying = useComfortPlayerStore((s) => s.isPlaying);
  const currentIndex = useComfortPlayerStore((s) => s.currentIndex);
  const { addItem, removeItem, play, pause, next, setIndex, clear } = useComfortPlayerStore.getState();

  const [view, setView] = useState<'playlist' | 'record'>('playlist');
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordStartRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentItem = items[currentIndex] ?? null;

  // Load blob URL when item/play state changes
  useEffect(() => {
    if (!isPlaying || !currentItem) { setMediaUrl(null); return; }
    let cancelled = false;
    let url: string | null = null;
    getBlob(currentItem.id).then((blob) => {
      if (cancelled) return;
      if (!blob) { removeItem(currentItem.id); return; }
      url = URL.createObjectURL(blob);
      setMediaUrl(url);
      // Trigger play after URL is set — delayed to ensure DOM has the src
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        setTimeout(playMedia, 100);
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setMediaUrl(null);
    };
  }, [isPlaying, currentIndex, currentItem?.id]);

  // Play media after user gesture — ref tracks pending play
  const pendingPlayRef = useRef(false);
  const playMedia = useCallback(() => {
    const el = videoRef.current || audioRef.current;
    if (el) el.play().catch(() => {});
  }, []);

  // M7: Clear photo timer before setting new one
  useEffect(() => {
    if (!isPlaying || !currentItem || !mediaUrl) return;
    if (currentItem.type === 'photo') {
      if (photoTimerRef.current) clearTimeout(photoTimerRef.current);
      photoTimerRef.current = setTimeout(() => next(), 8000);
      return () => { if (photoTimerRef.current) clearTimeout(photoTimerRef.current); };
    }
  }, [isPlaying, currentIndex, mediaUrl, currentItem?.id]);

  // C4 + C5: Cleanup recording + media on unmount
  useEffect(() => {
    return () => {
      try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
      if (timerRef.current) clearInterval(timerRef.current);
      audioRef.current?.pause();
      videoRef.current?.pause();
      pause();
    };
  }, []);

  // H5: stable ref for next
  const handleMediaEnded = useCallback(() => { next(); }, [next]);

  // M6: Guard against double recording
  const startRecording = async () => {
    if (recording || mediaRecorderRef.current) return;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recordStartRef.current = performance.now();
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream!.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;
        if (blob.size > MAX_FILE_SIZE) { alert('Recording too large (max 100 MB).'); return; }
        const id = crypto.randomUUID();
        const currentItems = useComfortPlayerStore.getState().items;
        if (currentItems.length >= MAX_ITEMS) return;
        const totalUsed = currentItems.reduce((sum, i) => sum + i.sizeBytes, 0);
        if (totalUsed + blob.size > MAX_TOTAL_STORAGE) { alert('Storage full (500 MB max). Remove items first.'); return; }
        // M5: Accurate duration from performance.now
        const durationMs = Math.round(performance.now() - recordStartRef.current);
        try {
          await saveBlob(id, blob);
        } catch (err) {
          // H4: Handle quota exceeded
          const msg = err instanceof DOMException && err.name === 'QuotaExceededError'
            ? 'Storage full. Please remove some items.'
            : 'Failed to save recording.';
          alert(msg);
          return;
        }
        addItem({
          id, type: 'audio', label: `Recording ${currentItems.length + 1}`,
          mimeType: 'audio/webm', sizeBytes: blob.size, durationMs, createdAt: Date.now(),
        });
        setView('playlist');
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    } catch {
      // R3-1: Stop stream tracks if getUserMedia succeeded but MediaRecorder failed
      if (stream) stream.getTracks().forEach((t) => t.stop());
      // L6: Feedback on mic permission denied
      alert('Microphone access is required to record. Please allow microphone access in your browser settings.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // C2 + H1 + H4 + M8: Validate size, type, sanitize label
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    let totalUsed = useComfortPlayerStore.getState().totalBytes();
    for (const file of Array.from(files)) {
      if (useComfortPlayerStore.getState().items.length >= MAX_ITEMS) {
        alert(`Maximum ${MAX_ITEMS} items reached.`); break;
      }
      if (file.size === 0) { alert('Empty file skipped.'); continue; }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        alert(`Unsupported file type: ${file.type || 'unknown'}`); continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large (max 100 MB): ${file.name}`); continue;
      }
      if (totalUsed + file.size > MAX_TOTAL_STORAGE) {
        alert('Storage full (500 MB max). Remove items first.'); break;
      }
      const id = crypto.randomUUID();
      let type: ComfortMediaItem['type'] = 'audio';
      if (file.type.startsWith('image/')) type = 'photo';
      else if (file.type.startsWith('video/')) type = 'video';
      try {
        await saveBlob(id, file);
      } catch (err) {
        const msg = err instanceof DOMException && err.name === 'QuotaExceededError'
          ? 'Storage full. Please remove some items.'
          : 'Failed to save file.';
        alert(msg); break;
      }
      const label = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\s\-().]/g, '').slice(0, 100) || 'Untitled';
      addItem({
        id, type, label,
        mimeType: file.type, sizeBytes: file.size, createdAt: Date.now(),
      });
      totalUsed += file.size;
    }
    e.target.value = '';
  };

  const typeIcon = (t: string) => t === 'audio' ? '🎙️' : t === 'photo' ? '📷' : '🎬';
  const formatSize = (b: number) => b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  // M3: Fullscreen with keyboard dismiss + focus management
  if (isFullscreen && isPlaying && mediaUrl && currentItem) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Fullscreen playback"
        className="fixed inset-0 z-[999] bg-black flex items-center justify-center"
        onClick={() => setIsFullscreen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsFullscreen(false); }}>
        {currentItem.type === 'photo' && (
          <img src={mediaUrl} alt={`Comfort media: ${currentItem.label}`} className="max-w-full max-h-full object-contain" />
        )}
        {currentItem.type === 'video' && (
          <video ref={videoRef} src={mediaUrl} autoPlay playsInline controls onEnded={handleMediaEnded} className="max-w-full max-h-full" />
        )}
        {currentItem.type === 'audio' && (
          <div className="text-center text-white">
            <div className="text-8xl mb-4 animate-pulse">🎵</div>
            <p className="text-2xl">{currentItem.label}</p>
            <audio ref={audioRef} src={mediaUrl} autoPlay playsInline onEnded={handleMediaEnded} />
          </div>
        )}
        {/* L3: Adequate touch target */}
        <button className="absolute top-8 right-8 text-white text-3xl w-12 h-12 flex items-center justify-center opacity-80"
          aria-label="Exit fullscreen" onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}>✕</button>
        <p className="absolute bottom-8 text-white opacity-30 text-sm">Tap anywhere or press Escape to exit</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 px-4 py-2 border-b border-theme shrink-0">
        <span className="text-xl">🎧</span>
        <h2 className="font-semibold text-lg flex-1">Comfort Player</h2>
        {items.length > 0 && (
          <>
            <button onClick={() => { tapFeedback(); if (isPlaying) { pause(); } else { pendingPlayRef.current = true; play(); } }}
              className="aac-btn w-9 h-9 rounded-lg surface-key text-lg flex items-center justify-center border border-theme"
              aria-label={isPlaying ? 'Pause playback' : 'Start playback'}>
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button onClick={() => { tapFeedback(); setIsFullscreen(true); if (!isPlaying) { pendingPlayRef.current = true; play(); } }}
              className="aac-btn w-9 h-9 rounded-lg surface-key text-lg flex items-center justify-center border border-theme"
              aria-label="Fullscreen playback">⛶</button>
          </>
        )}
        <button onClick={() => { tapFeedback(); onClose(); }}
          className="aac-btn w-9 h-9 rounded-lg surface-key text-muted text-lg flex items-center justify-center border border-theme"
          aria-label="Close comfort player">✕</button>
      </header>

      {/* Now Playing bar */}
      {isPlaying && currentItem && mediaUrl && (
        <div className="px-4 py-2 border-b border-theme surface-key shrink-0" aria-live="polite" aria-atomic="true">
          <div className="flex items-center gap-3">
            <span className="text-lg">{typeIcon(currentItem.type)}</span>
            <p className="font-medium truncate flex-1 text-sm">{currentItem.label}</p>
            <button onClick={() => { tapFeedback(); next(); }} className="aac-btn px-3 py-1 rounded-lg surface-key border border-theme text-sm"
              aria-label="Skip to next item">Skip ⏭</button>
          </div>
        </div>
      )}

      {/* Media playback area — fills available space */}
      {isPlaying && currentItem && mediaUrl && (currentItem.type === 'video' || currentItem.type === 'photo') && (
        <div className="flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden">
          {currentItem.type === 'video' && (
            <video ref={videoRef} src={mediaUrl} autoPlay playsInline onEnded={handleMediaEnded}
              className="w-full h-full object-contain" controls />
          )}
          {currentItem.type === 'photo' && (
            <img src={mediaUrl} alt={`Comfort media: ${currentItem.label}`}
              className="w-full h-full object-contain" />
          )}
        </div>
      )}

      {/* Audio player — compact, leaves room for playlist */}
      {isPlaying && currentItem && mediaUrl && currentItem.type === 'audio' && (
        <div className="px-4 py-3 shrink-0">
          <audio ref={audioRef} src={mediaUrl} autoPlay playsInline onEnded={handleMediaEnded} className="w-full" controls />
        </div>
      )}

      <div className={`${isPlaying && currentItem && mediaUrl && (currentItem.type === 'video' || currentItem.type === 'photo') ? 'hidden' : 'flex-1'} overflow-y-auto p-4 space-y-2 min-h-0`}>
        {view === 'record' ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className={`text-6xl ${recording ? 'animate-pulse' : ''}`}>🎙️</div>
            {recording ? (
              <>
                <p className="text-2xl font-mono">{Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}</p>
                <button onClick={stopRecording} className="aac-btn px-8 py-3 rounded-xl bg-red-600 text-white text-lg font-semibold"
                  aria-label="Stop recording">⏹ Stop</button>
              </>
            ) : (
              <>
                <p className="text-muted">Tap to start recording a message</p>
                <button onClick={startRecording} className="aac-btn px-8 py-3 rounded-xl bg-red-500 text-white text-lg font-semibold"
                  aria-label="Start recording">⏺ Record</button>
                <button onClick={() => setView('playlist')} className="text-muted text-sm mt-2">← Back to playlist</button>
              </>
            )}
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted">
                <span className="text-5xl">🎧</span>
                <p className="text-lg font-medium">Comfort Player</p>
                <p className="text-sm opacity-70 max-w-xs">Record voice messages, upload photos and videos for your loved one. They loop continuously at the bedside.</p>
              </div>
            ) : (
              // M2: Keyboard-accessible playlist items
              items.map((item, i) => (
                <div key={item.id} role="button" tabIndex={0}
                  aria-label={`Play ${item.label}, ${item.type}, ${formatSize(item.sizeBytes)}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapFeedback(); setIndex(i); }}}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-theme cursor-pointer ${i === currentIndex && isPlaying ? 'surface-key ring-2 ring-green-500/50' : 'hover:bg-black/5'}`}
                  onClick={() => { tapFeedback(); pendingPlayRef.current = true; setIndex(i); }}>
                  <span className="text-2xl">{typeIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted">{item.type} · {formatSize(item.sizeBytes)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); tapFeedback(); removeItem(item.id); }}
                    className="text-muted hover:text-red-500 text-lg px-1" aria-label={`Delete ${item.label}`}>🗑</button>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* M4: In-app clear confirmation instead of confirm() */}
      {view === 'playlist' && (
        <div className="shrink-0 px-4 py-3 border-t border-theme">
          {showClearConfirm ? (
            <div className="flex gap-2 items-center">
              <p className="flex-1 text-sm text-muted">Delete all media?</p>
              <button onClick={() => { clear(); setShowClearConfirm(false); }}
                className="aac-btn px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium">Yes, delete all</button>
              <button onClick={() => setShowClearConfirm(false)}
                className="aac-btn px-4 py-2 rounded-lg surface-key border border-theme text-sm">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { tapFeedback(); setView('record'); }}
                className="aac-btn flex-1 py-2 rounded-lg surface-key border border-theme text-sm font-medium">🎙️ Record</button>
              <button onClick={() => { tapFeedback(); fileInputRef.current?.click(); }}
                className="aac-btn flex-1 py-2 rounded-lg surface-key border border-theme text-sm font-medium">📎 Upload</button>
              <input ref={fileInputRef} type="file" accept="audio/*,image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
              {items.length > 0 && (
                <button onClick={() => { tapFeedback(); setShowClearConfirm(true); }}
                  className="aac-btn py-2 px-3 rounded-lg surface-key border border-theme text-sm text-muted"
                  aria-label="Delete all media">🗑</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
