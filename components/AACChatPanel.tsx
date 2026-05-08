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
        className={`aac-key surface-key text-primary rounded-lg w-full p-4 text-left flex items-center gap-3 min-h-[64px] ${available ? '' : 'opacity-60'}`}
        data-testid={`aac-chat-contact-${section}-${c.id}`}
        aria-label={available ? c.name : `${c.name} — requires ${PROVIDER_MIN_TIER[c.provider]} plan`}
      >
        <span aria-hidden className="text-2xl flex-shrink-0">
          {c.avatar || PROVIDER_ICONS[c.provider]}
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
    return (
      <section
        aria-label={tx('aac_chat_title', 'Send a message')}
        data-testid="aac-chat-panel"
        data-state="medium-empty"
        className="shrink-0 surface-bar border-y border-theme flex flex-col"
        style={{ minHeight: 200, maxHeight: 240 }}
      >
        <div className="flex items-center justify-between px-3 py-2 gap-3 border-b border-theme">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">💬</span>
            <span className="font-bold text-primary truncate">
              {tx('aac_chat_title', 'Send a message')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { tapFeedback(); toggleSettings(); }}
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
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
          <p className="text-xs text-muted">
            {tx('aac_chat_no_contacts', 'No contacts yet.')}{' '}
            {tx(
              'aac_chat_empty_hint',
              'Add one above, or open Caregiver Settings → Contacts → Sync now to pull from Gmail.',
            )}
          </p>
          {/* Three ghost rows so the picker doesn't look like one
              clipped line — gives caregivers a sense of scale. */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 surface-key rounded-lg px-3 py-2 opacity-50 border border-dashed border-theme"
              data-testid={`aac-chat-ghost-${i}`}
              aria-hidden
            >
              <span className="text-2xl">👤</span>
              <span className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-primary text-sm">
                  {i === 0
                    ? tx('aac_chat_ghost_mom', 'e.g. Mom')
                    : i === 1
                      ? tx('aac_chat_ghost_dad', 'e.g. Dad')
                      : tx('aac_chat_ghost_teacher', 'e.g. Teacher')}
                </span>
                <span className="text-xs text-secondary truncate">
                  {tx('aac_chat_ghost_hint', 'Will appear here after sync')}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Below this point: have contacts or active contact — full panel.
  return (
    <section
      aria-label={tx('aac_chat_title', 'Send a message')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
      data-testid="aac-chat-panel"
      data-state="expanded"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-theme">
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
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            {activeContact ? (
              <>
                <span aria-hidden>{PROVIDER_ICONS[activeContact.provider]}</span>
                {activeContact.name}
              </>
            ) : (
              <>
                <span aria-hidden>💬</span>
                {tx('aac_chat_title', 'Send a message')}
              </>
            )}
          </h2>
        </div>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label={tx('close', 'Close')}
          className="aac-key surface-key text-primary rounded-lg px-3 py-1 font-bold"
        >
          ×
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Empty state is handled by the medium-empty early-return above
            (2026-05-08, Image #24). This branch only renders when the
            user has at least one contact. */}
        {!activeContact && sortedContacts.length > 0 && (
          <>
            {frequentContacts.length > 0 && (
              <section data-testid="aac-chat-frequent">
                <p className="text-muted text-[11px] uppercase tracking-wider mb-1.5">
                  {tx('aac_chat_frequent', 'Frequent')}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {frequentContacts.map((c) => renderContactTile(
                    c,
                    isProviderAvailable(c.provider, plan),
                    handlePickContact,
                    'freq',
                  ))}
                </ul>
              </section>
            )}
            <section data-testid="aac-chat-all">
              {frequentContacts.length > 0 && (
                <p className="text-muted text-[11px] uppercase tracking-wider mb-1.5">
                  {tx('aac_chat_all_contacts', 'All contacts')}
                </p>
              )}
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="aac-chat-contact-list">
                {sortedContacts.map((c) => renderContactTile(
                  c,
                  isProviderAvailable(c.provider, plan),
                  handlePickContact,
                  'all',
                ))}
              </ul>
            </section>
          </>
        )}

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
