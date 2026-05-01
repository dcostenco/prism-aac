'use client';
import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSyncStatus } from './SyncProvider';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { isVoiceInputSupported, startVoiceInput, VoiceSession } from '@/services/voiceInputService';
import { correctText } from '@/services/textCorrectService';

const SYNC_ICONS: Record<string, string> = {
  idle: '⬡', syncing: '🔄', synced: '🟢', offline: '🔸', error: '🔴',
};

export default function Toolbar() {
  const { openCategories, openMath, openCaregiver, openAIChat, openSchedule, openGames, openMarketplace, toggleHistory, toggleSettings, triggerAlert } = useUIStore();
  const { soundEnabled, toggleSound, appendText } = useMessageStore();
  const language = useSettingsStore((s) => s.language);
  const syncStatus = useSyncStatus();
  const { t } = useT();
  const [listening, setListening] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const voiceSupported = isVoiceInputSupported();

  useEffect(() => () => { voiceRef.current?.stop(); }, []);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showMore]);

  const toggleMic = () => {
    tapFeedback();
    if (voiceRef.current) {
      voiceRef.current.stop();
      voiceRef.current = null;
      setListening(false);
      return;
    }
    const session = startVoiceInput({
      lang: language,
      onInterim: () => {},
      onFinal: async (txt) => {
        const fixed = await correctText(txt.trim(), language);
        appendText((fixed || txt).trim() + ' ');
      },
      onError: () => {
        voiceRef.current = null;
        setListening(false);
      },
    });
    if (session) {
      voiceRef.current = session;
      setListening(true);
    }
  };

  const btn = 'aac-btn w-[clamp(2.75rem,9vw,3.5rem)] h-[clamp(2.75rem,7svh,3.5rem)] rounded-xl surface-key text-primary font-bold text-[clamp(1.25rem,4vw,1.75rem)] select-none border border-theme shrink-0 flex items-center justify-center';
  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };
  const tapClose = (fn: () => void) => () => { tapFeedback(); setShowMore(false); fn(); };

  const moreBtn = 'aac-btn w-full h-14 rounded-xl surface-key text-primary font-bold text-lg select-none border border-theme flex items-center gap-3 px-4';

  return (
    <div className="flex items-center justify-between px-1.5 py-[clamp(0.15rem,0.5svh,0.3rem)] surface-bar shrink-0 border-b border-theme relative">
      {/* Primary icons — always visible */}
      <div className="flex gap-1">
        <button className={btn} onClick={tap(openCategories)} aria-label={t('categories')} title={t('categories')}>📂</button>
        {voiceSupported && (
          <button
            className={`aac-btn w-[clamp(2.75rem,9vw,3.5rem)] h-[clamp(2.75rem,7svh,3.5rem)] rounded-xl font-bold text-[clamp(1.25rem,4vw,1.75rem)] select-none border border-theme shrink-0 flex items-center justify-center ${
              listening ? 'bg-[#F44336] text-white border-transparent animate-pulse' : 'surface-key text-primary'
            }`}
            onClick={toggleMic}
            aria-pressed={listening}
            data-testid="toolbar-mic"
            aria-label={listening ? t('stop_voice') : t('start_voice')}
          >
            {listening ? '⏺' : '🎙'}
          </button>
        )}
        <button className={btn} onClick={tap(openSchedule)} aria-label={t('schedule')} title={t('schedule')}>📅</button>
        <button className={btn} onClick={tap(openGames)} aria-label={t('games')} title={t('games')}>🎮</button>
        <button className={btn} onClick={tap(triggerAlert)} aria-label={t('alert')} title={t('alert')}>🚨</button>
      </div>

      {/* Right side — essential + More dropdown */}
      <div className="flex gap-1 items-center">
        <span className="text-[10px] text-dim" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
        <button
          className={`aac-btn w-[clamp(2.75rem,9vw,3.5rem)] h-[clamp(2.75rem,7svh,3.5rem)] rounded-xl font-bold text-[clamp(1.25rem,4vw,1.75rem)] select-none border border-theme shrink-0 flex items-center justify-center ${
            soundEnabled ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
          }`}
          onClick={tap(toggleSound)}
          aria-label={soundEnabled ? t('sound_on') : t('sound_off')}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <button className={btn} onClick={tap(toggleSettings)} aria-label={t('settings')} title={t('settings')}>⚙️</button>

        {/* More menu button */}
        <div ref={moreRef} className="relative">
          <button
            className={`${btn} ${showMore ? 'bg-[#2196F3] text-white border-transparent' : ''}`}
            onClick={() => { tapFeedback(); setShowMore(!showMore); }}
            aria-label="More"
            aria-expanded={showMore}
          >
            ⋯
          </button>

          {showMore && (
            <div className="absolute right-0 top-full mt-1 w-56 surface-bar rounded-2xl border border-theme shadow-2xl z-50 p-2 space-y-1">
              <button className={moreBtn} onClick={tapClose(openMath)}>🔢 <span>{t('math')}</span></button>
              <button className={moreBtn} onClick={tapClose(openAIChat)}>✨ <span>{t('ai_chat')}</span></button>
              <button className={moreBtn} onClick={tapClose(openCaregiver)}>📋 <span>{t('notes')}</span></button>
              <button className={moreBtn} onClick={tapClose(openMarketplace)}>🏪 <span>{t('marketplace')}</span></button>
              <button className={moreBtn} onClick={tapClose(toggleHistory)}>📜 <span>{t('history')}</span></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
