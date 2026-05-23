'use client';

/**
 * Adaptive Engine — Real-time behavioral feedback loop
 * ═══════════════════════════════════════════════════════
 *
 * ⚠️  SINGLE SOURCE OF TRUTH = SYNALUX
 *
 * The canonical AdaptiveProfile schema, tone-detection algorithm, and
 * tone→TTS-style mappings live in:
 *
 *     synalux-private/portal/src/shared/adaptiveEngine.ts
 *
 * This file is a CLIENT-SIDE MIRROR with the same algorithm so prism-aac
 * works offline (free tier, network loss). It must be kept structurally
 * identical to the synalux version — same field names, same constants,
 * same regex sets, same numeric thresholds.
 *
 * When making changes:
 *   1. Edit synalux first.
 *   2. Mirror the change here in this file.
 *   3. Bump PROFILE_VERSION in BOTH files together.
 *   4. Add a migration branch in the migrate() function below.
 *   5. Tests in tests/adaptive-engine.test.ts should still pass.
 *
 * Run training/sync_adaptive_engine.sh to verify the two files are in
 * structural sync (compares constant sets + function signatures).
 *
 * 5 adaptive systems:
 *   1. Tone — auto-routes TTS voice style based on detected message context
 *   2. Gesture Speed — cursor sensitivity matches motor rhythm
 *   3. Pronunciation — learns speech patterns (with hard emergency passthrough)
 *   4. Background Noise — adapts mic threshold to environment (clamped)
 *   5. Prompt Pattern — frequency-weighted category preference + decaying TOD vocab
 *
 * BCBA alignment:
 *   - All adaptation ADDITIVE (never removes capabilities)
 *   - Emergency words bypass pronunciation correction
 *   - Dwell clamped to [400, 3000]ms
 *   - Noise threshold clamped to ≤ -20dB so voice can always trigger
 *   - Caregiver reset clears everything via resetProfile()
 *   - Module-scoped in-memory profile + 3s debounced localStorage write
 */

import { clampNumber } from '@/lib/safeValidation';

const PROFILE_KEY = 'prism-adaptive-profile';
const PROFILE_VERSION = 2;

// ── Types ───────────────────────────────────────────────────

/**
 * Per-locale tone label sent to TTS / prism-coder system prompt.
 * Mapped to Azure styles in speechService.
 */
export type AdaptiveTone = 'neutral' | 'friendly' | 'excited' | 'empathetic' | 'serious';

export interface CategoryStat {
  count: number;
  lastUsed: number;
}

export interface TimePeriodWord {
  /** lower-cased word */
  w: string;
  /** last seen epoch ms — used for 30-day decay */
  t: number;
  /** number of occurrences */
  n: number;
}

export interface AdaptiveProfile {
  version: number;

  // 1. Tone
  toneHistory: Array<{ tone: AdaptiveTone; timestamp: number }>;
  /** sustained mood — only flips when ≥5 of last 10 events agree */
  dominantMood: 'neutral' | 'urgent' | 'happy' | 'calm';

  // 2. Gesture Speed
  avgDwellMs: number;
  avgMoveSpeed: number; // px/sec
  motorRhythmSamples: number; // capped at 1000 — see EMA branch in recordDwell

  // 3. Pronunciation (heard → intended). Emergency words bypass via correctPronunciation.
  commonMispronunciations: Record<string, string>;
  preferredVoiceRate: number;

  // 4. Background Noise
  noiseFloorDb: number;
  noiseAdaptedAt: number;
  quietEnvironment: boolean;

  // 5. Prompt Patterns
  avgMessageLength: number;
  /** id → {count, lastUsed}. Sort by count * exp(-age_days/14) for ranking. */
  categories: Record<string, CategoryStat>;
  /** period → words (kept fresh by 30-day decay on read) */
  timeOfDayPatterns: Record<string, TimePeriodWord[]>;
  messageSamples: number;

  lastUpdated: number;
}

