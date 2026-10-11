/**
 * Where picture symbols come from, in one place.
 *
 * Two consumers read this and they must not drift apart:
 *   • lib/builtInSymbols.ts builds symbol URLs from it.
 *   • lib/datadog.ts redacts these request paths, because the file name names
 *     the word on the tile — and prediction tiles follow what the AAC user is
 *     composing.
 *
 * Built-in phrases and categories use the bundled Prism AAC symbols in
 * the locally saved pack (see public/symbols/ATTRIBUTION.txt). Nothing is fetched from
 * a third-party symbol service. Typed words on paid plans get a generated
 * picture from the Synalux portal, whose request carries the word in the body,
 * not the URL.
 *
 * If a new picture source ever puts vocabulary in a URL, add its path or host
 * here in the same commit — otherwise the telemetry scrubber keeps redacting
 * paths nobody calls while the new one ships vocabulary to Datadog in cleartext.
 */
import { PRISM_AAC_BASE_PATH } from '@/lib/appPaths';

/** Stable symbol identities resolved to local pack bytes before rendering. */
export const SYMBOL_BASE_PATH = `${PRISM_AAC_BASE_PATH}/symbols/`;
export const PICTURE_PACK_API_PATH = '/api/v1/prism-aac/pictures/';

/** URL path prefixes whose remainder names AAC vocabulary. */
export const PICTOGRAM_CONTENT_PATH_PREFIXES: readonly string[] = [SYMBOL_BASE_PATH];
