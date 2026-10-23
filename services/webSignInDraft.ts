import { useMessageStore } from '@/store/messageStore';
import { hasNativeBillingDraft } from '@/services/nativeBillingDraft';

export const WEB_SIGNIN_DRAFT_KEY = 'prism-aac-signin-draft-v1';
const DRAFT_TTL_MS = 30 * 60_000;
// Checkout attempts last an hour. Allow a bounded return window, without
// extending the ordinary sign-in copy's privacy retention.
const EXTERNAL_RETURN_WINDOW_MS = 75 * 60_000;
const MAX_DRAFT_CHARS = 4000;
let revokedDraft: Pick<ReturnType<typeof useMessageStore.getState>, 'text' | 'undoStack'> | null = null;

/** Retire the handoff, preserving the live board and suppressing a late pagehide copy. */
export function clearWebSignInDraft(): void {
  const { text, undoStack } = useMessageStore.getState();
  revokedDraft = { text, undoStack };
  try { sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY); } catch { /* Storage may be unavailable. */ }
}

/** Only the current draft, in this tab, for one authentication round trip. */
export function rememberWebSignInDraft(purpose: 'signin' | 'billing' = 'signin'): boolean {
  const text = useMessageStore.getState().text;
  try {
    if (hasNativeBillingDraft()) {
      sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
      return true; // The device-only native handoff owns persistence here.
    }
    if (purpose === 'signin' && revokedDraft?.text === text
      && revokedDraft.undoStack === useMessageStore.getState().undoStack) {
      sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
      return true;
    }
    revokedDraft = null;
    if (!text) {
      sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
      return true;
    }
    let saved: { text?: unknown; purpose?: unknown; expiresAt?: unknown } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY) || 'null'); } catch { /* Replace an invalid copy. */ }
    // A pagehide listener runs after the explicit billing save. Keep that
    // deadline rather than shortening it to 30 minutes or renewing it forever.
    const billing = purpose === 'billing' || (saved?.purpose === 'billing' && saved.text === text
      && typeof saved.expiresAt === 'number' && saved.expiresAt > Date.now()
      && saved.expiresAt <= Date.now() + EXTERNAL_RETURN_WINDOW_MS);
    const expiresAt = purpose !== 'billing' && billing ? saved!.expiresAt
      : Date.now() + (billing ? EXTERNAL_RETURN_WINDOW_MS : DRAFT_TTL_MS);
    sessionStorage.setItem(WEB_SIGNIN_DRAFT_KEY, JSON.stringify({ text, expiresAt, ...(billing ? { purpose: 'billing' } : {}) }));
    return true;
  } catch { return false; }
}

export function recoverWebSignInDraft(): void {
  try {
    if (hasNativeBillingDraft()) {
      sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
      return;
    }
    const raw = sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.text === 'string' && saved.text.length <= MAX_DRAFT_CHARS
      && Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now()
      && saved.expiresAt <= Date.now() + (saved.purpose === 'billing' ? EXTERNAL_RETURN_WINDOW_MS : DRAFT_TTL_MS)
      && !useMessageStore.getState().text) {
      useMessageStore.getState().setTextSilent(saved.text);
    }
    sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
  } catch { /* Browser storage may be unavailable; the in-memory draft is untouched. */ }
}
