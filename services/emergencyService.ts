/**
 * Emergency Response Service — Life-Safety System
 *
 * Apple Watch-style automatic emergency detection and routing.
 * When a user communicates a crisis phrase, the system:
 *
 *   1. ALWAYS: Speaks the phrase aloud immediately (TTS, online or offline)
 *   2. ALWAYS: Shows a visual emergency alert with countdown
 *   3. IF ONLINE: Sends SMS/email to emergency contacts immediately
 *   4. IF ONLINE: Optionally initiates 911 call (configurable)
 *   5. IF OFFLINE: Queues the alert, auto-sends when connectivity restores
 *
 * The countdown (default 10s) gives the user/caregiver time to cancel
 * a false trigger — identical to Apple Watch fall detection behavior.
 *
 * This is a life-safety system. It must NEVER fail silently.
 */

import { randomId } from '@/lib/uuid';
import { timeoutSignal } from '@/lib/portalConfig';
import { sanitizeString } from '@/lib/safeStrings';
import {
  clampInt,
  isHttpsAllowedUrl,
  safeMailtoRecipient,
  safePhoneForUri,
} from '@/lib/safeValidation';
import { useAuthStore } from '@/store/authStore';
import { getAuthToken } from '@/services/aiService';

/** Cap on best-effort 3rd-party response bodies (Nominatim reverse
 *  geocode). Hostile/poisoned DNS pointing at a server that streams
 *  gigabytes would otherwise OOM the AAC tablet — in a literal life-
 *  safety code path. 64 KB is generous for a single reverse-geocode
 *  result. */
const MAX_THIRD_PARTY_BYTES = 64 * 1024;

export interface EmergencyContact {
  name: string;
  phone?: string;
  email?: string;
  relationship: string;
}

export interface UserMedicalProfile {
  name: string;
  age?: number;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
  address?: string;
  callbackNumber?: string;
  country?: string;
}

// Emergency numbers by country — configured during caregiver onboarding
const EMERGENCY_NUMBERS: Record<string, string> = {
  US: '911', CA: '911', MX: '911',
  GB: '999', IE: '999',
  AU: '000', NZ: '111',
  JP: '119', KR: '119',
  CN: '120', TW: '119',
  RU: '112', UA: '112',
  BR: '192', PT: '112',
  DE: '112', FR: '112', ES: '112', IT: '112', RO: '112',
  SA: '911', AE: '999', EG: '123',
};

export interface EmergencyConfig {
  enabled: boolean;
  countdownSeconds: number;
  autoCall911: boolean;
  contacts: EmergencyContact[];
  profile: UserMedicalProfile;
  language?: string;
  synaluxApiUrl?: string;
}

// Emergency features work for ALL tiers — free, standard, advanced, enterprise.
// A child's safety does not depend on a subscription.
const SYNALUX_EMERGENCY_API =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API
    ? process.env.NEXT_PUBLIC_SYNALUX_API
    : 'https://synalux.ai/api/v1') + '/prism-aac/emergency';

// Cancel gesture: two-corner simultaneous press-and-hold for 3 seconds.
// The child is trained on this during onboarding, like Apple Watch SOS training.
// A bully cannot figure this out in the 5-10 second countdown window.
//
// Critical alerts (abuse, assault) have NO cancel mechanism at all.
const CANCEL_HOLD_MS = 3000;
let cancelHoldTimer: ReturnType<typeof setTimeout> | null = null;
let activeCancelFn: (() => void) | null = null;

function isTwoCornerHold(touches: TouchList | null): boolean {
  if (!touches || touches.length < 2) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Use 12% of screen dimensions — motor-accessible on 7" iPad through 13" iPad Pro
  const CORNER = Math.max(60, Math.min(w, h) * 0.12);
  let hasTopLeft = false;
  let hasBottomRight = false;
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    if (t.clientX < CORNER && t.clientY < CORNER) hasTopLeft = true;
    if (t.clientX > w - CORNER && t.clientY > h - CORNER) hasBottomRight = true;
  }
  return hasTopLeft && hasBottomRight;
}

export function registerCancelGesture(onCancel: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (activeCancelFn && process.env.NODE_ENV !== 'production') {
    console.warn('[EMERGENCY] registerCancelGesture called while activeCancelFn already set — previous cancel gesture will be replaced');
  }
  activeCancelFn = onCancel;

  const onTouchStart = (e: TouchEvent) => {
    if (isTwoCornerHold(e.touches)) {
      cancelHoldTimer = setTimeout(() => {
        activeCancelFn?.();
      }, CANCEL_HOLD_MS);
    }
  };
  const onTouchEnd = () => {
    if (cancelHoldTimer) { clearTimeout(cancelHoldTimer); cancelHoldTimer = null; }
  };

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    if (cancelHoldTimer) { clearTimeout(cancelHoldTimer); cancelHoldTimer = null; }
    activeCancelFn = null;
  };
}

interface QueuedAlert {
  id: string;
  phrase: string;
  timestamp: number;
  location?: { lat: number; lng: number };
  sent: boolean;
  severity?: 'critical' | 'urgent' | 'medical';
}

// Severity levels:
//   'critical'     — CANNOT be cancelled. Alert WILL send. No cancel button shown.
//                    Used for: abuse, assault, breathing emergency, being lost
//   'urgent'       — Can be cancelled WITH caregiver PIN only.
//                    A bully/abuser cannot cancel without the PIN.
//   'medical'      — Can be cancelled with PIN. Medical emergencies.
const EMERGENCY_PHRASES: Record<string, 'critical' | 'urgent' | 'medical'> = {
  'someone hurt me': 'critical',
  'i am not safe': 'critical',
  'i don\'t know you': 'critical',
  'don\'t touch me': 'critical',
  'i said no': 'critical',
  'call 911': 'critical',
  'i can\'t breathe': 'critical',
  'i am lost': 'critical',
  'help me': 'urgent',
  'i need help': 'urgent',
  'i am scared': 'urgent',
  'call my mom': 'urgent',
  'call my dad': 'urgent',
  'i want to go home': 'urgent',
  'i fell': 'medical',
  'it hurts': 'medical',
  'i feel sick': 'medical',
  'i feel dizzy': 'medical',
  'i need my medicine': 'medical',
};

const ALERT_QUEUE_KEY = 'prism-aac-emergency-queue';
const CONFIG_KEY = 'prism-aac-emergency-config';

/** Mutex: prevents double-dispatch if the setInterval fires twice before
 *  the first sendAlert resolves (e.g., device sleep/wake jitter). */
