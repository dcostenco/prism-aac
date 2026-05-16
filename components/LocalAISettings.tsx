'use client';
import { useEffect, useState, useRef } from 'react';

interface ModelInfo {
  id: string;
  label: string;
  tag: string;
  size: string;
  ram: string;
  tier: string;
  description: string;
}

const MODELS: ModelInfo[] = [
  {
    id: '1b7',
    label: 'Prism 1.7B — Fast',
    tag: 'dcostenco/prism-coder:1b7',
    size: '1.1 GB',
    ram: '~2 GB',
    tier: 'Free tier · ~0.5s · 100% BFCL',
    description: 'On-device AAC routing. Works offline. iPhone 12+ via WiFi.',
  },
  {
    id: '8b',
    label: 'Prism 8B — Balanced',
    tag: 'dcostenco/prism-coder:8b-v29',
    size: '4.7 GB',
    ram: '~6 GB',
    tier: 'Standard tier · ~1.5s',
    description: 'Higher accuracy on complex routing. 8GB-RAM devices where 14B doesn\'t fit.',
  },
  {
    id: '14b',
    label: 'Prism 14B — Standard',
    tag: 'dcostenco/prism-coder:14b',
    size: '9.3 GB',
    ram: '~10 GB',
    tier: 'Standard tier · ~3s',
    description: 'Better accuracy for complex phrases. Mac M2 Pro+ recommended.',
  },
  {
    id: '32b',
    label: 'Prism 32B — Enterprise',
    tag: 'dcostenco/prism-coder:32b',
    size: '19 GB',
    ram: '~20 GB',
    tier: 'Enterprise tier · ~8s',
    description: 'Clinical reasoning, BCBA analysis, multi-step tasks. Mac M2 Ultra+.',
  },
];

type ModelStatus = 'unknown' | 'checking' | 'not_installed' | 'downloading' | 'installed' | 'active' | 'error';

export default function LocalAISettings() {
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const abortRefs = useRef<Record<string, AbortController>>({});

  // Detect Ollama on mount and when URL changes
  useEffect(() => {
    checkOllama();
  }, [ollamaUrl]);

  async function checkOllama() {
    setOllamaOnline(null);
    try {
      const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) { setOllamaOnline(false); return; }
      setOllamaOnline(true);
      const data = await r.json() as { models?: Array<{ name: string }> };
      const installed = new Set((data.models ?? []).map(m => m.name));
      const newStatuses: Record<string, ModelStatus> = {};
      for (const m of MODELS) {
        // Check both full tag and shortname
        const isInstalled = installed.has(m.tag) || [...installed].some(n => n.includes(`prism-coder:${m.id}`));
        newStatuses[m.id] = isInstalled ? 'installed' : 'not_installed';
      }
      setStatuses(newStatuses);
    } catch {
      setOllamaOnline(false);
    }
  }

  async function downloadModel(model: ModelInfo) {
    setStatuses(s => ({ ...s, [model.id]: 'downloading' }));
    setProgress(p => ({ ...p, [model.id]: 0 }));
    const ctrl = new AbortController();
    abortRefs.current[model.id] = ctrl;

    try {
      const r = await fetch(`${ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model.tag, stream: true }),
        signal: ctrl.signal,
      });
      if (!r.ok || !r.body) throw new Error('Pull failed');
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line) as { status?: string; completed?: number; total?: number };
            if (ev.total && ev.completed) {
              setProgress(p => ({ ...p, [model.id]: Math.round(100 * ev.completed! / ev.total!) }));
            }
            if (ev.status === 'success') {
              setStatuses(s => ({ ...s, [model.id]: 'installed' }));
              setProgress(p => ({ ...p, [model.id]: 100 }));
            }
          } catch {}
        }
      }
      setStatuses(s => ({ ...s, [model.id]: 'installed' }));
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') {
        setStatuses(s => ({ ...s, [model.id]: 'error' }));
      } else {
        setStatuses(s => ({ ...s, [model.id]: 'not_installed' }));
      }
    }
  }

  function cancelDownload(id: string) {
    abortRefs.current[id]?.abort();
  }

  async function deleteModel(model: ModelInfo) {
    setStatuses(s => ({ ...s, [model.id]: 'checking' }));
    try {
      await fetch(`${ollamaUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model.tag }),
      });
      setStatuses(s => ({ ...s, [model.id]: 'not_installed' }));
    } catch {
      setStatuses(s => ({ ...s, [model.id]: 'error' }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Ollama status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${ollamaOnline === null ? 'bg-gray-400 animate-pulse' : ollamaOnline ? 'bg-green-500' : 'bg-red-400'}`} />
        <span className="text-theme-muted">
          {ollamaOnline === null ? 'Checking Ollama…' : ollamaOnline ? 'Ollama connected' : 'Ollama not found'}
        </span>
        <button onClick={checkOllama} className="ml-auto text-xs text-accent hover:underline">Refresh</button>
      </div>

      {/* Ollama URL (advanced) */}
      {!ollamaOnline && (
        <div className="text-xs text-theme-muted space-y-1">
          <p>Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener" className="text-accent hover:underline">ollama.com</a>, then refresh.</p>
          <div className="flex gap-2 items-center mt-2">
            <span className="shrink-0">URL:</span>
            <input
              className="flex-1 text-xs border border-theme rounded px-2 py-1 bg-transparent"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
          <p className="text-xs opacity-60">iOS on same WiFi: use Mac IP, e.g. http://192.168.1.x:11434</p>
        </div>
      )}

      {/* Model cards */}
      {ollamaOnline && (
        <div className="space-y-3">
          {MODELS.map(model => {
            const status = statuses[model.id] ?? 'unknown';
            const pct = progress[model.id] ?? 0;
            const isDownloading = status === 'downloading';
            const isInstalled = status === 'installed' || status === 'active';

            return (
              <div key={model.id} className="border border-theme rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-theme">{model.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isInstalled ? 'bg-green-100 text-green-700' : 'bg-theme text-theme-muted'}`}>
                        {isInstalled ? '✓ Installed' : model.size}
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted mt-0.5">{model.description}</p>
                    <p className="text-xs text-theme-muted opacity-60">{model.tier} · RAM {model.ram}</p>
                  </div>

                  <div className="shrink-0 flex gap-1">
                    {isDownloading ? (
                      <button onClick={() => cancelDownload(model.id)}
                        className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50">
                        Cancel
                      </button>
                    ) : isInstalled ? (
                      <button onClick={() => deleteModel(model)}
                        className="text-xs px-2 py-1 rounded border border-theme text-theme-muted hover:bg-theme">
                        Remove
                      </button>
                    ) : (
                      <button onClick={() => downloadModel(model)}
                        disabled={status === 'checking'}
                        className="text-xs px-3 py-1 rounded bg-accent text-white hover:opacity-90 disabled:opacity-40">
                        Download
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {isDownloading && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-theme rounded-full overflow-hidden">
                      <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-theme-muted text-right">{pct}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-theme-muted opacity-60">
        Local models run on your device — no cloud cost, no data sent externally.
        <a href="https://ollama.com/dcostenco/prism-coder" target="_blank" rel="noopener" className="ml-1 text-accent hover:underline">View on Ollama Hub →</a>
      </p>
    </div>
  );
}
