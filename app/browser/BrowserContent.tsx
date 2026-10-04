'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBrowserStore } from './browserStore';
import { openBookmark } from './BrowserToolbar';
import { useUIStore } from '@/store/uiStore';

export default function BrowserContent() {
  const isHome = useBrowserStore((s) => s.isHome);
  const url = useBrowserStore((s) => s.url);
  const isLoading = useBrowserStore((s) => s.isLoading);
  const error = useBrowserStore((s) => s.error);
  const navigate = useBrowserStore((s) => s.navigate);
  const setLoaded = useBrowserStore((s) => s.setLoaded);
  const setError = useBrowserStore((s) => s.setError);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (progressRef.current) clearTimeout(progressRef.current);
    setProgressMsg(null);
    setLoaded();
  }, [setLoaded]);

  useEffect(() => {
    if (!url || isHome) return;
    setProgressMsg(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (progressRef.current) clearTimeout(progressRef.current);
    progressRef.current = setTimeout(() => {
      setProgressMsg('Still loading… Some sites block in-app browsing.');
    }, 3000);
    timeoutRef.current = setTimeout(() => {
      setError('This site can’t be shown here. Try opening in a new tab.');
    }, 6000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressRef.current) clearTimeout(progressRef.current);
    };
  }, [url, isHome, iframeKey, setError]);

  const prevUrl = useRef(url);
  useEffect(() => {
    if (url === prevUrl.current && isLoading && !isHome) {
      setIframeKey((k) => k + 1);
    }
    prevUrl.current = url;
  }, [url, isLoading, isHome]);

  const pinnedBookmarks = useBrowserStore((s) => s.pinnedBookmarks);
  const speakMode = useBrowserStore((s) => s.speakMode);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  if (isHome) {
    return (
      <div className="flex-[2] min-h-0 overflow-auto surface-app" data-testid="browser-content">
        {/* Under 500px tall (phones in landscape) Home gets about 58px between
            the toolbar and the keyboard; less padding keeps Settings whole. */}
        <div className="flex flex-col items-center justify-center min-h-full gap-3 p-3 sm:p-4 [@media(max-height:499.98px)]:py-1.5">
          {/* What this is and the way into Settings (voice, size, access
              methods, tiles), in one row at the top: under the tiles, Settings
              sat below the fold on an iPhone SE. On Home only, out of reach of
              a stray tap while browsing. With a caregiver PIN set, Settings
              asks for it first. */}
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-between gap-2">
              <h1 className="flex items-center gap-2 min-w-0 text-lg sm:text-2xl font-extrabold text-primary">
                <span aria-hidden className="text-2xl sm:text-3xl leading-none">🌐</span>
                <span className="truncate">Prism AAC Browser</span>
              </h1>
              <button
                onClick={toggleSettings}
                data-testid="browser-settings-button"
                className="aac-btn shrink-0 flex items-center gap-2 px-4 min-h-[44px] rounded-xl surface-key border border-theme text-sm font-semibold text-primary select-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <span aria-hidden className="text-lg leading-none">⚙</span>
                Settings
              </button>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {speakMode ? 'Type below and tap Say to speak it' : 'Type below and tap Go to search or enter a URL'}
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3 w-full max-w-lg">
            {pinnedBookmarks.map(b => (
              <button
                key={b.url}
                onClick={() => openBookmark(b, navigate)}
                aria-label={b.title}
                className="aac-btn relative flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-xl surface-key border border-theme text-xs sm:text-sm font-semibold select-none min-h-[80px] sm:min-h-[88px] focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <span className="text-2xl sm:text-3xl">{b.icon}</span>
                {b.title}
              </button>
            ))}
          </div>

        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-[2] min-h-0 surface-app flex flex-col items-center justify-center gap-3 p-4" data-testid="browser-content" role="alert">
        <div className="text-3xl">⚠️</div>
        <p className="text-sm font-semibold text-primary text-center">{error}</p>
        <p className="text-xs text-muted text-center max-w-xs">
          Some sites block embedding. You can open this page in a new tab instead.
        </p>
        <div className="flex gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="aac-btn px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold"
          >
            Open in new tab ↗
          </a>
          <button
            onClick={() => useBrowserStore.getState().goHome()}
            className="aac-btn px-4 py-2.5 rounded-lg surface-key border border-theme text-sm font-bold text-primary"
          >
            🏠 Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-[2] min-h-0 relative surface-app" data-testid="browser-content">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60" aria-live="polite">
          <div className="animate-pulse text-muted text-sm">Loading…</div>
          {progressMsg && <div className="text-yellow-400 text-xs text-center px-4">{progressMsg}</div>}
        </div>
      )}
      <iframe
        key={`${url}-${iframeKey}`}
        ref={iframeRef}
        src={url}
        title="Web page"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={() => setError('Failed to load this page.')}
      />
    </div>
  );
}