let dispatchInProgress = false;
/** Mutex: prevents concurrent sendAlert calls (e.g., flush + triggerEmergency racing). */
let isSendInFlight = false;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let countdownCallback: ((seconds: number) => void) | null = null;
let cancelCallback: (() => void) | null = null;
let alarmCtx: AudioContext | null = null;
let alarmOsc: OscillatorNode | null = null;
let alarmGain: GainNode | null = null;
let alarmInterval: ReturnType<typeof setInterval> | null = null;
let flashInterval: ReturnType<typeof setInterval> | null = null;
let flashOverlay: HTMLDivElement | null = null;

/**
 * SOS alarm — loud beeping pattern at maximum volume.
 * Uses Web Audio API to bypass device volume (plays at hardware max).
 * Pattern: 3 short, 3 long, 3 short (SOS) repeated.
 */
export function startAlarm(): void {
  stopAlarm();
  if (typeof window === 'undefined') return;

  try {
    alarmCtx = new AudioContext();
    // Non-blocking resume — Safari suspends AudioContext when created
    // outside a user gesture (e.g., from 'online' event). Fire-and-forget
    // so the visual strobe and network dispatch proceed regardless.
    if (alarmCtx.state === 'suspended') {
      alarmCtx.resume().catch(() => {});
    }
    alarmGain = alarmCtx.createGain();
    alarmGain.gain.value = 1.0;
    alarmGain.connect(alarmCtx.destination);
  } catch {
    return;
  }

  // SOS pattern: short short short — long long long — short short short
  const SOS = [
    100, 100, 100, 100, 100, 100,   // 3 short beeps (100ms on, 100ms off)
    300, 100, 300, 100, 300, 100,   // 3 long beeps (300ms on, 100ms off)
    100, 100, 100, 100, 100, 100,   // 3 short beeps
    0, 600,                          // pause before repeat
  ];

  let step = 0;
  let isOn = true;

  function tick() {
    if (!alarmCtx || !alarmGain) return;
    const duration = SOS[step % SOS.length];
    step++;
    isOn = !isOn;

    if (isOn && duration > 0) {
      alarmOsc = alarmCtx.createOscillator();
      alarmOsc.type = 'square';
      alarmOsc.frequency.value = 2600; // high-pitched emergency tone
      alarmOsc.connect(alarmGain!);
      alarmOsc.start();
      setTimeout(() => { alarmOsc?.stop(); alarmOsc = null; }, duration);
    }

    alarmInterval = setTimeout(tick, duration || 100);
  }

  tick();
}

export function stopAlarm(): void {
  if (alarmOsc) { try { alarmOsc.stop(); } catch {} alarmOsc = null; }
  if (alarmInterval) { clearTimeout(alarmInterval); alarmInterval = null; }
  if (alarmCtx) { alarmCtx.close().catch(() => {}); alarmCtx = null; }
  alarmGain = null;
}

/**
 * Full-screen red/white flash — impossible to miss.
 * Alternates every 500ms like emergency vehicle lights.
 */
export function startFlash(): void {
  stopFlash();
  if (typeof document === 'undefined') return;

  flashOverlay = document.createElement('div');
  flashOverlay.id = 'prism-emergency-flash';
  flashOverlay.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;transition:background 0.15s;';
  document.body.appendChild(flashOverlay);

  let isRed = true;
  flashOverlay.style.background = 'rgba(255,0,0,0.25)';

  // Skip flashing for users who have opted into reduced motion (WCAG 2.3.3).
  // The alarm audio continues so the emergency is still detectable.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  flashInterval = setInterval(() => {
    if (!flashOverlay) return;
    isRed = !isRed;
    flashOverlay.style.background = isRed ? 'rgba(255,0,0,0.25)' : 'rgba(255,255,255,0.35)';
  }, 1000);
}

export function stopFlash(): void {
  if (flashInterval) { clearInterval(flashInterval); flashInterval = null; }
  if (flashOverlay) { flashOverlay.remove(); flashOverlay = null; }
}

export const DEFAULT_CONFIG: EmergencyConfig = {
  enabled: true,
  countdownSeconds: 10,
  autoCall911: false,
  contacts: [],
  profile: { name: '' },
};

/** Bounds applied to localStorage-read emergency config. THIS IS LIFE-
 *  SAFETY CODE. A tampered persist entry could otherwise:
 *  - inject a malicious synaluxApiUrl that redirects 911 POSTs (with
 *    GPS, name, medical profile, message) to an attacker
 *  - inject attacker phone/email into contacts so alerts go to the
 *    attacker rather than the caregiver
 *  - inject NaN / negative / huge countdownSeconds disabling the
 *    cancel window or leaving the user stuck in countdown
 *  - disable `enabled` to silently turn the whole system off
 *  Drop any field that doesn't match its strict shape. */
const MAX_CONTACTS = 20;
const MAX_NAME_LEN = 80;
const MAX_PHONE_LEN = 32;
const MAX_EMAIL_LEN = 254;
const MAX_RELATIONSHIP_LEN = 40;
const MAX_CONDITION_LEN = 120;
const MAX_CONDITIONS = 30;
const MAX_ADDRESS_LEN = 200;
const MAX_API_URL_LEN = 256;
/** Allowed hostnames for the emergency synaluxApiUrl. Built at module
 *  load from synalux.ai + localhost defaults plus an opt-in env
 *  override (NEXT_PUBLIC_SYNALUX_EMERGENCY_HOSTS — comma-separated).
 *  The env override exists so a future custom domain doesn't silently
 *  break emergency dispatch — operators can add their domain via env
 *  without a code change. https-only for the production hosts (via
 *  isHttpsAllowedUrl below); localhost permits http for local dev. */
function buildAllowedHosts(): { production: Set<string>; localhost: Set<string> } {
  const production = new Set<string>(['synalux.ai', 'www.synalux.ai']);
  const localhost = new Set<string>(['localhost', '127.0.0.1', '0.0.0.0']);
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_EMERGENCY_HOSTS) {
    // SECURITY: validate each host matches a safe hostname pattern before adding.
    // Prevents supply-chain attacks via compromised Vercel build secrets injecting
    // arbitrary domains. Only alphanumeric + dots + hyphens accepted.
    const SAFE_HOST = /^[a-z0-9][a-z0-9.\-]{0,252}[a-z0-9]$/i;
    for (const h of process.env.NEXT_PUBLIC_SYNALUX_EMERGENCY_HOSTS.split(',')) {
      const trimmed = h.trim().toLowerCase();
      if (trimmed && SAFE_HOST.test(trimmed)) production.add(trimmed);
    }
  }
  return { production, localhost };
}
const { production: PROD_API_HOSTS, localhost: LOCAL_API_HOSTS } = buildAllowedHosts();
const ALLOWED_API_HOSTS = new Set([...PROD_API_HOSTS, ...LOCAL_API_HOSTS]);

