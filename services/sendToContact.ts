/**
 * Provider dispatch — sends an AAC user's composed text to a real
 * recipient via the right Synalux portal endpoint.
 *
 * All provider-specific knowledge (endpoint, body shape, length cap,
 * tier requirement) lives in `lib/messageProviders.ts`. This file is
 * the transport — fetch, abort, error mapping. Adding a new provider
 * means editing only the config table.
 *
 * Failure mode: returns `{ ok: false, error }` so the UI can show a
 * toast + leave the message in the bar for retry. Never throws.
 */
import type { AacContact, ContactProvider } from '@/store/contactsStore';
import {
  PROVIDERS,
  isProviderAvailable as _isProviderAvailable,
  clampToProviderLimit,
  type PlanTier,
} from '@/lib/messageProviders';

const SYNALUX_API = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
  ? process.env.NEXT_PUBLIC_SYNALUX_API
  : 'https://synalux.ai/api/v1';

/** Per-call deadline. Long enough for 3G/airplane wifi, short enough that
 *  a stuck send doesn't strand the AAC user staring at "Sending…". */
const SEND_TIMEOUT_MS = 10_000;

type SendResult = { ok: true; truncated: boolean } | { ok: false; error: string };

export async function sendToContact(
  contact: AacContact,
  text: string,
  plan: PlanTier | null | undefined = null,
): Promise<SendResult> {
  const cfg = PROVIDERS[contact.provider];
  if (!cfg) return { ok: false, error: `unknown_provider:${contact.provider}` };

  // Empty-text rejection happens BEFORE the tier check so callers always
  // see a deterministic "empty" error regardless of plan state.
  const raw = (text ?? '').trim();
  if (!raw) return { ok: false, error: 'empty' };

  // Client-side tier guard. The portal route also enforces (and must,
  // since this layer is untrusted) but a local check spares the user a
  // 403 round-trip and lets the picker greying stay honest.
  if (!_isProviderAvailable(contact.provider, plan)) {
    return { ok: false, error: `tier_required:${cfg.minTier}` };
  }

  // Recipient-id format guard — catches caregiver typos like "mom" in a
  // phone number field early. Portal still validates authoritatively.
  if (!cfg.validateRecipientId(contact.recipientId)) {
    return { ok: false, error: 'invalid_recipient_id' };
  }

  // Provider-imposed length cap. We truncate (with ellipsis) rather than
  // reject so the AAC user's effort isn't wasted on a typo-overflow.
  const clamped = clampToProviderLimit(contact.provider, raw);
  const truncated = clamped.length < raw.length;

  let res: Response;
  try {
    res = await fetch(`${SYNALUX_API}${cfg.endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg.buildBody(contact, clamped)),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}${errBody ? ': ' + errBody.slice(0, 80) : ''}` };
  }
  return { ok: true, truncated };
}

// Re-exports — keep the sendToContact import surface stable for the
// AAC chat panel + caregiver settings, both of which need access to
// per-provider metadata for tile rendering and tier hints.
export {
  PROVIDERS,
  clampToProviderLimit,
  isProviderAvailable,
  type PlanTier,
} from '@/lib/messageProviders';

// Compatibility shims so existing call sites keep working without
// touching every component import.
export const PROVIDER_LABELS: Record<ContactProvider, string> = Object.fromEntries(
  (Object.keys(PROVIDERS) as ContactProvider[]).map((k) => [k, PROVIDERS[k].label]),
) as Record<ContactProvider, string>;

export const PROVIDER_ICONS: Record<ContactProvider, string> = Object.fromEntries(
  (Object.keys(PROVIDERS) as ContactProvider[]).map((k) => [k, PROVIDERS[k].icon]),
) as Record<ContactProvider, string>;

export const PROVIDER_MIN_TIER: Record<ContactProvider, PlanTier> = Object.fromEntries(
  (Object.keys(PROVIDERS) as ContactProvider[]).map((k) => [k, PROVIDERS[k].minTier]),
) as Record<ContactProvider, PlanTier>;