const DEFAULT_PROFILE: AdaptiveProfile = {
  version: PROFILE_VERSION,
  toneHistory: [],
  dominantMood: 'neutral',
  avgDwellMs: 1200,
  avgMoveSpeed: 100,
  motorRhythmSamples: 0,
  commonMispronunciations: {},
  preferredVoiceRate: 0.5,
  noiseFloorDb: -60,
  noiseAdaptedAt: 0,
  quietEnvironment: true,
  avgMessageLength: 3,
  categories: {},
  timeOfDayPatterns: {},
  messageSamples: 0,
  lastUpdated: 0,
};

// ── Persistence — module-scoped in-memory + 3s debounced write ──────────────

let _profile: AdaptiveProfile | null = null;
let _writeTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DEBOUNCE_MS = 3000;
/** External listener (e.g. synalux sync) invoked on profile change. */
type ChangeListener = (p: Readonly<AdaptiveProfile>) => void;
const _listeners = new Set<ChangeListener>();

/**
 * DEEP clone of DEFAULT_PROFILE. Shallow spread `{...DEFAULT_PROFILE}` would
 * share `commonMispronunciations`, `categories`, `timeOfDayPatterns`,
 * `toneHistory` references — mutating the profile would leak into the default
 * and persist across `resetProfile()` calls. Real bug caught by tests.
 */
function freshProfile(): AdaptiveProfile {
  return {
    ...DEFAULT_PROFILE,
    toneHistory: [],
    commonMispronunciations: {},
    categories: {},
    timeOfDayPatterns: {},
  };
}

/** Hard caps on adaptive-profile fields read from localStorage. A
 *  tampered persist could otherwise inject NaN / -Infinity / huge
 *  values into the math the AAC user's predictions and motor-rhythm
 *  cursor speeds depend on — silently locking them out of accurate
 *  recommendations or making the cursor unusable. */
const MAX_TONE_HISTORY = 100;
const MAX_MISPRONUNCIATIONS = 500;
const MAX_CATEGORIES = 200;
const MAX_TOD_PERIODS = 24;
const MAX_TOD_WORDS_PER_PERIOD = 100;
const MAX_KEY_LEN = 200;

