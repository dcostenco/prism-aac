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
  const voiceRef = useRef<VoiceSession | null>(null);
  const voiceSupported = isVoiceInputSupported();

  useEffect(() => () => { voiceRef.current?.stop(); }, []);

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
      onInterim: () => { /* preview is shown in MessageBar */ },
      onFinal: async (txt) => {
        // Run every final transcript through auto-correction before
        // committing — Web Speech API often mis-segments fast speech
        // ("bowlofrice" → "bowl of rice"). The user with motor or
        // cognitive challenges shouldn't have to clean this up by hand.
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

  // Toolbar labels share the same scale as the keyboard's word-row keys
  // (Speak, Space, Caregiver Notes, etc.) so the chrome reads as one
  // typographic system. Larger labels also help motor-impaired users —
  // bigger hit targets, easier glance-readability.
  const btn =
    'aac-btn w-[clamp(2.75rem,8vw,3.75rem)] h-[clamp(2.75rem,8svh,3.75rem)] rounded-xl surface-key text-primary font-bold text-[clamp(1.25rem,3.5vw,1.75rem)] select-none border border-theme shrink-0 flex items-center justify-center';

  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };

  return (
    <div className="flex items-center justify-between px-2 py-[clamp(0.2rem,0.8svh,0.4rem)] surface-bar shrink-0 border-b border-theme">
      <div className="flex gap-1.5 flex-wrap">
        <button className={btn} onClick={tap(openCategories)} aria-label={t('categories')} title={t('categories')}>📂</button>
        <button className={btn} onClick={tap(openMath)} aria-label={t('math')} title={t('math')}>🔢</button>
        <button className={btn} onClick={tap(openAIChat)} aria-label={t('ai_chat')} title={t('ai_chat')}>✨</button>
        {voiceSupported && (
          <button
            className={`aac-btn w-[clamp(2.75rem,8vw,3.75rem)] h-[clamp(2.75rem,8svh,3.75rem)] rounded-xl font-bold text-[clamp(1.25rem,3.5vw,1.75rem)] select-none border border-theme shrink-0 flex items-center justify-center ${
              listening ? 'bg-[#F44336] text-white border-transparent animate-pulse' : 'surface-key text-primary'
            }`}
            onClick={toggleMic}
            aria-pressed={listening}
            data-testid="toolbar-mic"
            aria-label={listening ? t('stop_voice') : t('start_voice')}
            title={listening ? t('stop_voice') : t('start_voice')}
          >
            {listening ? '⏺' : '🎙'}
          </button>
        )}
        <button className={btn} onClick={tap(openCaregiver)} aria-label={t('notes')} title={t('notes')}>📋</button>
        <button className={btn} onClick={tap(openSchedule)} aria-label={t('schedule')} title={t('schedule')}>📅</button>
        <button className={btn} onClick={tap(openGames)} aria-label={t('games')} title={t('games')}>🎮</button>
        <button className={btn} onClick={tap(openMarketplace)} aria-label={t('marketplace')} title={t('marketplace')}>🏪</button>
      </div>
      <div className="flex gap-1.5 items-center">
        <span className="text-xs text-dim" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
        <button className={btn} onClick={tap(triggerAlert)} aria-label={t('alert')} title={t('alert')}>🚨</button>
        <button className={btn} onClick={tap(toggleHistory)} aria-label={t('history')} title={t('history')}>📜</button>
        <button className={btn} onClick={tap(toggleSettings)} aria-label={t('settings')} title={t('settings')}>⚙️</button>
        <button
          className={`aac-btn w-[clamp(2.75rem,8vw,3.75rem)] h-[clamp(2.75rem,8svh,3.75rem)] rounded-xl font-bold text-[clamp(1.25rem,3.5vw,1.75rem)] select-none border border-theme shrink-0 flex items-center justify-center ${
            soundEnabled ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
          }`}
          onClick={tap(toggleSound)}
          aria-label={soundEnabled ? t('sound_on') : t('sound_off')}
          title={soundEnabled ? t('sound_on') : t('sound_off')}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
