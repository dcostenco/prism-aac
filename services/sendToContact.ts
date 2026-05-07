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

export async function sendToContact(
  contact: AacContact,
  text: string,
  plan: PlanTier | null | undefined = null,
): Promise<SendResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'empty' };
  // Client-side tier guard. The portal route also enforces (must, since
  // this layer is untrusted) but a local check spares the user a 403
  // round-trip and lets the picker greying stay honest.
  if (!isProviderAvailable(contact.provider, plan)) {
    return { ok: false, error: `tier_required:${PROVIDER_MIN_TIER[contact.provider]}` };
  }

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

/** Plan tier required to USE a given provider. The AAC Chat component
 *  itself is on every tier (per product) — only the *send* leg is
 *  gated. This keeps the picker informative on free accounts: the user
 *  sees their family Telegram contact greyed out with an upgrade hint
 *  rather than missing entirely.
 *
 *  Mapping rationale:
 *    free      — mail + sms: ubiquitous, no third-party messaging API
 *                cost beyond Twilio per-segment.
 *    standard  — + telegram / whatsapp / viber: most-requested family
 *                messaging providers; portal pays for WA Cloud API
 *                conversation fees here.
 *    advanced  — + messenger / instagram: Meta Business API tier with
 *                page-scoped IDs and rate limits that need more setup.
 *    enterprise — same as advanced (no provider beyond Meta Business). */
export type PlanTier = 'free' | 'standard' | 'advanced' | 'enterprise';

export const PROVIDER_MIN_TIER: Record<ContactProvider, PlanTier> = {
  mail:      'free',
  sms:       'free',
  telegram:  'standard',
  whatsapp:  'standard',
  viber:     'standard',
  messenger: 'advanced',
  instagram: 'advanced',
};

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  standard: 1,
  advanced: 2,
  enterprise: 3,
};

/** True if the given user plan can use the provider. Used to grey out
 *  contact tiles + block sendToContact from issuing the request. */
export function isProviderAvailable(provider: ContactProvider, plan: PlanTier | null | undefined): boolean {
  const userTier = TIER_RANK[plan ?? 'free'];
  const required = TIER_RANK[PROVIDER_MIN_TIER[provider]];
  return userTier >= required;
}
