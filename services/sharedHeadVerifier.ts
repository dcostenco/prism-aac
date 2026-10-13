import { FACE_LANDMARKER_URL, MEDIAPIPE_WASM_URL } from './mediapipeRuntime';

interface Result { faceLandmarks?: Array<Array<{ x: number; y: number }>> }
export interface HeadVerifierLease { detect(input: HTMLCanvasElement): Result; close(): void }
interface Entry { model: Promise<HeadVerifierLease>; refs: number }
const VERIFIER_CLOSED = 'head-verifier-closed';
let shared: Entry | null = null;

async function openModel(): Promise<HeadVerifierLease> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  return FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL), {
    baseOptions: { modelAssetPath: FACE_LANDMARKER_URL, delegate: 'CPU' },
    runningMode: 'IMAGE', numFaces: 1,
  });
}

/** Presence confirmation only: no gaze, gestures or cursor output. One CPU
 * model is shared by concurrent owners; do not fall back to unverified pose. */
export async function acquireHeadVerifier(): Promise<HeadVerifierLease> {
  const entry = shared ?? (shared = { model: openModel(), refs: 0 });
  entry.refs++;
  let model: HeadVerifierLease;
  try { model = await entry.model; }
  catch (error) { if (--entry.refs === 0 && shared === entry) shared = null; throw error; }
  let released = false;
  return {
    detect(input) { if (released) throw new Error(VERIFIER_CLOSED); return model.detect(input); },
    close() {
      if (released) return;
      released = true;
      if (--entry.refs === 0) { if (shared === entry) shared = null; model.close(); }
    },
  };
}
