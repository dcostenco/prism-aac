import { PICTOGRAM_CONTENT_HOSTS } from '@/lib/pictogramSources';

let initialized = false;

export const DATADOG_RUM_PRIVACY_OPTIONS = {
  sessionReplaySampleRate: 0,
  trackUserInteractions: false,
  defaultPrivacyLevel: 'mask' as const,
};

/**
 * Capitalised words that make up standard JS/DOM error names and HTTP status
 * phrases. The "First Last" rule below cannot tell `Maria Gonzalez` from
 * `Network Error`, and redacting the latter would destroy the console signal
 * this telemetry exists for.
 *
 * BOTH words must be in this list for a pair to survive. Requiring only one
 * leaks real names, because ordinary surnames collide with error vocabulary:
 * `Cross`, `Frame`, `Rivera`-beside-`Camera`. `Maria Cross` and `David Cross`
 * are person names, and an either-word test shipped them in cleartext.
 *
 * A missing word therefore costs an over-redacted diagnostic, never a leak —
 * an incomplete list fails safe.
 */
const TECHNICAL_WORDS = new Set([
  'Aborted', 'Access', 'Allowed', 'Assembly', 'Audio', 'Bad', 'Cache', 'Camera',
  'Closed', 'Connection', 'Content', 'Cross', 'Denied', 'Device', 'Element',
  'Error', 'Exceeded', 'Expired', 'Failed', 'Failure', 'Fetch', 'Forbidden',
  'Found', 'Frame', 'Gateway', 'Internal', 'Invalid', 'Limit', 'Load',
  'Loading', 'Media', 'Microphone', 'Missing', 'Module', 'Network', 'Not',
  'Origin', 'Permission', 'Permissions', 'Policy', 'Promise', 'Property',
  'Quota', 'Range', 'Rate', 'Recognition', 'Reference', 'Refused', 'Rejection',
  'Request', 'Reset', 'Response', 'Script', 'Security', 'Server', 'Service',
  'Session', 'Speech', 'State', 'Storage', 'Stream', 'Supported', 'Synthesis',
  'Syntax', 'Timeout', 'Token', 'Type', 'Unauthorized', 'Uncaught', 'Unhandled',
  'Unknown', 'Video', 'Violation', 'Web', 'Worker',
]);

/**
 * Structured PHI — high confidence, low false-positive rate. These are the only
 * patterns trusted enough to justify DISCARDING an event (see
 * `carriesUnredactableText`); the looser name/date/email heuristics redact in
 * place but must never destroy a diagnostic.
 *
 * The lookarounds on PHONE keep it off run-on decimals: without them
 * `perf 123.456 789.0123 ms` reads as a phone number.
 */
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE = /(?<![\d.])(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d.])/g;

/** Bare month-first dates (`03/14/1998`). */
const DATE_US = /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g;

/**
 * Any date format, but only next to a birth word. A bare ISO or day-first date
 * cannot be told apart from a build stamp — `build 2026-09-14` is not a date of
 * birth, and redacting every timestamp costs more diagnostics than it protects.
 * Anchoring on `born`/`dob` catches the internationalised forms this app will
 * actually see without eating the machine dates.
 */
const DATE_NEAR_BIRTH_WORD =
  /\b((?:born|birthday|birthdate|dob)\b\W{0,12})\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/gi;

/**
 * PHI scrubber shared by both Datadog SDKs. AAC message text is the user's
 * own voice — it names people, places and conditions — so every string that
 * can reach Datadog passes through here first.
 */
export function scrubPhi(text: string): string {
  return text
    .replace(SSN, '[SSN]')
    .replace(DATE_NEAR_BIRTH_WORD, '$1[DOB]')
    .replace(DATE_US, '[DOB]')
    // The TLD must be alphabetic, or `next@16.3.3-canary` and every other
    // `package@version` in a chunk-load error reads as an email address.
    .replace(/\b[\w.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}\b/g, '[EMAIL]')
    .replace(PHONE, '[PHONE]')
    .replace(/\b\d{10,11}\b/g, '[PHONE]')
    // `%20` and `+` because a name reaches Datadog URL-encoded just as often as
    // it reaches it spaced — `…/search/Grandma%20Betty` is the same leak.
    .replace(
      /\b([A-Z][a-z]+)(\s|%20|\+)([A-Z][a-z]+)\b/g,
      (match, first: string, _sep: string, last: string) =>
        TECHNICAL_WORDS.has(first) && TECHNICAL_WORDS.has(last) ? match : '[NAME]',
    );
}

