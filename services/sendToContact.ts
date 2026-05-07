/**
 * Provider dispatch — sends an AAC user's composed text to a real
 * recipient via the right Synalux portal endpoint.
 *
 * One thin function per provider keeps the call site (AACChatPanel)
 * agnostic. All routes already exist in synalux-private. Auth is
 * cookie-based via fetch credentials: 'include' — caregiver pre-
 * connected the provider OAuth on synalux.ai/chat, the AAC client
 * just reuses that workspace token.
 *
 * Failure mode: returns { ok: false, error } so the UI can show a
 * toast + leave the message in the bar for retry. Never throws.
 */
import type { AacContact, ContactProvider } from '@/store/contactsStore';

const SYNALUX_API = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
  ? process.env.NEXT_PUBLIC_SYNALUX_API
  : 'https://synalux.ai/api/v1';

type SendResult = { ok: true } | { ok: false; error: string };

const ENDPOINT: Record<ContactProvider, string> = {
  telegram:  '/telegram/send',
  whatsapp:  '/whatsapp/send',
  viber:     '/viber/send',
  sms:       '/sms/send',
  messenger: '/messenger/send',
  instagram: '/instagram/send',
  mail:      '/mail/send',
};

/** Provider-specific request body shape — each provider's send route
 *  accepts a slightly different field name for the recipient. */
function bodyFor(contact: AacContact, text: string): Record<string, unknown> {
  switch (contact.provider) {
    case 'telegram':
    case 'messenger':
    case 'instagram':
    case 'viber':
      return { recipientId: contact.recipientId, text };
    case 'whatsapp':
    case 'sms':
      return { to: contact.recipientId, body: text };
    case 'mail':
      return { to: contact.recipientId, subject: text.slice(0, 60), body_text: text };
  }
}

export async function sendToContact(contact: AacContact, text: string): Promise<SendResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'empty' };

  const path = ENDPOINT[contact.provider];
  try {
    const res = await fetch(`${SYNALUX_API}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyFor(contact, trimmed)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}${errBody ? ': ' + errBody.slice(0, 80) : ''}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export const PROVIDER_LABELS: Record<ContactProvider, string> = {
  telegram:  'Telegram',
  whatsapp:  'WhatsApp',
  viber:     'Viber',
  sms:       'SMS',
  messenger: 'Messenger',
  instagram: 'Instagram',
  mail:      'Mail',
};

export const PROVIDER_ICONS: Record<ContactProvider, string> = {
  telegram:  '✈️',
  whatsapp:  '💬',
  viber:     '🟣',
  sms:       '📱',
  messenger: '💙',
  instagram: '📸',
  mail:      '📧',
};
