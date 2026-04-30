'use client';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSyncStatus } from './SyncProvider';
import { tapFeedback } from '@/services/feedback';

const SYNC_ICONS: Record<string, string> = {
  idle: '⬡', syncing: '🔄', synced: '🟢', offline: '🔸', error: '🔴',
};

export default function Toolbar() {
  const { sidePanel, openCategories, openMath, toggleHistory, toggleSettings, triggerAlert } = useUIStore();
  const { soundEnabled, toggleSound } = useMessageStore();
  const syncStatus = useSyncStatus();

  const btn = 'aac-btn h-14 px-5 rounded-xl bg-[#2a2a3e] text-[#e0e0e0] font-semibold text-sm select-none';
  const active = 'bg-[#4CAF50] text-white';

  const tap = (fn: () => void) => () => { tapFeedback(); fn(); };

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#16162a] shrink-0">
      <div className="flex gap-2">
        <button className={`${btn} ${sidePanel === 'categories' || sidePanel === 'category-detail' || sidePanel === 'ordering' ? active : ''}`} onClick={tap(openCategories)} aria-label="Toggle categories panel">📂 Categories</button>
        <button className={`${btn} ${sidePanel === 'math' ? active : ''}`} onClick={tap(openMath)} aria-label="Toggle math panel">🔢 Math</button>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs opacity-60 mr-1" title={`Sync: ${syncStatus}`}>{SYNC_ICONS[syncStatus] ?? '⬡'}</span>
        <button className={btn} onClick={tap(triggerAlert)} aria-label="Send alert">🚨 Alert</button>
        <button className={btn} onClick={tap(toggleHistory)} aria-label="Open history">📜 History</button>
        <button className={btn} onClick={tap(toggleSettings)} aria-label="Open settings">⚙️</button>
        <button className={`${btn} ${soundEnabled ? active : ''}`} onClick={tap(toggleSound)} aria-label={soundEnabled ? 'Sound on' : 'Sound off'}>{soundEnabled ? '🔊' : '🔇'}</button>
      </div>
    </div>
  );
}