/**
 * services/pictogramService.ts puts an AAC vocabulary token straight into the
 * picture-symbol search path, and `trackResources: true` reports the whole URL.
 * No pattern can recognise "grandma" or "seizure" as sensitive, so the path is
 * dropped wholesale for those hosts. Origin, timing and status survive, which
 * is all the resource telemetry is read for.
 *
 * The host list lives with the provider config so swapping the pictogram
 * provider cannot silently leave this redaction pointed at a dead host.
 */
const AAC_CONTENT_HOSTS = new Set(PICTOGRAM_CONTENT_HOSTS);

function redactAacContentUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return AAC_CONTENT_HOSTS.has(parsed.hostname) ? `${parsed.origin}/[REDACTED]` : url;
  } catch {
    return url;
  }
}

/**
 * Paths Datadog copies back out of `beforeSend`.
 *
 * `limitModification` (rum-core) hands the callback a DEEP CLONE and then
 * copies back only the paths in `modifiableFieldPathsByEvent`
 * (rum-core/domain/assembly.js). Editing any other field mutates the clone and
 * the original still ships — silently. So this list is not a convenience, it
 * is the complete set of things `beforeSend` is able to protect.
 */
type PathKind = 'text' | 'url' | 'object';

export const SCRUBBABLE_PATHS: ReadonlyArray<readonly [path: string, kind: PathKind]> = [
  ['error.message', 'text'],
  ['error.stack', 'text'],
  ['error.handling_stack', 'text'],
  ['error.fingerprint', 'text'],
  ['error.resource.url', 'url'],
  ['resource.url', 'url'],
  ['resource.graphql.variables', 'text'],
  ['resource.request.headers', 'object'],
  ['resource.response.headers', 'object'],
  ['action.target.name', 'text'],
  ['view.url', 'url'],
  ['view.referrer', 'url'],
  ['view.name', 'text'],
  ['view.performance.lcp.resource_url', 'url'],
  // Long Animation Frames attribute work to the resource that caused it, so a
  // pictogram lookup URL lands here too. `trackLongTasks` is on.
  ['long_task.scripts[].invoker', 'url'],
  ['long_task.scripts[].source_url', 'url'],
  ['service', 'text'],
  ['version', 'text'],
];

type RumEventLike = Record<string, unknown>;

function scrubLeaf(value: unknown, kind: PathKind): unknown {
  if (kind === 'object') return scrubDeep(value);
  if (typeof value !== 'string') return value;
  return scrubPhi(kind === 'url' ? redactAacContentUrl(value) : value);
}

/** Walks a Datadog field path, including its `[]` array segments. */
function scrubStringAt(node: unknown, segments: readonly string[], kind: PathKind): void {
  const [head, ...rest] = segments;

  if (head === '[]') {
    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        if (rest.length) scrubStringAt(item, rest, kind);
        else node[i] = scrubLeaf(item, kind);
      });
    }
    return;
  }

  if (!node || typeof node !== 'object') return;
  const parent = node as RumEventLike;
  if (rest.length) return scrubStringAt(parent[head], rest, kind);
  parent[head] = scrubLeaf(parent[head], kind);
}

/** Scrub every string inside `context`, which Datadog copies back wholesale. */
function scrubDeep(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubPhi(value);
  if (depth >= 6 || !value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1));
  for (const [key, nested] of Object.entries(value as RumEventLike)) {
    (value as RumEventLike)[key] = scrubDeep(nested, depth + 1);
  }
  return value;
}

/**
 * `error.causes[]` carries free text but is NOT in `SCRUBBABLE_PATHS`, so
 * redacting it is discarded — dropping the whole event is the only lever
 * `beforeSend` has over it.
 *
 * Only STRUCTURED PHI triggers the drop. Using the full scrubber here destroyed
 * ordinary diagnostics: `The Internet connection appears to be offline.` and
 * `in PhraseTile (created by Board Grid)` both contain a capitalised pair, and
 * a name heuristic is nowhere near confident enough to justify discarding an
 * error report. An SSN or a phone number in a cause chain is.
 *
 * `error.component_stack` is deliberately not checked: it is only populated by
 * rum-core's internal `addError({ componentStack })`, which the public API
 * never calls, and `@datadog/browser-rum-react` is not a dependency. This app's
 * real component stack goes through `console.error` in components/PrismApp.tsx
 * and lands in `error.message`, which IS scrubbable.
 */
