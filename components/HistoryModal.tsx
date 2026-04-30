'use client';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';

export default function HistoryModal() {
  const { showHistory, toggleHistory } = useUIStore();
  const { history, setText, clearHistory } = useMessageStore();

  if (!showHistory) return null;

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={toggleHistory}>
      <div className="bg-[#1e1e2e] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a3e]">
          <h2 className="text-[#e0e0e0] font-bold text-lg">History</h2>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-[#F44336] text-sm hover:underline">Clear all</button>
            )}
            <button onClick={toggleHistory} className="text-[#888] hover:text-white text-xl">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {history.length === 0 ? (
            <p className="text-[#555] text-center py-8">No history yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => { setText(entry.text); toggleHistory(); }}
                  className="bg-[#2a2a3e] rounded-xl p-3 text-left hover:bg-[#3a3a5e] transition-colors"
                >
                  <p className="text-[#e0e0e0] text-base">{entry.text}</p>
                  <p className="text-[#666] text-xs mt-1">{fmt(entry.timestamp)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
