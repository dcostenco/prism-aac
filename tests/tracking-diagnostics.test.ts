import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosticFrame } from '@/services/trackingDiagnostics';
import { CAMERA_WRIST_SOURCE } from '@/services/cameraTrackingTargets';

let recorder: typeof import('@/services/trackingDiagnostics');
const FRAME: DiagnosticFrame = {
  pipeline: 'pose', target: 'right_wrist', requestedTarget: 'any_wrist', rawNorm: [0.5, 0.4], inputNorm: [0.51, 0.4],
  mapped: [400, 300], filtered: [395, 299], confidence: 0.9, filterConfidence: 0.9, noise: 0.01,
  calibration: [0.6, 0.4, 0.3, 0.7], sensitivity: 1, cameraIndex: 0, videoSize: [640, 480], screenSize: [800, 600],
};
beforeEach(async () => { vi.restoreAllMocks(); vi.resetModules(); recorder = await import('@/services/trackingDiagnostics'); });
describe('opt-in local tracking evidence', () => {
  it('records a held cursor without misreporting automatic selection as ready', () => {
    recorder.startTrackingDiagnostics();
    recorder.recordTrackingDiagnosticFrame({ ...FRAME, cursorHeld: true, motionPaused: true, selectionReady: false });
    const frame = JSON.parse(recorder.trackingDiagnosticReport()).frames[0];
    expect(frame).toMatchObject({ cursorHeld: true, motionPaused: true, selectionReady: false });
  });
  it('distinguishes head from wrist loss without admitting arbitrary error text', () => {
    recorder.startTrackingDiagnostics();
    recorder.recordTrackingDiagnosticState('pose', 'lost', { reason: 'head-missing', headConfidence: 0 });
    recorder.recordTrackingDiagnosticState('pose', 'lost', { reason: 'wrist-missing', headConfidence: 0.9 });
    recorder.recordTrackingDiagnosticState('pose', 'lost', { reason: 'private text' as 'head-missing', headConfidence: NaN });
    const report = JSON.parse(recorder.trackingDiagnosticReport());
    expect(report.states.map((s: { reason?: string }) => s.reason)).toEqual(['head-missing', 'wrist-missing', undefined]);
    expect(report.states[1].headConfidence).toBe(0.9);
    expect(JSON.stringify(report)).not.toContain('private text');
  });
  it('collects nothing before consent and retains raw, mapped and filtered values after stop', () => {
    recorder.recordTrackingDiagnosticFrame(FRAME);
    expect(recorder.trackingDiagnosticStatus().frames).toBe(0);
    expect(recorder.startTrackingDiagnostics()).toBe(true);
    recorder.recordTrackingDiagnosticFrame(FRAME);
    recorder.stopTrackingDiagnostics();
    recorder.recordTrackingDiagnosticFrame(FRAME);
    const report = JSON.parse(recorder.trackingDiagnosticReport());
    expect(report.frames).toHaveLength(1);
    expect(report.frames[0]).toMatchObject(FRAME);
    expect(recorder.startTrackingDiagnostics()).toBe(false); // do not replace unsaved evidence
  });
  it('whitelists fields and targets instead of serializing arbitrary caller data', () => {
    recorder.startTrackingDiagnostics();
    recorder.recordTrackingDiagnosticFrame({ ...FRAME, target: 'private arbitrary text', secret: 'private arbitrary text' } as DiagnosticFrame);
    const report = recorder.trackingDiagnosticReport();
    expect(report).not.toContain('private arbitrary text');
    expect(report).not.toContain('secret');
    expect(JSON.parse(report).frames[0].target).toBe('unknown');
  });
  it('identifies the versioned hand coordinate source without accepting arbitrary labels', () => {
    recorder.startTrackingDiagnostics();
    recorder.recordTrackingDiagnosticFrame({ ...FRAME, coordinateSource: CAMERA_WRIST_SOURCE });
    recorder.recordTrackingDiagnosticFrame({ ...FRAME, coordinateSource: 'private arbitrary text' } as unknown as DiagnosticFrame);
    const report = recorder.trackingDiagnosticReport();
    expect(JSON.parse(report).frames.map((f: DiagnosticFrame) => f.coordinateSource)).toEqual([CAMERA_WRIST_SOURCE, null]);
    expect(report).not.toContain('private arbitrary text');
  });
  it('snapshots values and encodes invalid numbers explicitly as null', () => {
    recorder.startTrackingDiagnostics();
    const frame = { ...FRAME, rawNorm: [NaN, Infinity] as const, calibration: [...FRAME.calibration] };
    recorder.recordTrackingDiagnosticFrame(frame);
    frame.calibration[0] = 1;
    const captured = JSON.parse(recorder.trackingDiagnosticReport()).frames[0];
    expect(captured.rawNorm).toEqual([null, null]);
    expect(captured.calibration[0]).toBe(0.6);
  });
  it('retains only finite captured-media timestamps, independently of inference time', () => {
    recorder.recordTrackingDiagnosticFrame({ ...FRAME, motionTimeMs: 1000 });
    expect(recorder.trackingDiagnosticStatus().frames).toBe(0);
    recorder.startTrackingDiagnostics();
    for (const motionTimeMs of [1000, NaN, Infinity]) recorder.recordTrackingDiagnosticFrame({ ...FRAME, motionTimeMs, processingMs: 190 });
    const frames = JSON.parse(recorder.trackingDiagnosticReport()).frames;
    expect(frames.map((f: { motionTimeMs: number | null }) => f.motionTimeMs)).toEqual([1000, null, null]);
    expect(frames.every((f: { processingMs: number }) => f.processingMs === 190)).toBe(true);
  });
  it('retains a failed tracking session with no points and rejects arbitrary status text', () => {
    recorder.startTrackingDiagnostics();
    recorder.recordTrackingDiagnosticState('pose', 'starting');
    recorder.recordTrackingDiagnosticState('pose', 'lost');
    recorder.recordTrackingDiagnosticState('pose', 'lost');
    recorder.recordTrackingDiagnosticState('pose', 'private arbitrary text' as 'lost');
    recorder.stopTrackingDiagnostics();
    const report = JSON.parse(recorder.trackingDiagnosticReport());
    expect(report.frames).toHaveLength(0);
    expect(report.states.map((state: { status: string }) => state.status)).toEqual(['starting', 'lost']);
    expect(JSON.stringify(report)).not.toContain('private arbitrary text');
  });
  it('stops at the sample limit without silently overwriting the first samples', () => {
    recorder.startTrackingDiagnostics();
    for (let i = 0; i <= recorder.DIAGNOSTIC_FRAME_LIMIT; i++) recorder.recordTrackingDiagnosticFrame(FRAME);
    expect(recorder.trackingDiagnosticStatus()).toEqual({ active: false, frames: recorder.DIAGNOSTIC_FRAME_LIMIT, limitReached: true, started: true });
  });
  it('expires even when no usable camera frames arrive', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    recorder.startTrackingDiagnostics();
    clock.mockReturnValue(1000 + recorder.DIAGNOSTIC_DURATION_MS);
    expect(recorder.trackingDiagnosticStatus()).toEqual({ active: false, frames: 0, limitReached: true, started: true });
  });
});
