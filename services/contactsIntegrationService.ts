/**
 * Contacts integration — mirrors connected-provider contacts from the
 * Synalux portal into the AAC client's local contact list.
 *
 * Why mirror instead of fetch-on-open: the AAC user opens the picker
 * expecting an instant grid. A round-trip to the portal on every open
 * would mean a blank screen on flaky school Wi-Fi for 1-3s — long
 * enough for an AAC user with motor/cognitive load to give up.
 *
 * Endpoint contract (Synalux Portal):
 *   GET /api/v1/prism-aac/contacts
 *   →   { contacts: Array<{
 *           name: string;
 *           provider: ContactProvider;
 *           recipientId: string;
 *           avatar?: string;
 *           lastMessagePreview?: string;
 *           sourceProvider?: 'google';
 *         }>,
 *         syncedSources: Array<'google'>,
 *         disconnectedSources: Array<'google'>,
 *         serverTime: number }
 *
 * Behavior on missing/erroring endpoint:
 *   - 404 / network error: silently no-op (endpoint not shipped, or
 *     offline). Local list keeps working.
 *   - 401: skip; authStore handles reauth elsewhere.
 */
import {
  useContactsStore,
  type AacContact,
  type ContactProvider,
  type IntegrationContactSource,
} from '@/store/contactsStore';
import { useAuthStore } from '@/store/authStore';
import { PROVIDERS } from '@/lib/messageProviders';
import { portalFetch } from '@/services/portalClient';
import { sanitizeString, SAFE_LIMITS } from '@/lib/safeStrings';
import { reportSwallowedError } from '@/lib/devLog';

const reportSyncError = reportSwallowedError('contactsIntegrationService.syncContactsOnce');

// Path is portal-relative; portalFetch prepends the SYNALUX_API base.
const ENDPOINT = '/prism-aac/contacts';
// Match the inbox poller cadence — 5min is enough for caregiver-side
// edits (add new family member) to land without spamming the portal.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SYNC_TIMEOUT_MS = 8_000;
/** Hard cap on contacts per sync — paranoia against a runaway portal
 *  query returning the entire contact graph. The picker would be
 *  unusable past this anyway. Per-field length caps come from
 *  lib/safeStrings.SAFE_LIMITS so a single change ripples everywhere. */
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
  sourceProvider?: string;
}

const VALID_SOURCES = new Set<IntegrationContactSource>(['google']);

function sanitizeSources(raw: unknown): IntegrationContactSource[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(
    (source): source is IntegrationContactSource => typeof source === 'string'
      && VALID_SOURCES.has(source as IntegrationContactSource),
  ))];
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
    const name = sanitizeString(cc.name, SAFE_LIMITS.name);
    const recipientId = sanitizeString(cc.recipientId, SAFE_LIMITS.recipientId);
    const provider = sanitizeString(cc.provider, SAFE_LIMITS.providerCode) as ContactProvider;
    if (!name || !recipientId) continue;
    if (!VALID_PROVIDERS.has(provider)) continue;
    // Per-provider id format check — drops bad entries (caregiver
    // editing the source erroneously) at the boundary.
    if (!PROVIDERS[provider].validateRecipientId(recipientId)) continue;
    const avatar = sanitizeString(cc.avatar, SAFE_LIMITS.avatar);
    const lastMessagePreview = sanitizeString(cc.lastMessagePreview, SAFE_LIMITS.preview);
    const sourceProvider = sanitizeString(cc.sourceProvider, SAFE_LIMITS.providerCode);
    if (sourceProvider && !VALID_SOURCES.has(sourceProvider as IntegrationContactSource)) continue;
    out.push({
      name,
      provider,
      recipientId,
      ...(avatar ? { avatar } : {}),
      ...(lastMessagePreview ? { lastMessagePreview } : {}),
      ...(sourceProvider ? { sourceProvider: sourceProvider as IntegrationContactSource } : {}),
    });
  }
  return out;
}

let syncInFlight = false;

export interface SyncOutcome {
  added: number;
  updated: number;
  removed: number;
  /** Per-source advisory strings from the portal — e.g.
   *  "Reconnect Gmail to grant Contacts permission" when the user
   *  authorized Gmail but not the contacts.readonly scope needed by
   *  the People API. UI surfaces these so the caregiver knows why
   *  "Synced — 0 contacts" happened. */
  notes: string[];
}

/** Fetch contacts from the portal and merge into the local store.
 *  Returns the merge result for callers that want to surface a toast
 *  ("3 new contacts"). Resolves with null on transport failure so
 *  callers can distinguish "no changes" from "couldn't reach". */
export async function syncContactsOnce(): Promise<SyncOutcome | null> {
  if (syncInFlight) return null;
  // Skip when not signed in — session-cookie gated, would 401 forever.
  if (!useAuthStore.getState().profile) return null;
  syncInFlight = true;
  try {
    const res = await portalFetch<{
      contacts?: unknown;
      notes?: unknown;
      syncedSources?: unknown;
      disconnectedSources?: unknown;
    }>({
      path: ENDPOINT,
      timeoutMs: SYNC_TIMEOUT_MS,
    });
    if (!res.ok) return null;
    const body = res.data;
    if (!body || typeof body !== 'object') return null;
    const incoming = sanitize(body.contacts);
    const notes = Array.isArray(body.notes)
      ? body.notes.filter((n): n is string => typeof n === 'string').slice(0, 8)
      : [];
    const reportedSynced = sanitizeSources(body.syncedSources);
    const reportedDisconnected = sanitizeSources(body.disconnectedSources);
    // A contradictory source state is not authoritative. Retain local data
    // instead of choosing a destructive interpretation.
    const contradictory = new Set(
      reportedSynced.filter((source) => reportedDisconnected.includes(source)),
    );
    const syncedSources = reportedSynced.filter((source) => !contradictory.has(source));
    const disconnectedSources = reportedDisconnected.filter((source) => !contradictory.has(source));
    // Endpoint reachable (even with no rows) — bump lastSyncedAt so the
    // settings UI shows a successful sync.
    const merge = useContactsStore.getState().mergeFromIntegrations(
      incoming,
      { authoritativeSources: syncedSources },
    );
    const disconnectedRemoved = useContactsStore.getState()
      .removeIntegrationContacts(disconnectedSources);
    return { ...merge, removed: merge.removed + disconnectedRemoved, notes };
  } finally {
    syncInFlight = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startContactsSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (intervalId !== null) return stopContactsSync;
  // `.catch(reportSyncError)` swallows unhandled rejection from any future
  // refactor that introduces a throw above syncContactsOnce' try block.
  syncContactsOnce().catch(reportSyncError);
  intervalId = setInterval(() => { syncContactsOnce().catch(reportSyncError); }, SYNC_INTERVAL_MS);
  return stopContactsSync;
}

export function stopContactsSync(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
