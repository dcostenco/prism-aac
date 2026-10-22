'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useT } from '@/engine/useT';
import { useAuthStore } from '@/store/authStore';
import { isPrismNativeShell } from '@/services/nativeShell';
import { fetchWebAccess, hasVerifiedLocalAccess, rememberVerifiedLocalAccess, clearVerifiedLocalAccess,
  LOCAL_ACCESS_CLEARED, LOCAL_ACCESS_KEY, type WebAccess } from '@/services/webAccessService';
import { rememberWebSignInDraft, recoverWebSignInDraft } from '@/services/webSignInDraft';
import { reportWebGate, type WebGateOutcome } from '@/services/monetizationTelemetry';
import { usePathname } from 'next/navigation';
import { PRISM_AAC_TERMS_PATH, PRISM_AAC_TERMS_ROUTE } from '@/lib/appPaths';
import { AacBillingRequestError, fetchAacBillingStatus } from '@/services/aacBillingService';
import { useMessageStore } from '@/store/messageStore';
import { acknowledgeNativeBillingDraft, clearNativeBillingDraft, hasNativeBillingDraft, nativeBillingDraftGeneration,
  observeNativeBillingDraft, recoverNativeBillingDraft } from '@/services/nativeBillingDraft';

type AccessState = WebAccess['state'] | 'checking' | 'error';
const SIGNED_IN_RECHECK_MS = 5 * 60_000;
const PREVIEW_WARNING_SECONDS = 2 * 60;
const subscribeNative = () => () => {};
// Any native shell, not only one that offers Sign in with Apple: the Browser
// shell has no such method and was walled after a 60-second preview.
const nativeSnapshot = () => isPrismNativeShell();
const serverNativeSnapshot = () => false;