function sanitizeAdaptiveProfile(raw: unknown): AdaptiveProfile {
  const fresh = freshProfile();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Record<string, unknown>;

  // Numbers — clamp to plausible bounds so motor-rhythm + noise math
  // can never see NaN/Infinity from a tampered persist.
  const out: AdaptiveProfile = {
    ...fresh,
    avgDwellMs: clampNumber(r.avgDwellMs, 0, 60_000, fresh.avgDwellMs),
    avgMoveSpeed: clampNumber(r.avgMoveSpeed, 0, 10_000, fresh.avgMoveSpeed),
    motorRhythmSamples: clampNumber(r.motorRhythmSamples, 0, 100_000, fresh.motorRhythmSamples),
    preferredVoiceRate: clampNumber(r.preferredVoiceRate, 0.1, 3, fresh.preferredVoiceRate),
    noiseFloorDb: clampNumber(r.noiseFloorDb, -120, 20, fresh.noiseFloorDb),
    noiseAdaptedAt: clampNumber(r.noiseAdaptedAt, 0, Date.now() + 86400_000, fresh.noiseAdaptedAt),
    quietEnvironment: typeof r.quietEnvironment === 'boolean' ? r.quietEnvironment : fresh.quietEnvironment,
    avgMessageLength: clampNumber(r.avgMessageLength, 0, 1000, fresh.avgMessageLength),
    messageSamples: clampNumber(r.messageSamples, 0, 1_000_000, fresh.messageSamples),
    lastUpdated: clampNumber(r.lastUpdated, 0, Date.now() + 86400_000, fresh.lastUpdated),
    version: clampNumber(r.version, 1, 100, fresh.version),
  };

  // toneHistory — array of {context, tone, timestamp}, capped.
  if (Array.isArray(r.toneHistory)) {
    const validTones = new Set(['neutral', 'friendly', 'excited', 'empathetic', 'serious']);
    out.toneHistory = (r.toneHistory as unknown[])
      .filter((h): h is { tone: AdaptiveTone; timestamp: number } => {
        if (!h || typeof h !== 'object') return false;
        const x = h as Record<string, unknown>;
        return typeof x.tone === 'string' && validTones.has(x.tone)
          && typeof x.timestamp === 'number' && Number.isFinite(x.timestamp);
      })
      .slice(0, MAX_TONE_HISTORY);
  }

  if (typeof r.dominantMood === 'string'
    && ['neutral', 'urgent', 'happy', 'calm'].includes(r.dominantMood)) {
    out.dominantMood = r.dominantMood as AdaptiveProfile['dominantMood'];
  }

  // commonMispronunciations — Record<string, string>, capped.
  if (r.commonMispronunciations && typeof r.commonMispronunciations === 'object'
    && !Array.isArray(r.commonMispronunciations)) {
    const cleaned: Record<string, string> = {};
    let n = 0;
    for (const [k, v] of Object.entries(r.commonMispronunciations as Record<string, unknown>)) {
      if (n >= MAX_MISPRONUNCIATIONS) break;
      if (typeof k !== 'string' || !k || k.length > MAX_KEY_LEN) continue;
      if (typeof v !== 'string' || v.length > MAX_KEY_LEN) continue;
      cleaned[k] = v;
      n++;
    }
    out.commonMispronunciations = cleaned;
  }

  // categories — Record<string, {count, lastUsed}>, capped + numeric.
  if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
    const cleaned: Record<string, CategoryStat> = {};
    let n = 0;
    for (const [k, v] of Object.entries(r.categories as Record<string, unknown>)) {
      if (n >= MAX_CATEGORIES) break;
      if (typeof k !== 'string' || !k || k.length > MAX_KEY_LEN) continue;
      if (!v || typeof v !== 'object') continue;
      const x = v as Record<string, unknown>;
      const count = clampNumber(x.count, 0, 1_000_000, -1);
      const lastUsed = clampNumber(x.lastUsed, 0, Date.now() + 86400_000, -1);
      if (count < 0 || lastUsed < 0) continue;
      cleaned[k] = { count, lastUsed };
      n++;
    }
    out.categories = cleaned;
  }

  // timeOfDayPatterns — Record<string, TimePeriodWord[]>, capped.
  if (r.timeOfDayPatterns && typeof r.timeOfDayPatterns === 'object'
    && !Array.isArray(r.timeOfDayPatterns)) {
    const cleaned: Record<string, TimePeriodWord[]> = {};
    let p = 0;
    for (const [period, words] of Object.entries(r.timeOfDayPatterns as Record<string, unknown>)) {
      if (p >= MAX_TOD_PERIODS) break;
      if (typeof period !== 'string' || !period || period.length > MAX_KEY_LEN) continue;
      if (!Array.isArray(words)) continue;
      const cleanWords: TimePeriodWord[] = [];
      for (const w of words) {
        if (cleanWords.length >= MAX_TOD_WORDS_PER_PERIOD) break;
        if (!w || typeof w !== 'object') continue;
        const x = w as Record<string, unknown>;
        if (typeof x.w !== 'string' || !x.w || x.w.length > MAX_KEY_LEN) continue;
        const t = clampNumber(x.t, 0, Date.now() + 86400_000, -1);
        const n = clampNumber(x.n, 0, 1_000_000, -1);
        if (t < 0 || n < 0) continue;
        cleanWords.push({ w: x.w, t, n });
      }
      cleaned[period] = cleanWords;
      p++;
    }
    out.timeOfDayPatterns = cleaned;
  }

  return out;
}

function readFromStorage(): AdaptiveProfile {
  if (typeof window === 'undefined') return freshProfile();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return freshProfile();
    const parsed = JSON.parse(raw) as Partial<AdaptiveProfile> & { version?: number };
    // Migrate first (handles v1 → v2 shape lift), then sanitize the
    // result. Migration trusts shape; sanitization re-validates every
    // field so migrate() can stay simple AND a tampered persist can't
    // smuggle NaN through the pre-version branch.
    return sanitizeAdaptiveProfile(migrate(parsed));
  } catch {
    return freshProfile();
  }
}

