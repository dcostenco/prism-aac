'use client';

/**
 * Where can this page reach a local Ollama, and what should the user do next?
 *
 * Browser rules this module encodes (checked October 2026):
 *   • Safari / WebKit (macOS, iPhone, iPad — including Chrome and Firefox on
 *     iOS, which use WebKit) blocks a secure (https) page from fetching
 *     http://localhost as mixed content. WebKit bug 171934 is still open.
 *   • Chrome 142+ and Edge 143+ allow it after a per-site "local network
 *     access" permission prompt.
 *   • Firefox treats localhost as potentially trustworthy and allows it.
 *   • Addresses of other machines (http://192.168.x.x) are mixed content from
 *     an https page in every browser.
 *   • Ollama itself refuses a page whose origin is not listed in
 *     OLLAMA_ORIGINS: it answers 403 without a CORS header, so the browser
 *     reports a network error.
 *   • The iOS app (WKWebView with window.prismNativeBridge) runs its own
 *     on-device model; Ollama does not apply there.
 */

export type LocalAiPlatform = 'ios-app' | 'insecure-page' | 'safari' | 'chromium' | 'firefox' | 'other';

export type LocalAiState =
  | 'connected'          // Ollama answered /api/tags
  | 'ios-builtin'        // iOS app: the built-in on-device model is used instead
  | 'browser-blocks'     // Safari/WebKit on https: cannot reach localhost at all
  | 'unsafe-url'         // https page + non-local URL: blocked as mixed content
  | 'needs-permission'   // Chrome/Edge: the user has not allowed local network access yet
  | 'permission-denied'  // Chrome/Edge: local network access is blocked for this site
  | 'blocked-by-ollama'  // Ollama is running but refuses this site (OLLAMA_ORIGINS)
  | 'not-running';       // nothing answered

export type HostOs = 'mac' | 'windows' | 'linux';

/** Set once the panel has connected; lets background services probe Ollama on https pages. */
export const LOCAL_AI_OPT_IN_KEY = 'prism-aac-local-ai-connected';

const PROBE_TIMEOUT_MS = 3000;

export interface LocalAiWindow {
  location: { protocol: string; origin: string };
  navigator: { userAgent: string };
  prismNativeBridge?: unknown;
}

