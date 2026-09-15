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
 * EVERY word of a capitalised run must be in this list for the run to survive.
 * Requiring only one leaks real names, because ordinary surnames collide with
 * error vocabulary: `Cross`, `Frame`, `Rivera`-beside-`Camera`. `Maria Cross`
 * and `David Cross` are person names, and an either-word test shipped them in
 * cleartext.
 *
 * The cost is real and worth stating: a run is masked whole, so a phrase with
 * one off-list word is reduced to initials — `Service Worker Registration`
 * becomes `S* W* R*`, `Cross Origin Read Blocking` `C* O* R* B*`. Roughly one in three
 * standard HTTP/DOM reason phrases goes the same way. Measured against this
 * repo's own ~1400 logged strings the cost is 0 — this app logs numeric
 * `res.status`, not `res.statusText` — but third-party libraries that
 * `console.error` their own phrases will lose readability. That is the right
 * side to err on: over-redaction costs a diagnostic, under-redaction ships a
 * child's contacts. Nothing outside this module calls `scrubPhi`, so an
 * over-redaction can never reach AAC speech or on-screen text.
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
 * PHONE brackets the number with a captured leading character instead of a
 * lookbehind. Both read the same, but lookbehind is Safari 16.4+ and this file
 * is statically imported by always-mounted components (Toolbar, MessageBar,
 * PredictionBar, CategoryPanel) while the iOS deployment target is 16.0 — a
 * lookbehind here is a SyntaxError at module evaluation on iOS 16.0–16.3, which
 * means the AAC app does not start at all. Nothing down-levels regex literals.
 * The guard it provides is real: without it `perf 123.456 789.0123 ms` reads as
 * a phone number.
 */
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE = /(^|[^\d.])((?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})(?![\d.])/g;

/** Unformatted run of digits — what a numeric keyboard produces. */
const BARE_PHONE = /\b\d{10,11}\b/g;

/**
 * A card number: 14–19 contiguous digits, or groups of at least four digits
 * joined by single spaces or dashes (4-4-4-4, Amex 4-6-5).
 *
 * The grouping rule is what keeps this from spanning two adjacent values. An
 * earlier `\d(?:[ -]?\d){12,18}` accepted any separator anywhere, so
 * `555-123-4567 106-16-1006` — a phone next to an SSN — was one 19-digit run,
 * Luhn-valid one time in ten, masked to ITS last four: the SSN's. Phones are
 * 3-3-4 and SSNs 3-2-4, so a leading four-digit group excludes both.
 *
 * The 14-digit floor excludes every 13-digit epoch-millisecond timestamp
 * outright (13-digit cards have not been issued in decades). The Luhn check
 * below does the rest — see its comment for what it does and does not buy.
 */
const CARD = /\b(?:\d{14,19}|\d{4}(?:[ -]\d{4,6}){2,4})\b/g;

/** Bare month-first dates (`03/14/1998`). */
const DATE_US = /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g;

/**
 * Any date format, but only next to a birth word. A bare ISO or day-first date
 * cannot be told apart from a build stamp — `build 2026-09-14` is not a date of
 * birth, and redacting every timestamp costs more diagnostics than it protects.
 * Anchoring on `born`/`birth`/`dob` catches the internationalised forms without
 * eating the machine dates.
 *
 * The gap admits short filler (`is`, `on the`, `:`) but must not step across a
 * SENTENCE boundary — sentence punctuation followed by a capital. `[^\d\n]`
 * alone let `She was born. Build 2026-09-14` redact the build stamp; banning
 * `.!?;` outright then lost `DOB. 14/03/1998` and `dob; 14.03.1998`, which is
 * exactly the shape OCR of a medical form produces. The lookahead keeps both.
 *
 * Separators cover `/`, `-`, `.` (German/Russian/Polish) and space. The year
 * must be two digits or 19xx/20xx, or `born 1 2 3456` reads as a date. The
 * trailing `(?!\d)` rather than `\b` lets `born 2026-09-14T10:00` match — `\b`
 * fails against the `T`.
 */
const DATE_NEAR_BIRTH_WORD =
  /\b((?:born|birth|birthday|birthdate|dob)\b(?:(?![.!?;][^\p{L}\d\n]*\p{Lu})[^\d\n]){0,12})(\d{1,4}[/.\- ]\d{1,2}[/.\- ](?:(?:19|20)\d{2}|\d{2}))(?!\d)/giu;

