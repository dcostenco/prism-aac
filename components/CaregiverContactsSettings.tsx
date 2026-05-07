'use client';
/**
 * Caregiver-only UI for curating the AAC user's contact list.
 *
 * Shown inside the Settings modal — the AAC user only ever sees the
 * read-only picker in AACChatPanel. Caregivers can:
 *   - Add contacts manually (name + provider + recipient id)
 *   - Edit/remove existing entries
 *   - Trigger an integrations sync (pulls from /api/v1/prism-aac/contacts
 *     so contacts the caregiver added on synalux.ai/chat appear here too)
 *
 * Provider tier hints render so a free-plan caregiver isn't surprised
 * when their WhatsApp contact greys out for the AAC user.
 */
import { useState, useCallback } from 'react';
import { useContactsStore, MAX_CONTACTS, type ContactProvider } from '@/store/contactsStore';
import { useAuthStore } from '@/store/authStore';
import {
  PROVIDERS as PROVIDER_CFG,
  PROVIDER_LABELS,
  PROVIDER_ICONS,
  PROVIDER_MIN_TIER,
  isProviderAvailable,
} from '@/services/sendToContact';
import { syncContactsOnce } from '@/services/contactsIntegrationService';
import { tapFeedback } from '@/services/feedback';

const PROVIDER_LIST: ContactProvider[] = [
  'mail', 'sms', 'telegram', 'whatsapp', 'viber', 'messenger', 'instagram',
];