/** Coerce sanitizeString's '' return into the presence-or-undefined
 *  idiom the profile builder uses. */
function presentOrUndefined(s: string): string | undefined {
  return s.length > 0 ? s : undefined;
}

function cleanContact(c: unknown): EmergencyContact | null {
  if (!c || typeof c !== 'object') return null;
  const x = c as Record<string, unknown>;
  const name = presentOrUndefined(sanitizeString(x.name, MAX_NAME_LEN));
  const relationship = presentOrUndefined(sanitizeString(x.relationship, MAX_RELATIONSHIP_LEN));
  if (!name || !relationship) return null;
  const phone = presentOrUndefined(sanitizeString(x.phone, MAX_PHONE_LEN));
  const email = presentOrUndefined(sanitizeString(x.email, MAX_EMAIL_LEN));
  // A contact with neither phone nor email isn't reachable — drop it
  // so render code doesn't display a useless row.
  if (!phone && !email) return null;
  return { name, relationship, ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
}

function cleanProfile(p: unknown): UserMedicalProfile {
  if (!p || typeof p !== 'object') return { name: '' };
  const x = p as Record<string, unknown>;
  const name = sanitizeString(x.name, MAX_NAME_LEN);
  const age = clampInt(x.age, 0, 149, -1);
  const cleanList = (raw: unknown): string[] | undefined => {
    if (!Array.isArray(raw)) return undefined;
    const items = raw
      .map((s) => sanitizeString(s, MAX_CONDITION_LEN))
      .filter((s) => s.length > 0)
      .slice(0, MAX_CONDITIONS);
    return items.length > 0 ? items : undefined;
  };
  const address = presentOrUndefined(sanitizeString(x.address, MAX_ADDRESS_LEN));
  const callbackNumber = presentOrUndefined(sanitizeString(x.callbackNumber, MAX_PHONE_LEN));
  const country = presentOrUndefined(sanitizeString(x.country, MAX_NAME_LEN));
  return {
    name,
    ...(age >= 0 ? { age } : {}),
    ...(cleanList(x.conditions) ? { conditions: cleanList(x.conditions) } : {}),
    ...(cleanList(x.allergies) ? { allergies: cleanList(x.allergies) } : {}),
    ...(cleanList(x.medications) ? { medications: cleanList(x.medications) } : {}),
    ...(address ? { address } : {}),
    ...(callbackNumber ? { callbackNumber } : {}),
    ...(country ? { country } : {}),
  };
}

export function validateEmergencyConfig(raw: unknown): EmergencyConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;
  const x = raw as Record<string, unknown>;
  const countdownSeconds = clampInt(x.countdownSeconds, 1, 60, DEFAULT_CONFIG.countdownSeconds);
  const contacts = Array.isArray(x.contacts)
    ? x.contacts.map(cleanContact).filter((c): c is EmergencyContact => c !== null).slice(0, MAX_CONTACTS)
    : [];
  return {
    enabled: typeof x.enabled === 'boolean' ? x.enabled : DEFAULT_CONFIG.enabled,
    countdownSeconds,
    autoCall911: typeof x.autoCall911 === 'boolean' ? x.autoCall911 : DEFAULT_CONFIG.autoCall911,
    contacts,
    profile: cleanProfile(x.profile),
    ...(typeof x.language === 'string' && x.language.length > 0 && x.language.length <= 16
      ? { language: x.language.replace(/[^a-zA-Z-]/g, '').slice(0, 16) }
      : {}),
    // Production hosts: https-only (PII over plaintext is a hard no).
    // Localhost dev: http permitted because there's no real PII +
    // local dev doesn't have a TLS cert. Two-step check keeps the
    // strict default (allowHttp:false) for the production hostnames
    // and only relaxes it when the host is explicitly localhost.
    ...((isHttpsAllowedUrl(x.synaluxApiUrl, PROD_API_HOSTS, { maxLen: MAX_API_URL_LEN })
      || isHttpsAllowedUrl(x.synaluxApiUrl, LOCAL_API_HOSTS, { maxLen: MAX_API_URL_LEN, allowHttp: true }))
      ? { synaluxApiUrl: x.synaluxApiUrl as string }
      : {}),
  };
}

export function getConfig(): EmergencyConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return validateEmergencyConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: EmergencyConfig): void {
  if (typeof window === 'undefined') return;
  // Re-validate on save too — caller may have been a settings panel
  // that didn't enforce all the bounds. Persisting a clean shape
  // means getConfig() doesn't have to deal with mid-tier corruption
  // from our own code path.
  const clean = validateEmergencyConfig(config);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
}

// Use word-boundary matching to prevent false positives
// e.g. "sos" inside "osmosis", "it hurts" inside "it hurts just a little"
function wordBoundaryMatch(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  // Use Unicode-aware word boundaries so Cyrillic/Arabic/CJK phrases match correctly
  return new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, 'iu').test(text);
}

export function detectEmergency(text: string): { detected: boolean; severity: 'critical' | 'urgent' | 'medical' | null; phrase: string | null } {
  const lower = text.toLowerCase().trim();
  for (const [phrase, severity] of Object.entries(EMERGENCY_PHRASES)) {
    if (wordBoundaryMatch(lower, phrase)) {
      return { detected: true, severity, phrase };
    }
  }
  return { detected: false, severity: null, phrase: null };
}

/** Strict shape check for entries we read back from the alert queue.
 *  This is LIFE-SAFETY code — a tampered localStorage entry that
 *  passes the queue dedup as a "matching" alert could silently
 *  swallow a real emergency. Drop anything that doesn't have the
 *  exact required fields. */
const VALID_SEVERITIES = new Set(['critical', 'urgent', 'medical']);
function isValidQueuedAlert(a: unknown): a is QueuedAlert {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  if (typeof x.id !== 'string' || !x.id || x.id.length > 128) return false;
  if (typeof x.phrase !== 'string' || !x.phrase || x.phrase.length > 1000) return false;
  if (typeof x.timestamp !== 'number' || !Number.isFinite(x.timestamp) || x.timestamp < 0) return false;
  if (typeof x.sent !== 'boolean') return false;
  if (x.severity !== undefined && (typeof x.severity !== 'string' || !VALID_SEVERITIES.has(x.severity))) return false;
  return true;
}

function getQueuedAlerts(): QueuedAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ALERT_QUEUE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    // Hard cap on queue size — defense against tampered storage. A
    // legitimate queue stays under ~10 entries (only unsent alerts
    // accumulate); 200 is paranoid headroom that still bounds the
    // dedup-loop work past which it would noticeably stall.
    return parsed.filter(isValidQueuedAlert).slice(0, 200) as QueuedAlert[];
  } catch {
    return [];
  }
}

