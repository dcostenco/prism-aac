'use client';
import { useState, useCallback, useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useContactsStore, type AacContact } from '@/store/contactsStore';
import { sendToContact, PROVIDER_LABELS, PROVIDER_ICONS } from '@/services/sendToContact';
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
  const { sidePanel, closeSidePanel, activeContactId, selectContact, backToContacts } = useUIStore();
  const { text, clearAll } = useMessageStore();
  const contacts = useContactsStore((s) => s.contacts);
  const { t } = useT();
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.order - b.order),
    [contacts],
  );
  const activeContact: AacContact | undefined = useMemo(
    () => sortedContacts.find((c) => c.id === activeContactId),
    [sortedContacts, activeContactId],
  );

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
    tapFeedback();
    setSending(true);
    const res = await sendToContact(activeContact, trimmed);
    setSending(false);
    if (res.ok) {
      setToast(t('aac_chat_sent') || `Sent to ${activeContact.name}`);
      clearAll();
    } else {
      setToast(t('aac_chat_send_failed') || `Could not send: ${res.error}`);
    }
    setTimeout(() => setToast(null), 3000);
  }, [activeContact, sending, text, clearAll, t]);

  if (sidePanel !== 'aac-chat') return null;

  return (
    <section
      aria-label={t('aac_chat_title') || 'Send a message'}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
      data-testid="aac-chat-panel"
    >
      {/* Header */}
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

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {/* No contact picked → show picker */}
        {!activeContact && sortedContacts.length === 0 && (
          <div className="text-center text-secondary py-8 text-base leading-relaxed">
            <p className="text-lg mb-2">📭</p>
            <p>{t('aac_chat_no_contacts') || 'No contacts yet.'}</p>
            <p className="mt-1 text-sm">
              {t('aac_chat_setup_hint') || 'A caregiver can add contacts in Settings → Contacts.'}
            </p>
          </div>
        )}

        {!activeContact && sortedContacts.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="aac-chat-contact-list">
            {sortedContacts.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => handlePickContact(c.id)}
                  className="aac-key surface-key text-primary rounded-lg w-full p-4 text-left flex items-center gap-3 min-h-[64px]"
                  data-testid={`aac-chat-contact-${c.id}`}
                >
                  <span aria-hidden className="text-2xl flex-shrink-0">
                    {c.avatar || PROVIDER_ICONS[c.provider]}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-bold truncate">{c.name}</span>
                    <span className="text-xs text-secondary truncate">
                      {PROVIDER_LABELS[c.provider]}
                      {c.lastMessagePreview ? ` · ${c.lastMessagePreview}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Contact picked → chat compose view */}
        {activeContact && (
          <div className="flex flex-col gap-3">
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
              disabled={sending || !text.trim()}
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
