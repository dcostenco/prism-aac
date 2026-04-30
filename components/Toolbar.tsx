'use client';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSyncStatus } from './SyncProvider';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

const SYNC_ICONS: Record<string, string> = {
  idle: '⬡', syncing: '🔄', synced: '🟢', offline: '🔸', error: '🔴',
};

export default function Toolbar() {
  const { openCategories, openMath, openCaregiver, openAIChat, toggleHistory, toggleSettings, triggerAlert } = useUIStore();
  const { soundEnabled, toggleSound } = useMessageStore();
  const syncStatus = useSyncStatus();
  const { t } = useT();

  const btn =
    'aac-btn h-14 px-5 rounded-xl surface-key text-primary font-semibold text-sm select-none border border-theme';

  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };

  return (
    <div className="flex items-center justify-between px-3 py-2 surface-bar shrink-0 border-b border-theme">
      <div className="flex gap-2">
        <button className={btn} onClick={tap(openCategories)} aria-label={t('categories')}>📂 {t('categories')}</button>
        <button className={btn} onClick={tap(openMath)} aria-label={t('math')}>🔢 {t('math')}</button>
        <button className={btn} onClick={tap(openAIChat)} aria-label={t('ai_chat')}>✨ {t('ai_chat')}</button>
        <button className={btn} onClick={tap(openCaregiver)} aria-label={t('notes')}>📋 {t('notes')}</button>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-dim mr-1" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
        <button className={btn} onClick={tap(triggerAlert)} aria-label={t('alert')}>🚨 {t('alert')}</button>
        <button className={btn} onClick={tap(toggleHistory)} aria-label={t('history')}>📜 {t('history')}</button>
        <button className={btn} onClick={tap(toggleSettings)} aria-label={t('settings')}>⚙️</button>
        <button
          className={`aac-btn h-14 px-5 rounded-xl font-semibold text-sm select-none border border-theme ${
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
