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
import { useState, useCallback, useEffect, useRef } from 'react';
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
import { subscribeToIntegrationEvents } from '@/services/integrationsService';
import { tapFeedback } from '@/services/feedback';
import IntegrationsSettings from './IntegrationsSettings';

const PROVIDER_LIST: ContactProvider[] = [
  'mail', 'sms', 'telegram', 'whatsapp', 'viber', 'messenger', 'instagram',
];

// Mask sensitive recipient IDs (phone numbers, emails)
function maskRecipientId(id: string, provider: string): string {
  if (provider === 'sms' || provider === 'whatsapp' || provider === 'viber') {
    // E.164 phone: show last 4 digits
    return id.length > 4 ? `+***${id.slice(-4)}` : '****';
  }
  if (id.includes('@')) {
    // Email: show first char and domain
    const [local, domain] = id.split('@');
    return `${local?.[0] ?? '*'}***@${domain ?? '***'}`;
  }
  // Default: show last 4 chars only
  return id.length > 4 ? `***${id.slice(-4)}` : '****';
}

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
  // Collapse the "Add a contact manually" form by default when contacts
  // already exist — caregivers usually open Settings to see their list
  // or trigger Sync, not to type one in. The form expands on tap of the
  // "+ Add manually" header. When contacts.length===0 the form starts
  // expanded so the user has somewhere to start.
  // Initial: collapsed when contacts already exist, expanded for fresh
  // accounts so the user has somewhere to start. Stays whatever the
  // user last toggled it to (state, not derived).
  const [manualOpen, setManualOpen] = useState(() => contacts.length === 0);
  // TEMP DIAG (May 2026 — user reports form auto-collapses ~1 sec after
  // expand click). Logs mount/unmount + every manualOpen state change
  // so we can tell remount-vs-state-reset from the next console paste.
  useEffect(() => {
    console.log('[contacts-diag] CaregiverContactsSettings MOUNT, manualOpen=', manualOpen, 'contacts.length=', contacts.length);
    return () => console.log('[contacts-diag] CaregiverContactsSettings UNMOUNT');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    console.log('[contacts-diag] manualOpen changed →', manualOpen);
  }, [manualOpen]);
  // Per-source advisories from the portal — e.g. "Reconnect Gmail to
  // grant Contacts permission". Without surfacing these, a 0-contact
  // sync looks broken when really the user just hasn't granted the
  // contacts.readonly scope yet.
  const [syncNotes, setSyncNotes] = useState<string[]>([]);
  // Inline edit state — replaces window.prompt() so tablet AAC users
  // (and screen-reader caregivers) get a real form instead of a modal
  // dialog they may not be able to dismiss.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // Inline confirm state — replaces window.confirm() with a small
  // two-button row so destructive actions remain reversible-by-cancel.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // Prevent setSyncMsg(null) from firing on an unmounted component when
  // the user navigates away mid-sync.
  const mountedRef = useRef(true);
  const syncMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    mountedRef.current = false;
    if (syncMsgTimerRef.current) clearTimeout(syncMsgTimerRef.current);
  }, []);

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
      setSyncNotes([]);
    } else if (res.added === 0 && res.updated === 0) {
      // Distinguish "already up to date with N contacts" from
      // "no contacts came back at all" — the latter means the user
      // probably needs to reconnect with broader scope. Without the
      // distinction the UX reads as "sync works fine, you have 0
      // friends" which is wrong.
      const haveContacts = useContactsStore.getState().contacts.length > 0;
      setSyncMsg(haveContacts ? 'Already up to date.' : 'Synced — 0 contacts available yet.');
      setSyncNotes(res.notes ?? []);
    } else {
      setSyncMsg(`+${res.added} new, ${res.updated} updated.`);
      setSyncNotes(res.notes ?? []);
    }
    if (syncMsgTimerRef.current) clearTimeout(syncMsgTimerRef.current);
    syncMsgTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setSyncMsg(null);
    }, 4000);
  }, []);

  // When IntegrationsSettings broadcasts a 'provider-connected' event
  // (caregiver finished an OAuth popup), automatically pull contacts
  // so the row list refreshes without a separate Sync click.
  useEffect(() => {
    const unsub = subscribeToIntegrationEvents((ev) => {
      if (ev.type === 'provider-connected') {
        handleSync();
      }
    });
    return unsub;
  }, [handleSync]);

  const inputClass = 'w-full surface-key rounded-lg px-3 py-2 text-primary text-base border border-theme';
  const btnPrimary = 'aac-btn rounded-lg px-4 py-2 bg-[#4CAF50] text-white font-bold disabled:opacity-40';
  const btnSecondary = 'aac-btn rounded-lg px-3 py-2 surface-key text-primary border border-theme text-sm';

  return (
    <div className="space-y-3" data-testid="caregiver-contacts-settings">
      {/* In-app integrations connect grid — replaces the prior dead-end
          "Pulls contacts you connected on synalux.ai/chat" copy. The
          caregiver authorizes Telegram / Slack / Gmail / Outlook / etc.
          via popup, never leaving PrismAAC. Contacts re-sync
          automatically on each successful connect (handleSync runs
          via subscribeToIntegrationEvents above). */}
      <IntegrationsSettings />

      {/* Manual sync remains available as an escape hatch — useful if
          a caregiver added a contact on the portal in another window
          and wants it to appear here without re-connecting. */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-theme">
        <p className="text-muted text-[11px]">
          {lastSyncedAt ? `Contacts last synced ${new Date(lastSyncedAt).toLocaleString()}.` : 'Connect a provider above to pull contacts.'}
        </p>
        <button
          className={btnSecondary}
          onClick={handleSync}
          disabled={syncing}
          data-testid="contacts-sync-btn"
        >
          {syncing ? 'Syncing…' : '↻ Sync now'}
        </button>
      </div>
      {syncMsg && <p className="text-xs text-[#4CAF50]" data-testid="contacts-sync-msg">{syncMsg}</p>}
      {syncNotes.length > 0 && (
        // Per-source advisories (e.g. "Reconnect Gmail to grant
        // Contacts permission"). Amber, not red — sync succeeded;
        // these are next-step CTAs not failures.
        <ul className="text-xs text-[#FF9800] space-y-0.5" data-testid="contacts-sync-notes">
          {syncNotes.map((n, i) => (<li key={i}>• {n}</li>))}
        </ul>
      )}

      {/* Add new contact — collapsed by default when contacts already exist */}
      <div className="space-y-2 p-3 surface-key rounded-lg border border-theme">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          aria-expanded={manualOpen}
          aria-controls="manual-add-body"
          className="w-full flex items-center justify-between text-left"
          data-testid="manual-add-toggle"
        >
          <span className="text-primary text-sm font-bold">＋ Add a contact manually</span>
          <span className="text-muted text-sm shrink-0" aria-hidden>{manualOpen ? '▾' : '▸'}</span>
        </button>
        {manualOpen && (
        <div id="manual-add-body" className="space-y-2 pt-2">
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
        {(!draftName.trim() || !draftRecipientId.trim()) && (
          // Without this, the disabled state looks "permanently broken"
          // — users (esp. caregivers tapping on iPad) don't realize the
          // green button enables once both fields are filled.
          <p className="text-muted text-[11px]" data-testid="contact-draft-hint">
            Type a name and {PROVIDER_CFG[draftProvider].recipientHint.toLowerCase()} to enable.
          </p>
        )}
        </div>
        )}
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
                {editingId === c.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingName.trim()) updateContact(c.id, { name: editingName.trim() });
                        setEditingId(null);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => {
                      if (editingName.trim() && editingName.trim() !== c.name) {
                        updateContact(c.id, { name: editingName.trim() });
                      }
                      setEditingId(null);
                    }}
                    maxLength={80}
                    className="flex-1 surface-key rounded-md px-2 py-1 text-primary text-sm border border-theme"
                    data-testid={`contact-edit-${c.id}`}
                    aria-label={`Rename contact ${c.name}`}
                  />
                ) : (
                  <span className="flex-1 min-w-0">
                    <span className="text-primary text-sm font-bold block truncate">{c.name}</span>
                    <span className="text-muted text-xs block truncate">
                      {PROVIDER_LABELS[c.provider]} · {maskRecipientId(c.recipientId, c.provider)}
                      {!available && (
                        <span className="ml-2 text-[#FF9800]" data-testid={`tier-locked-${c.id}`}>
                          🔒 {PROVIDER_MIN_TIER[c.provider]} plan
                        </span>
                      )}
                    </span>
                  </span>
                )}
                {confirmRemoveId === c.id ? (
                  <>
                    <button
                      className="aac-btn h-7 px-2 rounded-md bg-[#F44336] text-white text-xs font-bold"
                      onClick={() => { tapFeedback(); removeContact(c.id); setConfirmRemoveId(null); }}
                      data-testid={`contact-confirm-remove-${c.id}`}
                      aria-label={`Confirm remove ${c.name}`}
                    >Remove?</button>
                    <button
                      className="aac-btn h-7 px-2 rounded-md surface-bar text-primary text-xs border border-theme"
                      onClick={() => { tapFeedback(); setConfirmRemoveId(null); }}
                      data-testid={`contact-cancel-remove-${c.id}`}
                      aria-label="Cancel remove"
                    >×</button>
                  </>
                ) : (
                  <>
                    <button
                      className="aac-btn w-7 h-7 rounded-md surface-bar text-primary text-sm border border-theme"
                      onClick={() => {
                        tapFeedback();
                        setEditingName(c.name);
                        setEditingId(c.id);
                        setConfirmRemoveId(null);
                      }}
                      aria-label={`Rename ${c.name}`}
                      title="Rename"
                      data-testid={`contact-rename-${c.id}`}
                    >✎</button>
                    <button
                      className="aac-btn w-7 h-7 rounded-md bg-[#F44336] text-white text-xs"
                      onClick={() => { tapFeedback(); setConfirmRemoveId(c.id); setEditingId(null); }}
                      aria-label={`Remove ${c.name}`}
                      title="Remove"
                      data-testid={`contact-remove-${c.id}`}
                    >×</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
