'use client';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/engine/useT';

export default function HistoryModal() {
  const { showHistory, toggleHistory } = useUIStore();
  const { history, setText, clearHistory } = useMessageStore();
  const lang = useSettingsStore((s) => s.language);
  const { t } = useT();

  if (!showHistory) return null;

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div role="dialog" aria-modal="true" className="modal-backdrop fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={toggleHistory}>
      <div className="surface-bar rounded-2xl w-full max-w-lg max-h-[80svh] flex flex-col border border-theme shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme">
          <h2 className="text-primary font-bold text-lg">{t('history')}</h2>
          <div className="flex gap-2 items-center">
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-[#F44336] text-sm hover:underline">{t('clear_all')}</button>
            )}
            <button onClick={toggleHistory} aria-label={t('close_history')} className="text-muted hover:text-primary text-xl">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {history.length === 0 ? (
            <p className="text-dim text-center py-8">{t('no_history')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => { setText(entry.text); toggleHistory(); }}
                  className="surface-key rounded-xl p-3 text-left transition-colors border border-theme"
                >
                  <p className="text-primary text-base">{entry.text}</p>
                  <p className="text-dim text-xs mt-1">{fmt(entry.timestamp)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