/**
 * Discard the in-memory profile cache. Re-reads from localStorage on next
 * loadProfile(). Exposed for tests + for sync scenarios where another tab
 * updated the profile.
 */
export function _invalidateCache(): void {
  _profile = null;
}

/**
 * Forward-compat profile migration. v1 used `topCategories: string[]` (recency-only)
 * and `timeOfDayPatterns: Record<string, string[]>` (no decay). v2 switches both
 * to frequency-weighted with last-seen timestamps.
 */
function migrate(raw: Partial<AdaptiveProfile> & { topCategories?: string[]; timeOfDayPatterns?: unknown }): AdaptiveProfile {
  const v = (raw as { version?: number }).version ?? 1;
  if (v >= PROFILE_VERSION) return { ...freshProfile(), ...(raw as object) } as AdaptiveProfile;
  // v1 → v2
  const out: AdaptiveProfile = { ...freshProfile(), ...(raw as object), version: PROFILE_VERSION };
  // topCategories[] → categories{}
  const oldCats = (raw as { topCategories?: string[] }).topCategories;
  if (Array.isArray(oldCats) && (!raw.categories || Object.keys(raw.categories).length === 0)) {
    out.categories = {};
    const now = Date.now();
    oldCats.forEach((id, i) => {
      // Higher count for the more-recent (front) entries so ranking survives migration
      out.categories[id] = { count: Math.max(1, oldCats.length - i), lastUsed: now };
    });
  }
  // timeOfDayPatterns: Record<string,string[]> → Record<string, TimePeriodWord[]>
  const oldTod = (raw as { timeOfDayPatterns?: unknown }).timeOfDayPatterns;
  if (oldTod && typeof oldTod === 'object' && !Array.isArray(oldTod)) {
    const upgraded: Record<string, TimePeriodWord[]> = {};
    const now = Date.now();
    for (const [period, words] of Object.entries(oldTod as Record<string, unknown>)) {
      if (Array.isArray(words) && words.every((w) => typeof w === 'string')) {
        upgraded[period] = (words as string[]).map((w) => ({ w, t: now, n: 1 }));
      } else if (Array.isArray(words)) {
        // already v2 shape
        upgraded[period] = words as TimePeriodWord[];
      }
    }
    out.timeOfDayPatterns = upgraded;
  }
  return out;
}

export function loadProfile(): AdaptiveProfile {
  if (_profile) return _profile;
  _profile = readFromStorage();
  return _profile;
}

function scheduleFlush(): void {
  if (typeof window === 'undefined') return;
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    flushNow();
  }, FLUSH_DEBOUNCE_MS);
}

function flushNow(): void {
  if (!_profile || typeof window === 'undefined') return;
  _profile.lastUpdated = Date.now();
  try {
    // H7: exclude health-sensitive word patterns from localStorage persistence.
    // timeOfDayPatterns and commonMispronunciations contain vocabulary that may
    // reveal medical conditions, locations, or personal routines. They are
    // rebuilt from session usage each time and do not need to survive reloads.
    const { timeOfDayPatterns: _tod, commonMispronunciations: _mis, ..._safe } = _profile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(_safe));
  } catch {
    // Quota or private mode — best-effort, the in-memory profile keeps working.
  }
  if (_writeTimer) {
    clearTimeout(_writeTimer);
    _writeTimer = null;
  }
}

function notify(): void {
  if (!_profile || _listeners.size === 0) return;
  // M13: deliver only the privacy-safe signals subset, not the full profile
  // (which contains timeOfDayPatterns / commonMispronunciations / toneHistory).
  const signals = getAdaptiveSignals(); // privacy-safe signals, not full profile
  for (const l of _listeners) {
    try { l(signals as unknown as Readonly<AdaptiveProfile>); } catch { /* listener errors don't break engine */ }
  }
}

