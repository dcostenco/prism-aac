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
  const { openCategories, openMath, openCaregiver, openAIChat, toggleHistory, toggleSettings, triggerAlert } = useUIStore();
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
    'aac-btn h-16 max-sm:h-10 landscape:h-7 px-5 max-sm:px-2 landscape:px-1.5 rounded-xl max-sm:rounded-lg landscape:rounded surface-key text-primary font-bold text-xl md:text-2xl max-sm:text-sm landscape:text-[10px] select-none border border-theme shrink-0';

  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };

  return (
    <div className="flex items-center justify-between gap-2 max-sm:gap-1 landscape:gap-0.5 px-3 max-sm:px-1 landscape:px-0.5 py-2 max-sm:py-0.5 landscape:py-0 surface-bar shrink-0 border-b border-theme overflow-x-auto">
      <div className="flex gap-2">
        <button className={btn} onClick={tap(openCategories)} aria-label={t('categories')}>📂 {t('categories')}</button>
        <button className={btn} onClick={tap(openMath)} aria-label={t('math')}>🔢 {t('math')}</button>
        <button className={btn} onClick={tap(openAIChat)} aria-label={t('ai_chat')}>✨ {t('ai_chat')}</button>
        {voiceSupported && (
          <button
            className={`aac-btn h-16 max-sm:h-10 landscape:h-7 px-5 max-sm:px-2 landscape:px-1.5 rounded-xl max-sm:rounded-lg landscape:rounded font-bold text-xl md:text-2xl max-sm:text-sm landscape:text-[10px] select-none border border-theme shrink-0 ${
              listening ? 'bg-[#F44336] text-white border-transparent animate-pulse' : 'surface-key text-primary'
            }`}
            onClick={toggleMic}
            aria-pressed={listening}
            data-testid="toolbar-mic"
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          >
            {listening ? '⏺ Stop' : '🎙 Mic'}
          </button>
        )}
        <button className={btn} onClick={tap(openCaregiver)} aria-label={t('notes')}>📋 {t('notes')}</button>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-dim mr-1" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
        <button className={btn} onClick={tap(triggerAlert)} aria-label={t('alert')}>🚨 {t('alert')}</button>
        <button className={btn} onClick={tap(toggleHistory)} aria-label={t('history')}>📜 {t('history')}</button>
        <button className={btn} onClick={tap(toggleSettings)} aria-label={t('settings')}>⚙️</button>
        <button
          className={`aac-btn h-16 max-sm:h-10 landscape:h-7 px-5 max-sm:px-2 landscape:px-1.5 rounded-xl max-sm:rounded-lg landscape:rounded font-bold text-xl md:text-2xl max-sm:text-sm landscape:text-[10px] select-none border border-theme shrink-0 ${
            soundEnabled ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
          }`}
          onClick={tap(toggleSound)}
          aria-label={soundEnabled ? t('sound_on') : t('sound_off')}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
