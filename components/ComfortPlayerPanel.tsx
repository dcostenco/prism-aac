'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useComfortPlayerStore, ComfortMediaItem } from '@/store/comfortPlayerStore';
import { saveBlob, getBlobUrl } from '@/services/comfortMediaStorage';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Playback
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentItem = items[currentIndex] ?? null;

  useEffect(() => {
    if (!isPlaying || !currentItem) { setMediaUrl(null); return; }
    let revoke: string | null = null;
    getBlobUrl(currentItem.id).then((url) => {
      if (!url) { next(); return; }
      revoke = url;
      setMediaUrl(url);
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [isPlaying, currentIndex, currentItem]);

  useEffect(() => {
    if (!isPlaying || !currentItem || !mediaUrl) return;
    if (currentItem.type === 'photo') {
      photoTimerRef.current = setTimeout(() => next(), 8000);
      return () => { if (photoTimerRef.current) clearTimeout(photoTimerRef.current); };
    }
  }, [isPlaying, currentIndex, mediaUrl, currentItem]);

  const handleMediaEnded = useCallback(() => { next(); }, []);

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;
        const id = crypto.randomUUID();
        await saveBlob(id, blob);
        addItem({
          id, type: 'audio', label: `Recording ${items.length + 1}`,
          mimeType: 'audio/webm', sizeBytes: blob.size,
          durationMs: recordTime * 1000, createdAt: Date.now(),
        });
        setView('playlist');
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    } catch { /* mic permission denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      let type: ComfortMediaItem['type'] = 'audio';
      if (file.type.startsWith('image/')) type = 'photo';
      else if (file.type.startsWith('video/')) type = 'video';
      await saveBlob(id, file);
      addItem({
        id, type, label: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type, sizeBytes: file.size, createdAt: Date.now(),
      });
    }
    e.target.value = '';
  };

  const typeIcon = (t: string) => t === 'audio' ? '🎙️' : t === 'photo' ? '📷' : '🎬';
  const formatSize = (b: number) => b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  // Fullscreen playback view
  if (isFullscreen && isPlaying && mediaUrl && currentItem) {
    return (
      <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center" onClick={() => setIsFullscreen(false)}>
        {currentItem.type === 'photo' && (
          <img src={mediaUrl} alt={currentItem.label} className="max-w-full max-h-full object-contain" />
        )}
        {currentItem.type === 'video' && (
          <video ref={videoRef} src={mediaUrl} autoPlay onEnded={handleMediaEnded} className="max-w-full max-h-full" />
        )}
        {currentItem.type === 'audio' && (
          <div className="text-center text-white">
            <div className="text-8xl mb-4 animate-pulse">🎵</div>
            <p className="text-2xl">{currentItem.label}</p>
            <audio ref={audioRef} src={mediaUrl} autoPlay onEnded={handleMediaEnded} />
          </div>
        )}
        <button className="absolute top-8 right-8 text-white text-3xl opacity-50" onClick={() => setIsFullscreen(false)}>✕</button>
        <p className="absolute bottom-8 text-white opacity-30 text-sm">Tap anywhere to exit fullscreen</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2 border-b border-theme shrink-0">
        <span className="text-xl">🎧</span>
        <h2 className="font-semibold text-lg flex-1">Comfort Player</h2>
        {items.length > 0 && (
          <>
            <button onClick={() => { tapFeedback(); isPlaying ? pause() : play(); }}
              className="aac-btn w-9 h-9 rounded-lg surface-key text-lg flex items-center justify-center border border-theme"
              aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button onClick={() => { tapFeedback(); setIsFullscreen(true); if (!isPlaying) play(); }}
              className="aac-btn w-9 h-9 rounded-lg surface-key text-lg flex items-center justify-center border border-theme"
              aria-label="Fullscreen">⛶</button>
          </>
        )}
        <button onClick={() => { tapFeedback(); onClose(); }}
          className="aac-btn w-9 h-9 rounded-lg surface-key text-muted text-lg flex items-center justify-center border border-theme"
          aria-label="Close">✕</button>
      </header>

      {/* Now Playing */}
      {isPlaying && currentItem && mediaUrl && (
        <div className="px-4 py-3 border-b border-theme surface-key">
          <p className="text-sm text-muted mb-1">Now Playing</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeIcon(currentItem.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{currentItem.label}</p>
            </div>
            <button onClick={() => { tapFeedback(); next(); }} className="aac-btn px-3 py-1 rounded-lg surface-key border border-theme text-sm">Skip ⏭</button>
          </div>
          {currentItem.type === 'audio' && (
            <audio ref={audioRef} src={mediaUrl} autoPlay onEnded={handleMediaEnded} className="w-full mt-2" controls />
          )}
          {currentItem.type === 'video' && (
            <video ref={videoRef} src={mediaUrl} autoPlay onEnded={handleMediaEnded} className="w-full mt-2 rounded-lg max-h-48" controls />
          )}
          {currentItem.type === 'photo' && (
            <img src={mediaUrl} alt={currentItem.label} className="w-full mt-2 rounded-lg max-h-48 object-contain" />
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {view === 'record' ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className={`text-6xl ${recording ? 'animate-pulse' : ''}`}>🎙️</div>
            {recording ? (
              <>
                <p className="text-2xl font-mono">{Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}</p>
                <button onClick={stopRecording} className="aac-btn px-8 py-3 rounded-xl bg-red-600 text-white text-lg font-semibold">⏹ Stop</button>
              </>
            ) : (
              <>
                <p className="text-muted">Tap to start recording a message</p>
                <button onClick={startRecording} className="aac-btn px-8 py-3 rounded-xl bg-red-500 text-white text-lg font-semibold">⏺ Record</button>
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
              items.map((item, i) => (
                <div key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-theme cursor-pointer ${i === currentIndex && isPlaying ? 'surface-key ring-2 ring-green-500/50' : 'hover:bg-black/5'}`}
                  onClick={() => { tapFeedback(); setIndex(i); }}>
                  <span className="text-2xl">{typeIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted">{item.type} · {formatSize(item.sizeBytes)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); tapFeedback(); removeItem(item.id); }}
                    className="text-muted hover:text-red-500 text-lg px-1" aria-label="Delete">🗑</button>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Add Media Footer */}
      {view === 'playlist' && (
        <div className="shrink-0 px-4 py-3 border-t border-theme flex gap-2">
          <button onClick={() => { tapFeedback(); setView('record'); }}
            className="aac-btn flex-1 py-2 rounded-lg surface-key border border-theme text-sm font-medium">🎙️ Record</button>
          <button onClick={() => { tapFeedback(); fileInputRef.current?.click(); }}
            className="aac-btn flex-1 py-2 rounded-lg surface-key border border-theme text-sm font-medium">📎 Upload</button>
          <input ref={fileInputRef} type="file" accept="audio/*,image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
          {items.length > 0 && (
            <button onClick={() => { tapFeedback(); if (confirm('Delete all media?')) clear(); }}
              className="aac-btn py-2 px-3 rounded-lg surface-key border border-theme text-sm text-muted">🗑</button>
          )}
        </div>
      )}
    </section>
  );
}
