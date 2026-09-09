'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useT } from '@/engine/useT';
import { useAuthStore } from '@/store/authStore';
import { isNativeiOS, synaluxSignInUrl } from '@/services/aiService';
import { fetchWebAccess, hasVerifiedLocalAccess, rememberVerifiedLocalAccess, clearVerifiedLocalAccess,
  LOCAL_ACCESS_CLEARED, LOCAL_ACCESS_KEY, type WebAccess } from '@/services/webAccessService';
import { rememberWebSignInDraft, recoverWebSignInDraft } from '@/services/webSignInDraft';
import { reportWebGate } from '@/services/monetizationTelemetry';

type AccessState = WebAccess['state'] | 'checking' | 'error';
const PRIVACY_URL = 'https://synalux.ai/legal/privacy';
const TERMS_URL = 'https://synalux.ai/legal/terms';
const SIGNED_IN_RECHECK_MS = 5 * 60_000;
const subscribeNative = () => () => {};
const nativeSnapshot = () => isNativeiOS();
const serverNativeSnapshot = () => false;

/** Registration gate only. Cloud entitlement is enforced separately by the portal. */
export default function WebSignInGate({ children }: { children: ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE === '1';
  const native = useSyncExternalStore(subscribeNative, nativeSnapshot, serverNativeSnapshot);
  const { t } = useT();
  const profile = useAuthStore(s => s.profile);
  const [state, setState] = useState<AccessState>('checking');
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draftFallback, setDraftFallback] = useState(false);
  const expires = useRef(0);
  const anonymousAccess = useRef(false);
  const requestVersion = useRef(0);
  const alive = useRef(false);
  const signInButton = useRef<HTMLButtonElement>(null);

  const check = useCallback(async () => {
    const version = ++requestVersion.current;
    setBusy(true);
    try {
      const result = await fetchWebAccess();
      if (!alive.current || version !== requestVersion.current) return;
      if (result.state === 'signed_in') rememberVerifiedLocalAccess();
      else if (result.state !== 'disabled') clearVerifiedLocalAccess(false);
      anonymousAccess.current = result.state === 'preview' || result.state === 'sign_in_required';
      // A focus event or duplicate response cannot extend an existing preview.
      const candidate = performance.now() + result.remainingMs;
      if (result.state === 'preview') expires.current = expires.current ? Math.min(expires.current, candidate) : candidate;
      const left = Math.max(0, expires.current - performance.now());
      if (result.state === 'signed_in' || result.state === 'disabled' || (result.state === 'preview' && left > 0)) {
        recoverWebSignInDraft();
      } else if (!rememberWebSignInDraft()) setDraftFallback(true);
      setRemaining(Math.ceil(left / 1000));
      setState(result.state === 'preview' && left <= 0 ? 'sign_in_required' : result.state);
    } catch {
      if (alive.current && version === requestVersion.current) {
        if (hasVerifiedLocalAccess()) {
          recoverWebSignInDraft();
          setState('signed_in');
        } else setState('error');
      }
    } finally {
      if (alive.current && version === requestVersion.current) setBusy(false);
    }
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
    };
    const storage = (event: StorageEvent) => {
      if ((event.key === LOCAL_ACCESS_KEY || event.key === null) && event.newValue !== '1') clearVerifiedLocalAccess();
    };
    window.addEventListener('focus', focus);
    window.addEventListener(LOCAL_ACCESS_CLEARED, revoke);
    window.addEventListener('storage', storage);
    const refresh = setInterval(focus, SIGNED_IN_RECHECK_MS);
    const saveDraft = () => { if (anonymousAccess.current) rememberWebSignInDraft(); };
    window.addEventListener('pagehide', saveDraft);
    return () => {
      alive.current = false;
      clearTimeout(initial); clearInterval(refresh);
      window.removeEventListener('focus', focus);
      window.removeEventListener(LOCAL_ACCESS_CLEARED, revoke);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', saveDraft);
    };
  }, [enabled, native, check, profile?.email]);

  // `state` is the only trigger, so this fires once per decision change and
  // never on the countdown's four-a-second re-renders. 'checking' is a
  // transient placeholder, not an outcome, so it is never reported.
  useEffect(() => {
    if (!enabled || native || state === 'checking') return;
    reportWebGate(state);
  }, [enabled, native, state]);

  useEffect(() => {
    if (state !== 'preview') return;
    const update = () => {
      const left = Math.max(0, expires.current - performance.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) {
        if (!rememberWebSignInDraft()) setDraftFallback(true);
        setState('sign_in_required');
      }
    };
    const tick = setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', update); };
  }, [state]);

  useEffect(() => {
    if (state === 'sign_in_required' || state === 'error') signInButton.current?.focus();
  }, [state]);

  // Native bridge is injected before page JavaScript. It is a UI distinction,
  // never evidence of cloud entitlement on the server.
  if (!enabled || native || state === 'disabled' || state === 'signed_in') return children;
  if (state === 'preview') return <div className="h-svh flex flex-col">
    <div className="shrink-0 text-center text-xs px-3 py-1 bg-slate-900 text-white" data-testid="web-preview-notice">
      {t('web_preview_notice').replace('{seconds}', String(remaining))}
    </div>
    <div className="aac-web-preview-body min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>;
  return <main className="h-svh w-full overflow-auto flex items-center justify-center bg-slate-50 text-slate-900 p-6"
    data-testid="web-signin-gate">
    <section className="w-full max-w-md space-y-5" aria-labelledby="web-signin-title">
      <h1 id="web-signin-title" className="text-2xl font-semibold">
        {t(state === 'checking' ? 'checking_sign_in' : 'web_signin_required')}
      </h1>
      <p id="web-signin-explanation">{t(state === 'checking' ? 'web_signin_checking_desc' : 'web_signin_explanation')}</p>
      <p className="text-sm">{t('web_signin_saved')}</p>
      {state === 'error' && <p role="alert" className="text-red-700">{t('web_signin_network_error')}</p>}
      {draftFallback && <p role="alert" className="text-sm">{t('web_signin_draft_fallback')}</p>}
      <button ref={signInButton} type="button" disabled={state === 'checking'} aria-describedby="web-signin-explanation"
        onClick={() => {
          reportWebGate('sign_in_clicked');
          if (draftFallback) { window.open(synaluxSignInUrl(), '_blank', 'noopener,noreferrer'); return; }
          if (!rememberWebSignInDraft()) { setDraftFallback(true); return; }
          window.location.assign(synaluxSignInUrl());
        }} className="aac-btn block w-full rounded-xl bg-blue-700 text-white text-center px-4 py-4 font-semibold">
        {t('continue_to_google')}
      </button>
      <button type="button" disabled={busy} onClick={() => void check()}
        className="aac-btn w-full rounded-xl border border-slate-400 px-4 py-4 disabled:opacity-50">
        {t('web_signin_check_again')}
      </button>
      <p className="text-sm"><a className="underline" href={PRIVACY_URL}>{t('cloud_privacy')}</a>
        {' · '}<a className="underline" href={TERMS_URL}>{t('cloud_terms')}</a></p>
    </section>
  </main>;
}
