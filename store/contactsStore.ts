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
  addContact: (c: Omit<AacContact, 'id' | 'order'>) => string;
  removeContact: (id: string) => void;
  updateContact: (id: string, patch: Partial<Omit<AacContact, 'id'>>) => void;
  reorderContact: (id: string, newOrder: number) => void;
  setContacts: (cs: AacContact[]) => void;
}

let nextId = 1;
const genId = () => `c-${Date.now()}-${nextId++}`;

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: [],
      addContact: (c) => {
        const id = genId();
        const order = get().contacts.length;
        set((s) => ({ contacts: [...s.contacts, { ...c, id, order }] }));
        return id;
      },
      removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      updateContact: (id, patch) => set((s) => ({
        contacts: s.contacts.map((c) => c.id === id ? { ...c, ...patch } : c),
      })),
      reorderContact: (id, newOrder) => set((s) => ({
        contacts: s.contacts.map((c) => c.id === id ? { ...c, order: newOrder } : c),
      })),
      setContacts: (cs) => set({ contacts: cs }),
    }),
    {
      name: 'prism-aac-contacts',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : ({
        getItem: () => null, setItem: () => {}, removeItem: () => {},
      } as unknown as Storage))),
    },
  ),
);
