/**
 * AAC Chat contacts — caregiver-managed list of recipients the AAC user
 * can send messages to.
 *
 * Scope (MVP):
 *   - Local-first via Zustand persist. Synced to Synalux portal in a
 *     follow-up (synalux-private API endpoint TBD).
 *   - Each contact is bound to ONE provider — the contact "Mom" might
 *     be a Telegram chat, "Dad" might be WhatsApp. Avoids the user
 *     having to pick provider per-message.
 *   - Caregiver curates the list via Settings → Contacts (UI in
 *     Caregiver panel; the AAC user only sees the picker).
 *
 * Why not pull from Synalux contacts API: AAC user might be offline /
 * on a slow school connection, and the recipient list must be instant.
 * Background sync from the portal happens when online.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { randomId } from '@/lib/uuid';
import { safeJSONStorage } from '@/lib/safeStorage';
import { PROVIDERS } from '@/lib/messageProviders';

export type ContactProvider =
  | 'telegram'
  | 'whatsapp'
  | 'viber'
  | 'sms'
  | 'messenger'
  | 'instagram'
  | 'mail';

export interface AacContact {
  id: string;
  name: string;
  provider: ContactProvider;
  /** Provider-specific recipient identifier:
   *  - telegram: chat_id (string of digits)
   *  - whatsapp: E.164 phone number
   *  - viber: user_id from Viber Bot
   *  - sms: E.164 phone number
   *  - messenger: PSID (page-scoped user id)
   *  - instagram: IGSID
   *  - mail: email address
   */
  recipientId: string;
  /** Optional emoji or single character for the avatar tile */
  avatar?: string;
  /** Optional last-message preview surfaced in the picker */
  lastMessagePreview?: string;
  /** Sort order — lower = first */
  order: number;
  /** How many times the AAC user has successfully sent to this contact.
   *  Drives the "Frequent" section atop the chat picker (top 5 by
   *  sendCount desc). Persisted; survives reload. */
  sendCount?: number;
  /** Last successful send timestamp (ms). Tiebreaker for sendCount
   *  when two contacts have the same count, so the more-recent one
   *  surfaces first. */
  lastUsedAt?: number;
}

interface ContactsState {
  contacts: AacContact[];
  /** Last successful sync timestamp from the portal /contacts endpoint
   *  — used to throttle automatic refresh + show "last synced" hint in
   *  the caregiver settings panel. 0 = never. */
  lastSyncedAt: number;
  /** Returns the new id, or null if the contact was rejected (cap hit
   *  or invalid input). */
  addContact: (c: Omit<AacContact, 'id' | 'order'>) => string | null;
  removeContact: (id: string) => void;
  updateContact: (id: string, patch: Partial<Omit<AacContact, 'id'>>) => void;
  reorderContact: (id: string, newOrder: number) => void;
  setContacts: (cs: AacContact[]) => void;
  /** Merge a fetched batch with the existing local list. Identity is
   *  per (provider, recipientId) — same external person arriving via the
   *  same provider updates in place, never duplicates. Caregiver-edited
   *  fields (avatar, name override) are preserved on re-sync. New
   *  contacts past MAX_CONTACTS are dropped (oldest-keep-wins). */
  mergeFromIntegrations: (incoming: Array<Omit<AacContact, 'id' | 'order'>>) => { added: number; updated: number };
  /** Bump sendCount + stamp lastUsedAt for a contact. No-op if id is
   *  unknown (contact removed mid-send). Called by the chat panel on
   *  successful send so the Frequent section reorders itself. */
  noteSentTo: (id: string) => void;
}

/** Hard cap on local contact list. AAC pickers past ~200 stop being
 *  usable (motor + cognitive load). Beyond it, caregiver should use
 *  the portal contacts UI. Catch synced-from-portal explosions too. */
export const MAX_CONTACTS = 200;
const MAX_NAME_LEN = 80;
const MAX_RECIPIENT_LEN = 254;
const MAX_AVATAR_LEN = 16;

const VALID_PROVIDERS = new Set<ContactProvider>([
  'telegram', 'whatsapp', 'viber', 'sms', 'messenger', 'instagram', 'mail',
]);