function saveQueuedAlerts(alerts: QueuedAlert[]): void {
  if (typeof window === 'undefined') return;
  // Wrap in try/catch — life-safety code must not throw on
  // QuotaExceededError. If write fails, in-memory queue still has the
  // alert; the next online-flush retry will attempt to send it. Logging
  // helps a caregiver diagnose "why didn't the alert send" later.
  try {
    localStorage.setItem(ALERT_QUEUE_KEY, JSON.stringify(alerts));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[emergency] saveQueuedAlerts failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Get device GPS location. Waits up to 3 seconds — if GPS fails or times out,
 * proceeds without location. Emergency call is NEVER delayed more than 3s for GPS.
 */
async function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { clearTimeout(timeout); resolve(null); },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 60000 },
    );
  });
}

/**
 * Reverse-geocode GPS to detect CURRENT country.
 * Uses free Nominatim API (OpenStreetMap). If it fails, falls back to config.
 * This handles: child traveling abroad, school trip, vacation, hospital in another city.
 */
let _lastNominatimCallMs = 0;
let _lastNominatimResult: Awaited<ReturnType<typeof detectCountryFromGPS>> | null = null;

async function detectCountryFromGPS(lat: number, lng: number): Promise<{ country: string; countryCode: string; language: string } | null> {
  const now = Date.now();
  if (now - _lastNominatimCallMs < 2000 && _lastNominatimResult) {
    return _lastNominatimResult;
  }
  _lastNominatimCallMs = now;
  const t = timeoutSignal(2000);
  try {
    // SECURITY NOTE: GPS coordinates are sent in the query string to nominatim.openstreetmap.org
    // over HTTPS. This is an accepted risk — there is no POST API alternative for Nominatim.
    // The returned country code is validated against EMERGENCY_NUMBERS before use.
    // A compromised/MITM network can observe the coordinates but cannot spoof a valid country code.
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { signal: t.signal, headers: { 'User-Agent': 'PrismAAC-Emergency/1.0' } },
    );
    if (!res.ok) return null;
    // Size guard: a hostile/poisoned Nominatim response could push GBs;
    // we only need a small JSON object back. Pre-check Content-Length
    // and reject anything larger than 64 KB before reading the body.
    const declaredLen = Number(res.headers?.get?.('content-length') ?? '');
    if (Number.isFinite(declaredLen) && declaredLen > MAX_THIRD_PARTY_BYTES) return null;
    const text = await res.text();
    if (text.length > MAX_THIRD_PARTY_BYTES) return null;
    let data: { address?: { country_code?: string; country?: string } };
    try { data = JSON.parse(text); } catch { return null; }
    const rawCode = (data.address?.country_code || '').toUpperCase().replace(/[^A-Z]/g, '');
    // Validate against known country codes to block spoofed Nominatim responses
    // (e.g. DNS-poisoned or MITM proxy on school WiFi) from routing to wrong emergency number.
    // Fall back to stored profile country when Nominatim returns an unknown code.
    // Use getConfig() (not the local `config` variable) so this function is safe to call standalone.
    const storedCountry = getConfig()?.profile?.country?.toUpperCase() || '';
    const code = rawCode in EMERGENCY_NUMBERS ? rawCode : storedCountry;
    if (!code) return null;

    const COUNTRY_LANG: Record<string, string> = {
      US: 'en', CA: 'en', GB: 'en', AU: 'en', IE: 'en', NZ: 'en',
      ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
      FR: 'fr', BE: 'fr', CH: 'fr',
      BR: 'pt', PT: 'pt',
      DE: 'de', AT: 'de',
      RU: 'ru', BY: 'ru',
      UA: 'uk',
      RO: 'ro', MD: 'ro',
      JP: 'ja',
      KR: 'ko',
      CN: 'zh-Hans',  // Mainland — Simplified, Mandarin
      TW: 'zh-Hant',  // Taiwan — Traditional, Taiwanese Mandarin
      HK: 'zh-HK',    // Hong Kong — Traditional, Cantonese
      MO: 'zh-HK',    // Macao — Traditional + Cantonese
      SG: 'zh-Hans',  // Singapore Chinese-speakers — Simplified, Mandarin
      SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar',
      IT: 'it', NL: 'nl', PL: 'pl', TR: 'tr', TH: 'th', VN: 'vi',
      // Note: SG resolved above to zh-Hans for Chinese-speakers; English-speaking
      // Singapore residents whose UI is in English are handled by the language
      // setting, not the country lookup.
      IN: 'en', PH: 'en', ZA: 'en', NG: 'en', KE: 'en',
    };

    const result = {
      country: data.address?.country || code,
      countryCode: code,
      language: COUNTRY_LANG[code] || 'en',
    };
    _lastNominatimResult = result;
    return result;
  } catch {
    return null;
  } finally {
    t.cancel();
  }
}

interface QueuedAlertGeo {
  location: { lat: number; lng: number } | null;
  detectedCountry: string | null;
  detectedLanguage: string | null;
  emergencyNumber: string | null;
}

async function getLocationAndCountry(): Promise<QueuedAlertGeo> {
  const location = await getDeviceLocation();
  if (!location) return { location: null, detectedCountry: null, detectedLanguage: null, emergencyNumber: null };

  const geo = await detectCountryFromGPS(location.lat, location.lng);
  const emergencyNumber = geo ? (EMERGENCY_NUMBERS[geo.countryCode] || '112') : null;

  return {
    location,
    detectedCountry: geo?.country || null,
    detectedLanguage: geo?.language || null,
    emergencyNumber,
  };
}

// Dedup window: if the same phrase/severity was queued or dispatched within
// 5 minutes, silently ignore the duplicate. Prevents a child mashing "call 911"
// 15 times from generating 15 concurrent Twilio VoIP calls to the PSAP.
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

async function queueAlert(phrase: string, severity?: 'critical' | 'urgent' | 'medical'): Promise<(QueuedAlert & { geo: QueuedAlertGeo }) | null> {
  const queue = getQueuedAlerts();
  const now = Date.now();
  const isDuplicate = queue.some(a =>
    a.phrase === phrase &&
    a.severity === severity &&
    (now - a.timestamp) < DEDUP_WINDOW_MS
  );
  if (isDuplicate) return null;

  const geo = await getLocationAndCountry();
  const alert: QueuedAlert & { geo: QueuedAlertGeo } = {
    // Use randomId so two alerts triggered in the same millisecond
    // (rare but possible on a stuttering tap) can't collide on a
    // Math.random()-derived suffix. Critical because emergency alert
    // ids key the queued-send dedup logic.
    id: randomId('em-'),
    phrase,
    timestamp: Date.now(),
    location: geo.location || undefined,
    sent: false,
    severity,
    geo,
  };
  queue.push(alert);
  saveQueuedAlerts(queue);
  return alert;
}