function mutate(fn: (p: AdaptiveProfile) => void): void {
  const p = loadProfile();
  fn(p);
  scheduleFlush();
  notify();
}

// Flush on page hide / visibility change so we never lose the last few seconds
// of adaptation when the user closes the tab. Mirrors predictionStore pattern.
// Named handler so it can be removed if cleanup is ever needed (tests, PWA re-mount)
const _adaptiveOnVisibility = () => { if (document.visibilityState === 'hidden') flushNow(); };
let _adaptiveListenersRegistered = false;
if (typeof window !== 'undefined' && !_adaptiveListenersRegistered) {
  _adaptiveListenersRegistered = true;
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', _adaptiveOnVisibility);
}

export function cleanupAdaptiveListeners(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', flushNow);
    document.removeEventListener('visibilitychange', _adaptiveOnVisibility);
    _adaptiveListenersRegistered = false;
  }
}

export function resetProfile(): void {
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(PROFILE_KEY); } catch { /* */ }
  }
  // Discard cache so subsequent loadProfile() reads a fresh default —
  // critical so tests / caregiver-reset scenarios don't see stale state
  // from in-memory mutations on a shared object.
  _profile = freshProfile();
  if (_writeTimer) {
    clearTimeout(_writeTimer);
    _writeTimer = null;
  }
  notify();
}

