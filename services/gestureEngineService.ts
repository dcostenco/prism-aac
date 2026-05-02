'use client';

/**
 * Custom Gesture Engine — Teach, Record, Assign
 *
 * Allows caregivers to define custom gestures and assign them to
 * AAC actions. A gesture is a sequence of body/head movements or
 * switch patterns that the system learns to recognize.
 *
 * Built-in gestures:
 *   - Head nod (up-down-up) → "Yes"
 *   - Head shake (left-right-left) → "No"
 *   - Blink (both eyes close > 500ms) → click
 *   - Double blink → speak current text
 *   - Mouth open → start voice input
 *
 * Custom gestures:
 *   1. Caregiver enters "Record" mode
 *   2. Child performs the gesture 3 times
 *   3. System averages the movement pattern
 *   4. Caregiver assigns an action (speak phrase, press button, etc.)
 *   5. Gesture is saved and recognized in real-time
 */

// ── Types ──────────────────────────────────────────────────────────────

export type GestureAction =
  | { type: 'speak'; text: string }
  | { type: 'click'; selector: string }
  | { type: 'navigate'; panel: string }
  | { type: 'toggle'; feature: string }
  | { type: 'custom'; callback: string };

export interface GestureDefinition {
  id: string;
  name: string;
  pattern: GesturePattern;
  action: GestureAction;
  enabled: boolean;
  createdAt: string;
}

export interface GesturePattern {
  type: 'head' | 'body' | 'switch' | 'blink';
  // Sequence of normalized direction vectors (dx, dy per frame)
  sequence: Array<{ dx: number; dy: number; dt: number }>;
  tolerance: number; // 0-1, how closely the input must match (0.7 = 70%)
}

export interface GestureEngineCallbacks {
  onGestureDetected: (gesture: GestureDefinition) => void;
  onRecordingProgress?: (sampleCount: number, needed: number) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism-gestures';
const MATCH_THRESHOLD = 0.65;
const RECORDING_SAMPLES = 3;
const SEQUENCE_MAX_LENGTH = 30; // max frames per gesture

// ── Built-in Gestures ──────────────────────────────────────────────────

const HEAD_NOD: GesturePattern = {
  type: 'head',
  sequence: [
    { dx: 0, dy: -0.1, dt: 150 }, // up
    { dx: 0, dy: 0.2, dt: 200 },  // down
    { dx: 0, dy: -0.1, dt: 150 }, // back to center
  ],
  tolerance: 0.7,
};

const HEAD_SHAKE: GesturePattern = {
  type: 'head',
  sequence: [
    { dx: -0.15, dy: 0, dt: 150 }, // left
    { dx: 0.3, dy: 0, dt: 200 },   // right
    { dx: -0.15, dy: 0, dt: 150 }, // back to center
  ],
  tolerance: 0.7,
};

export const BUILTIN_GESTURES: GestureDefinition[] = [
  {
    id: 'builtin-nod-yes',
    name: 'Head Nod → Yes',
    pattern: HEAD_NOD,
    action: { type: 'speak', text: 'Yes' },
    enabled: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-shake-no',
    name: 'Head Shake → No',
    pattern: HEAD_SHAKE,
    action: { type: 'speak', text: 'No' },
    enabled: true,
    createdAt: '2024-01-01',
  },
];

// ── Persistence ────────────────────────────────────────────────────────

export function loadGestures(): GestureDefinition[] {
  if (typeof window === 'undefined') return [...BUILTIN_GESTURES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const custom = JSON.parse(raw) as GestureDefinition[];
      return [...BUILTIN_GESTURES, ...custom];
    }
  } catch { /* */ }
  return [...BUILTIN_GESTURES];
}

export function saveCustomGestures(gestures: GestureDefinition[]): void {
  const custom = gestures.filter(g => !g.id.startsWith('builtin-'));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); } catch { /* */ }
}

export function addGesture(gesture: GestureDefinition): void {
  const all = loadGestures();
  all.push(gesture);
  saveCustomGestures(all);
}

export function removeGesture(id: string): void {
  const all = loadGestures().filter(g => g.id !== id);
  saveCustomGestures(all);
}

export function toggleGesture(id: string, enabled: boolean): void {
  const all = loadGestures();
  const g = all.find(x => x.id === id);
  if (g) g.enabled = enabled;
  saveCustomGestures(all);
}

// ── Pattern Matching ───────────────────────────────────────────────────

