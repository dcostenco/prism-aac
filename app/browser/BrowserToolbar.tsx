'use client';

import { useCallback, useState } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { PRISM_AAC_BASE_PATH } from '@/lib/appPaths';
import { useBrowserStore, shortDisplay, type PinnedBookmark } from './browserStore';
import { sayOrStop, useBrowserSpeech } from './browserSpeech';

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
  const setSpeakMode = useBrowserStore((s) => s.setSpeakMode);
  const speaking = useBrowserSpeech((s) => s.speaking);

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
    // A raw href skips the Next base path: '/' is the synalux.ai home page, not
    // the AAC board, and the iOS shell has no way back from it.
    window.location.href = PRISM_AAC_BASE_PATH;
  }, []);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  const isPinned = !isHome && pinnedBookmarks.some(
    (b) => shortDisplay(b.url) === shortDisplay(url)
  );

  const btn = 'aac-btn rounded-lg flex items-center justify-center font-bold select-none shrink-0 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1';

  const emptyField = speakMode ? 'Type a message' : 'Search or URL';

  return (
    <div className="shrink-0 surface-key border-b border-theme" data-testid="browser-toolbar">
      {/* Under 768px one row ran off the screen once a site was open (Go, Pin
          and Open in new tab out of reach) and left room for a few letters of
          a message. There the toolbar takes two rows: where you are and the
          mode on top, the field across the width below. From 768px the row
          wrappers dissolve (display: contents) into the one row. DOM order is
          the reading order either way, so Tab and switch scanning match. */}
      <div className="flex flex-col md:flex-row md:items-center gap-1 px-1.5 sm:px-2 py-1.5">
        <div className="flex items-center gap-1 md:contents">
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
          {/* Say or Search, in words. The old muted-speaker emoji read as "sound
              off", so people who came to talk never found Say. The border is on
              the buttons: on the group it made the row 2px taller, which the
              keys paid for on an iPad mini. */}
          <div role="group" aria-label="Say or Search" className="flex shrink-0 max-md:ms-auto">
            {([
              { say: true, label: 'Say', icon: '🔊', testId: 'browser-mode-say', on: 'bg-[#4CAF50] text-white' },
              { say: false, label: 'Search', icon: '🔎', testId: 'browser-mode-search', on: 'bg-blue-600 text-white' },
            ] as const).map((mode) => (
              <button
                key={mode.label}
                onClick={() => setSpeakMode(mode.say)}
                aria-pressed={speakMode === mode.say}
                aria-label={`${mode.label} mode`}
                data-testid={mode.testId}
                className={`aac-btn flex flex-col sm:flex-row items-center justify-center sm:gap-1 min-w-[44px] min-h-[44px] border border-theme first:rounded-l-lg last:rounded-r-lg last:border-l-0 px-1.5 sm:px-2.5 text-[11px] sm:text-sm font-bold leading-tight select-none focus-visible:ring-2 focus-visible:ring-blue-400 ${speakMode === mode.say ? mode.on : 'surface-key text-muted'}`}
              >
                <span aria-hidden className="text-base leading-none">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 md:contents">
          {/* Merged URL bar / composition surface */}
          <button
            onClick={expandKeyboard}
            className="flex-1 h-11 rounded-lg border-2 border-theme surface-input flex items-center px-2 gap-1 text-sm overflow-hidden min-w-[60px] text-left"
            aria-label={speaking ? 'Speaking' : text.trim() ? `Editing: ${text}` : speakMode ? 'Tap to type a message' : 'Tap to type a URL or search'}
          >
            {isLoading && <span className="shrink-0 animate-spin text-xs">⏳</span>}
            {!isLoading && !isHome && url.startsWith('https://') && <span className="text-green-500 shrink-0 text-xs">🔒</span>}
            {speaking ? (
              <span className="truncate font-semibold text-[#2e7d32]" data-testid="browser-speaking">Speaking…</span>
            ) : text.trim() ? (
              <span className="truncate text-primary font-medium">{text}</span>
            ) : (
              <span className="truncate text-muted">{isHome ? emptyField : useBrowserStore.getState().displayUrl || emptyField}</span>
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

          {/* Go searches or opens; Say speaks and never searches, and stops speech
              when pressed again. */}
          {speakMode ? (
            <button
              onClick={() => sayOrStop(text)}
              disabled={!speaking && !text.trim()}
              aria-label={speaking ? 'Stop speaking' : 'Say'}
              data-testid="browser-say-button"
              className={`${btn} px-2 h-10 sm:h-11 text-sm font-extrabold whitespace-nowrap ${speaking ? 'bg-[#c62828] text-white' : text.trim() ? 'bg-[#4CAF50] text-white' : 'surface-key text-muted border border-theme'}`}
            >
              {speaking ? '■ Stop' : 'Say'}
            </button>
          ) : (
            <button
              onClick={handleGo}
              disabled={!text.trim()}
              aria-label="Go"
              className={`${btn} w-12 sm:w-14 h-10 sm:h-11 text-sm font-extrabold ${text.trim() ? 'bg-blue-600 text-white' : 'surface-key text-muted border border-theme'}`}
            >
              Go
            </button>
          )}
        </div>
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