export function subscribe(listener: ChangeListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** Force an immediate flush — call before navigating away or syncing externally. */
export function flushAdaptiveProfile(): void {
  flushNow();
}

// ── 1. Tone Adaptation ──────────────────────────────────────

const EMERGENCY_WORDS = new Set([
  'help', 'hurt', 'scared', 'pain', 'emergency', 'call', '911',
  'bleed', 'bleeding', 'choking', 'fire', 'stuck', 'lost',
]);
const HAPPY_WORDS = new Set([
  'happy', 'fun', 'play', 'love', 'good', 'yes', 'like', 'want',
  'please', 'thank', 'thanks', 'awesome', 'great', 'cool',
]);
const CALM_WORDS = new Set([
  'tired', 'sleep', 'rest', 'quiet', 'done', 'finished', 'bedtime',
  'sleepy', 'cozy', 'calm',
]);

/** Crude stemmer — drops trailing -ing/-ed/-s so "hurting"/"hurts" → "hurt". */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/**
 * Tokenize text robustly: lower-case, strip non-letter/space punctuation across
 * Unicode ranges (handles "help!", "hurt." and similar attached punctuation
 * that the prior implementation missed).
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Detect tone from a message. Used both for caregiver insight and for
 * routing TTS voice style automatically.
 */
export function detectTone(text: string): AdaptiveTone {
  const raw = text.trim();
  const tokens = tokenize(raw);
  const stems = tokens.map(stem);

  const inSet = (s: Set<string>) => tokens.some((t) => s.has(t)) || stems.some((t) => s.has(t));

  const hasEmergency = inSet(EMERGENCY_WORDS);
  const hasHappy = inSet(HAPPY_WORDS);
  const hasCalm = inSet(CALM_WORDS);
  const isQuestion = raw.endsWith('?');
  const isExclamation = raw.endsWith('!');

  if (hasEmergency) return 'serious';
  if (isExclamation && hasHappy) return 'excited';
  if (hasHappy) return 'friendly';
  if (hasCalm) return 'empathetic';
  if (isQuestion) return 'friendly';
  return 'neutral';
}

export function recordTone(text: string, tone: AdaptiveTone): void {
  mutate((p) => {
    // SECURITY: context (message text) MUST NOT be persisted — it may contain PHI (medical symptoms, names, locations). Only the detected tone enum is stored. Do not re-add the context field.
    p.toneHistory.push({ tone, timestamp: Date.now() });
    if (p.toneHistory.length > 100) p.toneHistory = p.toneHistory.slice(-100);

    // Hysteresis: dominant mood only flips when ≥5 of last 10 events agree.
    // Prevents a single emergency from putting the system in 'urgent' mode for
    // the next half hour.
    const recent = p.toneHistory.slice(-10);
    const counts: Record<string, number> = {};
    for (const t of recent) counts[t.tone] = (counts[t.tone] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 5) {
      const toneToMood: Record<string, AdaptiveProfile['dominantMood']> = {
        serious: 'urgent', excited: 'happy', friendly: 'happy',
        empathetic: 'calm', neutral: 'neutral',
      };
      p.dominantMood = toneToMood[top[0]] ?? 'neutral';
    }
  });
}

/**
 * Auto Tone Switch — single entry point for the rest of the app to ask
 * "what tone should I speak this in?". Detects → records → returns.
 *
 * Wire this in speechService.ts so every TTS call routes through one
 * line of code.
 */
export function autoSwitchTone(text: string): AdaptiveTone {
  const tone = detectTone(text);
  recordTone(text, tone);
  return tone;
}

/**
 * Map AdaptiveTone → ToneStyle (must be a member of azureTTS.TONE_OPTIONS).
 * 'general' and 'gentle' are NOT valid ToneStyle values — they were causing
 * tone=general in TTS logs and passing an invalid style to the portal.
 */
export function toneToAzureStyle(tone: AdaptiveTone): string {
  switch (tone) {
    case 'serious':    return 'calm';        // measured, not distressed
    case 'excited':    return 'cheerful';
    case 'friendly':   return 'friendly';
    case 'empathetic': return 'empathetic';  // valid Azure SSML style
    case 'neutral':    return 'friendly';    // neutral → friendly default
    default:           return 'friendly';    // safe fallback (→ autoStyle on portal)
  }
}

/** Map AdaptiveTone → speech rate multiplier. Slower for serious/empathetic. */
export function toneToRate(tone: AdaptiveTone, baseRate: number): number {
  switch (tone) {
    case 'serious': return Math.max(0.7, baseRate * 0.85);
    case 'empathetic': return Math.max(0.7, baseRate * 0.9);
    case 'excited': return Math.min(1.4, baseRate * 1.1);
    default: return baseRate;
  }
}

/** Map AdaptiveTone → prism-coder system-prompt addendum. Sent on every chat. */
export function toneToSystemHint(tone: AdaptiveTone): string {
  switch (tone) {
    case 'serious': return 'The user has communicated something urgent or distressing. Be calm, clear, and brief. Keep responses short. Validate first, then offer concrete next steps.';
    case 'excited': return 'The user is excited and happy. Match their energy with warmth.';
    case 'friendly': return 'The user is in a positive social register. Be warm and casual.';
    case 'empathetic': return 'The user seems tired or wanting comfort. Be gentle and slow.';
    default: return '';
  }
}

// ── 2. Gesture Speed Adaptation ─────────────────────────────

const SAMPLE_CAP = 1000;
// EMA alpha after the cap — half-life ≈ 35 samples. Lets the average track
// real changes in motor speed instead of freezing forever.
const POST_CAP_ALPHA = 0.02;

function updateRunningAvg(prev: number, sample: number, n: number): { avg: number; n: number } {
  if (n < SAMPLE_CAP) {
    return { avg: (prev * n + sample) / (n + 1), n: n + 1 };
  }
  return { avg: prev * (1 - POST_CAP_ALPHA) + sample * POST_CAP_ALPHA, n };
}

export function recordDwell(dwellMs: number): void {
  if (!Number.isFinite(dwellMs) || dwellMs <= 0) return;
  mutate((p) => {
    const r = updateRunningAvg(p.avgDwellMs, dwellMs, p.motorRhythmSamples);
    p.avgDwellMs = r.avg;
    p.motorRhythmSamples = r.n;
  });
}

export function recordMoveSpeed(pxPerSec: number): void {
  if (!Number.isFinite(pxPerSec) || pxPerSec < 0) return;
  mutate((p) => {
    const r = updateRunningAvg(p.avgMoveSpeed, pxPerSec, p.motorRhythmSamples);
    p.avgMoveSpeed = r.avg;
    p.motorRhythmSamples = r.n;
  });
}

export function getAdaptedDwellMs(): number {
  const profile = loadProfile();
  if (profile.motorRhythmSamples < 10) return 1200;
  return Math.max(400, Math.min(3000, Math.round(profile.avgDwellMs * 1.2)));
}

export function getAdaptedCursorSmoothing(): number {
  const profile = loadProfile();
  if (profile.motorRhythmSamples < 10) return 0.12;
  if (profile.avgMoveSpeed < 50) return 0.06;
  if (profile.avgMoveSpeed > 200) return 0.2;
  return 0.12;
}

// ── 3. Pronunciation Learning ───────────────────────────────

export function recordMispronunciation(heard: string, intended: string): void {
  const h = heard.trim().toLowerCase();
  const i = intended.trim().toLowerCase();
  if (!h || !i) return;
  // Hard guard: never let a correction shadow an emergency word. Even if the
  // caregiver records 'help' → 'helper' by mistake, emergency detection must
  // still see 'help' downstream.
  if (EMERGENCY_WORDS.has(h)) return;
  mutate((p) => {
    p.commonMispronunciations[h] = i;
    const entries = Object.entries(p.commonMispronunciations);
    if (entries.length > 200) {
      p.commonMispronunciations = Object.fromEntries(entries.slice(-200));
    }
  });
}

export function correctPronunciation(heard: string): string {
  const lower = heard.toLowerCase();
  // Emergency passthrough — never mangle an emergency word with a learned
  // correction. This is the safety guarantee referenced in tests.
  if (EMERGENCY_WORDS.has(lower)) return heard;
  const profile = loadProfile();
  return profile.commonMispronunciations[lower] || heard;
}

export function recordPreferredRate(rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) return;
  mutate((p) => { p.preferredVoiceRate = rate; });
}

