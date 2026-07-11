'use client';

import { useCallback, useState } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useBrowserStore, shortDisplay, type PinnedBookmark } from './browserStore';

export function openBookmark(b: PinnedBookmark, navigate: (url: string) => void) {
  navigate(b.url);
}

export default function BrowserToolbar() {
  const text = useMessageStore((s) => s.text);
  const clearAll = useMessageStore((s) => s.clearAll);

  const url = useBrowserStore((s) => s.url);
  const isLoading = useBrowserStore((s) => s.isLoading);
  const isHome = useBrowserStore((s) => s.isHome);
  const canBack = useBrowserStore((s) => s.canBack);
  const canFwd = useBrowserStore((s) => s.canFwd);
  const showBookmarks = useBrowserStore((s) => s.showBookmarks);
  const pinnedBookmarks = useBrowserStore((s) => s.pinnedBookmarks);
  const editingBookmarks = useBrowserStore((s) => s.editingBookmarks);
  const navigate = useBrowserStore((s) => s.navigate);
  const goBack = useBrowserStore((s) => s.goBack);
  const goFwd = useBrowserStore((s) => s.goFwd);
  const goHome = useBrowserStore((s) => s.goHome);
  const refresh = useBrowserStore((s) => s.refresh);
  const toggleBookmarks = useBrowserStore((s) => s.toggleBookmarks);
  const pinCurrentSite = useBrowserStore((s) => s.pinCurrentSite);
  const unpinBookmark = useBrowserStore((s) => s.unpinBookmark);
  const toggleEditingBookmarks = useBrowserStore((s) => s.toggleEditingBookmarks);
  const expandKeyboard = useBrowserStore((s) => s.expandKeyboard);
  const speakMode = useBrowserStore((s) => s.speakMode);
  const toggleSpeakMode = useBrowserStore((s) => s.toggleSpeakMode);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const handleGo = useCallback(() => {
    const input = text.trim();
    if (!input) return;
    navigate(input);
    clearAll();
  }, [text, navigate, clearAll]);

  const handleBookmark = useCallback((b: PinnedBookmark) => {
    openBookmark(b, navigate);
    clearAll();
  }, [navigate, clearAll]);

  const handleLeaveClick = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveConfirm(false);
    window.location.href = '/';
  }, []);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  const isPinned = !isHome && pinnedBookmarks.some(
    (b) => shortDisplay(b.url) === shortDisplay(url)
  );

  const btn = 'aac-btn rounded-lg flex items-center justify-center font-bold select-none shrink-0 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1';

  return (
    <div className="shrink-0 surface-key border-b border-theme" data-testid="browser-toolbar">
      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5">
        {/* Back to AAC — with confirmation */}
        <button
          onClick={handleLeaveClick}
          aria-label="Back to AAC Board"
          className={`${btn} w-10 sm:w-11 h-10 sm:h-11 bg-purple-700 text-white text-sm font-extrabold`}
        >
          💬
        </button>
        <button onClick={goBack} disabled={!canBack} aria-label="Back" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 ${canBack ? 'text-primary' : 'text-muted opacity-50'}`}>←</button>
        <button onClick={goFwd} disabled={!canFwd} aria-label="Forward" className={`${btn} hidden sm:flex w-11 h-11 ${canFwd ? 'text-primary' : 'text-muted opacity-50'}`}>→</button>
        <button onClick={goHome} aria-label="Home" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-primary`}>🏠</button>
        <button onClick={toggleBookmarks} aria-label="Bookmarks" className={`${btn} hidden sm:flex w-11 h-11 text-primary ${showBookmarks ? 'ring-2 ring-blue-500' : ''}`}>🔖</button>
        <button onClick={toggleSpeakMode} aria-label={speakMode ? 'Switch to Go mode' : 'Switch to Speak mode'} className={`${btn} w-10 sm:w-11 h-10 sm:h-11 ${speakMode ? 'bg-[#4CAF50] text-white' : 'text-muted'}`}>{speakMode ? '🔊' : '🔇'}</button>

        {/* Merged URL bar / composition surface */}
        <button
          onClick={expandKeyboard}
          className="flex-1 h-10 sm:h-11 rounded-lg border-2 border-theme surface-input flex items-center px-2 gap-1 text-sm overflow-hidden min-w-[60px] text-left"
          aria-label={text.trim() ? `Editing: ${text}` : 'Tap to type a URL or search'}
        >
          {isLoading && <span className="shrink-0 animate-spin text-xs">⏳</span>}
          {!isLoading && !isHome && url.startsWith('https://') && <span className="text-green-500 shrink-0 text-xs">🔒</span>}
          {text.trim() ? (
            <span className="truncate text-primary font-medium">{text}</span>
          ) : (
            <span className="truncate text-muted">{isHome ? 'Search or URL' : useBrowserStore.getState().displayUrl || 'Search or URL'}</span>
          )}
        </button>

        {/* Refresh/Stop */}
        {!isHome && (
          isLoading ? (
            <button onClick={goHome} aria-label="Stop" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-red-400`}>✕</button>
          ) : (
            <button onClick={refresh} aria-label="Refresh" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-primary`}>🔄</button>
          )
        )}

        {/* Pin bookmark */}
        {!isHome && !isPinned && (
          <button onClick={pinCurrentSite} aria-label="Pin this site" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-primary`}>☆</button>
        )}
        {!isHome && isPinned && (
          <button onClick={() => unpinBookmark(url)} aria-label="Unpin this site" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-yellow-400`}>★</button>
        )}

        {/* Open in new tab */}
        {!isHome && (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className={`${btn} w-10 sm:w-11 h-10 sm:h-11 text-primary text-sm`}>↗</a>
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
        <div className="flex gap-2 px-2 pb-2 overflow-x-auto scrollbar-thin items-center">
          <div className="shrink-0 w-1" aria-hidden="true" />
          {pinnedBookmarks.map(b => (
            <div key={b.url} className="relative shrink-0">
              <button
                onClick={() => editingBookmarks ? unpinBookmark(b.url) : handleBookmark(b)}
                aria-label={editingBookmarks ? `Remove ${b.title}` : b.title}
                className={`${btn} flex items-center gap-1.5 px-3 py-2.5 rounded-lg surface-key border border-theme text-sm font-semibold whitespace-nowrap ${editingBookmarks ? 'border-red-400' : ''}`}
              >
                {editingBookmarks && <span className="text-red-400 text-xs">✕</span>}
                <span className="text-lg">{b.icon}</span>{b.title}
              </button>
            </div>
          ))}
          <button
            onClick={toggleEditingBookmarks}
            aria-label={editingBookmarks ? 'Done editing' : 'Edit bookmarks'}
            className={`${btn} px-3 py-2.5 rounded-lg text-sm font-semibold ${editingBookmarks ? 'bg-blue-600 text-white' : 'surface-key border border-theme text-muted'}`}
          >
            {editingBookmarks ? 'Done' : 'Edit'}
          </button>
          <div className="shrink-0 w-1" aria-hidden="true" />
        </div>
      )}

      {/* Loading bar */}
      {isLoading && <div className="h-[3px] bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 bg-[length:200%_100%] animate-pulse" />}

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60" role="dialog" aria-label="Leave browser?">
          <div className="surface-bar rounded-2xl p-6 max-w-xs w-full mx-4 border border-theme shadow-xl">
            <h2 className="text-lg font-extrabold text-primary mb-2">Leave Browser?</h2>
            <p className="text-sm text-muted mb-6">Your browsing session will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={handleLeaveCancel}
                autoFocus
                className={`${btn} flex-1 py-3 bg-blue-600 text-white text-base rounded-xl`}
              >
                Stay
              </button>
              <button
                onClick={handleLeaveConfirm}
                className={`${btn} flex-1 py-3 surface-key border border-theme text-primary text-base rounded-xl`}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
