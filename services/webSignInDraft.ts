import { useMessageStore } from '@/store/messageStore';

export const WEB_SIGNIN_DRAFT_KEY = 'prism-aac-signin-draft-v1';
const DRAFT_TTL_MS = 30 * 60_000;
const MAX_DRAFT_CHARS = 4000;

/** Only the current draft, in this tab, for one authentication round trip. */
export function rememberWebSignInDraft(): boolean {
  const text = useMessageStore.getState().text;
  if (!text) return true;
  try {
    sessionStorage.setItem(WEB_SIGNIN_DRAFT_KEY, JSON.stringify({ text, expiresAt: Date.now() + DRAFT_TTL_MS }));
    return true;
  } catch { return false; }
}

export function recoverWebSignInDraft(): void {
  try {
    const raw = sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.text === 'string' && saved.text.length <= MAX_DRAFT_CHARS
      && Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now()
      && saved.expiresAt <= Date.now() + DRAFT_TTL_MS && !useMessageStore.getState().text) {
      useMessageStore.getState().setTextSilent(saved.text);
    }
    sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
  } catch { /* Browser storage may be unavailable; the in-memory draft is untouched. */ }
}
