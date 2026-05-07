/**
 * Contacts integration — mirrors connected-provider contacts from the
 * Synalux portal into the AAC client's local contact list.
 *
 * Why mirror instead of fetch-on-open: the AAC user opens the picker
 * expecting an instant grid. A round-trip to the portal on every open
 * would mean a blank screen on flaky school Wi-Fi for 1-3s — long
 * enough for an AAC user with motor/cognitive load to give up.
 *
 * Endpoint contract (synalux-private side, TBD if not yet shipped):
 *   GET /api/v1/prism-aac/contacts
 *   →   { contacts: Array<{
 *           name: string;
 *           provider: ContactProvider;
 *           recipientId: string;
 *           avatar?: string;
 *           lastMessagePreview?: string;
 *         }>,
 *         serverTime: number }
 *
 * Behavior on missing/erroring endpoint:
 *   - 404 / network error: silently no-op (endpoint not shipped, or
 *     offline). Local list keeps working.
 *   - 401: skip; authStore handles reauth elsewhere.
 */
import { useContactsStore, type AacContact, type ContactProvider } from '@/store/contactsStore';

const ENDPOINT = '/api/v1/prism-aac/contacts';
// Match the inbox poller cadence — 5min is enough for caregiver-side
// edits (add new family member) to land without spamming the portal.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const VALID_PROVIDERS = new Set<ContactProvider>([
  'telegram', 'whatsapp', 'viber', 'sms', 'messenger', 'instagram', 'mail',
]);

export interface IntegrationContact {
  name?: string;
  provider?: string;
  recipientId?: string;
  avatar?: string;
  lastMessagePreview?: string;
}

function sanitize(raw: IntegrationContact[]): Array<Omit<AacContact, 'id' | 'order'>> {
  const out: Array<Omit<AacContact, 'id' | 'order'>> = [];
  for (const c of raw) {
    const name = (c.name || '').trim();
    const recipientId = (c.recipientId || '').trim();
    const provider = (c.provider || '').trim() as ContactProvider;
    if (!name || !recipientId) continue;
    if (!VALID_PROVIDERS.has(provider)) continue;
    out.push({
      name,
      provider,
      recipientId,
      ...(c.avatar ? { avatar: c.avatar } : {}),
      ...(c.lastMessagePreview ? { lastMessagePreview: c.lastMessagePreview } : {}),
    });
  }
  return out;
}

/** Fetch contacts from the portal and merge into the local store.
 *  Returns the merge result for callers that want to surface a toast
 *  ("3 new contacts"). Resolves with null on transport failure so
 *  callers can distinguish "no changes" from "couldn't reach". */
export async function syncContactsOnce(): Promise<{ added: number; updated: number } | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let body: { contacts?: IntegrationContact[] };
  try {
    body = await res.json();
  } catch {
    return null;
  }
  const incoming = Array.isArray(body.contacts) ? sanitize(body.contacts) : [];
  if (incoming.length === 0) {
    // Endpoint reachable but empty — still bump lastSyncedAt so the UI
    // shows a successful sync. Done by passing an empty array through
    // merge, which sets lastSyncedAt: Date.now().
    return useContactsStore.getState().mergeFromIntegrations([]);
  }
  return useContactsStore.getState().mergeFromIntegrations(incoming);
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startContactsSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (intervalId !== null) return stopContactsSync;
  void syncContactsOnce();
  intervalId = setInterval(() => { void syncContactsOnce(); }, SYNC_INTERVAL_MS);
  return stopContactsSync;
}

export function stopContactsSync(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
