'use client';
import { useRef, useEffect } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/engine/useT';

export default function HistoryModal() {
  const { showHistory, toggleHistory } = useUIStore();
  const { history, setText, clearHistory } = useMessageStore();
  const lang = useSettingsStore((s) => s.language);
  const { t } = useT();

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (showHistory) {
      closeButtonRef.current?.focus();
    }
  }, [showHistory]);

  if (!showHistory) return null;

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="history-modal-title" className="modal-backdrop fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={toggleHistory} onKeyDown={(e) => { if (e.key === 'Escape') toggleHistory(); }} tabIndex={-1}>
      <div className="surface-bar rounded-2xl w-full max-w-lg max-h-[80svh] flex flex-col border border-theme shadow-2xl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const focusable = Array.from(
            (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter(el => !el.hasAttribute('disabled'));
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
          } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme">
          <h2 id="history-modal-title" className="text-primary font-bold text-lg">{t('history')}</h2>
          <div className="flex gap-2 items-center">
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-[#F44336] text-sm hover:underline">{t('clear_all')}</button>
            )}
            <button ref={closeButtonRef} onClick={toggleHistory} aria-label={t('close_history')} className="text-muted hover:text-primary text-xl">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {history.length === 0 ? (
            <p className="text-dim text-center py-8">{t('no_history')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((entry) => (
                <button
                  key={`${entry.timestamp}-${entry.text.slice(0, 20)}`}
                  onClick={() => {
                    setText(entry.text);
                    // Clear any stale translation so the restored text is re-translated fresh.
                    // TODO: if a setTranslated action is added to messageStore, call it here.
                    toggleHistory();
                  }}
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
