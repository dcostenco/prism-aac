'use client';
/**
 * Integrations settings — in-app provider connect grid.
 *
 * Replaces the previous "Pulls contacts you connected on synalux.ai/chat"
 * dead-end. Lists every chat + mail provider Synalux knows about, with
 * server-resolved connect status and a per-provider Connect button that
 * opens an OAuth popup against synalux.ai.
 *
 * UX rules:
 *   - The user NEVER lands on synalux.ai/chat. Connect happens in a
 *     popup; on close we refresh status here and the parent contacts
 *     list refreshes automatically (services/integrationsService
 *     calls syncContactsOnce).
 *   - Status is server-truth (chat providers come from
 *     /api/v1/chat/providers). The UI can't lie about what's wired.
 *   - "planned" providers (RCS, iMessage, FaceTime) render disabled
 *     with the why-it's-planned tooltip — keeps the surface honest.
 *   - Errors (popup blocked, popup closed without success) surface
 *     inline, never as a window.alert that motor-impaired AAC users
 *     can't dismiss.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  listIntegrations,
  subscribeToIntegrationEvents,
  type IntegrationProvider,
} from '@/services/integrationsService';
import { tapFeedback } from '@/services/feedback';

type LoadState = 'idle' | 'loading' | 'error';

export default function IntegrationsSettings() {
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    try {
      const list = await listIntegrations();
      setProviders(list);
      setLoadState('idle');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load integrations.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when ANY same-origin synalux tab broadcasts a connect/disconnect.
  // This is the "raise notification on all synalux apps connected" wire —
  // mail/calendar/chat surfaces firing a connect here causes PrismAAC to
  // refresh, and vice versa.
  useEffect(() => {
    const unsub = subscribeToIntegrationEvents((ev) => {
      if (ev.type === 'provider-connected' || ev.type === 'provider-disconnected') {
        refresh();
      }
    });
    return unsub;
  }, [refresh]);

  const handleConnect = useCallback((p: IntegrationProvider) => {
    if (p.status !== 'available') return;
    if (!p.connectUrl) return;

    // Same-window navigation, NOT popup. iPad Safari aggressively
    // blocks popups (even synchronously-opened ones) and opens
    // surviving popups in background tabs that the user doesn't
    // notice — both manifest as "nothing happens". Same-window
    // navigation avoids the entire popup category of bugs.
    //
    // Trade-off: the user leaves PrismAAC during OAuth and lands
    // back at /prism-aac (home, not Settings) on success. Acceptable
    // for a Connect action since the user explicitly opted in.
    //
    // The synalux callback redirects to the `return` path appending
    // ?connected=1&provider=<id>&scope=<key>; HomePage / SettingsModal
    // listen for those params and surface a toast ("✓ Gmail connected").
    tapFeedback();
    const url = new URL(p.connectUrl);
    if (!url.searchParams.has('return')) {
      url.searchParams.set('return', '/prism-aac');
    }
    setStatusMsg(`Opening ${p.label}…`);
    setConnecting(p.id);
    // Tiny delay so the status message paints before navigation kills
    // this DOM. Without it the user sees nothing between tap and the
    // OAuth screen — same UX bug as the popup approach, just smaller.
    setTimeout(() => {
      window.location.href = url.toString();
    }, 50);
  }, []);

  const grouped = {
    chat: providers.filter((p) => p.kind === 'chat'),
    mail: providers.filter((p) => p.kind === 'mail'),
  };

  return (
    <div className="space-y-3" data-testid="integrations-settings">
      <div className="flex items-center justify-between gap-2">
        <p className="text-primary text-sm font-bold">Integrations</p>
        <button
          onClick={() => { tapFeedback(); refresh(); }}
          disabled={loadState === 'loading'}
          data-testid="integrations-refresh"
          className="aac-btn rounded-lg px-3 py-1.5 surface-key text-primary border border-theme text-xs"
        >
          {loadState === 'loading' ? '…' : '↻'}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="text-xs text-[#F44336]"
          data-testid="integrations-error"
        >
          {error}
        </p>
      )}

      {statusMsg && (
        <p
          className="text-xs text-[#4CAF50]"
          data-testid="integrations-status"
        >
          {statusMsg}
        </p>
      )}

      {loadState === 'loading' && providers.length === 0 && (
        <p className="text-muted text-xs" data-testid="integrations-loading">Loading providers…</p>
      )}

      {(['chat', 'mail'] as const).map((kind) => {
        const list = grouped[kind];
        if (list.length === 0) return null;
        return (
          <section key={kind} className="space-y-1.5" data-testid={`integrations-${kind}`}>
            <p className="text-muted text-[11px] uppercase tracking-wider">
              {kind === 'chat' ? 'Messaging' : 'Mail'}
            </p>
            <ul className="space-y-1">
              {list.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg surface-key border border-theme"
                  data-testid={`integration-row-${p.id}`}
                  data-status={p.status}
                >
                  <span className="text-xl shrink-0" aria-hidden>{p.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-primary text-sm font-bold block truncate">
                      {p.label}
                    </span>
                    <span className="text-muted text-xs block truncate">
                      {p.status === 'connected' && (
                        <span className="text-[#4CAF50]">✓ Connected</span>
                      )}
                      {p.status === 'available' && (
                        <span>Click connect to authorize</span>
                      )}
                      {p.status === 'planned' && (
                        <span className="text-[#FF9800]">
                          Coming soon{p.plannedNote ? ` — ${p.plannedNote}` : ''}
                        </span>
                      )}
                    </span>
                  </span>
                  {p.status === 'available' && (
                    <button
                      onClick={() => handleConnect(p)}
                      // Only disable THIS button while it's connecting,
                      // not every other Connect button on the page.
                      // Bug history (May 2026): disabled={connecting !== null}
                      // froze every row when one popup got stuck because the
                      // synalux /integrations/connect-done page didn't exist
                      // → popup never closed → connecting never cleared →
                      // all buttons looked clickable but weren't. Even with
                      // connect-done now wired, scope the disable so a stuck
                      // popup never disables the others.
                      disabled={connecting === p.id}
                      data-testid={`integration-connect-${p.id}`}
                      className="aac-btn rounded-lg px-3 py-1.5 bg-[#4CAF50] text-white font-bold text-xs disabled:opacity-40"
                    >
                      {connecting === p.id ? 'Opening…' : 'Connect'}
                    </button>
                  )}
                  {p.status === 'connected' && (
                    <>
                      <span
                        className="text-[#4CAF50] text-base font-bold pl-2"
                        data-testid={`integration-connected-${p.id}`}
                        aria-label={`${p.label} connected`}
                      >
                        ✓
                      </span>
                      {/* Reconnect path — caregivers need this to upgrade
                          scope (e.g. add contacts.readonly to an existing
                          gmail.modify grant) without us building a separate
                          "permissions" UI. Re-running OAuth re-prompts
                          consent and writes a fresh grant row. */}
                      {p.connectUrl && (
                        <button
                          onClick={() => handleConnect(p)}
                          disabled={connecting === p.id}
                          data-testid={`integration-reconnect-${p.id}`}
                          className="aac-btn rounded-lg px-2 py-1 surface-key text-primary border border-theme text-[10px] disabled:opacity-40"
                          title="Reconnect to grant additional permissions"
                        >
                          {connecting === p.id ? '…' : '↻'}
                        </button>
                      )}
                    </>
                  )}
                  {p.status === 'planned' && (
                    <span
                      className="text-[10px] text-[#FF9800] px-2"
                      data-testid={`integration-planned-${p.id}`}
                    >
                      🔒
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
