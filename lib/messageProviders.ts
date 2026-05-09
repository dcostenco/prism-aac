/**
 * Message provider config — single source of truth for everything
 * provider-specific in the AAC chat send leg:
 *   - portal endpoint path
 *   - request body shape
 *   - max text length (provider-imposed)
 *   - recipientId format validator (so caregiver mistakes get caught
 *     locally before they hit the portal as a 400)
 *   - minimum tier required (kept here too so the picker, send guard,
 *     and contacts editor all read the same source)
 *
 * Adding a provider = add one entry here. The send pipeline, picker
 * tile rendering, contacts editor, and tier gating all read from this
 * table — no scattered switches.
 *
 * Numbers are taken from the upstream APIs' published limits as of
 * 2026-Q2; tighter than necessary is fine, looser is not.
 */
import type { AacContact, ContactProvider } from '@/store/contactsStore';

export type PlanTier = 'free' | 'standard' | 'advanced' | 'enterprise';

const TIER_RANK: Record<PlanTier, number> = { free: 0, standard: 1, advanced: 2, enterprise: 3 };

export interface ProviderConfig {
  /** Display name shown in the picker. */
  label: string;
  /** Single emoji shown when the contact has no custom avatar. */
  icon: string;
  /** Portal API path (relative to SYNALUX_API base). */
  endpoint: string;
  /** Builds the JSON body for the send request. Trimmed text is provided. */
  buildBody: (contact: AacContact, text: string) => Record<string, unknown>;
  /** Hard upper bound on text length the provider accepts. The send
   *  pipeline truncates to this before posting (with a `...` suffix if
   *  truncation occurred). */
  maxTextLength: number;
  /** Returns true if `recipientId` is a syntactically valid id for this
   *  provider. Validation is local-best-effort — the portal is the
   *  authoritative check. Used in the caregiver contacts editor to
   *  reject obvious mistakes (e.g. typing "mom" as a phone number). */
  validateRecipientId: (recipientId: string) => boolean;
  /** Caregiver-facing hint shown in the manual-add form. */
  recipientHint: string;
  /** Minimum subscription tier required to USE this provider. The
   *  component itself ships on every tier (per product). */
  minTier: PlanTier;
}

// Validators — pragmatic patterns; portal is the source of truth.
const isE164 = (s: string) => /^\+?[1-9]\d{6,14}$/.test(s);
const isDigits = (s: string) => /^\d{3,32}$/.test(s);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;
// Page-Scoped IDs and Instagram-Scoped IDs are opaque base-N strings.
// Allow letters, digits, hyphens, underscores; min 6 chars to weed out typos.
const isOpaqueId = (s: string) => /^[A-Za-z0-9_-]{6,64}$/.test(s);
// Viber user IDs are base64-ish 24+ chars in practice.
const isViberId = (s: string) => /^[A-Za-z0-9+/=_-]{16,64}$/.test(s);

export const PROVIDERS: Record<ContactProvider, ProviderConfig> = {
  telegram: {
    label: 'Telegram',
    icon: '✈️',
    endpoint: '/telegram/send',
    buildBody: (c, text) => ({ recipientId: c.recipientId, text }),
    // Telegram Bot API hard cap is 4096 chars per message. Stay well under.
    maxTextLength: 4000,
    validateRecipientId: isDigits,
    recipientHint: 'Telegram chat_id (digits only)',
    minTier: 'standard',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: '💬',
    endpoint: '/whatsapp/send',
    buildBody: (c, text) => ({ to: c.recipientId, body: text }),
    // WhatsApp Cloud API text-message body is ~4096; portal session window
    // template messages are 1024. Use the conservative 1024 so we don't
    // half-send during the user's first 24-hour conversation window.
    maxTextLength: 1024,
    validateRecipientId: isE164,
    recipientHint: '+15551234567 (E.164 phone)',
    minTier: 'standard',
  },
  viber: {
    label: 'Viber',
    icon: '🟣',
    endpoint: '/viber/send',
    buildBody: (c, text) => ({ recipientId: c.recipientId, text }),
    // Viber Bot text message limit is 7000.
    maxTextLength: 6500,
    validateRecipientId: isViberId,
    recipientHint: 'Viber user_id from Viber Bot',
    minTier: 'standard',
  },
  sms: {
    label: 'SMS',
    icon: '📱',
    endpoint: '/sms/send',
    buildBody: (c, text) => ({ to: c.recipientId, body: text }),
    // SMS hard cap by carrier: a 1600-char Twilio request gets split into
    // 10 segments which is the max billable unit before we ship multipart.
    // Stay under the carrier-recommended 1600.
    maxTextLength: 1500,
    validateRecipientId: isE164,
    recipientHint: '+15551234567 (E.164 phone)',
    // Portal /api/v1/sms/send requires Standard or above (Twilio cost).
    // aac_plan='standard' also qualifies via dual-plan lookup in the route.
    minTier: 'standard',
  },
  messenger: {
    label: 'Messenger',
    icon: '💙',
    endpoint: '/messenger/send',
    buildBody: (c, text) => ({ recipientId: c.recipientId, text }),
    // Meta Messenger hard cap: 2000 chars per message.
    maxTextLength: 2000,
    validateRecipientId: isOpaqueId,
    recipientHint: 'Messenger PSID (page-scoped id)',
    minTier: 'advanced',
  },
  instagram: {
    label: 'Instagram',
    icon: '📸',
    endpoint: '/instagram/send',
    buildBody: (c, text) => ({ recipientId: c.recipientId, text }),
    maxTextLength: 1000,
    validateRecipientId: isOpaqueId,
    recipientHint: 'Instagram IGSID',
    minTier: 'advanced',
  },
  mail: {
    label: 'Mail',
    icon: '📧',
    endpoint: '/prism-aac/mail/send',
    buildBody: (c, text) => ({ to: c.recipientId, subject: text.slice(0, 60), body_text: text }),
    // Email body is effectively unbounded but a single AAC message > 10k
    // chars is a typo, not a message. Cap to keep the portal route happy.
    maxTextLength: 10000,
    validateRecipientId: isEmail,
    recipientHint: 'name@example.com',
    minTier: 'free',
  },
};

/** True if the user's plan permits using `provider`. */
export function isProviderAvailable(provider: ContactProvider, plan: PlanTier | null | undefined): boolean {
  const cfg = PROVIDERS[provider];
  if (!cfg) return false;
  return TIER_RANK[plan ?? 'free'] >= TIER_RANK[cfg.minTier];
}

/** Returns text trimmed + truncated to the provider's maxTextLength.
 *  Adds an ellipsis if truncated so the recipient sees the cut clearly. */
export function clampToProviderLimit(provider: ContactProvider, text: string): string {
  const cfg = PROVIDERS[provider];
  const trimmed = text.trim();
  if (!cfg) return trimmed;
  if (trimmed.length <= cfg.maxTextLength) return trimmed;
  return trimmed.slice(0, cfg.maxTextLength - 1) + '…';
}