/**
 * A run of two or more capitalised words. The whole run is redacted unless
 * EVERY word is error vocabulary. Redacting only the first non-technical pair
 * shipped surnames: `Error Maria Gonzalez` became `[NAME] Gonzalez`, because
 * the (technical, given-name) pair consumed the given name and left the
 * surname unpaired. Losing a leading `Uncaught` is a small price; a name in a
 * diagnostic should not have been there to begin with.
 *
 * `\p{Lu}\p{Ll}` rather than `[A-Z][a-z]`: this app ships in 40 locales, and an
 * ASCII-only rule leaks every accented or Cyrillic name — `María González`,
 * `Søren Jensen`, `Мария Иванова` all passed through untouched. `\b` stays
 * ASCII-defined even under /u, so the boundary is a captured non-letter. Cased
 * scripts only: CJK names cannot be matched by any capitalisation rule. See
 * the "Known residuals" list on `rumBeforeSend`.
 *
 * `%20` and `+` join words because a name reaches Datadog URL-encoded just as
 * often as spaced — `…/search/Grandma%20Betty` is the same leak.
 *
 * `[^\S\n\r]` is whitespace minus the two characters a JS stack trace uses as
 * a line break, so frames are never joined into a name. It must NOT be
 * narrowed to `[ \t]`: that dropped every other Unicode space with it, and
 * pdfjs text extraction and clipboard paste routinely put U+00A0 between
 * words, so `Grandma<NBSP>Betty` out of a PDF shipped in cleartext.
 */
const CAPITALISED_RUN =
  /(^|[^\p{L}])(\p{Lu}\p{Ll}+(?:(?:[^\S\n\r]|%20|\+)\p{Lu}\p{Ll}+)+)(?![\p{L}])/gu;
const RUN_SEPARATOR = /[^\S\n\r]|%20|\+/u;

/** Mask character. ASCII, so it survives every transport and log viewer. */
const MASK = '*';

/**
 * Luhn checksum. Every card number satisfies it. So does one random 16-digit
 * number in ten — measured 10.0% over 100,000 — so this is a filter, not a
 * proof: it rejects nine of ten order ids and Apple transaction ids, and the
 * tenth is masked to its last four. That is the accepted cost; telling a card
 * from an id with certainty needs BIN tables, which is more machinery than a
 * telemetry scrubber should carry.
 */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Mask every digit but the last `keep`, leaving separators in place. */
function maskDigits(text: string, keep: number): string {
  const total = (text.match(/\d/g) ?? []).length;
  let seen = 0;
  return text.replace(/\d/g, (d) => (++seen > total - keep ? d : MASK));
}

/** True when a `CARD` match is a real card, not a coincidental digit run. */
function isCard(match: string): boolean {
  const digits = match.replace(/\D/g, '');
  return digits.length >= 14 && luhnValid(digits);
}

/** Shared by the redactor and the drop lever so the two cannot drift. */
function containsCard(text: string): boolean {
  for (const match of text.matchAll(CARD)) if (isCard(match[0])) return true;
  return false;
}

/**
 * Keep the year, mask the rest. HIPAA Safe Harbor removes date precision finer
 * than the year for exactly this reason: the year alone does not identify, and
 * it is the part with any diagnostic value.
 */
function maskDate(date: string): string {
  const year = /(?:19|20)\d{2}/.exec(date);
  if (!year) return date.replace(/\d/g, MASK);
  const start = year.index;
  return date.replace(/\d/g, (d, offset: number) =>
    offset >= start && offset < start + 4 ? d : MASK,
  );
}

/**
 * PHI obfuscator shared by both Datadog SDKs. AAC message text is the user's
 * own voice — it names people, places and conditions — so every string that
 * can reach Datadog passes through here first.
 *
 * This masks rather than deletes. `[NAME]` and `[PHONE]` threw away the
 * distinction between two different errors and made a false positive
 * catastrophic for the engineer reading it; `G* B*` and `***-***-4567` keep
 * the message legible and two occurrences distinguishable.
 *
 * What each retained fragment rests on, stated exactly: the last four of a
 * card is the PCI-DSS display rule; keeping only the year of a date is the
 * HIPAA Safe Harbor rule (§164.514(b)(2)(i)(C)). Initials for a name and the
 * last four of a phone are NOT Safe Harbor carve-outs — Safe Harbor removes
 * names and phone numbers entirely — they are the owner's chosen convention
 * for internal telemetry, on the judgement that an initial and four digits do
 * not identify a person on their own. An SSN keeps nothing, and an email keeps
 * its first letter and TLD only: a vanity domain carries a surname and a clinic
 * domain names the treatment facility.
 *
 * The practical consequence is that over-matching stops being expensive. A
 * technical phrase wrongly caught by the name rule degrades to its initials
 * instead of vanishing, which is why this can afford to err toward masking.
 */
