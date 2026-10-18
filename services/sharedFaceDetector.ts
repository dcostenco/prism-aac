import { FACE_DETECTOR_URL, MEDIAPIPE_WASM_URL } from './mediapipeRuntime';

export interface FaceDetectionResult {
  detections?: Array<{
    boundingBox?: { originX: number; originY: number; width: number; height: number };
    categories?: Array<{ score?: number }>;
  }>;
}
export interface FaceDetectorLease {
  detectForVideo(input: HTMLVideoElement | HTMLCanvasElement, timestamp: number): FaceDetectionResult;
  close(): void;
}
interface Model extends FaceDetectorLease {}
interface Entry { model: Promise<Model>; refs: number; timestamp: number }
const DELEGATES = ['GPU', 'CPU'] as const;
const FACE_CONFIDENCE = 0.5;
const FACE_DETECTOR_UNAVAILABLE = 'face-detector-unavailable';
const FACE_DETECTOR_CLOSED = 'face-detector-closed';
const shared = new Map<string, Entry>();

async function openModel(modelAssetPath: string): Promise<Model> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  let cause: unknown;
  for (const delegate of DELEGATES) {
    try {
      return await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO', minDetectionConfidence: FACE_CONFIDENCE,
      }) as Model;
    } catch (error) { cause = error; /* Retry the other delegate, never infer presence. */ }
  }
  throw new Error(FACE_DETECTOR_UNAVAILABLE, { cause });
}

/** A single model shared by camera consumers; closing one lease cannot
 * invalidate another. Normalize SDK timestamps, not observation freshness. */
export async function acquireFaceDetector(modelAssetPath = FACE_DETECTOR_URL): Promise<FaceDetectorLease> {
  let entry = shared.get(modelAssetPath);
  if (!entry) { entry = { model: openModel(modelAssetPath), refs: 0, timestamp: -1 }; shared.set(modelAssetPath, entry); }
  entry.refs++;
  let model: Model;
  try { model = await entry.model; }
  catch (error) { if (--entry.refs === 0 && shared.get(modelAssetPath) === entry) shared.delete(modelAssetPath); throw error; }
  let released = false;
  return {
    detectForVideo(input, timestamp) {
      if (released || !Number.isFinite(timestamp)) throw new Error(FACE_DETECTOR_CLOSED);
      entry.timestamp = Math.max(timestamp, entry.timestamp + 1);
      return model.detectForVideo(input, entry.timestamp);
    },
    close() {
      if (released) return;
      released = true;
      if (--entry.refs === 0) {
        if (shared.get(modelAssetPath) === entry) shared.delete(modelAssetPath);
        model.close();
      }
    },
  };
}