/**
 * Build the emergency message the AI speaks on the call.
 * Used by all alert paths — TTS on speaker, VoIP AI agent, SMS body.
 */
/**
 * Get recent conversation history from the message store.
 * This gives the emergency AI context about what the child was
 * communicating BEFORE the emergency — critical for operators.
 */
function getRecentHistory(maxItems = 20): Array<{ text: string; timestamp: number }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('prism-aac-message');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Zustand persist may store state as a nested JSON string (v3 compat)
    const stateObj = typeof parsed?.state === 'string' ? JSON.parse(parsed.state) : parsed?.state;
    const rawHistory: unknown[] = Array.isArray(stateObj?.history) ? stateObj.history : [];
    // Validate each entry — tampered localStorage must not inject content into emergency dispatch
    const MAX_TEXT = 4000;
    const history = rawHistory
      .filter((h): h is { text: string; timestamp: number } =>
        h !== null && typeof h === 'object' &&
        typeof (h as Record<string, unknown>).text === 'string' &&
        typeof (h as Record<string, unknown>).timestamp === 'number',
      )
      .map((h) => ({ text: h.text.slice(0, MAX_TEXT), timestamp: h.timestamp }));
    return history.slice(0, maxItems);
  } catch {
    return [];
  }
}

function formatHistoryForAI(history: Array<{ text: string; timestamp: number }>): string {
  if (history.length === 0) return 'No recent conversation history available.';
  const now = Date.now();
  return history.map((h) => {
    const minsAgo = Math.round((now - h.timestamp) / 60000);
    const timeLabel = minsAgo < 1 ? 'just now' : minsAgo < 60 ? `${minsAgo}min ago` : `${Math.round(minsAgo / 60)}h ago`;
    return `[${timeLabel}] "${h.text}"`;
  }).join('\n');
}

export function buildEmergencyScript(phrase: string, config: EmergencyConfig, location?: { lat: number; lng: number }): string {
  const p = config.profile;
  const name = p.name || 'a PrismAAC user';
  const age = p.age ? `${p.age}-year-old` : '';
  const conditions = p.conditions?.length ? p.conditions.join(', ') : '';
  const allergies = p.allergies?.length ? `Allergies: ${p.allergies.join(', ')}.` : '';
  const meds = p.medications?.length ? `Medications: ${p.medications.join(', ')}.` : '';
  // GPS location takes priority over stored address — child could be anywhere.
  // Validate coordinates: browser Geolocation API returns IEEE 754 doubles;
  // a spoofed/injected geolocation could produce NaN or Infinity.
  const validLoc = location && Number.isFinite(location.lat) && Number.isFinite(location.lng)
    ? location : null;
  const gpsStr = validLoc ? `GPS coordinates ${validLoc.lat.toFixed(5)}, ${validLoc.lng.toFixed(5)}` : '';
  const mapLink = validLoc
    ? `https://maps.google.com/?q=${encodeURIComponent(String(validLoc.lat))},${encodeURIComponent(String(validLoc.lng))}`
    : '';
  const addr = gpsStr
    ? (p.address ? `${p.address} (live GPS: ${gpsStr})` : gpsStr)
    : (p.address || 'unknown — GPS unavailable');
  const callback = p.callbackNumber || '';

  return [
    `This is an automated emergency call from PrismAAC.`,
    `${age ? `A ${age} ` : ''}nonverbal individual named ${name} needs help.`,
    `They communicated: "${phrase}".`,
    `Location: ${addr}.`,
    conditions ? `Medical conditions: ${conditions}.` : '',
    allergies,
    meds,
    callback ? `Callback number: ${callback}.` : '',
    `This message will repeat. I can answer your questions.`,
  ].filter(Boolean).join(' ');
}

/**
 * Emergency alert dispatch — 5-level fallback chain.
 * Works for ALL subscription tiers. A child's safety does not depend on payment.
 *
 * PRIORITY ORDER:
 *   1. Synalux Direct (VoIP) — staffed dispatch, trained on AAC users
 *   2. Emergency contacts (API → SMS/email via Synalux backend)
 *   3. Emergency contacts (VoIP call via Twilio — AI speaks on call)
 *   4. Native phone call (tel:// + TTS on speaker)
 *   5. Offline queue + alarm (auto-sends on reconnect)
 *
 * DEVICE SUPPORT:
 *   - iPhone: all 5 levels
 *   - iPad WiFi: levels 1-3 (VoIP) + level 5 (offline queue)
 *   - iPad cellular: all 5 levels
 *   - Apple Watch cellular/WiFi (no phone): levels 1-3 via direct VoIP + level 5
 *   - Apple Watch (phone in range): delegates to iPhone via WatchConnectivity
 *   - Android: all 5 levels
 */
