'use client';

import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_URL, OBJECT_DETECTOR_URL, FpsWatchdog } from './mediapipeRuntime';
import { acquireCamera, type CameraLease } from './cameraStream';

export interface ObjectDetection {
  label: string;
  score: number;
  boundingBox: { x: number; y: number; w: number; h: number };
  timestamp: number;
}

export interface VisionContext {
  objects: ObjectDetection[];
  stableObjects: string[];
  timestamp: number;
}

export interface ObjectDetectionHandle {
  stop: () => void;
  getLastContext: () => VisionContext | null;
}

const FRAME_INTERVAL_MS = 500;
const MIN_CONFIDENCE = 0.4;
const STABLE_THRESHOLD_MS = 1500;
const MAX_CONSECUTIVE_FAILURES = 5;
// All entries must be lowercase
const SUPPRESSED_CLASSES = new Set(['person']);

type Listener = (ctx: VisionContext) => void;
const listeners = new Set<Listener>();

let lastContext: VisionContext | null = null;
let stableTracker = new Map<string, number>();
let activeHandle: ObjectDetectionHandle | null = null;

export function subscribeVisionContext(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getLastVisionContext(): VisionContext | null {
  return lastContext;
}

function emit(ctx: VisionContext): void {
  lastContext = ctx;
  for (const fn of listeners) {
    try { fn(ctx); } catch { /* listener errors must not break the loop */ }
  }
}

function updateStableObjects(labels: string[], nowMs: number): string[] {
  for (const label of labels) {
    if (!stableTracker.has(label)) stableTracker.set(label, nowMs);
  }
  for (const [label] of stableTracker) {
    if (!labels.includes(label)) stableTracker.delete(label);
  }
  const stable: string[] = [];
  for (const [label, firstSeen] of stableTracker) {
    if (nowMs - firstSeen >= STABLE_THRESHOLD_MS) stable.push(label);
  }
  return stable;
}

export async function startObjectDetection(opts?: {
  deviceId?: string;
  targetFps?: number;
}): Promise<ObjectDetectionHandle | null> {
  if (activeHandle) {
    activeHandle.stop();
    activeHandle = null;
  }

  const lease: CameraLease | null = await acquireCamera({
    deviceId: opts?.deviceId,
    width: 320,
    height: 240,
  });
  if (!lease) return null;

  let detector: ObjectDetector | null = null;
  try {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    detector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: OBJECT_DETECTOR_URL },
      runningMode: 'VIDEO',
      maxResults: 10,
      scoreThreshold: MIN_CONFIDENCE,
    });
  } catch {
    lease.release();
    return null;
  }

  const fpsWatchdog = new FpsWatchdog({
    starvationThresholdFps: 1,
    starvationConsecutiveMs: 5000,
  });

  const video = lease.video;
  let stopped = false;
  let lastFrameTime = 0;
  let lastTimestamp = 0;
  let rafId = 0;
  let paused = false;
  let starvationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;
  const intervalMs = opts?.targetFps ? 1000 / opts.targetFps : FRAME_INTERVAL_MS;

  function tick(ts: number): void {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);
    if (paused) return;
    if (ts - lastFrameTime < intervalMs) return;

    fpsWatchdog.tick(ts);
    if (fpsWatchdog.isStarved()) {
      paused = true;
      starvationTimeoutId = setTimeout(() => {
        starvationTimeoutId = null;
        if (!stopped) { paused = false; fpsWatchdog.reset(); }
      }, 30_000);
      return;
    }

    lastFrameTime = ts;

    if (!detector || !video || video.readyState < 2) return;

    const frameTs = Math.round(ts);
    if (frameTs <= lastTimestamp) return;
    lastTimestamp = frameTs;

    try {
      const result = detector.detectForVideo(video, frameTs);
      consecutiveFailures = 0;
      const nowMs = Date.now();

      const objects: ObjectDetection[] = [];
      for (const det of result.detections) {
        const cat = det.categories?.[0];
        if (!cat) continue;
        const label = cat.categoryName?.toLowerCase() ?? '';
        if (!label || SUPPRESSED_CLASSES.has(label)) continue;
        const bb = det.boundingBox;
        objects.push({
          label,
          score: cat.score ?? 0,
          boundingBox: bb
            ? { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height }
            : { x: 0, y: 0, w: 0, h: 0 },
          timestamp: nowMs,
        });
      }

      const labels = objects.map(o => o.label);
      const stableObjects = updateStableObjects(labels, nowMs);

      emit({ objects, stableObjects, timestamp: nowMs });
    } catch (err) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error('[objectDetection] %d consecutive failures, pausing', consecutiveFailures, err);
        paused = true;
        starvationTimeoutId = setTimeout(() => {
          starvationTimeoutId = null;
          if (!stopped) { paused = false; consecutiveFailures = 0; }
        }, 30_000);
      }
    }
  }

  rafId = requestAnimationFrame(tick);

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      paused = true;
    } else if (!stopped) {
      setTimeout(() => { if (!stopped) paused = false; }, 1000);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  lastContext = null;
  stableTracker = new Map();

  const handle: ObjectDetectionHandle = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      if (starvationTimeoutId !== null) clearTimeout(starvationTimeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
      try { detector?.close(); } catch { /* */ }
      detector = null;
      lease.release();
      lastContext = null;
      stableTracker = new Map();
      listeners.clear();
      if (activeHandle === handle) activeHandle = null;
    },
    getLastContext: () => lastContext,
  };

  activeHandle = handle;
  return handle;
}

export function _resetForTests(): void {
  if (activeHandle) { activeHandle.stop(); activeHandle = null; }
  lastContext = null;
  stableTracker = new Map();
  listeners.clear();
}
