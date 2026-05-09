'use client';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useContactsStore, type AacContact } from '@/store/contactsStore';
import { useAuthStore } from '@/store/authStore';
import {
  sendToContact,
  PROVIDER_LABELS,
  PROVIDER_ICONS,
  PROVIDER_MIN_TIER,
  isProviderAvailable,
} from '@/services/sendToContact';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

/** Renders one tile in either the Frequent or All-contacts grid.
 *  Sectioned via `section` so a contact appearing in BOTH lists has
 *  unique data-testid + React keys (otherwise React warns about
 *  duplicate keys when the user has only 1-5 contacts and they all
 *  show in both). */
function renderContactTile(
  c: AacContact,
  available: boolean,
  onPick: (id: string) => void,
  section: 'freq' | 'all',
): React.ReactElement {
  return (
    <li key={`${section}:${c.id}`}>
      <button
        onClick={() => onPick(c.id)}
        className={`aac-key surface-key text-primary rounded-lg w-full px-3 py-2 text-left flex items-center gap-3 min-h-[52px] ${available ? '' : 'opacity-60'}`}
        data-testid={`aac-chat-contact-${section}-${c.id}`}
        aria-label={available ? c.name : `${c.name} — requires ${PROVIDER_MIN_TIER[c.provider]} plan`}
      >
        <span aria-hidden className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-white/10">
          {c.avatar
            ? <img src={c.avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
            : <span className="text-2xl">{PROVIDER_ICONS[c.provider]}</span>
          }
        </span>
        <span className="flex flex-col min-w-0 flex-1">
          <span className="font-bold truncate">{c.name}</span>
          <span className="text-xs text-secondary truncate">
            {PROVIDER_LABELS[c.provider]}
            {c.lastMessagePreview ? ` · ${c.lastMessagePreview}` : ''}
          </span>
        </span>
        {!available && (
          <span
            className="text-[10px] text-[#FF9800] font-bold flex-shrink-0"
            data-testid={`aac-chat-locked-${c.id}`}
          >
            🔒 {PROVIDER_MIN_TIER[c.provider]}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * AAC Chat — send messages to real people via Telegram / WhatsApp /
 * Viber / SMS / Messenger / Instagram / Mail.
 *
 * Flow:
 *   1. Open AAC Chat → CONTACT PICKER (caregiver-pre-configured list)
 *   2. Tap a contact → CHAT VIEW (compose using main AAC keyboard above)
 *   3. Type via the AAC keyboard (which stays visible per PrismApp's
 *      keyboardHidden gate).
 *   4. Tap Send → POST to provider's /api/v1/<provider>/send
 *   5. Success: clear the message bar, toast confirms.
 *   6. Failure: leave bar intact for retry.
 *
 * Caregiver curates contacts via Settings → Contacts (not in this
 * panel). This component is read-only on contacts so the AAC user
 * cannot accidentally lose them.
 */
export default function AACChatPanel() {
  const { sidePanel, closeSidePanel, activeContactId, selectContact, backToContacts, toggleSettings } = useUIStore();
  const { text, clearAll } = useMessageStore();
  const contacts = useContactsStore((s) => s.contacts);
  const profile = useAuthStore((s) => s.profile);
  const plan = profile?.plan ?? 'free';
  const noteSentTo = useContactsStore((s) => s.noteSentTo);
  const { t } = useT();
  // t() returns the raw key when no translation is loaded for it
  // (engine/i18n.ts:147 — `loaded[lang]?.[key] ?? loaded.en?.[key] ?? key`).
  // That breaks the `t('x') || 'fallback'` pattern because the key
  // string is truthy. tx() detects the round-trip and falls through.
  // Without this you see literal "aac_chat_add_contact" in the UI
  // when an English string is missing — caregivers screenshot it
  // and report it as a bug.
  const tx = useCallback((key: string, fallback: string): string => {
    const v = t(key);
    return v === key ? fallback : v;
  }, [t]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Track mount + clear pending toast timer on unmount. Without this,
  // the 3-second toast-clear setTimeout would call setState on an
  // unmounted component when the user closes the panel mid-toast,
  // tripping React 18's "can't perform a React state update on an
  // unmounted component" warning.
  const mountedRef = useRef(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    mountedRef.current = false;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);
  // If sync deletes (or the caregiver removes) the active contact while
  // the AAC user is staring at the compose view, the panel was leaving
  // the user with a half-empty chat shell and no useful action. Snap
  // back to the picker so the user always has somewhere to go.
  useEffect(() => {
    if (activeContactId && !contacts.some((c) => c.id === activeContactId)) {
      backToContacts();
    }
  }, [activeContactId, contacts, backToContacts]);
  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 3000);
  }, []);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.order - b.order),
    [contacts],
  );
  // Frequent = top N by sendCount desc, then lastUsedAt desc as tiebreak.
  // We only surface contacts the user has actually messaged (sendCount > 0)
  // — promoting a never-used contact to "Frequent" would be a lie.
  const FREQUENT_LIMIT = 5;
  const frequentContacts = useMemo(() => {
    const used = contacts.filter((c) => (c.sendCount ?? 0) > 0);
    used.sort((a, b) => {
      const dc = (b.sendCount ?? 0) - (a.sendCount ?? 0);
      if (dc !== 0) return dc;
      return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    });
    return used.slice(0, FREQUENT_LIMIT);
  }, [contacts]);
  const activeContact: AacContact | undefined = useMemo(
    () => sortedContacts.find((c) => c.id === activeContactId),
    [sortedContacts, activeContactId],
  );
  const activeContactAvailable = activeContact
    ? isProviderAvailable(activeContact.provider, plan)
    : true;

  // Other providers for the same person — quick-switch chips in compose header.
  const siblingContacts = useMemo(() => {
    if (!activeContact) return [];
    const name = activeContact.name.toLowerCase().trim();
    return contacts.filter(
      (c) => c.id !== activeContact.id && c.name.toLowerCase().trim() === name
    );
  }, [activeContact, contacts]);

  const handlePickContact = useCallback((id: string) => {
    tapFeedback();
    selectContact(id);
  }, [selectContact]);

  const handleBack = useCallback(() => {
    tapFeedback();
    backToContacts();
  }, [backToContacts]);

  const handleSend = useCallback(async () => {
    if (!activeContact || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    // Snapshot contact + text at submit time. Without these snapshots,
    // a slow network + a user who taps "Back to contacts" or selects a
    // different person mid-await would (a) show a success toast naming
    // the NEW contact even though we sent to the OLD one, and (b) blow
    // away whatever they started typing for the new contact via the
    // unconditional clearAll(). Both are silent data-loss bugs the AAC
    // user can't articulate.
    const submittedContact = activeContact;
    const submittedText = trimmed;
    tapFeedback();
    setSending(true);
    const res = await sendToContact(submittedContact, submittedText, plan);
    if (!mountedRef.current) return; // user closed the panel mid-await
    setSending(false);
    if (res.ok) {
      // Bump usage so this contact rises in the Frequent section.
      noteSentTo(submittedContact.id);
      const baseMsg = tx('aac_chat_sent', `Sent to ${submittedContact.name}`);
      flashToast(res.truncated ? `${baseMsg} (shortened to fit)` : baseMsg);
      // Only clear the keyboard buffer if the user hasn't started a new
      // message in the meantime. `text` from the closure is stale by now;
      // we read fresh from the store and compare to the captured value.
      const liveText = useMessageStore.getState().text;
      if (liveText.trim() === submittedText) clearAll();
    } else if (res.error.startsWith('tier_required:')) {
      const required = res.error.split(':')[1];
      flashToast(`${submittedContact.name}: requires ${required} plan`);
    } else if (res.error === 'invalid_recipient_id') {
      flashToast(`${submittedContact.name}: contact details look wrong — ask a caregiver to fix.`);
    } else {
      flashToast(tx('aac_chat_send_failed', `Could not send: ${res.error}`));
    }
  }, [activeContact, sending, text, clearAll, tx, plan, flashToast, noteSentTo]);

  if (sidePanel !== 'aac-chat') return null;

  // 2026-05-07 user report (Image #20): "message tool is broken and
  // shows a standard keyboard without inbox outbox and providers".
  // Earlier behavior unmounted the panel entirely when contacts.length
  // was zero — but the user EXPLICITLY tapped the 💬 toolbar button,
  // so they want to SEE the messaging UI (provider list / "add a
  // contact" CTA), not silently get only the qwerty back.
  const isEmpty = !activeContact && sortedContacts.length === 0;

  // Empty-state: MEDIUM panel — fixed height (~3 contact rows) so the
  // user sees what the chat will look like once contacts sync, with a
  // primary CTA to open caregiver settings. History:
  //   - flex-[3] (pre-2026-05-08): squeezed the AAC card row + provider
  //     chips to ~50px — labels clipped, looked broken (Image #26).
  //   - shrink-0 single-row slim (2026-05-08): too small. User couldn't
  //     tell if their 100+ Google contacts had landed; just one line
  //     with raw "aac_chat_add_contact" key showing (Image #24).
  //   - shrink-0 with bounded min/max height (now): preserves the
  //     keyboard's natural height AND gives the picker enough room to
  //     show 3 placeholder rows + the add-contact CTA + sync hint.
  if (isEmpty) {
    // Slim strip — single row, zero ghost contacts, zero keyboard impact.
    // Ghost contacts were compressing the keyboard below its usable floor
    // on every screen size. The strip height (~52px) fits in the flex
    // layout without stealing any space from the keyboard.
    return (
      <section
        aria-label={tx('aac_chat_title', 'Send a message')}
        data-testid="aac-chat-panel"
        data-state="compact-empty"
        className="shrink-0 surface-bar border-y border-theme"
      >
        <span data-testid="aac-chat-empty-state" aria-hidden />
        <div className="flex items-center justify-between px-3 py-2 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">💬</span>
            <span className="text-xs text-muted truncate">
              {tx('aac_chat_no_contacts', 'No contacts yet.')}{' '}
              {tx('aac_chat_empty_hint_short', 'Add one or sync Gmail in Settings.')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                tapFeedback();
                toggleSettings();
                // Scroll directly to the Contacts section after the modal renders.
                setTimeout(() => {
                  document.getElementById('settings-contacts-section')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 120);
              }}
              data-testid="aac-chat-open-settings"
              className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white"
            >
              ＋ {tx('aac_chat_add_contact', 'Add contact')}
            </button>
            <button
              onClick={() => { tapFeedback(); closeSidePanel(); }}
              aria-label={tx('close', 'Close')}
              className="aac-btn rounded-md px-2 py-1 text-muted text-lg"
            >×</button>
          </div>
        </div>
      </section>
    );
  }

  // Contacts present but no active contact — contacts stream to the
  // prediction bar (PredictionBar detects sidePanel==='aac-chat').
  // Collapse to a compact strip so the keyboard keeps full height.
  if (!activeContact && sortedContacts.length > 0) {
    return (
      <section
        aria-label={tx('aac_chat_title', 'Send a message')}
        data-testid="aac-chat-panel"
        data-state="contact-search"
        className="shrink-0 surface-bar border-y border-theme"
      >
        <span data-testid="aac-chat-empty-state" aria-hidden />
        <div className="flex items-center justify-between px-3 py-2 gap-3">
          <span className="text-xs text-muted truncate">
            💬 {tx('aac_chat_title', 'Send a message')}
            <span className="ml-1 opacity-60">— type to search {sortedContacts.length} contacts</span>
          </span>
          <button
            onClick={() => { tapFeedback(); closeSidePanel(); }}
            aria-label={tx('close', 'Close')}
            className="aac-btn rounded-md px-2 py-1 text-muted text-lg shrink-0"
          >×</button>
        </div>
      </section>
    );
  }

  // Active contact selected — show compose view.
  return (
    <section
      aria-label={tx('aac_chat_title', 'Send a message')}
      className="shrink-0 flex flex-col surface-bar border-y border-theme"
      style={{ maxHeight: 'clamp(180px,22svh,220px)' }}
      data-testid="aac-chat-panel"
      data-state="compose"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-theme shrink-0">
        <div className="flex items-center gap-3">
          {activeContact && (
            <button
              onClick={handleBack}
              aria-label={tx('back', 'Back')}
              className="aac-key surface-key text-primary rounded-lg px-3 py-1 font-bold"
            >
              ←
            </button>
          )}
          <div className="flex flex-col min-w-0">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
            {activeContact ? (
              <>
                <span aria-hidden>{PROVIDER_ICONS[activeContact.provider]}</span>
                {activeContact.name}
                <span className="text-xs text-secondary font-normal">{PROVIDER_LABELS[activeContact.provider]}</span>
              </>
            ) : (
              <>
                <span aria-hidden>💬</span>
                {tx('aac_chat_title', 'Send a message')}
              </>
            )}
          </h2>
            {siblingContacts.length > 0 && (
              <div className="flex gap-1 mt-0.5">
                {siblingContacts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { tapFeedback(); selectContact(s.id); }}
                    className="text-[10px] px-1.5 py-0.5 rounded surface-key border border-theme text-secondary hover:text-primary"
                    aria-label={`Switch to ${PROVIDER_LABELS[s.provider]}`}
                  >
                    {PROVIDER_ICONS[s.provider]} {PROVIDER_LABELS[s.provider]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label={tx('close', 'Close')}
          className="aac-key surface-key text-primary rounded-lg px-3 py-1 font-bold shrink-0"
        >×</button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Contact list moved to PredictionBar (contact-search mode).
            Compose view only renders when a contact is active. */}

        {/* Contact picked → chat compose view */}
        {activeContact && (
          <div className="flex flex-col gap-3">
            {!activeContactAvailable && (
              <div
                className="surface-key border border-[#FF9800] rounded-lg p-3 text-sm text-[#E65100]"
                data-testid="aac-chat-tier-warning"
                role="alert"
              >
                🔒 {PROVIDER_LABELS[activeContact.provider]} requires the{' '}
                <strong>{PROVIDER_MIN_TIER[activeContact.provider]}</strong> plan.
                A caregiver can upgrade on synalux.ai.
              </div>
            )}
            <div className="text-sm text-secondary">
              {tx('aac_chat_compose_hint', 'Type your message using the keyboard below, then press Send.')}
            </div>
            <div
              className="surface-key rounded-lg p-3 min-h-[64px] text-primary text-lg"
              data-testid="aac-chat-compose-preview"
            >
              {text.trim() || (
                <span className="text-secondary italic">
                  {tx('aac_chat_compose_placeholder', 'Your message will appear here…')}
                </span>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !text.trim() || !activeContactAvailable}
              data-testid="aac-chat-send-btn"
              className="aac-key surface-key text-primary rounded-lg p-4 font-bold text-lg disabled:opacity-40 bg-green-600 text-white"
            >
              {sending
                ? tx('aac_chat_sending', 'Sending…')
                : `${tx('aac_chat_send', 'Send')} → ${activeContact.name}`}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 surface-bar px-4 py-2 rounded-lg shadow-lg text-primary"
          data-testid="aac-chat-toast"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