// ── 4. Background Noise Profiling ───────────────────────────

const NOISE_EMA_ALPHA = 0.05;
const NOISE_QUIET_DB = -45;
/**
 * Voice must be at least this many dB above noise floor to trigger recognition.
 * Empirically calibrated for whisper / browser STT.
 */
const NOISE_SNR_DB = 15;
/**
 * Hard upper bound on the threshold so it never exceeds what a human voice
 * can plausibly hit on a consumer mic. Without this clamp, very loud cars
 * push threshold > 0dB and recognition silently dies.
 */
const NOISE_THRESHOLD_MAX_DB = -20;

export function updateNoiseFloor(rmsDb: number): void {
  if (!Number.isFinite(rmsDb)) return;
  mutate((p) => {
    p.noiseFloorDb = p.noiseFloorDb * (1 - NOISE_EMA_ALPHA) + rmsDb * NOISE_EMA_ALPHA;
    p.noiseAdaptedAt = Date.now();
    p.quietEnvironment = p.noiseFloorDb < NOISE_QUIET_DB;
  });
}

export function getNoiseAdaptedThreshold(): number {
  const profile = loadProfile();
  return Math.min(NOISE_THRESHOLD_MAX_DB, profile.noiseFloorDb + NOISE_SNR_DB);
}

export function isQuietEnvironment(): boolean {
  return loadProfile().quietEnvironment;
}

// ── 5. Prompt Pattern Analysis ──────────────────────────────

const TOD_DECAY_DAYS = 30;
const TOD_DECAY_MS = TOD_DECAY_DAYS * 24 * 60 * 60 * 1000;