export function detectPlatform(win: LocalAiWindow): LocalAiPlatform {
  if (win.prismNativeBridge) return 'ios-app';
  if (win.location.protocol !== 'https:') return 'insecure-page';
  const ua = win.navigator.userAgent;
  // Every browser on iOS/iPadOS is WebKit underneath, whatever its brand.
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'safari';
  // Blink always reports AppleWebKit/537.36; a higher WebKit version is Apple's engine
  // (e.g. Chrome on iPadOS in desktop mode sends a Mac UA with a Chrome/ token).
  const webkit = /AppleWebKit\/(\d+)/.exec(ua);
  if (webkit && Number(webkit[1]) >= 600) return 'safari';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/(Chrome|Chromium|Edg|OPR)\//.test(ua)) return 'chromium';
  if (/AppleWebKit/.test(ua) && /Safari\//.test(ua)) return 'safari';
  return 'other';
}

export function detectOs(userAgent: string): HostOs {
  if (/Windows/.test(userAgent)) return 'windows';
  if (/Mac OS X|Macintosh/.test(userAgent)) return 'mac';
  return 'linux';
}

/** http://localhost or http://127.0.0.1, any port. Not [::1]: the page policy (connect-src) does not list it. */
export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * What an https page may fetch: Ollama's default port on this computer only. It matches the
 * connect-src entries in middleware.ts and the portal's CSP, so a blocked request is never
 * mistaken for "not running".
 */
export function reachableFromSecurePage(url: string): boolean {
  if (!isLocalUrl(url)) return false;
  return new URL(url).port === '11434';
}

/** The command that lets Ollama accept this site, for the user's OS. */
export function ollamaOriginsCommand(os: HostOs, origin: string): string {
  switch (os) {
    case 'mac':
      return `launchctl setenv OLLAMA_ORIGINS "${origin}"`;
    case 'windows':
      return `setx OLLAMA_ORIGINS "${origin}"`;
    case 'linux':
      return `sudo systemctl edit ollama   # add: Environment="OLLAMA_ORIGINS=${origin}"`;
  }
}

/** After the command: how to make Ollama pick it up. */
export function ollamaRestartHint(os: HostOs): string {
  switch (os) {
    case 'mac':
      return 'Then quit Ollama from the menu bar and open it again.';
    case 'windows':
      return 'Then quit Ollama from the system tray and open it again.';
    case 'linux':
      return 'Then run: sudo systemctl restart ollama';
  }
}

/** window.localStorage, or null where touching it throws (sandboxed frames, some private modes). */
export function localStorageOrNull(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Background services may probe Ollama on this page without user action. */
export function canProbeInBackground(win: LocalAiWindow, storage: Pick<Storage, 'getItem'> | null): boolean {
  const platform = detectPlatform(win);
  if (platform === 'insecure-page') return true;
  if (platform !== 'chromium' && platform !== 'firefox') return false;
  // On https only after the user connected once: an unopted probe fails
  // for most visitors and fills their console with security errors.
  try {
    return storage?.getItem(LOCAL_AI_OPT_IN_KEY) === '1';
  } catch {
    return false;
  }
}

type PermissionStateLike = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface LocalAiDeps {
  fetch: typeof fetch;
  queryPermission?: () => Promise<PermissionStateLike>;
}

/** Chrome/Edge expose the local-network permission under these names (first supported wins). */
export async function queryLocalNetworkPermission(permissions: Permissions | undefined): Promise<PermissionStateLike> {
  if (!permissions?.query) return 'unsupported';
  for (const name of ['loopback-network', 'local-network-access']) {
    try {
      const status = await permissions.query({ name } as unknown as PermissionDescriptor);
      return status.state as PermissionStateLike;
    } catch {
      /* name not supported by this browser — try the next */
    }
  }
  return 'unsupported';
}

export interface LocalAiCheck {
  state: LocalAiState;
  models?: string[];
}

/**
 * Decide the panel state. `userInitiated` is true when the user pressed a
 * button; only then may a Chrome/Edge permission prompt be triggered.
 * Never fetches where the answer is known in advance (iOS app, Safari, unsafe URL, denied permission).
 */
export async function checkLocalAi(win: LocalAiWindow, url: string, deps: LocalAiDeps, userInitiated = false): Promise<LocalAiCheck> {
  const platform = detectPlatform(win);
  if (platform === 'ios-app') return { state: 'ios-builtin' };
  if (platform === 'safari') return { state: 'browser-blocks' };
  const base = url.replace(/\/+$/, '');
  if (platform !== 'insecure-page' && !reachableFromSecurePage(base)) return { state: 'unsafe-url' };

  let permission: PermissionStateLike = 'unsupported';
  if (platform === 'chromium' && deps.queryPermission) {
    permission = await deps.queryPermission();
    if (permission === 'denied') return { state: 'permission-denied' };
    if (permission === 'prompt' && !userInitiated) return { state: 'needs-permission' };
  }

  try {
    const r = await deps.fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (r.ok) {
      const data = (await r.json()) as { models?: Array<{ name: string }> };
      return { state: 'connected', models: (data.models ?? []).map((m) => m.name) };
    }
    // A readable non-ok answer only happens when CORS let it through; treat as refused.
    return { state: 'blocked-by-ollama' };
  } catch {
    /* fall through: CORS refusal, permission refusal, or nothing listening */
  }

  // An opaque no-cors request succeeds whenever something is listening, so it
  // separates "running but refusing this site" from "not running".
  try {
    await deps.fetch(`${base}/api/version`, { mode: 'no-cors', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return { state: 'blocked-by-ollama' };
  } catch {
    /* nothing reachable */
  }

  if (platform === 'chromium' && deps.queryPermission) {
    const after = await deps.queryPermission();
    if (after === 'denied') return { state: 'permission-denied' };
    if (after === 'prompt') return { state: 'needs-permission' };
  }
  return { state: 'not-running' };
}
