/**
 * Watch → web bridge — receives Apple Watch alert/message dispatches
 * forwarded by the iOS WKWebView host (see ContentView.swift), and
 * routes them through the same sendAlertToCaregiver path used by the
 * web toolbar's 🚨 button.
 *
 * The native side calls `window.prismOnWatchMessage(payload)` where
 * payload is `{ type, body, to }`. This module installs that handler.
 *
 * Idempotent — safe to call from React effects that may re-mount.
 */
import { sendAlertToCaregiver } from '@/services/sendAlertToCaregiver';

type WatchMessagePayload = { type?: string; body?: string; to?: string | null };

declare global {
  interface Window {
    prismOnWatchMessage?: (payload: WatchMessagePayload) => void;
    /** Internal: marks the bridge as installed so registerWatchAlertBridge
     *  is idempotent across React StrictMode double-mounts. */
    __prismWatchBridgeInstalled?: boolean;
  }
}

export function registerWatchAlertBridge(): void {
  if (typeof window === 'undefined') return;
  if (window.__prismWatchBridgeInstalled) return;
  window.__prismWatchBridgeInstalled = true;

  window.prismOnWatchMessage = (payload) => {
    const type = payload?.type ?? '';
    const body = (payload?.body ?? '').trim();
    if (!body) return;
    if (type !== 'send_alert' && type !== 'send_message') return;

    // For send_alert: route through caregiver path (Watch one-tap alert).
    // For send_message: same path for now — the Watch composer's `to`
    //   field is ignored. A future iteration can resolve `to` against the
    //   contacts store; for v1 the Watch composer is alert-shaped enough
    //   that caregiver-first dispatch is acceptable. Tracked in todo.
    void sendAlertToCaregiver(body).then((res) => {
      if (!res.ok) {
        console.warn('[watchBridge] alert dispatch failed:', res.error, res.detail ?? '');
      }
    });
  };
}