export default function CaregiverContactsSettings() {
  const contacts = useContactsStore((s) => s.contacts);
  const lastSyncedAt = useContactsStore((s) => s.lastSyncedAt);
  const addContact = useContactsStore((s) => s.addContact);
  const removeContact = useContactsStore((s) => s.removeContact);
  const updateContact = useContactsStore((s) => s.updateContact);
  const profile = useAuthStore((s) => s.profile);
  const plan = profile?.plan ?? 'free';

  const [draftName, setDraftName] = useState('');
  const [draftProvider, setDraftProvider] = useState<ContactProvider>('mail');
  const [draftRecipientId, setDraftRecipientId] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const name = draftName.trim();
    const recipientId = draftRecipientId.trim();
    setDraftError(null);
    if (!name || !recipientId) return;
    // Local format validation against the provider config — gives a
    // useful error before the portal would reject with HTTP 400.
    if (!PROVIDER_CFG[draftProvider].validateRecipientId(recipientId)) {
      setDraftError(`Invalid format for ${PROVIDER_LABELS[draftProvider]} — ${PROVIDER_CFG[draftProvider].recipientHint}`);
      return;
    }
    tapFeedback();
    const id = addContact({ name, provider: draftProvider, recipientId });
    if (id === null) {
      setDraftError(`Could not add — limit is ${MAX_CONTACTS} contacts, or this number is already saved.`);
      return;
    }
    setDraftName('');
    setDraftRecipientId('');
  }, [draftName, draftProvider, draftRecipientId, addContact]);

  const handleSync = useCallback(async () => {
    tapFeedback();
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncContactsOnce();
    setSyncing(false);
    if (res === null) {
      setSyncMsg('Sync unavailable — check your portal connection.');
    } else if (res.added === 0 && res.updated === 0) {
      setSyncMsg('Already up to date.');
    } else {
      setSyncMsg(`+${res.added} new, ${res.updated} updated.`);
    }
    setTimeout(() => setSyncMsg(null), 4000);
  }, []);

  const inputClass = 'w-full surface-key rounded-lg px-3 py-2 text-primary text-base border border-theme';
  const btnPrimary = 'aac-btn rounded-lg px-4 py-2 bg-[#4CAF50] text-white font-bold disabled:opacity-40';
  const btnSecondary = 'aac-btn rounded-lg px-3 py-2 surface-key text-primary border border-theme text-sm';

  return (
    <div className="space-y-3" data-testid="caregiver-contacts-settings">
      {/* Sync row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted text-xs">
          Pulls contacts you connected on synalux.ai/chat (Telegram / WhatsApp / Mail / …).
          {lastSyncedAt ? ` Last synced ${new Date(lastSyncedAt).toLocaleString()}.` : ' Never synced.'}
        </p>
        <button
          className={btnSecondary}
          onClick={handleSync}
          disabled={syncing}
          data-testid="contacts-sync-btn"
        >
          {syncing ? 'Syncing…' : '↻ Sync'}
        </button>
      </div>
      {syncMsg && <p className="text-xs text-[#4CAF50]" data-testid="contacts-sync-msg">{syncMsg}</p>}

      {/* Add new contact */}
      <div className="space-y-2 p-3 surface-key rounded-lg border border-theme">
        <p className="text-primary text-sm font-bold">Add a contact manually</p>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Name (e.g. Mom)"
          className={inputClass}
          data-testid="contact-draft-name"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draftProvider}
            onChange={(e) => { setDraftProvider(e.target.value as ContactProvider); setDraftError(null); }}
            className={inputClass}
            data-testid="contact-draft-provider"
          >
            {PROVIDER_LIST.map((p) => {
              const available = isProviderAvailable(p, plan);
              return (
                <option key={p} value={p}>
                  {PROVIDER_ICONS[p]} {PROVIDER_LABELS[p]}
                  {available ? '' : ` — needs ${PROVIDER_MIN_TIER[p]}`}
                </option>
              );
            })}
          </select>
          <input
            value={draftRecipientId}
            onChange={(e) => { setDraftRecipientId(e.target.value); setDraftError(null); }}
            placeholder={PROVIDER_CFG[draftProvider].recipientHint}
            className={inputClass}
            data-testid="contact-draft-recipient"
            maxLength={254}
          />
        </div>
        {draftError && (
          <p className="text-xs text-[#F44336]" role="alert" data-testid="contact-draft-error">
            {draftError}
          </p>
        )}
        <button
          className={btnPrimary}
          onClick={handleAdd}
          disabled={!draftName.trim() || !draftRecipientId.trim()}
          data-testid="contact-draft-add"
        >
          + Add contact
        </button>
      </div>

      {/* Existing contacts list */}
      {contacts.length === 0 ? (
        <p className="text-muted text-xs">No contacts yet. Add one above or click Sync.</p>
      ) : (
        <ul className="space-y-1" data-testid="contacts-list">
          {[...contacts].sort((a, b) => a.order - b.order).map((c) => {
            const available = isProviderAvailable(c.provider, plan);
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg surface-key border border-theme"
                data-testid={`contact-row-${c.id}`}
              >
                <span className="text-xl shrink-0">{c.avatar || PROVIDER_ICONS[c.provider]}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-primary text-sm font-bold block truncate">{c.name}</span>
                  <span className="text-muted text-xs block truncate">
                    {PROVIDER_LABELS[c.provider]} · {c.recipientId}
                    {!available && (
                      <span className="ml-2 text-[#FF9800]" data-testid={`tier-locked-${c.id}`}>
                        🔒 {PROVIDER_MIN_TIER[c.provider]} plan
                      </span>
                    )}
                  </span>
                </span>
                <button
                  className="aac-btn w-7 h-7 rounded-md surface-bar text-primary text-sm border border-theme"
                  onClick={() => {
                    tapFeedback();
                    const next = prompt('Rename contact', c.name);
                    if (next && next.trim()) updateContact(c.id, { name: next.trim() });
                  }}
                  aria-label={`Rename ${c.name}`}
                  title="Rename"
                >✎</button>
                <button
                  className="aac-btn w-7 h-7 rounded-md bg-[#F44336] text-white text-xs"
                  onClick={() => { tapFeedback(); if (confirm(`Remove ${c.name}?`)) removeContact(c.id); }}
                  aria-label={`Remove ${c.name}`}
                  title="Remove"
                  data-testid={`contact-remove-${c.id}`}
                >×</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