export function scrubPhi(text: string): string {
  return text
    // SSN before CARD, and an SSN keeps nothing: unlike a card, its last four
    // have no diagnostic use and are the half treated as identifying. Running
    // CARD first once let it absorb an adjacent SSN and keep those four.
    .replace(SSN, (match) => match.replace(/\d/g, MASK))
    // CARD before the phone rules, or a 16-digit PAN is eaten by BARE_PHONE.
    .replace(CARD, (match) => (isCard(match) ? maskDigits(match, 4) : match))
    .replace(DATE_NEAR_BIRTH_WORD, (_match, lead: string, date: string) => lead + maskDate(date))
    .replace(DATE_US, maskDate)
    // Keep the first character and the TLD only. The domain is masked because
    // it is not neutral: `@mariagonzalez.com` carries the surname, and
    // `@smith-family-clinic.org` names the treatment facility. The TLD must be
    // alphabetic, or `next@16.3.3-canary` and every other `package@version` in
    // a chunk-load error reads as an email address.
    .replace(
      /\b([\w.+-])[\w.+-]*@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*(\.[a-zA-Z]{2,})\b/g,
      (_match, first: string, tld: string) => `${first}${MASK}${MASK}@${MASK}${MASK}${MASK}${tld}`,
    )
    .replace(PHONE, (_match, before: string, number: string) => before + maskDigits(number, 4))
    .replace(BARE_PHONE, (match) => maskDigits(match, 4))
    .replace(CAPITALISED_RUN, (match, before: string, run: string) => {
      const words = run.split(RUN_SEPARATOR);
      return words.every((word) => TECHNICAL_WORDS.has(word))
        ? match
        // codePointAt, not [0]: the match is Unicode-aware, and for a script
        // outside the BMP (Adlam, Osage, Deseret) `word[0]` is half a surrogate
        // pair — malformed UTF-16 on the wire.
        : before + words.map((word) => String.fromCodePoint(word.codePointAt(0)!) + MASK).join(' ');
    });
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

/**
 * Deep enough for any context this app builds; shallow enough that a
 * pathological payload cannot overflow the stack (native recursion here dies
 * around 10,000 frames). Cycles are already gone before either caller runs —
 * `deepClone` strips them on the RUM path, `sanitize` on the Logs path — and
 * the cap terminates anything that slipped through regardless.
 */
const SCRUB_DEPTH_LIMIT = 32;

/**
 * Scrub every string inside an object Datadog copies back wholesale.
 *
 * Objects are mutated in place; arrays come back as NEW arrays, so callers must
 * assign the result. Anything below the depth limit is not inspected, and what
 * is not inspected must not ship — it is replaced, not passed through. (An
 * earlier cap silently returned the subtree, so a string at depth 7 left
 * unscrubbed.)
 */
function scrubDeep(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubPhi(value);
  if (!value || typeof value !== 'object') return value;
  if (depth >= SCRUB_DEPTH_LIMIT) return '[REDACTED]';
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
 * error report. An SSN or a formatted phone number in a cause chain is.
 *
 * The bare 10–11 digit rule is deliberately NOT here. It redacts fine in the
 * fields we can edit, but as a drop criterion it deletes error reports on
 * epoch-seconds timestamps: `cache bust ?v=1757800000`, `chunk.js:1757800000`.
 * So an unformatted phone number in a cause chain ships. That is the trade.
 *
 * In practice this almost never fires: nothing in this app constructs an Error
 * with a `cause`, and neither does any dependency it calls directly. It is a
 * cheap backstop for framework-internal chains, not a load-bearing control —
 * the structural protections are the per-host URL redaction and the path
 * coverage below.
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
    typeof value === 'string' &&
    ([SSN, PHONE].some((pattern) => new RegExp(pattern.source, 'g').test(value)) ||
      containsCard(value));

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
 *
 * Known residuals — what no pattern here can catch, stated so nobody assumes
 * otherwise: a single first name; lowercase vocabulary (`grandma`, `seizure`);
 * a street address; a diagnosis in prose; a name in an uncased script (CJK,
 * Thai); a Luhn-invalid identifier that is still sensitive. The structural
 * controls — dropping pictogram URL paths by host, discarding events whose
 * unredactable fields carry structured PHI — carry the guarantee; the patterns
 * are best-effort on top.
 */
export function rumBeforeSend(event: RumEventLike): boolean {
  if (!event || typeof event !== 'object') return true;
  if (carriesUnredactableText(event)) return false;
  for (const [path, kind] of SCRUBBABLE_PATHS) {
    scrubStringAt(event, path.split(/\.|(?=\[\])/).filter(Boolean), kind);
  }
  // Datadog copies `context` back only when the value it finds on the clone is
  // a plain object (limitModification → getType(value) === 'object'; an array
  // is 'array'). So an array context cannot be scrubbed in place — but it CAN
  // be replaced by an object, and that IS copied back. Wrapping keeps the event
  // and removes the PHI; an earlier version discarded the whole report on the
  // false premise that nothing could be written back.
  if (event.context) {
    event.context = Array.isArray(event.context)
      ? { items: scrubDeep(event.context) }
      : scrubDeep(event.context);
  }
  return true;
}

/**
 * The Logs SDK has no copy-back whitelist: `beforeSend` receives the live
 * event and everything it leaves alone ships. Custom keys passed to
 * `ddLog(message, context)` are merged into the top level of the event, so
 * scrubbing `message` alone left them — and `error.*` — in cleartext. Nothing
 * calls `ddLog` or `ddError` today; this is the guard for the first caller.
 */
export function logsBeforeSend(log: RumEventLike): boolean {
  scrubDeep(log);
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
      beforeSend: (log) => logsBeforeSend(log as unknown as RumEventLike),
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
