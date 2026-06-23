'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useMessageStore } from '@/store/messageStore';
import { useBrowserStore } from './browserStore';

const BOOKMARKS = [
  { label: 'Google', url: 'https://www.google.com/webhp?igu=1', icon: '🔍' },
  { label: 'YouTube', url: 'https://m.youtube.com', icon: '▶️' },
  { label: 'Wikipedia', url: 'https://m.wikipedia.org', icon: '📚' },
  { label: 'Gmail', url: 'https://mail.google.com', icon: '📧', external: true },
  { label: 'News', url: 'https://news.google.com', icon: '📰' },
  { label: 'Maps', url: 'https://maps.google.com', icon: '🗺️', external: true },
];

export { BOOKMARKS };

export default function BrowserToolbar() {
  const text = useMessageStore((s) => s.text);
  const clearAll = useMessageStore((s) => s.clearAll);

  const url = useBrowserStore((s) => s.url);
  const displayUrl = useBrowserStore((s) => s.displayUrl);
  const isLoading = useBrowserStore((s) => s.isLoading);
  const isHome = useBrowserStore((s) => s.isHome);
  const canBack = useBrowserStore((s) => s.canBack);
  const canFwd = useBrowserStore((s) => s.canFwd);
  const showBookmarks = useBrowserStore((s) => s.showBookmarks);
  const navigate = useBrowserStore((s) => s.navigate);
  const goBack = useBrowserStore((s) => s.goBack);
  const goFwd = useBrowserStore((s) => s.goFwd);
  const goHome = useBrowserStore((s) => s.goHome);
  const refresh = useBrowserStore((s) => s.refresh);
  const setError = useBrowserStore((s) => s.setError);
  const toggleBookmarks = useBrowserStore((s) => s.toggleBookmarks);

  const handleGo = useCallback(() => {
    const input = text.trim();
    if (!input) return;
    navigate(input);
    clearAll();
  }, [text, navigate, clearAll]);

  const handleBookmark = useCallback((b: typeof BOOKMARKS[number]) => {
    if ('external' in b && b.external) {
      window.open(b.url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(b.url);
    }
    clearAll();
  }, [navigate, clearAll]);

  const btn = 'aac-btn rounded-lg flex items-center justify-center font-bold select-none shrink-0 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1';

  return (
    <div className="shrink-0 surface-key border-b border-theme" data-testid="browser-toolbar">
      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5">
        <Link href="/" aria-label="Back to AAC Board" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 bg-purple-700 text-white text-sm font-extrabold`}>
          💬
        </Link>
        <button onClick={goBack} disabled={!canBack} aria-label="Back" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 ${canBack ? 'text-primary' : 'text-muted opacity-50'}`}>←</button>
        {/* Forward + Bookmarks: hidden on very small screens */}
        <button onClick={goFwd} disabled={!canFwd} aria-label="Forward" className={`${btn} hidden sm:flex w-11 h-11 ${canFwd ? 'text-primary' : 'text-muted opacity-50'}`}>→</button>
        <button onClick={goHome} aria-label="Home" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-primary`}>🏠</button>
        <button onClick={toggleBookmarks} aria-label="Bookmarks" className={`${btn} hidden sm:flex w-11 h-11 text-primary ${showBookmarks ? 'ring-2 ring-blue-500' : ''}`}>🔖</button>

        {/* URL bar */}
        <div className="flex-1 h-10 sm:h-11 rounded-lg border-2 border-theme surface-input flex items-center px-2 gap-1 text-sm text-muted overflow-hidden min-w-[60px]">
          {isLoading && <span className="shrink-0 animate-spin text-xs">⏳</span>}
          {!isLoading && displayUrl && <span className="text-green-500 shrink-0 text-xs">🔒</span>}
          <span className="truncate" aria-live="polite">{displayUrl || 'Search or URL'}</span>
        </div>

        {/* Refresh/Stop — visible only when browsing */}
        {!isHome && (
          isLoading ? (
            <button onClick={() => setError('Loading cancelled.')} aria-label="Stop" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-red-400`}>✕</button>
          ) : (
            <button onClick={refresh} aria-label="Refresh" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-primary`}>🔄</button>
          )
        )}

        {/* Open external — only on wider screens or when browsing */}
        {!isHome && (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className={`${btn} hidden sm:flex w-11 h-11 text-primary text-sm`}>↗</a>
        )}

        {/* Go */}
        <button
          onClick={handleGo}
          disabled={!text.trim()}
          aria-label="Go"
          className={`${btn} w-12 sm:w-14 h-10 sm:h-11 text-sm font-extrabold ${text.trim() ? 'bg-blue-600 text-white' : 'surface-key text-muted border border-theme'}`}
        >
          Go
        </button>
      </div>

      {/* Bookmarks row */}
      {showBookmarks && (
        <div className="flex gap-2 px-2 pb-2 overflow-x-auto scrollbar-thin">
          <div className="shrink-0 w-1" aria-hidden="true" />
          {BOOKMARKS.map(b => (
            <button
              key={b.url}
              onClick={() => handleBookmark(b)}
              aria-label={`${b.label}${'external' in b && b.external ? ' (opens in new tab)' : ''}`}
              className={`${btn} flex items-center gap-1.5 px-3 py-2.5 rounded-lg surface-key border border-theme text-sm font-semibold whitespace-nowrap`}
            >
              <span className="text-lg">{b.icon}</span>{b.label}{'external' in b && b.external ? ' ↗' : ''}
            </button>
          ))}
          <div className="shrink-0 w-1" aria-hidden="true" />
        </div>
      )}

      {/* Loading bar */}
      {isLoading && <div className="h-[3px] bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 bg-[length:200%_100%] animate-pulse" />}
    </div>
  );
}
