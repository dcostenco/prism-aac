/**
 * contactsStore — actions not covered by contacts-store-integration.test.ts
 *
 * The integration suite covers mergeFromIntegrations (add/update/cap),
 * addContact (dup + cap + validation), updateContact recipientId validation,
 * and syncContactsOnce network paths. These tests cover the remaining
 * action paths:
 *
 *   removeContact — deletes by id; must not remove adjacent contacts.
 *   A broken remove either silently keeps the deleted contact (privacy
 *   issue) or removes the wrong contact (AAC user loses a caregiver).
 *
 *   reorderContact — changes the order field of one contact. Broken
 *   reorder can leave the picker permanently in the wrong order.
 *
 *   noteSentTo — bumps sendCount and stamps lastUsedAt on a successful
 *   send. Broken noteSentTo means the Frequent section never reorders,
 *   so the AAC user always sees contacts in caregiver-set order even
 *   after weeks of use.
 *
 *   setContacts — bulk replace used by the portal sync path. Must cap
 *   at MAX_CONTACTS to prevent an oversized server payload from flooding
 *   the local store.
 *
 *   updateContact — name/avatar/order updates beyond what the integration
 *   test covers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useContactsStore, MAX_CONTACTS } from '@/store/contactsStore';
import type { AacContact } from '@/store/contactsStore';

function makeContact(overrides: Partial<Omit<AacContact, 'id'>> = {}): Omit<AacContact, 'id' | 'order'> {
  return {
    name: 'Test Contact',
    provider: 'telegram',
    recipientId: '123456789',
    ...overrides,
  };
}

beforeEach(() => {
  useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
});

// ── removeContact ─────────────────────────────────────────────────────────────

describe('contactsStore — removeContact', () => {
  it('removes the targeted contact', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().removeContact(id);
    expect(useContactsStore.getState().contacts.find(c => c.id === id)).toBeUndefined();
  });

  it('does not remove other contacts', () => {
    const id1 = useContactsStore.getState().addContact(makeContact({ name: 'Keep', recipientId: '111' }))!;
    const id2 = useContactsStore.getState().addContact(makeContact({ name: 'Delete', recipientId: '222' }))!;
    const id3 = useContactsStore.getState().addContact(makeContact({ name: 'Also keep', recipientId: '333' }))!;
    useContactsStore.getState().removeContact(id2);
    const ids = useContactsStore.getState().contacts.map(c => c.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id3);
    expect(ids).not.toContain(id2);
  });

  it('no-op for unknown id — contacts array unchanged', () => {
    useContactsStore.getState().addContact(makeContact());
    const before = useContactsStore.getState().contacts.length;
    useContactsStore.getState().removeContact('does-not-exist');
    expect(useContactsStore.getState().contacts.length).toBe(before);
  });

  it('leaves store empty after removing the last contact', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().removeContact(id);
    expect(useContactsStore.getState().contacts).toHaveLength(0);
  });
});

// ── reorderContact ────────────────────────────────────────────────────────────

describe('contactsStore — reorderContact', () => {
  it('updates the order field of the target contact', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().reorderContact(id, 5);
    const contact = useContactsStore.getState().contacts.find(c => c.id === id)!;
    expect(contact.order).toBe(5);
  });

  it('does not change order fields of other contacts', () => {
    const id1 = useContactsStore.getState().addContact(makeContact({ recipientId: '111' }))!;
    const id2 = useContactsStore.getState().addContact(makeContact({ recipientId: '222' }))!;
    const originalOrder = useContactsStore.getState().contacts.find(c => c.id === id1)!.order;
    useContactsStore.getState().reorderContact(id2, 10);
    expect(useContactsStore.getState().contacts.find(c => c.id === id1)!.order).toBe(originalOrder);
  });

  it('no-op for negative newOrder — contacts unchanged', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    const before = useContactsStore.getState().contacts.find(c => c.id === id)!.order;
    useContactsStore.getState().reorderContact(id, -1);
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.order).toBe(before);
  });

  it('no-op for NaN newOrder', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    const before = useContactsStore.getState().contacts.find(c => c.id === id)!.order;
    useContactsStore.getState().reorderContact(id, NaN);
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.order).toBe(before);
  });
});

// ── noteSentTo ────────────────────────────────────────────────────────────────

describe('contactsStore — noteSentTo', () => {
  it('increments sendCount from 0 to 1', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().noteSentTo(id);
    const contact = useContactsStore.getState().contacts.find(c => c.id === id)!;
    expect(contact.sendCount).toBe(1);
  });

  it('increments sendCount on every call', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().noteSentTo(id);
    useContactsStore.getState().noteSentTo(id);
    useContactsStore.getState().noteSentTo(id);
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.sendCount).toBe(3);
  });

  it('stamps lastUsedAt to a positive timestamp', () => {
    const before = Date.now();
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().noteSentTo(id);
    const ts = useContactsStore.getState().contacts.find(c => c.id === id)!.lastUsedAt!;
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it('no-op for unknown id — does not throw', () => {
    useContactsStore.getState().addContact(makeContact());
    expect(() => {
      useContactsStore.getState().noteSentTo('ghost-id');
    }).not.toThrow();
    expect(useContactsStore.getState().contacts[0].sendCount).toBeUndefined();
  });

  it('only updates the targeted contact, not others', () => {
    const id1 = useContactsStore.getState().addContact(makeContact({ recipientId: '111' }))!;
    const id2 = useContactsStore.getState().addContact(makeContact({ recipientId: '222' }))!;
    useContactsStore.getState().noteSentTo(id1);
    expect(useContactsStore.getState().contacts.find(c => c.id === id2)!.sendCount).toBeUndefined();
  });
});

// ── setContacts ───────────────────────────────────────────────────────────────

describe('contactsStore — setContacts', () => {
  it('replaces the contacts list', () => {
    useContactsStore.getState().addContact(makeContact({ name: 'Old', recipientId: '000' }));
    const newContacts: AacContact[] = [
      { id: 'nc-1', name: 'New', provider: 'telegram', recipientId: '111', order: 0 },
    ];
    useContactsStore.getState().setContacts(newContacts);
    const contacts = useContactsStore.getState().contacts;
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('New');
  });

  it('caps the list at MAX_CONTACTS', () => {
    const many: AacContact[] = Array.from({ length: MAX_CONTACTS + 10 }, (_, i) => ({
      id: `c-${i}`, name: `Contact ${i}`, provider: 'telegram', recipientId: `id-${i}`, order: i,
    }));
    useContactsStore.getState().setContacts(many);
    expect(useContactsStore.getState().contacts).toHaveLength(MAX_CONTACTS);
  });

  it('accepts an empty array (wipes contacts)', () => {
    useContactsStore.getState().addContact(makeContact());
    useContactsStore.getState().setContacts([]);
    expect(useContactsStore.getState().contacts).toHaveLength(0);
  });
});

// ── updateContact ─────────────────────────────────────────────────────────────

describe('contactsStore — updateContact name/avatar/order', () => {
  it('updates the contact name, trimmed and clamped', () => {
    const id = useContactsStore.getState().addContact(makeContact({ name: 'Old Name' }))!;
    useContactsStore.getState().updateContact(id, { name: '  New Name  ' });
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.name).toBe('New Name');
  });

  it('clamps name to 80 chars', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().updateContact(id, { name: 'x'.repeat(100) });
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.name.length).toBe(80);
  });

  it('updates avatar, trimmed and clamped to 16 chars', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().updateContact(id, { avatar: '❤️' });
    const avatar = useContactsStore.getState().contacts.find(c => c.id === id)!.avatar;
    expect(avatar).toBeDefined();
    expect(avatar!.length).toBeLessThanOrEqual(16);
  });

  it('updates order when a valid positive integer is given', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().updateContact(id, { order: 3 });
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.order).toBe(3);
  });

  it('floors order to integer', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    useContactsStore.getState().updateContact(id, { order: 2.9 });
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.order).toBe(2);
  });

  it('ignores negative order', () => {
    const id = useContactsStore.getState().addContact(makeContact())!;
    const before = useContactsStore.getState().contacts.find(c => c.id === id)!.order;
    useContactsStore.getState().updateContact(id, { order: -1 });
    expect(useContactsStore.getState().contacts.find(c => c.id === id)!.order).toBe(before);
  });

  it('does not affect other contacts', () => {
    const id1 = useContactsStore.getState().addContact(makeContact({ recipientId: '111', name: 'Alice' }))!;
    const id2 = useContactsStore.getState().addContact(makeContact({ recipientId: '222', name: 'Bob' }))!;
    useContactsStore.getState().updateContact(id1, { name: 'Alice Updated' });
    expect(useContactsStore.getState().contacts.find(c => c.id === id2)!.name).toBe('Bob');
  });
});
