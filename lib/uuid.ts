/**
 * UUID helper with a fallback for runtimes that don't expose
 * `crypto.randomUUID()` — namely old iPad WebViews (< Safari 15.4) we
 * occasionally see in the AAC tablet fleet. A failed UUID call would
 * crash addContact / addIncomingMessage; the fallback keeps the AAC
 * user functional even on aging hardware.
 */

let _fallbackCounter = 0;

export function randomId(prefix = ''): string {
  const c = (typeof crypto !== 'undefined' ? crypto : undefined) as
    | (Crypto & { randomUUID?: () => string })
    | undefined;
  if (c?.randomUUID) return prefix + c.randomUUID();
  // Fallback — RFC4122 v4-ish using getRandomValues when available.
  // When getRandomValues is also absent (extremely old WebViews), use a
  // deterministic-unique fallback seeded from timestamp + performance
  // counter + a module-level counter so two calls in the same millisecond
  // still produce distinct IDs. Not cryptographic strength, but uniqueness
  // (not unforgeability) is the requirement here.
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    const now = Date.now();
    const perf = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 0;
    const counter = ++_fallbackCounter;
    bytes[0] = (now >>> 24) & 0xff;
    bytes[1] = (now >>> 16) & 0xff;
    bytes[2] = (now >>> 8) & 0xff;
    bytes[3] = now & 0xff;
    bytes[4] = (perf >>> 8) & 0xff;
    bytes[5] = perf & 0xff;
    bytes[6] = (counter >>> 8) & 0xff;
    bytes[7] = counter & 0xff;
    // Fill remaining with mixed entropy
    for (let i = 8; i < 16; i++) bytes[i] = Math.floor((Math.random() * 0xff + (now ^ perf ^ counter)) & 0xff);
  }
  // Set version (4) and variant (10xx) bits per RFC4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
  return prefix +
    `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-` +
    `${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
