/**
 * Boundary string sanitization — one place, three callers.
 *
 * Used at every external-input boundary (portal poll, contacts sync,
 * caregiver-curated entries) to:
 *   1. Reject non-string values without throwing (returns '').
 *   2. Strip ASCII C0 controls (0x00-0x1F) + DEL (0x7F). These can
 *      break the schedule row's single-line render and, if logs ever
 *      tee to a real terminal, become an injection vector.
 *   3. Trim outer whitespace.
 *   4. Clamp length to a per-call cap.
 *
 * Replaces three near-identical copies that lived in inboxService,
 * contactsIntegrationService, and ad-hoc store handling.
 */

/** Strip control chars, trim, clamp. Returns '' for non-strings. */
// eslint-disable-next-line no-control-regex
const CTRL_REGEX = /[\u0000-\u001f\u007f]/g;

export function sanitizeString(s: unknown, maxLen: number): string {
  if (typeof s !== 'string') return '';
  const clean = s.replace(CTRL_REGEX, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

/** Caps used at every entry point so a single change ripples. Keep
 *  these tight enough that a hostile portal can't blow up local state
 *  with multi-megabyte fields. */
export const SAFE_LIMITS = {
  /** Display names (caregiver alias for a contact, message sender). */
  name: 80,
  /** Provider recipient ids (largest is RFC-5321 email at 254). */
  recipientId: 254,
  /** Avatar emoji + variation selectors. */
  avatar: 16,
  /** One-line message preview shown in the picker. */
  preview: 200,
  /** Inbox message body (per-message; provider hard caps still apply
   *  in messageProviders.ts before send). */
  messageText: 2000,
  /** Externally-provided message id used for dedupe. */
  externalId: 128,
  /** Provider name string from the wire (matched against the union). */
  providerCode: 32,
} as const;