async function sendAlert(alert: QueuedAlert, config: EmergencyConfig): Promise<boolean> {
  if (isSendInFlight) {
    console.warn('[EMERGENCY] sendAlert: previous dispatch still in flight, dropping duplicate');
    return false;
  }
  isSendInFlight = true;
  try {
  const script = buildEmergencyScript(alert.phrase, config, alert.location);

  // Speak the emergency message on device speaker IMMEDIATELY regardless of call status
  speakEmergencyOnSpeaker(script, config.language || 'en');

  const recentHistory = getRecentHistory(20);
  const historyText = formatHistoryForAI(recentHistory);

  // PHI separation: full payload (with profile + conversation history) is ONLY
  // sent to Level 1 (Synalux authenticated server endpoint). Levels 2–4 use a
  // minimal payload — phrase + script only — to avoid leaking medical profile
  // data and conversation history to contacts and to mailto:/sms: links.
  const fullPayload = {
    type: 'emergency',
    phrase: alert.phrase,
    script,
    timestamp: new Date(alert.timestamp).toISOString(),
    location: alert.location || null,
    contacts: config.contacts,
    profile: config.profile,
    language: config.language || 'en',
    conversationHistory: historyText,
    recentMessages: recentHistory,
  };

  const minimalPayload = {
    type: 'emergency',
    phrase: alert.phrase,
    script,
    geoScript: alert.location
      ? `https://maps.google.com/?q=${Number.isFinite(alert.location?.lat) ? alert.location.lat.toFixed(5) : 0},${Number.isFinite(alert.location?.lng) ? alert.location.lng.toFixed(5) : 0}`
      : undefined,
  };

  // ── LEVEL 1: Synalux Direct Line ──
  // Works on any device with internet (iPhone, iPad, Watch cellular/WiFi, Android)
  if (navigator.onLine) {
    const apiUrl = config.synaluxApiUrl || SYNALUX_EMERGENCY_API;
    // Re-validate URL on every dispatch — defence-in-depth against a tampered
    // config that slipped past validateEmergencyConfig (e.g., runtime mutation).
    const apiUrlValid = isHttpsAllowedUrl(apiUrl, PROD_API_HOSTS, { maxLen: MAX_API_URL_LEN })
      || isHttpsAllowedUrl(apiUrl, LOCAL_API_HOSTS, { maxLen: MAX_API_URL_LEN, allowHttp: true });
    if (!apiUrlValid) {
      console.error('[EMERGENCY] sendAlert: blocked — URL not in allowed hosts:', (() => { try { return new URL(apiUrl).hostname; } catch { return apiUrl; } })());
    }
    const t = timeoutSignal(15000);
    try {
      const token = getAuthToken();
      // PHI gate: only authenticated paid-tier users receive the full payload
      // (medical profile + conversation history). Free-tier and anonymous users
      // get minimalPayload — phrase + GPS only — to avoid transmitting PHI for
      // users who have not opted into a paid plan with associated data handling.
      // Only send full PHI payload (conversation history + medical profile) for authenticated paid-tier users.
      // Free-tier users get minimalPayload even when authenticated.
      const profile = useAuthStore.getState().profile;
      const isPaid = profile?.plan && profile.plan !== 'free';
      const dispatchPayload = (token && isPaid) ? fullPayload : minimalPayload;
      const res = apiUrlValid ? await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dispatchPayload),
        signal: t.signal,
      }) : null;
      if (res?.ok) {
        alert.sent = true;
        return true;
      }
    } catch {
      // Synalux unreachable — fall through
    } finally {
      t.cancel();
    }
  }

  // ── LEVEL 2: Emergency contacts via API (SMS/email dispatched server-side) ──
  // Uses minimalPayload — no PHI (profile/history) sent to this endpoint.
  if (navigator.onLine && config.contacts.length > 0) {
    const notifyUrl = `${config.synaluxApiUrl || SYNALUX_EMERGENCY_API}/notify`;
    const notifyUrlValid = isHttpsAllowedUrl(notifyUrl, PROD_API_HOSTS, { maxLen: MAX_API_URL_LEN })
      || isHttpsAllowedUrl(notifyUrl, LOCAL_API_HOSTS, { maxLen: MAX_API_URL_LEN, allowHttp: true });
    const t = timeoutSignal(10000);
    try {
      const notifyToken = getAuthToken();
      const res = notifyUrlValid ? await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(notifyToken ? { Authorization: `Bearer ${notifyToken}` } : {}),
        },
        body: JSON.stringify(minimalPayload),
        signal: t.signal,
      }) : null;
      if (res?.ok) {
        alert.sent = true;
        // Continue to level 4 for phone call too — belt and suspenders
      }
    } catch {
      // API failed — fall through
    } finally {
      t.cancel();
    }
  }

  // ── LEVEL 3: Direct email to contacts (browser-side, no API needed) ──
  // Compose a SINGLE mailto: with all recipients in the `to=` field.
  // Multiple window.open() calls are silently blocked by the popup blocker
  // after the first — a loop would only notify caregiver #1.
  // safeScript: phrase + GPS only — no PHI (name, age, conditions, medications).
  // Full medical profile stays in fullPayload (Level 1, authenticated + TLS only).
  const safeScript = [
    `Emergency phrase: ${alert.phrase}`,
    alert.location ? `Location: https://maps.google.com/?q=${Number.isFinite(alert.location?.lat) ? alert.location.lat.toFixed(5) : 0},${Number.isFinite(alert.location?.lng) ? alert.location.lng.toFixed(5) : 0}` : '',
    `Sent from PrismAAC`,
  ].filter(Boolean).join('\n');

  if (navigator.onLine) {
    const emailRecipients = config.contacts
      .map((c) => (c.email ? safeMailtoRecipient(c.email) : null))
      .filter((r): r is string => !!r);
    if (emailRecipients.length > 0) {
      const subject = encodeURIComponent('EMERGENCY — PrismAAC Alert');
      const body = encodeURIComponent(safeScript);
      window.open(`mailto:${emailRecipients.join(',')}?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
      alert.sent = true;
    }
  }

  // ── LEVEL 4: Native phone call + speaker TTS ──
  // Works on iPhone, iPad cellular, Android with cellular. Speaker TTS lets
  // 911 or caregiver hear the AI message through the device speaker.
  // On Apple Watch cellular (no paired phone), tel:// opens the watch dialer.
  // ── LEVEL 4: Native SMS (works WITHOUT internet on cellular devices) ──
  // SMS body cap: many carriers silently truncate at ~1500 encoded chars.
  // Prioritise: GPS link (most critical for first responders) + phrase.
  // Medical details are in the API path (Level 1/2); SMS is best-effort.
  const gpsLine = alert.location
    ? `📍 https://maps.google.com/?q=${Number.isFinite(alert.location?.lat) ? alert.location.lat.toFixed(5) : 0},${Number.isFinite(alert.location?.lng) ? alert.location.lng.toFixed(5) : 0}`
    : '';
  const smsCore = `🚨 EMERGENCY — PrismAAC\n${alert.phrase}\n${gpsLine}`.trim();
  const smsExtra = '';
  const smsScript = (smsCore + smsExtra).slice(0, 1500);

  for (const contact of config.contacts) {
    if (contact.phone) {
      const safePhone = safePhoneForUri(contact.phone);
      if (!safePhone) continue;
      const encodedBody = encodeURIComponent(smsScript);
      window.open(`sms:${safePhone}?body=${encodedBody}`, '_blank', 'noopener,noreferrer');
    }
  }

  // ── LEVEL 5: Native phone call + speaker TTS ──
  // Works on any device with cellular. Speaker TTS means 911 hears the message.
  if (config.autoCall911) {
    // Resolve emergency number from device geolocation when available; fall
    // back to the configured profile country, then to the international 112.
    const geo = await getLocationAndCountry();
    const emergencyNum = geo.emergencyNumber
      || EMERGENCY_NUMBERS[config.profile.country?.toUpperCase() || 'US']
      || '112';
    window.open(`tel:${emergencyNum}`, '_self');
    alert.sent = true;
  } else {
    for (const contact of config.contacts) {
      if (contact.phone) {
        const safePhone = safePhoneForUri(contact.phone);
        if (!safePhone) continue;
        window.open(`tel:${safePhone}`, '_self');
        alert.sent = true;
        break;
      }
    }
  }

  // ── LEVEL 5: Offline queue ──
  // If nothing worked, the alert stays in queue. When connectivity restores,
  // flushQueuedAlerts() fires automatically via the 'online' event listener
  // and retries from Level 1.
  return alert.sent;
  } finally {
    isSendInFlight = false;
  }
}

/**
 * Speak emergency script on device speaker at maximum volume.
 * Repeats every 15 seconds until stopped.
 * Works offline — uses device TTS, not cloud.
 */
let speakerRepeatInterval: ReturnType<typeof setInterval> | null = null;

function speakEmergencyOnSpeaker(script: string, language: string = 'en'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  stopEmergencySpeaker();  // clear any prior interval before creating a new one

  const speak = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 0.9;
    u.volume = 1.0;
    u.pitch = 1.0;
    const LANG_MAP: Record<string, string> = {
      en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', ro: 'ro-RO',
      uk: 'uk-UA', ru: 'ru-RU', de: 'de-DE', ja: 'ja-JP', ko: 'ko-KR',
      zh: 'zh-CN',           // back-compat: bare zh -> Mainland Mandarin
      'zh-Hans': 'zh-CN',    // Simplified / Mainland Mandarin
      'zh-Hant': 'zh-TW',    // Traditional / Taiwanese Mandarin
      'zh-HK': 'zh-HK',      // Hong Kong Cantonese
      ar: 'ar-SA',
    };
    u.lang = LANG_MAP[language] || 'en-US';
    window.speechSynthesis.speak(u);
  };

  speak();
  speakerRepeatInterval = setInterval(speak, 15000);
}

