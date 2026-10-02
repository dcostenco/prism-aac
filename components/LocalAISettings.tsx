'use client';
import { useEffect, useState, useRef } from 'react';
import {
  checkLocalAi, detectOs, LOCAL_AI_OPT_IN_KEY, ollamaOriginsCommand, ollamaRestartHint, queryLocalNetworkPermission,
  type LocalAiState, type LocalAiWindow,
} from '@/services/localAiConnect';

// Status line per state; the detail block below it says what to do next.
const STATE_LABEL: Record<LocalAiState, string> = {
  'connected': 'Ollama connected',
  'ios-builtin': 'On-device AI is built into this app',
  'browser-blocks': "Safari can't reach Ollama from this website",
  'unsafe-url': "This address can't be reached from a secure page",
  'needs-permission': 'Allow local network access',
  'permission-denied': 'Local network access is blocked',
  'blocked-by-ollama': 'Ollama is running but blocks this site',
  'not-running': 'Ollama is not running',
};
const STATE_DOT: Record<LocalAiState, string> = {
  'connected': 'bg-green-500',
  'ios-builtin': 'bg-green-500',
  'needs-permission': 'bg-amber-400',
  'blocked-by-ollama': 'bg-amber-400',
  'browser-blocks': 'bg-red-400',
  'unsafe-url': 'bg-red-400',
  'permission-denied': 'bg-red-400',
  'not-running': 'bg-red-400',
};

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
    tier: 'Free tier · ~0.5s · 96.1% BFCL',
    description: 'On-device AAC routing. Works offline. iPhone 12+ via WiFi.',
  },
  {
    id: '8b',
    label: 'Prism 8B — Balanced',
    tag: 'dcostenco/prism-coder:8b',
    size: '4.7 GB',
    ram: '~6 GB',
    tier: 'Standard tier · ~1s · 98.0% BFCL',
    description: 'Higher accuracy on complex routing. 8GB-RAM devices where 14B doesn\'t fit.',
  },
  {
    id: '14b',
    label: 'Prism 14B — Standard',
    tag: 'dcostenco/prism-coder:14b',
    size: '9.3 GB',
    ram: '~10 GB',
    tier: 'Standard tier · ~3s · 97.1% BFCL',
    description: 'Better accuracy for complex phrases. Mac M2 Pro+ recommended.',
  },
  {
    id: '32b',
    label: 'Prism 32B — Enterprise',
    tag: 'dcostenco/prism-coder:32b',
    size: '19 GB',
    ram: '~20 GB',
    tier: 'Enterprise tier · ~8s · 99.0% BFCL',
    description: 'Clinical reasoning, BCBA analysis, multi-step tasks. Mac M2 Ultra+.',
  },
];

type ModelStatus = 'unknown' | 'checking' | 'not_installed' | 'downloading' | 'installed' | 'active' | 'error';

