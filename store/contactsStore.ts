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
}

/** Hard cap on local contact list. AAC pickers past ~200 stop being
 *  usable (motor + cognitive load). Beyond it, caregiver should use
 *  the portal contacts UI. Catch synced-from-portal explosions too. */
export const MAX_CONTACTS = 200;
const MAX_NAME_LEN = 80;
const MAX_RECIPIENT_LEN = 254;
const MAX_AVATAR_LEN = 16;

let nextId = 1;
const genId = () => `c-${Date.now()}-${nextId++}`;

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
        const current = get().contacts;
        if (current.length >= MAX_CONTACTS) return null;
        // Reject exact (provider, recipientId) dup so the manual-add
        // form doesn't silently create a second "Mom" tile.
        if (current.some((x) => x.provider === c.provider && x.recipientId === recipientId)) return null;
        const id = genId();
        const order = current.length;
        set({ contacts: [...current, { name, provider: c.provider, recipientId, avatar, lastMessagePreview: c.lastMessagePreview, id, order }] });
        return id;
      },
      removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      updateContact: (id, patch) => set((s) => ({
        contacts: s.contacts.map((c) => {
          if (c.id !== id) return c;
          const next: AacContact = { ...c };
          if (patch.name !== undefined) next.name = patch.name.trim().slice(0, MAX_NAME_LEN);
          if (patch.recipientId !== undefined) next.recipientId = patch.recipientId.trim().slice(0, MAX_RECIPIENT_LEN);
          if (patch.provider !== undefined) next.provider = patch.provider;
          if (patch.avatar !== undefined) next.avatar = patch.avatar.trim().slice(0, MAX_AVATAR_LEN) || undefined;
          if (patch.lastMessagePreview !== undefined) next.lastMessagePreview = patch.lastMessagePreview;
          if (patch.order !== undefined) next.order = patch.order;
          return next;
        }),
      })),
      reorderContact: (id, newOrder) => set((s) => ({
        contacts: s.contacts.map((c) => c.id === id ? { ...c, order: newOrder } : c),
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
                lastMessagePreview: inc.lastMessagePreview ?? existing.lastMessagePreview,
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
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : ({
        getItem: () => null, setItem: () => {}, removeItem: () => {},
      } as unknown as Storage))),
    },
  ),
);