function periodForHour(h: number): string {
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function recordMessage(text: string, categoryId?: string): void {
  const tokens = tokenize(text);
  const wordCount = tokens.length || text.trim().split(/\s+/).length;
  if (wordCount === 0) return;
  mutate((p) => {
    const r = updateRunningAvg(p.avgMessageLength, wordCount, p.messageSamples);
    p.avgMessageLength = r.avg;
    p.messageSamples = r.n;

    // Frequency-weighted category tracking
    if (categoryId) {
      const cur = p.categories[categoryId] ?? { count: 0, lastUsed: 0 };
      p.categories[categoryId] = { count: cur.count + 1, lastUsed: Date.now() };
    }

    // Time-of-day patterns with per-word counts; decay applied on write.
    const period = periodForHour(new Date().getHours());
    const now = Date.now();
    const cutoff = now - TOD_DECAY_MS;
    const list = (p.timeOfDayPatterns[period] ?? []).filter((e) => e.t >= cutoff);
    for (const w of tokens.filter((t) => t.length > 2)) {
      const wordLower = w;
      // Never store emergency words — they must always pass through
      // unfiltered and should not influence pattern/prediction ranking.
      if (EMERGENCY_WORDS.has(wordLower)) continue;
      const existing = list.find((e) => e.w === wordLower);
      if (existing) {
        existing.t = now;
        existing.n += 1;
      } else {
        list.push({ w: wordLower, t: now, n: 1 });
      }
    }
    // Cap to top 50 by count — drop least-used to keep storage small
    if (list.length > 50) {
      list.sort((a, b) => b.n - a.n);
      list.length = 50;
    }
    p.timeOfDayPatterns[period] = list;
  });
}

/**
 * Returns context-relevant words for the current time of day. Words older
 * than {@link TOD_DECAY_DAYS} are filtered out so the suggestions track
 * the child's CURRENT routines, not last summer's vocabulary.
 */
export function getContextSuggestions(): string[] {
  const profile = loadProfile();
  const period = periodForHour(new Date().getHours());
  const list = profile.timeOfDayPatterns[period] ?? [];
  const cutoff = Date.now() - TOD_DECAY_MS;
  return list
    .filter((e) => e.t >= cutoff)
    .sort((a, b) => b.n - a.n)
    .map((e) => e.w);
}

/**
 * Frequency-weighted category ranking with 14-day decay. A category used
 * 100× yesterday outranks one used once today.
 */
export function getPreferredCategories(): string[] {
  const profile = loadProfile();
  const now = Date.now();
  return Object.entries(profile.categories)
    .map(([id, stat]) => {
      const ageDays = (now - stat.lastUsed) / (24 * 60 * 60 * 1000);
      const score = stat.count * Math.exp(-ageDays / 14);
      return { id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((c) => c.id)
    .slice(0, 10);
}

// ── Summary for caregiver / agent ───────────────────────────

export function getAdaptiveSummary(): string {
  const p = loadProfile();
  const lines = [
    `Mood: ${p.dominantMood}`,
    `Avg message: ${p.avgMessageLength.toFixed(1)} words`,
    `Motor speed: ${p.avgMoveSpeed.toFixed(0)} px/s (${p.motorRhythmSamples} samples)`,
    `Adapted dwell: ${getAdaptedDwellMs()}ms`,
    `Noise floor: ${p.noiseFloorDb.toFixed(0)} dB (${p.quietEnvironment ? 'quiet' : 'noisy'})`,
    `Top categories: ${getPreferredCategories().slice(0, 5).join(', ') || 'none yet'}`,
    `Mispronunciation corrections: ${Object.keys(p.commonMispronunciations).length}`,
  ];
  return lines.join('\n');
}

/**
 * Compact JSON snapshot suitable for sending to synalux / prism-mcp / prism-coder.
 * Contains only behavioral signals, no PII. Use this — not the full profile —
 * for cross-process sharing.
 */
export function getAdaptiveSignals(): {
  tone: AdaptiveProfile['dominantMood'];
  dwellMs: number;
  moveSpeed: number;
  smoothing: number;
  quietEnv: boolean;
  noiseDb: number;
  avgMessageLen: number;
  topCategories: string[];
} {
  const p = loadProfile();
  return {
    tone: p.dominantMood,
    dwellMs: getAdaptedDwellMs(),
    moveSpeed: Math.round(p.avgMoveSpeed),
    smoothing: getAdaptedCursorSmoothing(),
    quietEnv: p.quietEnvironment,
    noiseDb: Math.round(p.noiseFloorDb),
    avgMessageLen: Number(p.avgMessageLength.toFixed(1)),
    topCategories: getPreferredCategories().slice(0, 5),
  };
}