export default function LocalAISettings() {
  // null = checking. The panel mounts only when the user opens its Settings section.
  const [localState, setLocalState] = useState<LocalAiState | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [copied, setCopied] = useState(false);
  const abortRefs = useRef<Record<string, AbortController>>({});
  const ollamaOnline = localState === 'connected';

  // Detect Ollama on mount and when URL changes
  useEffect(() => {
    checkOllama();
  }, [ollamaUrl]);

  // userInitiated: only a button press may trigger the browser's local-network permission prompt.
  async function checkOllama(userInitiated = false) {
    setLocalState(null);
    const result = await checkLocalAi(window as unknown as LocalAiWindow, ollamaUrl, {
      fetch: (input, init) => fetch(input, init),
      queryPermission: () => queryLocalNetworkPermission(typeof navigator !== 'undefined' ? navigator.permissions : undefined),
    }, userInitiated);
    setLocalState(result.state);
    // A revoked permission: stop the background services from probing (and logging errors) on every page.
    if (result.state === 'permission-denied') { try { localStorage.removeItem(LOCAL_AI_OPT_IN_KEY); } catch { /* private mode */ } }
    if (result.state !== 'connected') return;
    // Lets the background AI services use this Ollama on https pages too.
    try { localStorage.setItem(LOCAL_AI_OPT_IN_KEY, '1'); } catch { /* private mode */ }
    const installed = new Set(result.models ?? []);
    const newStatuses: Record<string, ModelStatus> = {};
    for (const m of MODELS) {
      // Check both full tag and shortname
      const isInstalled = installed.has(m.tag) || [...installed].some(n => n.includes(`prism-coder:${m.id}`));
      newStatuses[m.id] = isInstalled ? 'installed' : 'not_installed';
    }
    setStatuses(newStatuses);
  }

  async function copyCommand(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable: the command stays selectable */ }
  }

  const os = typeof navigator !== 'undefined' ? detectOs(navigator.userAgent) : 'mac';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://synalux.ai';
  const originsCommand = ollamaOriginsCommand(os, origin);

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
        <div className={`w-2 h-2 rounded-full ${localState === null ? 'bg-gray-400 animate-pulse' : STATE_DOT[localState]}`} />
        <span className="text-theme-muted">
          {localState === null ? 'Checking Ollama…' : STATE_LABEL[localState]}
        </span>
        {localState !== 'ios-builtin' && localState !== 'browser-blocks' && (
          <button onClick={() => checkOllama(true)} className="ml-auto text-xs text-accent hover:underline">Refresh</button>
        )}
      </div>

      {/* What to do next, per platform and state */}
      {localState === 'ios-builtin' && (
        <p className="text-xs text-theme-muted">
          Prism runs its own AI model on this iPhone or iPad. It works offline and needs no Ollama.
        </p>
      )}

      {localState === 'browser-blocks' && (
        <div className="text-xs text-theme-muted space-y-1">
          <p>Safari blocks secure websites from talking to apps on this computer, so it can&apos;t reach Ollama here.</p>
          <p>To use a local model, open Prism AAC in Chrome, Edge or Firefox on this computer, or use the Prism AAC app on iPhone or iPad, which has a built-in model.</p>
        </div>
      )}

      {localState === 'needs-permission' && (
        <div className="text-xs text-theme-muted space-y-2">
          <p>Your browser will ask to let this site reach apps on this device. Choose Allow.</p>
          <button onClick={() => checkOllama(true)}
            className="text-xs px-3 py-1 rounded bg-accent text-white hover:opacity-90">
            Allow
          </button>
        </div>
      )}

      {localState === 'permission-denied' && (
        <p className="text-xs text-theme-muted">
          Open this site&apos;s settings (the icon left of the address bar), set Local network access to Allow, then press Refresh.
        </p>
      )}

      {localState === 'blocked-by-ollama' && (
        <div className="text-xs text-theme-muted space-y-2">
          <p>Run this on this computer:</p>
          <div className="flex gap-2 items-start">
            <code className="flex-1 select-all break-all rounded border border-theme px-2 py-1 font-mono">{originsCommand}</code>
            <button onClick={() => copyCommand(originsCommand)}
              className="shrink-0 text-xs px-2 py-1 rounded border border-theme hover:bg-theme">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p>{ollamaRestartHint(os)} Then press Refresh.</p>
          <p className="opacity-60">Already using OLLAMA_ORIGINS for other sites? Separate them with commas.</p>
        </div>
      )}

      {(localState === 'not-running' || localState === 'unsafe-url') && (
        <div className="text-xs text-theme-muted space-y-1">
          {localState === 'not-running' ? (
            <p>Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener" className="text-accent hover:underline">ollama.com</a>, open it, then press Refresh.</p>
          ) : (
            <p>A secure page can only reach Ollama on this same computer, at http://localhost:11434. Other addresses and ports, like http://192.168.1.20:11434, are blocked by the browser.</p>
          )}
          <div className="flex gap-2 items-center mt-2">
            <span className="shrink-0">URL:</span>
            <input
              className="flex-1 text-xs border border-theme rounded px-2 py-1 bg-transparent"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
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

      {localState !== 'ios-builtin' && (
        <p className="text-xs text-theme-muted opacity-60">
          Local models run on your device — no cloud cost, no data sent externally.
          <a href="https://ollama.com/dcostenco/prism-coder" target="_blank" rel="noopener" className="ml-1 text-accent hover:underline">View on Ollama Hub →</a>
        </p>
      )}
    </div>
  );
}