function comparePatterns(recorded: GesturePattern['sequence'], template: GesturePattern['sequence']): number {
  if (recorded.length === 0 || template.length === 0) return 0;

  // Resample recorded sequence to match template length
  const resampled = resampleSequence(recorded, template.length);

  // Compute cosine similarity of direction vectors
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < template.length; i++) {
    const a = resampled[i];
    const b = template[i];
    dotProduct += a.dx * b.dx + a.dy * b.dy;
    magA += a.dx * a.dx + a.dy * a.dy;
    magB += b.dx * b.dx + b.dy * b.dy;
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

function resampleSequence(
  seq: GesturePattern['sequence'],
  targetLength: number,
): GesturePattern['sequence'] {
  if (seq.length === targetLength) return seq;
  const result: GesturePattern['sequence'] = [];
  for (let i = 0; i < targetLength; i++) {
    const srcIdx = (i / targetLength) * seq.length;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, seq.length - 1);
    const t = srcIdx - lo;
    result.push({
      dx: seq[lo].dx * (1 - t) + seq[hi].dx * t,
      dy: seq[lo].dy * (1 - t) + seq[hi].dy * t,
      dt: seq[lo].dt * (1 - t) + seq[hi].dt * t,
    });
  }
  return result;
}

// ── Recording ──────────────────────────────────────────────────────────

let recordingBuffer: GesturePattern['sequence'][] = [];
let isRecording = false;
let currentRecording: GesturePattern['sequence'] = [];

export function startRecording(): void {
  isRecording = true;
  recordingBuffer = [];
  currentRecording = [];
}

export function feedRecordingFrame(dx: number, dy: number, dt: number): void {
  if (!isRecording) return;
  currentRecording.push({ dx, dy, dt });
  if (currentRecording.length > SEQUENCE_MAX_LENGTH) {
    currentRecording.shift();
  }
}

export function commitRecordingSample(): number {
  if (!isRecording) return 0;
  if (currentRecording.length > 2) {
    recordingBuffer.push([...currentRecording]);
  }
  currentRecording = [];
  return recordingBuffer.length;
}

export function finalizeRecording(): GesturePattern | null {
  isRecording = false;
  if (recordingBuffer.length < RECORDING_SAMPLES) return null;

  // Average all recorded samples
  const targetLen = Math.round(
    recordingBuffer.reduce((sum, s) => sum + s.length, 0) / recordingBuffer.length
  );
  const resampled = recordingBuffer.map(s => resampleSequence(s, targetLen));

  const averaged: GesturePattern['sequence'] = [];
  for (let i = 0; i < targetLen; i++) {
    let sumDx = 0, sumDy = 0, sumDt = 0;
    for (const sample of resampled) {
      sumDx += sample[i].dx;
      sumDy += sample[i].dy;
      sumDt += sample[i].dt;
    }
    averaged.push({
      dx: sumDx / resampled.length,
      dy: sumDy / resampled.length,
      dt: sumDt / resampled.length,
    });
  }

  recordingBuffer = [];
  return { type: 'head', sequence: averaged, tolerance: 0.7 };
}

export function isRecordingActive(): boolean {
  return isRecording;
}

// ── Real-time Detection ────────────────────────────────────────────────

let recentMovements: GesturePattern['sequence'] = [];
let lastDetectionTime = 0;
const DETECTION_COOLDOWN_MS = 1000;

export function feedMovementFrame(dx: number, dy: number, dt: number): void {
  recentMovements.push({ dx, dy, dt });
  if (recentMovements.length > SEQUENCE_MAX_LENGTH) {
    recentMovements.shift();
  }
}

export function detectGesture(gestures: GestureDefinition[]): GestureDefinition | null {
  if (recentMovements.length < 3) return null;

  const now = Date.now();
  if (now - lastDetectionTime < DETECTION_COOLDOWN_MS) return null;

  for (const gesture of gestures) {
    if (!gesture.enabled) continue;
    const score = comparePatterns(recentMovements, gesture.pattern.sequence);
    if (score >= (gesture.pattern.tolerance || MATCH_THRESHOLD)) {
      lastDetectionTime = now;
      recentMovements = [];
      return gesture;
    }
  }

  return null;
}

export function clearMovementBuffer(): void {
  recentMovements = [];
}

// ── Execute Gesture Action ─────────────────────────────────────────────

export function executeGestureAction(action: GestureAction): void {
  switch (action.type) {
    case 'speak': {
      import('./aacSpeak').then(({ aacSpeak }) => aacSpeak(action.text, 0.5, 1.0)).catch(() => {});
      break;
    }
    case 'click': {
      const el = document.querySelector(action.selector) as HTMLElement | null;
      el?.click();
      break;
    }
    case 'navigate': {
      const btn = document.querySelector(`[aria-label="${action.panel}"]`) as HTMLElement | null;
      btn?.click();
      break;
    }
    case 'toggle':
      break;
    case 'custom':
      break;
  }
}