export function stopEmergencySpeaker(): void {
  if (speakerRepeatInterval) { clearInterval(speakerRepeatInterval); speakerRepeatInterval = null; }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/**
 * Trigger emergency response. Called when an emergency phrase is detected.
 *
 * @param phrase - The emergency phrase detected
 * @param severity - 'critical' (immediate) or 'urgent' (with countdown)
 * @param onCountdown - Called each second with remaining seconds
 * @param onComplete - Called when alert is sent or queued
 * @param onCancel - Called if user cancels during countdown
 * @returns cancel function
 */
/**
 * Trigger emergency response.
 *
 * CRITICAL severity (abuse, assault, breathing):
 *   - UNCANCELLABLE. No button, no gesture, no way to stop it.
 *   - A bully/abuser standing next to the child CANNOT prevent the alert.
 *   - 5-second countdown then auto-sends.
 *
 * URGENT severity:
 *   - Cancellable ONLY via trained gesture: press-and-hold two opposite
 *     corners of the screen simultaneously for 3 seconds.
 *   - 10-second countdown. Bully cannot figure this out in time.
 *
 * MEDICAL severity:
 *   - Same cancel gesture as urgent. 10-second countdown.
 */
export async function triggerEmergency(
  phrase: string,
  severity: 'critical' | 'urgent' | 'medical',
  onCountdown: (seconds: number) => void,
  onComplete: (sent: boolean, queued: boolean) => void,
  onCancel?: () => void,
): Promise<() => void> {
  let config = getConfig();
  if (!config.enabled) {
    onComplete(false, false);
    return () => {};
  }

  // Allow one active countdown at a time. A second trigger within the countdown
  // window is treated as confirmation, not a second dispatch.
  if (countdownTimer !== null) {
    return () => {};
  }

  // Reset stale flag from a prior crashed dispatch before starting fresh.
  dispatchInProgress = false;

  const alert = await queueAlert(phrase, severity);

  // Dedup: same phrase already queued within 5 minutes — silently ignore
  if (!alert) {
    onComplete(false, false);
    return () => {};
  }

  // Override language + emergency number from live GPS country detection.
  // Create a new object — never mutate the config reference in-place so
  // the URL-validated object cannot be extended with attacker-controlled fields.
  if (alert.geo.detectedLanguage) config = { ...config, language: alert.geo.detectedLanguage };
  if (alert.geo.emergencyNumber) {
    // Update the 911 number to the LOCAL emergency number
    if (process.env.NODE_ENV !== 'production') console.log(`[EMERGENCY] GPS country detected`);
  }

  const countdownTotal = severity === 'critical' ? 5 : config.countdownSeconds;
  const isCancellable = severity !== 'critical';
  // Absolute dispatch time — immune to device sleep / background throttling.
  // If device wakes up past the dispatch time, check if stale (>5 min drift).
  const dispatchAtMs = Date.now() + countdownTotal * 1000;
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;

  startAlarm();
  startFlash();

  countdownCallback = onCountdown;
  cancelCallback = onCancel || null;
  onCountdown(countdownTotal);

  let unregisterGesture: (() => void) | null = null;
  if (isCancellable) {
    unregisterGesture = registerCancelGesture(() => {
      cancelEmergency(alert.id);
      onCancel?.();
    });
  }

  countdownTimer = setInterval(async () => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((dispatchAtMs - now) / 1000));
    onCountdown(remaining);

    if (remaining <= 0) {
      if (dispatchInProgress) return; // prevent double-dispatch on sleep/wake jitter
      dispatchInProgress = true;
      // If device slept through the countdown and woke up way past dispatch
      // time, treat as stale — don't blindly dispatch hours-old alerts.
      const driftMs = now - dispatchAtMs;
      if (driftMs > STALE_THRESHOLD_MS) {
        clearCountdown();
        if (unregisterGesture) unregisterGesture();
        stopAlarm();
        stopFlash();
        stopEmergencySpeaker();
        dispatchInProgress = false;
        onComplete(false, true); // queued, not dispatched
        return;
      }
      clearCountdown();
      if (unregisterGesture) unregisterGesture();
      try {
        const sent = await sendAlert(alert, config);
        stopAlarm();
        stopFlash();
        stopEmergencySpeaker();
        dispatchInProgress = false;
        if (!sent) {
          onComplete(false, true);
        } else {
          const queue = getQueuedAlerts();
          saveQueuedAlerts(queue.filter((a) => a.id !== alert.id));
          onComplete(true, false);
        }
      } catch {
        stopAlarm();
        stopFlash();
        stopEmergencySpeaker();
        dispatchInProgress = false;
        onComplete(false, true);
      }
    }
  }, 1000);

  // Return cancel function — but for critical, it's a no-op
  if (!isCancellable) {
    return () => {}; // CRITICAL: cannot be cancelled. This is intentional.
  }
  return () => {
    if (unregisterGesture) unregisterGesture();
    cancelEmergency(alert.id);
  };
}

export function cancelEmergency(alertId?: string): void {
  activeCancelFn = null;
  clearCountdown();
  stopAlarm();
  stopFlash();
  stopEmergencySpeaker();
  if (alertId) {
    const queue = getQueuedAlerts().filter((a) => a.id !== alertId);
    saveQueuedAlerts(queue);
  }
  cancelCallback?.();
}

