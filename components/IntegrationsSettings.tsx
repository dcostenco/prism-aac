'use client';
/**
 * Integrations settings — in-app provider connect grid.
 *
 * Replaces the previous "Pulls contacts you connected on synalux.ai/chat"
 * dead-end. Lists every chat + mail provider Synalux knows about, with
 * server-resolved connect status and a per-provider Connect button that
 * starts OAuth against synalux.ai after any required data-use disclosure.
 *
 * UX rules:
 *   - The user never lands on synalux.ai/chat. Current iPad-safe OAuth
 *     navigation is same-window and returns to Prism AAC.
 *   - Status is server-truth (chat providers come from
 *     /api/v1/chat/providers). The UI can't lie about what's wired.
 *   - "planned" providers (RCS, iMessage, FaceTime) render disabled
 *     with the why-it's-planned tooltip — keeps the surface honest.
 *   - Errors (popup blocked, popup closed without success) surface
 *     inline, never as a window.alert that motor-impaired AAC users
 *     can't dismiss.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listIntegrations,
  disconnectProvider,
  subscribeToIntegrationEvents,
  type IntegrationProvider,
} from '@/services/integrationsService';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { SYNALUX_PORTAL_ORIGIN } from '@/lib/portalConfig';

type LoadState = 'idle' | 'loading' | 'error';

export default function IntegrationsSettings() {
  const { t } = useT();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [pendingGoogle, setPendingGoogle] = useState<IntegrationProvider | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    if (!mountedRef.current) return;
    setLoadState('loading');
    try {
      const list = await listIntegrations();
      if (!mountedRef.current || generation !== refreshGenerationRef.current) return;
      setProviders(list);
      setLoadState('idle');
      setError(null);
    } catch (e) {
      if (!mountedRef.current || generation !== refreshGenerationRef.current) return;
      console.warn('[integrations] load failed:', e instanceof Error ? e.message : e);
      setError('Could not load integrations. Please check your connection.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    // Defer the initial load so the effect only synchronizes lifecycle state;
    // the async callback owns the subsequent React state updates.
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
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

  const navigateToProvider = useCallback((p: IntegrationProvider) => {
    // Allow connect AND reconnect: status === 'available' is a fresh
    // connect; status === 'connected' is a reconnect to upgrade scope
    // (e.g. add contacts.readonly to an existing gmail.send grant).
    // 'planned' rows have no connectUrl, so the second guard catches them.
    // Earlier `if (p.status !== 'available') return;` made the ↻
    // Reconnect button a no-op — the user reported "no way to reconnect"
    // (Image #25).
    if (p.status === 'planned') return;
    if (!p.connectUrl) return;

    // CRITICAL #1 — origin validation: block open-redirect to unexpected origins.
    // Fail closed against the same canonical Portal origin the integration
    // service uses, even when no public environment override is configured.
    let url: URL;
    try {
      url = new URL(p.connectUrl);
      const expectedOrigin = new URL(SYNALUX_PORTAL_ORIGIN).origin;
      // Require both HTTPS and exact origin — blocks data:, javascript:,
      // blob:, HTTP, lookalike domains, and a compromised provider response.
      if (url.protocol !== 'https:' || url.origin !== expectedOrigin) return;
    } catch { return; }

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

  const handleConnect = useCallback((provider: IntegrationProvider) => {
    if (provider.id === 'google-gmail') {
      setPendingGoogle(provider);
      return;
    }
    navigateToProvider(provider);
  }, [navigateToProvider]);

  const handleDisconnect = useCallback(async (provider: IntegrationProvider) => {
    tapFeedback();
    setDisconnecting(provider.id);
    setError(null);
    const ok = await disconnectProvider(provider);
    if (!mountedRef.current) return;
    setDisconnecting(null);
    if (!ok) {
      setError(`${provider.label}: ${t('error')}`);
      return;
    }
    setStatusMsg(`${provider.label}: ${t('done')}`);
    await refresh();
  }, [refresh, t]);

  const grouped = {
    chat: providers.filter((p) => p.kind === 'chat'),
    mail: providers.filter((p) => p.kind === 'mail'),
  };

  return (
    <>
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
                  {p.status === 'available' && p.connectUrl && (
                    <button
                      onClick={() => handleConnect(p)}
                      disabled={connecting === p.id}
                      data-testid={`integration-connect-${p.id}`}
                      className="aac-btn rounded-lg px-3 py-1.5 bg-[#4CAF50] text-white font-bold text-xs disabled:opacity-40"
                    >
                      {connecting === p.id ? 'Opening…' : 'Connect'}
                    </button>
                  )}
                  {p.status === 'available' && !p.connectUrl && (
                    <span className="text-muted text-[10px] px-2">Add contact in Settings → Contacts</span>
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
                          gmail.send grant) without us building a separate
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
                      <button
                        onClick={() => { void handleDisconnect(p); }}
                        disabled={disconnecting === p.id}
                        data-testid={`integration-disconnect-${p.id}`}
                        className="aac-btn rounded-lg px-2 py-1 text-[#F44336] border border-[#F44336]/40 text-[10px] disabled:opacity-40"
                      >
                        {disconnecting === p.id ? t('disconnecting') : t('disconnect')}
                      </button>
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
    {pendingGoogle && (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-oauth-disclosure-title"
          className="w-full max-w-xl max-h-[90svh] overflow-y-auto rounded-2xl surface-bar border border-theme p-5 space-y-4 shadow-2xl"
        >
          <h2 id="google-oauth-disclosure-title" className="text-primary text-xl font-bold">
            {t('google_oauth_disclosure_title')}
          </h2>
          <p className="text-primary text-sm leading-relaxed">
            {t('google_oauth_disclosure_body')}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingGoogle(null)}
              className="aac-btn rounded-lg px-4 py-2 surface-key text-primary border border-theme font-bold"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                const provider = pendingGoogle;
                setPendingGoogle(null);
                navigateToProvider(provider);
              }}
              className="aac-btn rounded-lg px-4 py-2 bg-[#4285F4] text-white font-bold"
            >
              {t('continue_to_google')}
            </button>
          </div>
        </section>
      </div>
    )}
    </>
  );
}