/** Validates one contact entry shape after persisted hydration.
 *  Tampered localStorage (browser extension, sibling-tab on a shared
 *  device, manual devtools edit) could inject arbitrary objects — we
 *  drop anything that doesn't fit. */
function isValidStoredContact(c: unknown): c is AacContact {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  if (typeof x.id !== 'string' || !x.id) return false;
  if (typeof x.name !== 'string' || !x.name || x.name.length > MAX_NAME_LEN) return false;
  if (typeof x.recipientId !== 'string' || !x.recipientId || x.recipientId.length > MAX_RECIPIENT_LEN) return false;
  if (typeof x.provider !== 'string' || !VALID_PROVIDERS.has(x.provider as ContactProvider)) return false;
  if (typeof x.order !== 'number' || !Number.isFinite(x.order) || x.order < 0) return false;
  if (x.avatar !== undefined && (typeof x.avatar !== 'string' || x.avatar.length > MAX_AVATAR_LEN)) return false;
  if (x.lastMessagePreview !== undefined && (typeof x.lastMessagePreview !== 'string' || x.lastMessagePreview.length > 500)) return false;
  if (x.sendCount !== undefined && (typeof x.sendCount !== 'number' || !Number.isFinite(x.sendCount) || x.sendCount < 0)) return false;
  if (x.lastUsedAt !== undefined && (typeof x.lastUsedAt !== 'number' || !Number.isFinite(x.lastUsedAt) || x.lastUsedAt < 0)) return false;
  return true;
}

