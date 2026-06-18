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
  const triggerAlert = useUIStore((s) => s.triggerAlert);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

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

  const btn = 'aac-btn rounded-lg flex items-center justify-center font-bold select-none shrink-0 min-w-[44px] min-h-[44px]';

  return (
    <div className="shrink-0 surface-key border-b border-theme" data-testid="browser-toolbar">
      {/* Row 1: Navigation + URL */}
      <div className="flex items-center gap-1 px-1.5 py-1">
        <button onClick={goBack} disabled={!canBack} aria-label="Back" className={`${btn} w-10 h-10 ${canBack ? 'text-primary' : 'text-muted opacity-50'}`}>←</button>
        <button onClick={goFwd} disabled={!canFwd} aria-label="Forward" className={`${btn} w-10 h-10 ${canFwd ? 'text-primary' : 'text-muted opacity-50'}`}>→</button>
        <button onClick={goHome} aria-label="Home" className={`${btn} w-10 h-10 text-primary`}>🏠</button>
        <button onClick={toggleBookmarks} aria-label="Bookmarks" className={`${btn} w-10 h-10 text-primary ${showBookmarks ? 'ring-2 ring-blue-500' : ''}`}>🔖</button>

        {/* URL display */}
        <div className="flex-1 h-10 rounded-lg border-2 border-theme surface-input flex items-center px-2 gap-1.5 text-sm text-muted overflow-hidden min-w-0">
          {isLoading && <span className="shrink-0 animate-spin">⏳</span>}
          {!isLoading && displayUrl && <span className="text-green-500 shrink-0">🔒</span>}
          <span className="truncate">{displayUrl || 'Search or enter URL'}</span>
        </div>

        {/* Go/Speak + Mode toggle */}
        <button onClick={handleGo} aria-label={mode === 'url' ? 'Go' : 'Speak'} className={`${btn} px-3 h-10 text-white text-sm font-extrabold ${mode === 'url' ? 'bg-blue-600' : 'bg-green-600'}`}>
          {mode === 'url' ? '🌐 Go' : '▶ Speak'}
        </button>
        <button onClick={toggleMode} aria-label={mode === 'url' ? 'Switch to Speak mode' : 'Switch to Browse mode'} className={`${btn} px-2 h-10 text-[11px] font-bold leading-tight text-center ${mode === 'url' ? 'bg-blue-900/80 text-blue-300 border border-blue-700' : 'bg-green-900/80 text-green-300 border border-green-700'}`}>
          {mode === 'url' ? '🗣\nSpeak' : '🌐\nBrowse'}
        </button>

        {/* SOS + Settings */}
        <button onClick={triggerAlert} aria-label="Emergency" className={`${btn} w-10 h-10 bg-red-600 text-white`}>🚨</button>
        <button onClick={toggleSettings} aria-label="Settings" className={`${btn} w-10 h-10 text-primary`}>⚙️</button>
      </div>

      {/* Bookmarks row */}
      {showBookmarks && (
        <div className="flex gap-2 px-2 pb-1.5 overflow-x-auto">
          {BOOKMARKS.map(b => (
            <button key={b.url} onClick={() => { navigate(b.url); clearAll(); }} aria-label={b.label} className="aac-btn flex items-center gap-1.5 px-3 py-2 rounded-lg surface-key border border-theme text-sm font-semibold select-none whitespace-nowrap min-h-[44px]">
              <span className="text-lg">{b.icon}</span>{b.label}
            </button>
          ))}
          <Link href="/" aria-label="AAC Board" className="aac-btn flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-900/60 border border-purple-600 text-purple-200 text-sm font-semibold select-none whitespace-nowrap min-h-[44px]">
            <span className="text-lg">💬</span>AAC
          </Link>
        </div>
      )}

      {/* Loading bar */}
      {isLoading && <div className="h-[3px] bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 bg-[length:200%_100%] animate-pulse" />}
    </div>
  );
}
