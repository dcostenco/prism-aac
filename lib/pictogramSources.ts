/**
 * Hosts whose request path once embedded user vocabulary.
 *
 * lib/datadog.ts drops the path for these hosts before resource telemetry
 * leaves the device. The third-party pictogram search that used this host is
 * retired and this build sends it no requests; the rule stays so a request to
 * it, should one ever appear, still cannot report the word being composed.
 */
export const PICTOGRAM_CONTENT_HOSTS: readonly string[] = ['api.arasaac.org'];