function carriesUnredactableText(event: RumEventLike): boolean {
  const error = event.error as RumEventLike | undefined;
  if (!error || typeof error !== 'object' || !Array.isArray(error.causes)) return false;

  const detects = (value: unknown) =>
    typeof value === 'string' && (new RegExp(SSN).test(value) || new RegExp(PHONE).test(value));

  return (error.causes as RumEventLike[]).some(
    (cause) => cause && (detects(cause.message) || detects(cause.stack)),
  );
}

/**
 * RUM's error collector subscribes to `console.error` automatically
 * (browser-rum-core `errorCollection` → `ConsoleApiName.error`), so the
 * `forwardConsoleLogs: []` guard below covers the Logs SDK only — RUM shipped
 * console text regardless. 130 of prism-aac's last 138 RUM errors arrived with
 * `error.source: console`.
 *
 * `trackResources: true` is the other carrier: pictogram lookups put the word
 * the user is composing into the request path (services/pictogramService.ts),
 * so resource events need scrubbing just as much as error events do.
 *
 * Returns false to discard an event whose PHI cannot be redacted in place.
 */
export function rumBeforeSend(event: RumEventLike): boolean {
  if (!event || typeof event !== 'object') return true;
  if (carriesUnredactableText(event)) return false;
  for (const [path, kind] of SCRUBBABLE_PATHS) {
    scrubStringAt(event, path.split(/\.|(?=\[\])/).filter(Boolean), kind);
  }
  if (event.context) scrubDeep(event.context);
  return true;
}

export function initDatadog() {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  const clientToken = process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN;
  const applicationId = process.env.NEXT_PUBLIC_DD_APPLICATION_ID;
  const site = process.env.NEXT_PUBLIC_DD_SITE || 'datadoghq.com';
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  if (!clientToken) return;

  import('@datadog/browser-logs').then(({ datadogLogs }) => {
    datadogLogs.init({
      clientToken,
      site,
      service: 'prism-aac',
      env,
      forwardErrorsToLogs: false, // HIPAA: prevent stack traces containing PHI from leaking to Datadog
      // Explicit ddLog/ddError calls own the operational signal. Console
      // messages can contain AAC text, so they must never be forwarded.
      forwardConsoleLogs: [],
      sessionSampleRate: 100,
      beforeSend: (log) => {
        // HIPAA: Scrub potential PHI patterns before forwarding to Datadog cloud
        if (log.message) log.message = scrubPhi(log.message);
        return true;
      },
    });
  });

  if (applicationId) {
    import('@datadog/browser-rum').then(({ datadogRum }) => {
      datadogRum.init({
        applicationId,
        clientToken: clientToken!,
        site,
        service: 'prism-aac',
        env,
        version: process.env.NEXT_PUBLIC_BUILD_ID || '0.0.0',
        sessionSampleRate: 100,
        // AAC interaction text is potentially PHI. Keep performance/error
        // telemetry, but never record sessions or automatic click metadata.
        sessionReplaySampleRate: DATADOG_RUM_PRIVACY_OPTIONS.sessionReplaySampleRate,
        trackUserInteractions: DATADOG_RUM_PRIVACY_OPTIONS.trackUserInteractions,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: DATADOG_RUM_PRIVACY_OPTIONS.defaultPrivacyLevel,
        beforeSend: (event) => rumBeforeSend(event as unknown as RumEventLike),
      });
    });
  }

  initialized = true;
}

export async function anonymousDatadogUserId(value: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value.trim().toLowerCase()),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

export function ddSetUser(user: {
  id: string;
  name?: string;
  email?: string;
  plan?: string;
}) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-rum').then(({ datadogRum }) => {
    datadogRum.setUser({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
    });
  }).catch(() => {});
}

export function ddAction(name: string, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-rum').then(({ datadogRum }) => {
    datadogRum.addAction(name, context);
  }).catch(() => {});
}

export function ddError(error: unknown, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-rum').then(({ datadogRum }) => {
    datadogRum.addError(error instanceof Error ? error : new Error(String(error)), context);
  }).catch(() => {});
}

export function ddLog(
  message: string,
  context?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  if (typeof window === 'undefined') return;
  import('@datadog/browser-logs').then(({ datadogLogs }) => {
    const logger = datadogLogs.logger;
    if (level === 'error') logger.error(message, context);
    else if (level === 'warn') logger.warn(message, context);
    else logger.info(message, context);
  }).catch(() => {});
}
