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
import { PROVIDERS } from '@/lib/messageProviders';

const ENDPOINT = '/api/v1/prism-aac/contacts';
// Match the inbox poller cadence — 5min is enough for caregiver-side
// edits (add new family member) to land without spamming the portal.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SYNC_TIMEOUT_MS = 8_000;
/** Hard caps on inbound payload — defense against compromised portal /
 *  hostile dev environment. Long names or huge avatar strings would
 *  blow up local persistence + render. */
const MAX_NAME_LEN = 80;
const MAX_RECIPIENT_LEN = 254; // ≥ longest valid email
const MAX_AVATAR_LEN = 16;     // emoji + variation selectors fit
const MAX_PREVIEW_LEN = 200;
/** Hard cap on contacts per sync — paranoia against a runaway portal
 *  query returning the entire contact graph. The picker would be
 *  unusable past this anyway. */
const MAX_CONTACTS_PER_SYNC = 500;

const VALID_PROVIDERS = new Set<ContactProvider>(
  Object.keys(PROVIDERS) as ContactProvider[],
);

export interface IntegrationContact {
  name?: string;
  provider?: string;
  recipientId?: string;
  avatar?: string;
  lastMessagePreview?: string;
}

function sanitizeStr(s: unknown, maxLen: number): string {
  if (typeof s !== 'string') return '';
  // Strip ASCII C0 control chars (0x00..0x1F) + DEL (0x7F). They could
  // break the schedule row's single-line render or — for terminals — be
  // an injection vector if values are ever logged unsanitized. Replace
  // with a single space so word boundaries survive.
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

function sanitize(raw: unknown): Array<Omit<AacContact, 'id' | 'order'>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Omit<AacContact, 'id' | 'order'>> = [];
  // Truncate aggregate first to bound work even if the portal returned
  // tens of thousands.
  const limited = raw.slice(0, MAX_CONTACTS_PER_SYNC);
  for (const c of limited) {
    if (!c || typeof c !== 'object') continue;
    const cc = c as IntegrationContact;
    const name = sanitizeStr(cc.name, MAX_NAME_LEN);
    const recipientId = sanitizeStr(cc.recipientId, MAX_RECIPIENT_LEN);
    const provider = sanitizeStr(cc.provider, 32) as ContactProvider;
    if (!name || !recipientId) continue;
    if (!VALID_PROVIDERS.has(provider)) continue;
    // Per-provider id format check — drops bad entries (caregiver
    // editing the source erroneously) at the boundary.
    if (!PROVIDERS[provider].validateRecipientId(recipientId)) continue;
    const avatar = sanitizeStr(cc.avatar, MAX_AVATAR_LEN);
    const lastMessagePreview = sanitizeStr(cc.lastMessagePreview, MAX_PREVIEW_LEN);
    out.push({
      name,
      provider,
      recipientId,
      ...(avatar ? { avatar } : {}),
      ...(lastMessagePreview ? { lastMessagePreview } : {}),
    });
  }
  return out;
}

let syncInFlight = false;

/** Fetch contacts from the portal and merge into the local store.
 *  Returns the merge result for callers that want to surface a toast
 *  ("3 new contacts"). Resolves with null on transport failure so
 *  callers can distinguish "no changes" from "couldn't reach". */
export async function syncContactsOnce(): Promise<{ added: number; updated: number } | null> {
  if (syncInFlight) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  syncInFlight = true;
  try {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return null;
    }
    if (!body || typeof body !== 'object') return null;
    const incoming = sanitize((body as { contacts?: unknown }).contacts);
    if (incoming.length === 0) {
      // Endpoint reachable but empty — still bump lastSyncedAt so the
      // UI shows a successful sync. Done by passing [] through merge.
      return useContactsStore.getState().mergeFromIntegrations([]);
    }
    return useContactsStore.getState().mergeFromIntegrations(incoming);
  } finally {
    syncInFlight = false;
  }
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
