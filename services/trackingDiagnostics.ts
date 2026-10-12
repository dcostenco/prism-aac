import { CAMERA_TRACKING_TARGETS } from './cameraTrackingTargets';

export const DIAGNOSTIC_FRAME_LIMIT = 6000;
export const DIAGNOSTIC_DURATION_MS = 120_000;
const TARGETS = new Set([...CAMERA_TRACKING_TARGETS.map(t => t.id), 'head']);
const STATUS_LIMIT = 256;
const STATUS_VALUES = ['starting', 'tracking', 'held', 'lost', 'error', 'stopped'] as const;
type DiagnosticStatus = typeof STATUS_VALUES[number];
const STATUS_NAMES = new Set<DiagnosticStatus>(STATUS_VALUES);
type Point = readonly [number | null, number | null];
export interface DiagnosticFrame {
  pipeline: 'pose' | 'head';
  target: string;
  requestedTarget: string;
  rawNorm: Point;
  inputNorm: Point;
  mapped: Point;
  filtered: Point;
  confidence: number | null;
  filterConfidence: number | null;
  noise: number | null;
  calibration: readonly (number | null)[];
  sensitivity: number | null;
  cameraIndex: number | null;
  videoSize: Point;
  screenSize: Point;
  detectionAgeMs?: number | null;
  processingMs?: number | null;
  cursorHeld?: boolean;
  calibrationFallback?: boolean;
}
let active = false;
let started = 0;
let startedAt = '';
let limitReached = false;
let frames: Array<DiagnosticFrame & { elapsedMs: number }> = [];
const states: Array<{ elapsedMs: number; pipeline: 'pose' | 'head'; status: DiagnosticStatus }> = [];
const lastState = new Map<string, DiagnosticStatus>();
let statusEventsDropped = 0;
const finite = (value: number | null | undefined) => Number.isFinite(value) ? value as number : null;
const point = (value: Point): Point => [finite(value[0]), finite(value[1])];

/** Explicit opt-in only; never replaces an unsaved capture. No camera or I/O. */
export function startTrackingDiagnostics(): boolean {
  if (active || startedAt) return false;
  started = performance.now();
  startedAt = new Date().toISOString();
  limitReached = false;
  active = true;
  return true;
}
export function stopTrackingDiagnostics() { active = false; }
export function isTrackingDiagnosticsActive(): boolean {
  if (active && performance.now() - started >= DIAGNOSTIC_DURATION_MS) {
    active = false;
    limitReached = true;
  }
  return active;
}
/** Called only behind the opt-in guard. Copy an explicit numeric whitelist. */
export function recordTrackingDiagnosticFrame(frame: DiagnosticFrame) {
  if (!isTrackingDiagnosticsActive()) return;
  recordTrackingDiagnosticState(frame.pipeline, frame.cursorHeld ? 'held' : 'tracking');
  frames.push({
    elapsedMs: performance.now() - started,
    pipeline: frame.pipeline === 'head' ? 'head' : 'pose',
    target: TARGETS.has(frame.target) ? frame.target : 'unknown',
    requestedTarget: TARGETS.has(frame.requestedTarget) ? frame.requestedTarget : 'unknown',
    rawNorm: point(frame.rawNorm), inputNorm: point(frame.inputNorm),
    mapped: point(frame.mapped), filtered: point(frame.filtered),
    confidence: finite(frame.confidence), filterConfidence: finite(frame.filterConfidence), noise: finite(frame.noise),
    calibration: frame.calibration.slice(0, 4).map(finite),
    sensitivity: finite(frame.sensitivity), cameraIndex: finite(frame.cameraIndex),
    videoSize: point(frame.videoSize), screenSize: point(frame.screenSize),
    detectionAgeMs: finite(frame.detectionAgeMs), processingMs: finite(frame.processingMs),
    cursorHeld: frame.cursorHeld === true,
    calibrationFallback: frame.calibrationFallback === true,
  });
  if (frames.length >= DIAGNOSTIC_FRAME_LIMIT) { active = false; limitReached = true; }
}
export function recordTrackingDiagnosticState(pipeline: 'pose' | 'head', status: DiagnosticStatus) {
  if ((pipeline !== 'pose' && pipeline !== 'head') || !STATUS_NAMES.has(status)) return;
  if (!isTrackingDiagnosticsActive() || lastState.get(pipeline) === status) return;
  lastState.set(pipeline, status);
  if (states.length < STATUS_LIMIT) states.push({ elapsedMs: performance.now() - started, pipeline, status });
  else statusEventsDropped++;
}
export function trackingDiagnosticStatus() {
  return { active: isTrackingDiagnosticsActive(), frames: frames.length, limitReached, started: Boolean(startedAt) };
}
export function trackingDiagnosticReport(): string {
  return JSON.stringify({ schemaVersion: 1, buildFingerprint: process.env.NEXT_PUBLIC_AAC_DIAGNOSTIC_BUILD_ID ?? 'unidentified', startedAt,
    limitReached, statusEventsDropped, states, frames }, null, 2);
}
