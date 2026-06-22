'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { useT } from '@/engine/useT';
import { aacSpeak } from '@/services/aacSpeak';
import { useBrowserStore } from './browserStore';

const BOOKMARKS = [
  { label: 'Google', url: 'https://www.google.com/webhp?igu=1', icon: '🔍' },
  { label: 'YouTube', url: 'https://m.youtube.com', icon: '▶️' },
  { label: 'Wikipedia', url: 'https://m.wikipedia.org', icon: '📚' },
  { label: 'Gmail', url: 'https://mail.google.com', icon: '📧' },
  { label: 'News', url: 'https://news.google.com', icon: '📰' },
  { label: 'Maps', url: 'https://maps.google.com', icon: '🗺️' },
];

export { BOOKMARKS };

export default function BrowserToolbar() {
  const { t } = useT();
  const text = useMessageStore((s) => s.text);
  const clearAll = useMessageStore((s) => s.clearAll);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const speechVolume = useSettingsStore((s) => s.speechVolume);

  const mode = useBrowserStore((s) => s.mode);
  const displayUrl = useBrowserStore((s) => s.displayUrl);
  const isLoading = useBrowserStore((s) => s.isLoading);
  const canBack = useBrowserStore((s) => s.canBack);
  const canFwd = useBrowserStore((s) => s.canFwd);
  const showBookmarks = useBrowserStore((s) => s.showBookmarks);
  const navigate = useBrowserStore((s) => s.navigate);
  const goBack = useBrowserStore((s) => s.goBack);
  const goFwd = useBrowserStore((s) => s.goFwd);
  const goHome = useBrowserStore((s) => s.goHome);
  const toggleBookmarks = useBrowserStore((s) => s.toggleBookmarks);
  const toggleMode = useBrowserStore((s) => s.toggleMode);

  const handleGo = useCallback(() => {
    const input = text.trim();
    if (!input) return;
    if (mode === 'url') {
      navigate(input);
      clearAll();
    } else {
      useMessageStore.getState().addToHistory(input);
      aacSpeak(input, speechRate, speechVolume);
    }
  }, [text, mode, navigate, clearAll, speechRate, speechVolume]);

  const btn = 'aac-btn rounded-lg flex items-center justify-center font-bold select-none shrink-0 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1';

  return (
    <div className="shrink-0 surface-key border-b border-theme" data-testid="browser-toolbar">
      {/* Row 1: Nav + URL + Action */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button onClick={goBack} disabled={!canBack} aria-label="Back" className={`${btn} w-11 h-11 ${canBack ? 'text-primary' : 'text-muted opacity-50'}`}>←</button>
        <button onClick={goFwd} disabled={!canFwd} aria-label="Forward" className={`${btn} w-11 h-11 ${canFwd ? 'text-primary' : 'text-muted opacity-50'}`}>→</button>
        <button onClick={goHome} aria-label="Home" className={`${btn} w-11 h-11 text-primary`}>🏠</button>
        <button onClick={toggleBookmarks} aria-label="Bookmarks" className={`${btn} w-11 h-11 text-primary ${showBookmarks ? 'ring-2 ring-blue-500' : ''}`}>🔖</button>

        {/* URL display */}
        <div className="flex-1 h-11 rounded-lg border-2 border-theme surface-input flex items-center px-2.5 gap-1.5 text-sm text-muted overflow-hidden min-w-0">
          {isLoading && <span className="shrink-0 animate-spin">⏳</span>}
          {!isLoading && displayUrl && <span className="text-green-500 shrink-0">🔒</span>}
          <span className="truncate">{displayUrl || 'Search or enter URL'}</span>
        </div>
      </div>

      {/* Row 2: Mode toggle + Go (Browse mode only — Speak mode uses MessageBar ▶) */}
      <div className="flex items-center gap-1.5 px-2 pb-1.5">
        <button onClick={toggleMode} aria-label={mode === 'url' ? 'Switch to Speak mode' : 'Switch to Browse mode'} className={`${btn} px-4 h-11 text-sm font-extrabold ${mode === 'url' ? 'bg-blue-900/80 text-blue-300 border border-blue-700' : 'bg-green-900/80 text-green-300 border border-green-700'}`}>
          {mode === 'url' ? '▶ Speak' : '🌐 Browse'}
        </button>
        {mode === 'url' && (
          <button onClick={handleGo} aria-label="Go" className={`${btn} flex-1 h-11 text-white text-base font-extrabold bg-blue-600`}>
            Go
          </button>
        )}
      </div>

      {/* Bookmarks row */}
      {showBookmarks && (
        <div className="flex gap-2 px-2 pb-2 overflow-x-auto scrollbar-thin">
          <div className="shrink-0 w-1" aria-hidden="true" />
          {BOOKMARKS.map(b => (
            <button key={b.url} onClick={() => { navigate(b.url); clearAll(); }} aria-label={b.label} className={`${btn} flex items-center gap-1.5 px-3 py-2.5 rounded-lg surface-key border border-theme text-sm font-semibold whitespace-nowrap`}>
              <span className="text-lg">{b.icon}</span>{b.label}
            </button>
          ))}
          <Link href="/" aria-label="AAC Board" className={`${btn} flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-purple-900/60 border border-purple-600 text-purple-200 text-sm font-semibold whitespace-nowrap`}>
            <span className="text-lg">💬</span>AAC
          </Link>
          <div className="shrink-0 w-1" aria-hidden="true" />
        </div>
      )}

      {/* Loading bar */}
      {isLoading && <div className="h-[3px] bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 bg-[length:200%_100%] animate-pulse" />}
    </div>
  );
}
