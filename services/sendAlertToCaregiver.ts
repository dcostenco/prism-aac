/**
 * Caregiver alert dispatch — resolves the primary caregiver from the
 * contacts store and ships a pre-canned alert SMS via sendToContact.
 *
 * Shared by:
 *   - The toolbar 🚨 button (confirmation modal on tap)
 *   - The Watch→web bridge (services/watchAlertBridge), which receives
 *     send_alert messages from Apple Watch
 *
 * Primary caregiver = lowest-order contact whose provider can deliver
 * a synchronous alert. SMS is preferred (universal, no app dependency).
 * Falls back to WhatsApp/Telegram if no SMS contact exists.
 */
import { useContactsStore, type AacContact } from '@/store/contactsStore';
import { sendToContact } from '@/services/sendToContact';
import type { PlanTier } from '@/lib/messageProviders';

export type AlertResult =
  | { ok: true; via: AacContact }
  | { ok: false; error: 'no_caregiver' | 'send_failed'; detail?: string };

/** Provider precedence for alert dispatch. SMS first because it never
 *  requires the recipient to have an app open. */
const ALERT_PROVIDER_ORDER: Array<AacContact['provider']> = [
  'sms', 'whatsapp', 'telegram', 'viber', 'messenger', 'mail',
];

/** Resolves the primary caregiver contact for alert dispatch.
 *  Returns null if no eligible contact exists. */
export function resolvePrimaryCaregiver(): AacContact | null {
  const contacts = useContactsStore.getState().contacts;
  if (!contacts.length) return null;
  // Try each provider in order; within a provider pick lowest `order`.
  for (const provider of ALERT_PROVIDER_ORDER) {
    const candidates = contacts
      .filter((c) => c.provider === provider)
      .sort((a, b) => a.order - b.order);
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

/** Sends a pre-canned alert SMS (or fallback) to the primary caregiver.
 *  The body is generated here so the Watch and the web toolbar produce
 *  the same message shape; only the timestamp differs. */
export async function sendAlertToCaregiver(
  body?: string,
  plan: PlanTier | null = null,
): Promise<AlertResult> {
  const caregiver = resolvePrimaryCaregiver();
  if (!caregiver) return { ok: false, error: 'no_caregiver' };

  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const message = body && body.trim().length > 0
    ? body
    : `⚠️ Alert — needs check-in · ${stamp}`;

  const res = await sendToContact(caregiver, message, plan);
  if (!res.ok) return { ok: false, error: 'send_failed', detail: res.error };
  // Bump usage stats so the Frequent picker reorders correctly.
  useContactsStore.getState().noteSentTo(caregiver.id);
  return { ok: true, via: caregiver };
}
