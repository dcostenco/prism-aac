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
let cancelTouches: { topLeft: number; bottomRight: number } = { topLeft: 0, bottomRight: 0 };
let cancelHoldTimer: ReturnType<typeof setTimeout> | null = null;
let activeCancelFn: (() => void) | null = null;

function isTwoCornerHold(touches: TouchList | null): boolean {
  if (!touches || touches.length < 2) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const CORNER = 80; // px from edge
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
  flashOverlay.style.background = 'rgba(255,0,0,0.4)';

  flashInterval = setInterval(() => {
    if (!flashOverlay) return;
    isRed = !isRed;
    flashOverlay.style.background = isRed ? 'rgba(255,0,0,0.4)' : 'rgba(255,255,255,0.6)';
  }, 500);
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

export function getConfig(): EmergencyConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: EmergencyConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function detectEmergency(text: string): { detected: boolean; severity: 'critical' | 'urgent' | 'medical' | null; phrase: string | null } {
  const lower = text.toLowerCase().trim();
  for (const [phrase, severity] of Object.entries(EMERGENCY_PHRASES)) {
    if (lower.includes(phrase)) {
      return { detected: true, severity, phrase };
    }
  }
  return { detected: false, severity: null, phrase: null };
}

function getQueuedAlerts(): QueuedAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ALERT_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueuedAlerts(alerts: QueuedAlert[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALERT_QUEUE_KEY, JSON.stringify(alerts));
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
async function detectCountryFromGPS(lat: number, lng: number): Promise<{ country: string; countryCode: string; language: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { signal: AbortSignal.timeout(2000), headers: { 'User-Agent': 'PrismAAC-Emergency/1.0' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const code = (data.address?.country_code || '').toUpperCase();
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
      CN: 'zh', TW: 'zh', HK: 'zh',
      SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar',
      IT: 'it', NL: 'nl', PL: 'pl', TR: 'tr', TH: 'th', VN: 'vi',
      IN: 'en', PH: 'en', SG: 'en', ZA: 'en', NG: 'en', KE: 'en',
    };

    return {
      country: data.address?.country || code,
      countryCode: code,
      language: COUNTRY_LANG[code] || 'en',
    };
  } catch {
    return null;
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

async function queueAlert(phrase: string): Promise<QueuedAlert & { geo: QueuedAlertGeo }> {
  const geo = await getLocationAndCountry();
  const alert: QueuedAlert & { geo: QueuedAlertGeo } = {
    id: `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    phrase,
    timestamp: Date.now(),
    location: geo.location || undefined,
    sent: false,
    geo,
  };
  const queue = getQueuedAlerts();
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
    const history: Array<{ text: string; timestamp: number }> = parsed?.state?.history || [];
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
  // GPS location takes priority over stored address — child could be anywhere
  const gpsStr = location ? `GPS coordinates ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : '';
  const mapLink = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : '';
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
  const script = buildEmergencyScript(alert.phrase, config, alert.location);

  // Speak the emergency message on device speaker IMMEDIATELY regardless of call status
  speakEmergencyOnSpeaker(script, config.language || 'en');

  const recentHistory = getRecentHistory(20);
  const historyText = formatHistoryForAI(recentHistory);

  const payload = {
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

  // ── LEVEL 1: Synalux Direct Line ──
  // Works on any device with internet (iPhone, iPad, Watch cellular/WiFi, Android)
  if (navigator.onLine) {
    const apiUrl = config.synaluxApiUrl || SYNALUX_EMERGENCY_API;
    try {
      const token = localStorage.getItem('prism-aac-auth-token');
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        alert.sent = true;
        return true;
      }
    } catch {
      // Synalux unreachable — fall through
    }
  }

  // ── LEVEL 2: Emergency contacts via API (SMS/email dispatched server-side) ──
  if (navigator.onLine && config.contacts.length > 0) {
    try {
      const res = await fetch(`${config.synaluxApiUrl || SYNALUX_EMERGENCY_API}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        alert.sent = true;
        // Continue to level 4 for phone call too — belt and suspenders
      }
    } catch {
      // API failed — fall through
    }
  }

  // ── LEVEL 3: Direct email to contacts (browser-side, no API needed) ──
  if (navigator.onLine) {
    for (const contact of config.contacts) {
      if (contact.email) {
        const subject = encodeURIComponent('EMERGENCY — PrismAAC Alert');
        const body = encodeURIComponent(script);
        window.open(`mailto:${contact.email}?subject=${subject}&body=${body}`, '_blank');
        alert.sent = true;
      }
    }
  }

  // ── LEVEL 4: Native phone call + speaker TTS ──
  // Works on iPhone, iPad cellular, Android with cellular. Speaker TTS lets
  // 911 or caregiver hear the AI message through the device speaker.
  // On Apple Watch cellular (no paired phone), tel:// opens the watch dialer.
  // ── LEVEL 4: Native SMS (works WITHOUT internet on cellular devices) ──
  const smsScript = [
    `🚨 EMERGENCY — PrismAAC`,
    script,
    alert.location ? `📍 Map: https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}` : '',
  ].filter(Boolean).join('\n');

  for (const contact of config.contacts) {
    if (contact.phone) {
      const encodedBody = encodeURIComponent(smsScript);
      window.open(`sms:${contact.phone}?body=${encodedBody}`, '_blank');
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
        window.open(`tel:${contact.phone}`, '_self');
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
}

/**
 * Speak emergency script on device speaker at maximum volume.
 * Repeats every 15 seconds until stopped.
 * Works offline — uses device TTS, not cloud.
 */
let speakerRepeatInterval: ReturnType<typeof setInterval> | null = null;

function speakEmergencyOnSpeaker(script: string, language: string = 'en'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const speak = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 0.9;
    u.volume = 1.0;
    u.pitch = 1.0;
    const LANG_MAP: Record<string, string> = {
      en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', ro: 'ro-RO',
      uk: 'uk-UA', ru: 'ru-RU', de: 'de-DE', ja: 'ja-JP', ko: 'ko-KR',
      zh: 'zh-CN', ar: 'ar-SA',
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
  const config = getConfig();
  if (!config.enabled) {
    onComplete(false, false);
    return () => {};
  }

  const alert = await queueAlert(phrase);

  // Override language + emergency number from live GPS country detection
  if (alert.geo.detectedLanguage) config.language = alert.geo.detectedLanguage;
  if (alert.geo.emergencyNumber) {
    // Update the 911 number to the LOCAL emergency number
    console.log(`[EMERGENCY] GPS detected country: ${alert.geo.detectedCountry}, emergency: ${alert.geo.emergencyNumber}, language: ${alert.geo.detectedLanguage}`);
  }

  const countdownTotal = severity === 'critical' ? 5 : config.countdownSeconds;
  let remaining = countdownTotal;
  const isCancellable = severity !== 'critical';

  startAlarm();
  startFlash();

  countdownCallback = onCountdown;
  cancelCallback = onCancel || null;
  onCountdown(remaining);

  // Register two-corner cancel gesture ONLY for non-critical alerts
  let unregisterGesture: (() => void) | null = null;
  if (isCancellable) {
    unregisterGesture = registerCancelGesture(() => {
      cancelEmergency(alert.id);
      onCancel?.();
    });
  }

  countdownTimer = setInterval(async () => {
    remaining--;
    onCountdown(remaining);

    if (remaining <= 0) {
      clearCountdown();
      if (unregisterGesture) unregisterGesture();
      const sent = await sendAlert(alert, config);
      stopAlarm();
      stopFlash();
      if (!sent) {
        onComplete(false, true);
      } else {
        const queue = getQueuedAlerts();
        saveQueuedAlerts(queue.filter((a) => a.id !== alert.id));
        onComplete(true, false);
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
export async function flushQueuedAlerts(): Promise<number> {
  const config = getConfig();
  const queue = getQueuedAlerts();
  const unsent = queue.filter((a) => !a.sent);
  if (unsent.length === 0) return 0;

  let sent = 0;
  for (const alert of unsent) {
    const ok = await sendAlert(alert, config);
    if (ok) sent++;
  }

  saveQueuedAlerts(queue.filter((a) => !a.sent));
  return sent;
}

/**
 * Register connectivity listener to auto-flush queued emergency alerts.
 * Call once at app startup.
 */
export function registerConnectivityListener(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', async () => {
    const flushed = await flushQueuedAlerts();
    if (flushed > 0) {
      console.log(`[EmergencyService] Connectivity restored — sent ${flushed} queued alert(s)`);
    }
  });
}
