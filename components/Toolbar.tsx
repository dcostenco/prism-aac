'use client';
import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { SupportedLanguage, LANG_META } from '@/engine/i18n';
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
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const updateSettings = useSettingsStore((s) => s.update);
  const syncStatus = useSyncStatus();
  const { t, ttsCode } = useT();
  const [listening, setListening] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState<'input' | 'output' | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const voiceSupported = isVoiceInputSupported();


  useEffect(() => () => { voiceRef.current?.stop(); }, []);
  useEffect(() => {
    if (!showMore && !showLangPicker) return;
    const handler = (e: MouseEvent) => {
      if (showMore && moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
      if (showLangPicker && langRef.current && !langRef.current.contains(e.target as Node)) setShowLangPicker(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showMore, showLangPicker]);

  const toggleMic = () => {
    tapFeedback();
    if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = null; setListening(false); return; }
    const session = startVoiceInput({
      lang: ttsCode,
      onInterim: () => {},
      onFinal: async (txt) => { const fixed = await correctText(txt.trim(), language); appendText((fixed || txt).trim() + ' '); },
      onError: () => { voiceRef.current = null; setListening(false); },
    });
    if (session) { voiceRef.current = session; setListening(true); }
  };

  const btn = 'aac-btn w-[clamp(2.25rem,7vw,3.25rem)] h-[clamp(2.25rem,7svh,3.25rem)] rounded-full surface-key text-primary text-[clamp(1.1rem,3.5vw,1.6rem)] select-none border border-theme shrink-0 flex items-center justify-center';
  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };
  const tapClose = (fn: () => void) => () => { tapFeedback(); setShowMore(false); fn(); };
  const moreBtn = 'aac-btn w-full h-12 rounded-xl surface-key text-primary font-bold text-base select-none border border-theme flex items-center gap-3 px-4';

  return (
    <div className="flex items-center justify-between px-1 py-[clamp(0.1rem,0.3svh,0.25rem)] surface-bar shrink-0 border-b border-theme relative">
      <div className="flex gap-1">
        <button className={btn} onClick={tap(openCategories)} aria-label={t('categories')} title={t('categories')}>📂</button>
        {voiceSupported && (
          <button className={`aac-btn w-[clamp(2.25rem,7vw,3.25rem)] h-[clamp(2.25rem,7svh,3.25rem)] rounded-full text-[clamp(1rem,3.5vw,1.5rem)] select-none border border-theme shrink-0 flex items-center justify-center ${listening ? 'bg-[#F44336] text-white border-transparent animate-pulse' : 'surface-key text-primary'}`}
            onClick={toggleMic} aria-pressed={listening} data-testid="toolbar-mic" aria-label={listening ? t('stop_voice') : t('start_voice')}>
            {listening ? '⏺' : '🎙'}
          </button>
        )}
        <button className={btn} onClick={tap(openSchedule)} aria-label={t('schedule')} title={t('schedule')}>📅</button>
        <button className={btn} onClick={tap(openGames)} aria-label={t('games')} title={t('games')}>🎮</button>
        <button className={btn} onClick={tap(triggerAlert)} aria-label={t('alert')} title={t('alert')}>🚨</button>
      </div>

      {/* Language pair selector */}
      <div ref={langRef} className="flex items-center gap-0.5 relative">
        <button
          className="aac-btn h-[clamp(1.75rem,5svh,2.5rem)] px-[clamp(0.3rem,1vw,0.5rem)] rounded-lg bg-[#2196F3] text-white font-bold text-[clamp(0.6rem,2vw,0.85rem)] uppercase select-none border-none"
          onClick={() => { tapFeedback(); setShowLangPicker(showLangPicker === 'input' ? null : 'input'); }}
        >
          {language}
        </button>
        <span className="text-[clamp(0.5rem,1.5vw,0.7rem)] text-muted">→</span>
        <button
          className={`aac-btn h-[clamp(1.75rem,5svh,2.5rem)] px-[clamp(0.3rem,1vw,0.5rem)] rounded-lg font-bold text-[clamp(0.6rem,2vw,0.85rem)] uppercase select-none border-none ${
            outputLanguage !== language ? 'bg-[#FF9800] text-white' : 'bg-[#4CAF50] text-white'
          }`}
          onClick={() => { tapFeedback(); setShowLangPicker(showLangPicker === 'output' ? null : 'output'); }}
        >
          {outputLanguage}
        </button>

        {showLangPicker && (
          <div className="absolute top-full mt-1 left-0 surface-bar rounded-xl border border-theme shadow-2xl z-50 p-1.5 grid grid-cols-4 gap-1 w-48">
            {LANG_META.map((l) => (
              <button
                key={l.code}
                className={`aac-btn rounded-lg px-1 py-2 text-center font-bold text-sm border border-theme ${
                  (showLangPicker === 'input' ? language : outputLanguage) === l.code
                    ? 'bg-[#4CAF50] text-white border-transparent'
                    : 'surface-key text-primary'
                }`}
                onClick={() => {
                  tapFeedback();
                  if (showLangPicker === 'input') {
                    updateSettings({ language: l.code as SupportedLanguage });
                  } else {
                    updateSettings({ outputLanguage: l.code as SupportedLanguage });
                  }
                  setShowLangPicker(null);
                }}
              >
                <div className="text-[10px] font-bold">{l.nativeName.slice(0, 3)}</div>
                <div className="text-[9px] uppercase mt-0.5 text-muted">{l.code}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 items-center">
        <span className="text-[8px] text-dim" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
        <button className={`aac-btn w-[clamp(2.25rem,7vw,3.25rem)] h-[clamp(2.25rem,7svh,3.25rem)] rounded-full text-[clamp(1rem,3.5vw,1.5rem)] select-none border border-theme shrink-0 flex items-center justify-center ${soundEnabled ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'}`}
          onClick={tap(toggleSound)} aria-label={soundEnabled ? t('sound_on') : t('sound_off')}>
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <button className={btn} onClick={tap(toggleSettings)} aria-label={t('settings')} title={t('settings')}>⚙️</button>
        <div ref={moreRef} className="relative">
          <button className={`${btn} ${showMore ? 'bg-[#2196F3] text-white border-transparent' : ''}`}
            onClick={() => { tapFeedback(); setShowMore(!showMore); }} aria-label="More" aria-expanded={showMore}>⋯</button>
          {showMore && (
            <div className="absolute right-0 top-full mt-1 w-52 surface-bar rounded-2xl border border-theme shadow-2xl z-50 p-1.5 space-y-1">
              <button className={moreBtn} onClick={tapClose(openMath)}>🔢 {t('math')}</button>
              <button className={moreBtn} onClick={tapClose(openAIChat)}>✨ {t('ai_chat')}</button>
              <button className={moreBtn} onClick={tapClose(openCaregiver)}>📋 {t('notes')}</button>
              <button className={moreBtn} onClick={tapClose(openMarketplace)}>🏪 {t('marketplace')}</button>
              <button className={moreBtn} onClick={tapClose(toggleHistory)}>📜 {t('history')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
