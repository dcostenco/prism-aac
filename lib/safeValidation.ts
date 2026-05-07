/**
 * Shared validation helpers used at every persistence + URL boundary.
 *
 * One module so the rules don't drift across stores. Refactored out of
 * pass-15-18 hardening duplicates that lived in:
 *   - services/emergencyService.ts (URL allowlist, phone/email URI guard,
 *     numeric clamp)
 *   - services/headTracker.ts + services/bodyPoseService.ts (calibration
 *     NaN defense — was the same predicate copy-pasted)
 *   - services/switchScanService.ts (CSS color injection guard)
 *   - services/adaptiveEngine.ts (clampNumber)
 *
 * These all defend against tampered localStorage / hostile portal
 * payloads. Keeping them in one place makes a future synalux-side
 * unification trivial: a single import line moves with the helpers.
 */

/** Returns v if it's a finite number in [min, max], else fallback.
 *  Single source of the "Number.isFinite + range" pattern that
 *  every store hydration validator was re-writing. */
export function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

/** As clampNumber, but coerces to integer (Math.floor). */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
    ? Math.floor(v)
    : fallback;
}

/** Validate a URL string against an allowlist of hostnames + a
 *  protocol whitelist. THIS IS LIFE-SAFETY when the URL routes
 *  emergency POSTs (PII + GPS); a tampered persist could otherwise
 *  redirect to an attacker. */
export function isHttpsAllowedUrl(
  value: unknown,
  allowedHosts: ReadonlySet<string>,
  opts: { maxLen?: number; allowHttp?: boolean } = {},
): value is string {
  // SECURE-BY-DEFAULT: allowHttp defaults to FALSE. The original
  // default `true` let emergency PII (GPS, name, medical profile,
  // message history) route over plaintext http if the caller didn't
  // explicitly opt out. Localhost dev / test still works because
  // those callers pass allowHttp:true explicitly.
  const { maxLen = 256, allowHttp = false } = opts;
  if (typeof value !== 'string' || !value || value.length > maxLen) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) return false;
    return allowedHosts.has(u.hostname);
  } catch {
    return false;
  }
}

/** Strict shape check on an email address before composing a mailto:
 *  URL. Rejects the header-injection attack class
 *      a@b.com?cc=evil@evil.com&bcc=evil2@evil.com
 *  by requiring no `?`, `&`, `#`, control chars, or shell quoting in
 *  either side of the address. Returns the encodeURIComponent-encoded
 *  recipient, or null if it doesn't look like an email.
 *
 *  Allows the `+` alias suffix (e.g. user+tag@example.com) which is
 *  RFC-5322-valid and ubiquitous (Gmail, Fastmail, every modern
 *  provider). Earlier version rejected `+` because the unsafe-char
 *  class included it — that was a bandaid that broke real emails. */
export function safeMailtoRecipient(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  // Local part: any char except whitespace + URI special chars + control.
  // Domain: same minus `+` (no `+` in domain by RFC). encodeURIComponent
  // below converts `+` to `%2B` so it can't break out of the URI.
  if (!/^[^\s@?&#%/<>"'`\\]+@[^\s@?&#%/<>"'`\\+]+\.[^\s@?&#%/<>"'`\\+]{2,}$/.test(trimmed)) return null;
  return encodeURIComponent(trimmed);
}

/** Strip everything except digits, +, *, # (the legitimate dial chars).
 *  A tampered phone like `5551234?from=evil&body=injection` would
 *  otherwise inject SMS/tel URI parameters when window.open composes
 *  a sms:/tel: URL. Returns null when nothing usable remains. */
export function safePhoneForUri(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const stripped = phone.replace(/[^0-9+*#]/g, '').slice(0, 32);
  return stripped || null;
}

/** CSS color shape gate. The string is interpolated into a <style>
 *  tag's textContent at the call site — anything containing `;`,
 *  `{`, `}`, `url(`, `expression(`, or `javascript:` could break
 *  out of the rule and execute attacker CSS. Allows only
 *  #hex / rgb()/rgba() / hsl()/hsla() / bare CSS color names. */
export function isSafeCssColor(color: unknown): color is string {
  if (typeof color !== 'string' || color.length === 0 || color.length > 64) return false;
  if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/.test(color)) return false;
  if (/url\s*\(|expression\s*\(|javascript:|;|\{|\}/i.test(color)) return false;
  return true;
}

/** Validate a 4-corner normalized calibration record (head tracker,
 *  body pose). Tampered persist injecting NaN / Infinity / matching
 *  leftX/rightX would freeze the cursor for an AAC user — the
 *  mapping math does (normX - rightX) / (leftX - rightX). Bounds
 *  are slightly generous (-1..2) so off-screen calibration points
 *  still work; non-zero range is required so downstream divisions
 *  don't blow up. */
export interface CornerCalibration {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
}

export function isValidCornerCalibration(c: unknown): c is CornerCalibration {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  for (const k of ['leftX', 'rightX', 'topY', 'bottomY'] as const) {
    const v = x[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < -1 || v > 2) return false;
  }
  if ((x.leftX as number) === (x.rightX as number)) return false;
  if ((x.topY as number) === (x.bottomY as number)) return false;
  return true;
}
