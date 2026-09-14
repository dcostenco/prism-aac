import { PICTOGRAM_CONTENT_HOSTS } from '@/lib/pictogramSources';

let initialized = false;

export const DATADOG_RUM_PRIVACY_OPTIONS = {
  sessionReplaySampleRate: 0,
  trackUserInteractions: false,
  defaultPrivacyLevel: 'mask' as const,
};

/**
 * Capitalised words that start standard JS/DOM error names and HTTP status
 * phrases. The "First Last" rule below cannot tell `Maria Gonzalez` from
 * `Network Error`, and redacting the latter would destroy the console signal
 * this telemetry exists for. Membership is checked per word, so a real name
 * beside a technical word (`Nurse Rivera`) is still caught.
 *
 * Being absent from this list only ever costs an over-redacted diagnostic —
 * never a leak — so an incomplete list fails safe.
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
 * PHI scrubber shared by both Datadog SDKs. AAC message text is the user's
 * own voice — it names people, places and conditions — so every string that
 * can reach Datadog passes through here first.
 */
export function scrubPhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g, '[DOB]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]*[a-zA-Z]\b/g, '[EMAIL]')
    .replace(/(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{10,11}\b/g, '[PHONE]')
    // `%20` and `+` because a name reaches Datadog URL-encoded just as often as
    // it reaches it spaced — `…/search/Grandma%20Betty` is the same leak.
    .replace(
      /\b([A-Z][a-z]+)(\s|%20|\+)([A-Z][a-z]+)\b/g,
      (match, first: string, _sep: string, last: string) =>
        TECHNICAL_WORDS.has(first) || TECHNICAL_WORDS.has(last) ? match : '[NAME]',
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
const SCRUBBABLE_PATHS: ReadonlyArray<readonly [path: string, kind: 'text' | 'url']> = [
  ['error.message', 'text'],
  ['error.stack', 'text'],
  ['error.handling_stack', 'text'],
  ['error.fingerprint', 'text'],
  ['error.resource.url', 'url'],
  ['resource.url', 'url'],
  ['action.target.name', 'text'],
  ['view.url', 'url'],
  ['view.referrer', 'url'],
  ['view.name', 'text'],
];

type RumEventLike = Record<string, unknown>;

function scrubStringAt(event: RumEventLike, path: string, kind: 'text' | 'url'): void {
  const segments = path.split('.');
  let node: RumEventLike | undefined = event;
  for (const segment of segments.slice(0, -1)) {
    const next = node?.[segment];
    if (!next || typeof next !== 'object') return;
    node = next as RumEventLike;
  }
  if (!node) return;
  const leaf = segments[segments.length - 1];
  const value = node[leaf];
  if (typeof value !== 'string') return;
  node[leaf] = scrubPhi(kind === 'url' ? redactAacContentUrl(value) : value);
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
 * `error.causes[].message` and `error.component_stack` carry free text but are
 * NOT in `SCRUBBABLE_PATHS`, so redacting them is discarded. Dropping the whole
 * event is the only lever `beforeSend` has over them — so drop, but only when
 * the scrubber actually detects PHI, to keep ordinary cause chains and React
 * component stacks reportable.
 */
function carriesUnredactableText(event: RumEventLike): boolean {
  const error = event.error as RumEventLike | undefined;
  if (!error || typeof error !== 'object') return false;

  const detects = (value: unknown) => typeof value === 'string' && scrubPhi(value) !== value;

  if (detects(error.component_stack)) return true;
  if (Array.isArray(error.causes)) {
    for (const cause of error.causes as RumEventLike[]) {
      if (cause && (detects(cause.message) || detects(cause.stack))) return true;
    }
  }
  return false;
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
  for (const [path, kind] of SCRUBBABLE_PATHS) scrubStringAt(event, path, kind);
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