/** Advisory cloud-preview status. Core AAC never depends on account status. */
export default function WebSignInGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const publicTerms = pathname === PRISM_AAC_TERMS_ROUTE || pathname === PRISM_AAC_TERMS_PATH;
  const enabled = process.env.NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE === '1' && !publicTerms;
  const native = useSyncExternalStore(subscribeNative, nativeSnapshot, serverNativeSnapshot);
  const { t, rtl } = useT();
  const profile = useAuthStore(s => s.profile);
  const renderedDraftText = useMessageStore(s => s.text);
  const [state, setState] = useState<AccessState>('checking');
  const [remaining, setRemaining] = useState(0);
  const [warned, setWarned] = useState(false);
  // The reported decision, kept apart from `state` because `state` is also set
  // optimistically from local storage before any server answer. React
  // coalesces an unchanged value, so a poll that keeps answering the same
  // thing is reported once per episode, not once per poll.
  const [outcome, setOutcome] = useState<WebGateOutcome | null>(null);
  const expires = useRef(0);
  const requestVersion = useRef(0);
  const alive = useRef(false);
  const draftRecovered = useRef(false);

  // Returns the decision this call produced, or null when it was superseded
  // or the gate unmounted. A caller cannot otherwise distinguish a server
  // answer that changed nothing from no answer at all.
  const check = useCallback(async (): Promise<AccessState | null> => {
    const version = ++requestVersion.current;
    try {
      const result = await fetchWebAccess();
      if (!alive.current || version !== requestVersion.current) return null;
      if (result.state === 'signed_in') rememberVerifiedLocalAccess();
      else if (result.state !== 'disabled') clearVerifiedLocalAccess(false);
      // A focus event or duplicate response cannot extend an existing preview.
      const candidate = performance.now() + result.remainingMs;
      if (result.state === 'preview') expires.current = expires.current ? Math.min(expires.current, candidate) : candidate;
      const left = Math.max(0, expires.current - performance.now());
      setRemaining(Math.ceil(left / 1000));
      const decided = result.state === 'preview' && left <= 0 ? 'sign_in_required' : result.state;
      setState(decided);
      setOutcome(decided);
      return decided;
    } catch {
      if (alive.current && version === requestVersion.current) {
        if (hasVerifiedLocalAccess()) {
          setState('signed_in');
          // Carried by a previously verified local session, not by the server.
          // Reported as its own outcome so registration conversion is not
          // inflated by continuity.
          setOutcome('offline_continuity');
          return 'signed_in';
        }
        setState('error'); setOutcome('error');
        return 'error';
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!hasNativeBillingDraft()) return;
    // This effect runs after React commits the recovered store text. Wait a
    // frame before consuming its native record; unmount cancels that intent.
    let frame = 0;
    const acknowledge = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void acknowledgeNativeBillingDraft(renderedDraftText).catch(() => {
          console.warn('[AAC billing] Recovered draft cleanup will retry on focus');
        });
      });
    };
    acknowledge();
    window.addEventListener('focus', acknowledge);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('focus', acknowledge); };
  }, [renderedDraftText]);

  useEffect(() => {
    if (!hasNativeBillingDraft()) return;
    const stop = observeNativeBillingDraft();
    let active = true;
    let inFlight = false;
    let completed: number | null = null;
    const recover = async () => {
      const version = nativeBillingDraftGeneration();
      if (inFlight || completed === version) return;
      inFlight = true;
      try {
        // Only an authenticated server billing identity can unlock a draft;
        // initial client profile hydration is not an account decision.
        const billing = await fetchAacBillingStatus();
        if (active && billing.userId) {
          await recoverNativeBillingDraft(billing.userId, version);
          completed = version;
        }
      } catch (error) {
        if (active && error instanceof AacBillingRequestError && error.status === 401) {
          clearNativeBillingDraft(); completed = nativeBillingDraftGeneration();
        }
        // An outage leaves the bounded draft for a later focus retry.
      } finally { inFlight = false; }
    };
    void recover();
    window.addEventListener('focus', recover);
    return () => { active = false; stop(); window.removeEventListener('focus', recover); };
  }, []);

  useEffect(() => {
    // Hydrate once before pagehide can save an initially empty store. Later
    // account refreshes must never resurrect text the user deliberately cleared.
    // Draft continuity is independent of cloud enforcement and native billing.
    if (!draftRecovered.current) {
      recoverWebSignInDraft();
      draftRecovered.current = true;
    }
    const saveDraft = () => { rememberWebSignInDraft(); };
    window.addEventListener('pagehide', saveDraft);
    return () => window.removeEventListener('pagehide', saveDraft);
  }, []);

  useEffect(() => {
    alive.current = true;
    requestVersion.current++;
    if (!enabled || native) return () => { alive.current = false; };
    // Defer out of the effect body; async responses own the state changes.
    const initial = setTimeout(() => {
      if (hasVerifiedLocalAccess()) setState('signed_in');
      void check();
    }, 0);
    const focus = () => { void check(); };
    const revoke = () => {
      requestVersion.current++;
      setState('sign_in_required');
      setOutcome('sign_in_required');
    };
    const storage = (event: StorageEvent) => {
      if ((event.key === LOCAL_ACCESS_KEY || event.key === null) && event.newValue !== '1') clearVerifiedLocalAccess();
    };
    window.addEventListener('focus', focus);
    window.addEventListener(LOCAL_ACCESS_CLEARED, revoke);
    window.addEventListener('storage', storage);
    const refresh = setInterval(focus, SIGNED_IN_RECHECK_MS);
    return () => {
      alive.current = false;
      clearTimeout(initial); clearInterval(refresh);
      window.removeEventListener('focus', focus);
      window.removeEventListener(LOCAL_ACCESS_CLEARED, revoke);
      window.removeEventListener('storage', storage);
    };
  }, [enabled, native, check, profile?.email]);

  // Only a decision is reported, never the optimistic local state and never a
  // render. When the gate is off or running native no decision is ever
  // reached, so this stays silent without needing to test for it.
  useEffect(() => {
    if (outcome && enabled && !native) reportWebGate(outcome);
  }, [outcome, enabled, native]);

  useEffect(() => {
    if (!enabled || native || state !== 'preview') return;
    const update = () => {
      const left = Math.max(0, expires.current - performance.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) {
        setState('sign_in_required');
        setOutcome('sign_in_required');
      }
    };
    const tick = setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', update); };
  }, [state, enabled, native]);

  // Keep the live region mounted before inserting its static warning. Unlike
  // the visual countdown, this text changes only once and never takes focus.
  useEffect(() => {
    if (state !== 'preview' || remaining <= 0 || remaining > PREVIEW_WARNING_SECONDS || warned) return;
    let active = true;
    queueMicrotask(() => { if (active) setWarned(true); });
    return () => { active = false; };
  }, [state, remaining, warned]);

  const showNotice = enabled && !native && state !== 'disabled' && state !== 'signed_in';
  const preview = state === 'preview';
  const warning = preview && warned;
  // Keep the same parent and child positions in every state. Replacing or
  // reparenting the board can reset local controls, playback and keyboard focus.
  // The portal enforces cloud access independently of this advisory display.
  return <div className="h-svh flex flex-col">
    {showNotice && <div dir={rtl ? 'rtl' : 'ltr'}
      className={`shrink-0 flex flex-col items-center justify-center sm:flex-row sm:gap-x-3 text-center text-xs px-3 py-2 ${warning ? 'bg-amber-100 text-amber-950' : 'bg-slate-900 text-white'}`}
      data-testid="web-preview-notice" data-state={state}>
      {(preview || state === 'sign_in_required') && <p role={preview ? 'timer' : undefined} aria-live="off">
        {t('web_preview_notice').replace('{time}', preview ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '0:00')}
      </p>}
      <p role="status" aria-live="polite" aria-atomic="true" data-testid="web-preview-warning"
        className={warning ? 'mt-1 font-semibold sm:mt-0' : undefined}>
        {preview ? warning ? t('web_preview_warning') : '' : t('cloud_core_free')}
      </p>
      {state === 'error' && <p role="status" className="mt-1 sm:mt-0">{t('web_signin_network_error')}</p>}
    </div>}
    <div key="communication" className="aac-web-preview-body min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>;
}
