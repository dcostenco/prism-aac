/**
 * Where picture symbols come from, in one place.
 *
 * Two consumers read this and they must not drift apart:
 *   • services/pictogramService.ts builds its lookup URLs from it.
 *   • lib/datadog.ts redacts request paths on these hosts, because the search
 *     path carries the word the AAC user is composing.
 *
 * ARASAAC is licensed to us only while Prism AAC is free, and is expected to be
 * replaced. When it is, change `PICTOGRAM_SEARCH_API` / `PICTOGRAM_CDN` here and
 * add the successor's host to `PICTOGRAM_CONTENT_HOSTS` in the same commit —
 * otherwise the telemetry scrubber keeps redacting a host nobody calls while
 * the new one ships vocabulary to Datadog in cleartext.
 */

export const PICTOGRAM_SEARCH_API = 'https://api.arasaac.org/v1';

export const PICTOGRAM_CDN = 'https://static.arasaac.org/pictograms';

/**
 * Hosts whose request path embeds user vocabulary rather than an opaque id.
 * The CDN is deliberately absent — it is addressed by numeric pictogram id,
 * which carries no user text.
 */
export const PICTOGRAM_CONTENT_HOSTS: readonly string[] = [
  new URL(PICTOGRAM_SEARCH_API).hostname,
];