// Was: `c-${Date.now()}-${counter++}`. Date.now() collisions in fast
// loops could produce dup ids; the counter wasn't shared across the
// new mergeFromIntegrations path either. randomId() is collision-free
// even when the same caller adds 100 contacts in a single tick.
const genId = () => randomId('c-');

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: [],
      lastSyncedAt: 0,
      addContact: (c) => {
        const name = (c.name ?? '').trim().slice(0, MAX_NAME_LEN);
        const recipientId = (c.recipientId ?? '').trim().slice(0, MAX_RECIPIENT_LEN);
        const avatar = c.avatar ? (c.avatar.trim().slice(0, MAX_AVATAR_LEN) || undefined) : undefined;
        if (!name || !recipientId || !c.provider) return null;
        const id = genId();
        // Cap + dup checks moved INSIDE the set callback so they read
        // the freshest committed state. The previous get()-then-set()
        // pattern had the same TOCTOU window addIncomingMessage had
        // before pass 4: two synchronously-back-to-back addContact
        // calls could both pass the cap check and both commit, putting
        // the store one over MAX_CONTACTS. JS is single-threaded so
        // the practical risk is small, but the atomic form is also
        // simpler to reason about and one less subtle invariant.
        let inserted = false;
        set((s) => {
          if (s.contacts.length >= MAX_CONTACTS) return s;
          if (s.contacts.some((x) => x.provider === c.provider && x.recipientId === recipientId)) return s;
          inserted = true;
          return {
            contacts: [
              ...s.contacts,
              { name, provider: c.provider, recipientId, avatar, ...(c.lastMessagePreview ? { lastMessagePreview: c.lastMessagePreview.slice(0, 200) } : {}), id, order: s.contacts.length },
            ],
          };
        });
        return inserted ? id : null;
      },
      removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      updateContact: (id, patch) => set((s) => ({
        contacts: s.contacts.map((c) => {
          if (c.id !== id) return c;
          const next: AacContact = { ...c };
          if (patch.name !== undefined) next.name = patch.name.trim().slice(0, MAX_NAME_LEN);
          if (patch.provider !== undefined) next.provider = patch.provider;
          if (patch.recipientId !== undefined) {
            const trimmed = patch.recipientId.trim().slice(0, MAX_RECIPIENT_LEN);
            // Validate against the (possibly-updated) provider's format
            // so a caregiver can't save "abc" as a phone number via
            // updateContact even though addContact rejects it. Mismatch
            // = ignore the recipientId update; rest of the patch
            // proceeds. Empty string is allowed only as a passthrough.
            const cfg = PROVIDERS[next.provider];
            if (!trimmed || cfg.validateRecipientId(trimmed)) {
              next.recipientId = trimmed;
            }
          }
          if (patch.avatar !== undefined) next.avatar = patch.avatar.trim().slice(0, MAX_AVATAR_LEN) || undefined;
          if (typeof patch.lastMessagePreview === 'string') next.lastMessagePreview = patch.lastMessagePreview.slice(0, 200);
          if (typeof patch.order === 'number' && Number.isFinite(patch.order) && patch.order >= 0) next.order = Math.floor(patch.order);
          return next;
        }),
      })),
      reorderContact: (id, newOrder) => set((s) => {
        if (!Number.isFinite(newOrder) || newOrder < 0) return s;
        return {
          contacts: s.contacts.map((c) => c.id === id ? { ...c, order: newOrder } : c),
        };
      }),
      noteSentTo: (id) => set((s) => ({
        contacts: s.contacts.map((c) =>
          c.id === id
            ? { ...c, sendCount: (c.sendCount ?? 0) + 1, lastUsedAt: Date.now() }
            : c,
        ),
      })),
      setContacts: (cs) => set({ contacts: cs.slice(0, MAX_CONTACTS) }),
      mergeFromIntegrations: (incoming) => {
        let added = 0;
        let updated = 0;
        const current = get().contacts;
        // Index existing by composite key so an incoming person with the
        // same provider+recipientId updates instead of duplicating.
        const byKey = new Map(current.map((c) => [`${c.provider}::${c.recipientId}`, c]));
        const merged = [...current];
        for (const inc of incoming) {
          if (!inc.provider || !inc.recipientId) continue;
          // Reject contacts with unknown providers to prevent prototype pollution
          // or unexpected data from integration sources.
          if (!VALID_PROVIDERS.has(inc.provider as ContactProvider)) continue;
          const key = `${inc.provider}::${inc.recipientId}`;
          const existing = byKey.get(key);
          if (existing) {
            // Refresh server-sourced fields (lastMessagePreview), but
            // keep caregiver-edited name/avatar — the AAC user might
            // know "Mom" by a custom alias the integration doesn't.
            const idx = merged.findIndex((c) => c.id === existing.id);
            if (idx >= 0) {
              merged[idx] = {
                ...existing,
                lastMessagePreview: inc.lastMessagePreview ? inc.lastMessagePreview.slice(0, 200) : existing.lastMessagePreview,
              };
              updated++;
            }
          } else {
            // Cap-aware append — drop new entries that would push past
            // MAX_CONTACTS rather than silently truncating later (which
            // would lose the lower-ordered contacts the user picked).
            if (merged.length >= MAX_CONTACTS) continue;
            merged.push({
              ...inc,
              id: genId(),
              order: merged.length,
            });
            added++;
          }
        }
        set({ contacts: merged, lastSyncedAt: Date.now() });
        return { added, updated };
      },
    }),
    {
      name: 'prism-aac-contacts',
      // Quota-safe wrapper — on QuotaExceededError, drop the lowest-
      // priority data (lastMessagePreview strings, which are server-
      // sourced and refreshed on next sync) so the contact list itself
      // survives. If still over after that, the persist write is lost
      // for this tick; the in-memory state stays intact.
      storage: createJSONStorage(() => safeJSONStorage({
        name: 'prism-aac-contacts',
        onQuotaExceeded: () => {
          useContactsStore.setState((s) => ({
            contacts: s.contacts.map(({ lastMessagePreview, ...c }) => {
              void lastMessagePreview;
              return c;
            }),
          }));
        },
      })),
      // Hydration validator — drops any contact entry that doesn't
      // match the expected shape, then enforces the MAX_CONTACTS cap.
      // Defends against tampered localStorage (browser extension /
      // sibling-tab / manual devtools edit). lastSyncedAt is reset to 0
      // if it wasn't a finite non-negative number.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<ContactsState>;
        const rawList = Array.isArray(incoming.contacts) ? incoming.contacts : [];
        const cleaned = rawList.filter(isValidStoredContact).slice(0, MAX_CONTACTS);
        const lastSyncedAt = typeof incoming.lastSyncedAt === 'number'
          && Number.isFinite(incoming.lastSyncedAt)
          && incoming.lastSyncedAt >= 0
          ? incoming.lastSyncedAt
          : 0;
        return { ...currentState, contacts: cleaned, lastSyncedAt };
      },
    },
  ),
);
