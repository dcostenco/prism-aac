'use client';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  const { t } = useT();
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
      const baseMsg = t('aac_chat_sent') || `Sent to ${submittedContact.name}`;
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
      flashToast(t('aac_chat_send_failed') || `Could not send: ${res.error}`);
    }
  }, [activeContact, sending, text, clearAll, t, plan, flashToast]);

  if (sidePanel !== 'aac-chat') return null;

  // SECOND-pass simplification (2026-05-07 user feedback: "doesnt make
  // any sense, expand type here panel instead", "remove contacts
  // button"). When the AAC user has no contacts AND no active
  // selection, we render NOTHING — the section unmounts. Toolbar's
  // 💬 button toggles the panel; Settings → Integrations / Contacts
  // is where caregivers manage the contact list (we just shipped the
  // in-app provider connect there). MessageBar grows by one line
  // when sidePanel is 'aac-chat' so the user has more compose room.
  const isCompact = !activeContact && sortedContacts.length === 0;
  if (isCompact) return null;

  // Below this point: not compact (have contacts or active contact).
  return (
    <section
      aria-label={t('aac_chat_title') || 'Send a message'}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
      data-testid="aac-chat-panel"
      data-state="expanded"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-theme">
        <div className="flex items-center gap-3">
          {activeContact && (
            <button
              onClick={handleBack}
              aria-label={t('back') || 'Back'}
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
                {t('aac_chat_title') || 'Send a message'}
              </>
            )}
          </h2>
        </div>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label={t('close') || 'Close'}
          className="aac-key surface-key text-primary rounded-lg px-3 py-1 font-bold"
        >
          ×
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {!activeContact && sortedContacts.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="aac-chat-contact-list">
            {sortedContacts.map((c) => {
              const available = isProviderAvailable(c.provider, plan);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => handlePickContact(c.id)}
                    className={`aac-key surface-key text-primary rounded-lg w-full p-4 text-left flex items-center gap-3 min-h-[64px] ${available ? '' : 'opacity-60'}`}
                    data-testid={`aac-chat-contact-${c.id}`}
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
            })}
          </ul>
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
              {t('aac_chat_compose_hint') || 'Type your message using the keyboard below, then press Send.'}
            </div>
            <div
              className="surface-key rounded-lg p-3 min-h-[64px] text-primary text-lg"
              data-testid="aac-chat-compose-preview"
            >
              {text.trim() || (
                <span className="text-secondary italic">
                  {t('aac_chat_compose_placeholder') || 'Your message will appear here…'}
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
                ? (t('aac_chat_sending') || 'Sending…')
                : `${t('aac_chat_send') || 'Send'} → ${activeContact.name}`}
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