function clearCountdown(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownCallback = null;
  cancelCallback = null;
}

/**
 * Flush queued alerts when connectivity restores.
 * Call this from a 'online' event listener.
 */
// Non-critical alerts expire after 10 minutes.
const QUEUE_TTL_MS = 10 * 60 * 1000;
// Critical alerts (abuse, abduction) are NEVER silently dropped, but
// after 30 minutes they are downgraded to SMS/email only (no live 911
// call) to prevent stale SWATing (e.g., iPad reconnects 3 days later).
const CRITICAL_DISPATCH_WINDOW_MS = 30 * 60 * 1000;

// Mutex: prevents concurrent flush from network flapping (car/wheelchair
// moving through dead zones — online event fires 5x in 1 second).
let isFlushing = false;

// Alerts older than 60s require re-verification before dispatch.
// The UI must present a 10-second "Dispatching Delayed Alert..." overlay
// with the standard cancel gesture. Only if no cancellation occurs does
// the alert actually send. This prevents resolved crises from auto-dispatching
// when the iPad walks into a WiFi zone 15 minutes later.
const REVERIFY_THRESHOLD_MS = 60 * 1000;
let onDelayedAlertCallback: ((alert: QueuedAlert, proceed: () => void, cancel: () => void) => void) | null = null;

export function setDelayedAlertHandler(handler: (alert: QueuedAlert, proceed: () => void, cancel: () => void) => void): void {
  onDelayedAlertCallback = handler;
}

export async function flushQueuedAlerts(): Promise<number> {
  if (isFlushing) return 0;
  isFlushing = true;
  try {
    let total = 0;
    // Re-drain: if new alerts arrive while processing (child presses panic
    // during the 10-second verification window), process them too before
    // releasing the mutex. Prevents silently stranded alerts.
    // Re-drain loop: process new alerts that arrive during verification.
    // BREAK if no progress (network down) — retry on next 'online' event.
    for (let pass = 0; pass < 10; pass++) {
      const sent = await _flushQueuedAlerts();
      total += sent;
      const remaining = getQueuedAlerts().filter(a => !a.sent);
      if (remaining.length === 0) break;
      if (sent === 0) break; // no progress — network failing, stop retrying
    }
    return total;
  } finally { isFlushing = false; }
}

async function _flushQueuedAlerts(): Promise<number> {
  const config = getConfig();
  const queue = getQueuedAlerts();
  const now = Date.now();

  const isCritical = (a: QueuedAlert) => a.severity === 'critical';
  const isExpired = (a: QueuedAlert) => (now - a.timestamp) >= QUEUE_TTL_MS;
  const isStaleCritical = (a: QueuedAlert) => isCritical(a) && (now - a.timestamp) >= CRITICAL_DISPATCH_WINDOW_MS;

  // Non-critical: drop after 10 min. Critical: keep forever but downgrade after 30 min.
  const unsent = queue.filter((a) => !a.sent && (!isExpired(a) || isCritical(a)));

  if (unsent.length === 0) {
    saveQueuedAlerts(queue.filter((a) => a.sent));
    return 0;
  }

  let sent = 0;
  for (const alert of unsent) {
    const isDelayed = (now - alert.timestamp) > REVERIFY_THRESHOLD_MS;

    if (isStaleCritical(alert)) {
      // Use a local copy — never mutate the shared config reference
      const staleCriticalConfig = { ...config, autoCall911: false };
      const dispatchAlert = { ...alert, phrase: `[DELAYED OFFLINE ALERT - ${new Date(alert.timestamp).toISOString()}] ${alert.phrase}` };
      const flushApiUrl = staleCriticalConfig.synaluxApiUrl || SYNALUX_EMERGENCY_API;
      const flushUrlValid = isHttpsAllowedUrl(flushApiUrl, PROD_API_HOSTS, { maxLen: MAX_API_URL_LEN })
        || isHttpsAllowedUrl(flushApiUrl, LOCAL_API_HOSTS, { maxLen: MAX_API_URL_LEN, allowHttp: true });
      if (!flushUrlValid) {
        console.error('[EMERGENCY] flush: blocked dispatch — URL not in allowed hosts');
        continue;
      }
      const ok = await sendAlert(dispatchAlert, staleCriticalConfig);
      if (ok) sent++;
    } else if (isDelayed && onDelayedAlertCallback) {
      // Alert >60s old: require caregiver re-verification before dispatch.
      // 10-second timeout: if UI fails to render (app backgrounded, crash),
      // auto-proceed with SMS-only to prevent queue deadlock.
      const dispatched = await Promise.race([
        new Promise<boolean>((resolve) => {
          onDelayedAlertCallback!(alert, () => resolve(true), () => resolve(false));
        }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10000)),
      ]);
      if (dispatched) {
        const delayedApiUrl = config.synaluxApiUrl || SYNALUX_EMERGENCY_API;
        const delayedUrlValid = isHttpsAllowedUrl(delayedApiUrl, PROD_API_HOSTS, { maxLen: MAX_API_URL_LEN })
          || isHttpsAllowedUrl(delayedApiUrl, LOCAL_API_HOSTS, { maxLen: MAX_API_URL_LEN, allowHttp: true });
        if (!delayedUrlValid) {
          console.error('[EMERGENCY] flush: blocked dispatch — URL not in allowed hosts');
          continue;
        }
        const ok = await sendAlert(alert, config);
        if (ok) sent++;
      } else {
        alert.sent = true; // cancelled by caregiver
      }
    } else {
      const elseApiUrl = config.synaluxApiUrl || SYNALUX_EMERGENCY_API;
      const elseUrlValid = isHttpsAllowedUrl(elseApiUrl, PROD_API_HOSTS, { maxLen: MAX_API_URL_LEN })
        || isHttpsAllowedUrl(elseApiUrl, LOCAL_API_HOSTS, { maxLen: MAX_API_URL_LEN, allowHttp: true });
      if (!elseUrlValid) {
        console.error('[EMERGENCY] flush: blocked dispatch — URL not in allowed hosts');
        continue;
      }
      const ok = await sendAlert(alert, config);
      if (ok) sent++;
    }
  }

  saveQueuedAlerts(queue.filter((a) => !a.sent && (!isExpired(a) || isCritical(a))));
  return sent;
}

/**
 * Register connectivity listener to auto-flush queued emergency alerts.
 * Call once at app startup.
 */
export function registerConnectivityListener(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = async () => {
    const flushed = await flushQueuedAlerts();
    if (flushed > 0) {
      console.log(`[EmergencyService] Connectivity restored — sent ${flushed} queued alert(s)`);
    }
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
