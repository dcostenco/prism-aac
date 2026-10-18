import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WristMotion, wristCursorTolerance } from '@/services/wristMotion';

const FRAME_MS = 1000 / 15;
const FRAMES = 45;

describe.each([0, 0.003, 0.015])('wrist report replay at drift=%s', drift => {
  it('replays a schema-valid wrist report through the production modules and their imports', () => {
    const frames = Array.from({ length: FRAMES }, (_, i) => {
      const x = 0.6 + drift * i / FRAMES + (i % 2 ? 0.002 : -0.002), y = 0.5;
      return { pipeline: 'pose', target: 'right_wrist', elapsedMs: i * FRAME_MS, inputNorm: [x, y], videoSize: [320, 240],
        calibration: [0.75, 0.05, 0.2, 0.8], sensitivity: 1, screenSize: [1280, 720], filterConfidence: 0.9,
        filtered: [640, 360] };
    });
    const file = join(mkdtempSync(join(tmpdir(), 'wrist-report-')), 'report.json');
    const bytes = JSON.stringify({ schemaVersion: 1, frames, states: [] });
    writeFileSync(file, bytes);
    const output = JSON.parse(execFileSync(process.execPath, ['scripts/replay-wrist-report.mjs', file], { encoding: 'utf8' }));
    expect(output).toMatchObject({ frames: FRAMES, sourceReportSHA256: createHash('sha256').update(bytes).digest('hex') });
    expect(output.paused).toBeGreaterThan(0);
    expect(Number.isFinite(output.replayMaxCursorStepPx)).toBe(true);
    const heldFile = join(mkdtempSync(join(tmpdir(), 'wrist-report-held-')), 'report.json');
    writeFileSync(heldFile, JSON.stringify({ schemaVersion: 1, frames,
      states: frames.map(frame => ({ pipeline: 'pose', status: 'held', elapsedMs: frame.elapsedMs - 1 })) }));
    const held = JSON.parse(execFileSync(process.execPath, ['scripts/replay-wrist-report.mjs', heldFile], { encoding: 'utf8' }));
    expect(held.paused).toBe(output.paused); // A held cursor is an observed rest, not tracking loss.
    const clockedFrames = frames.map(frame => ({ ...frame, motionTimeMs: frame.elapsedMs, elapsedMs: frame.elapsedMs * 10 }));
    const clockedFile = join(mkdtempSync(join(tmpdir(), 'wrist-report-media-clock-')), 'report.json');
    writeFileSync(clockedFile, JSON.stringify({ schemaVersion: 1, frames: clockedFrames, states: [] }));
    const clocked = JSON.parse(execFileSync(process.execPath, ['scripts/replay-wrist-report.mjs', clockedFile], { encoding: 'utf8' }));
    // Inference completion can lag capture. Using it fabricates stale gaps
    // and misdiagnoses a supported camera as incapable of a measured pause.
    expect(clocked.paused).toBe(output.paused);
    // Cursor filtering/pair windows still use report time. These completed
    // observations are >150ms apart, so none belongs in the fast-step metric.
    expect(clocked.replayMaxCursorStepPx).toBe(0);
    const lossFile = join(mkdtempSync(join(tmpdir(), 'wrist-report-media-loss-')), 'report.json');
    writeFileSync(lossFile, JSON.stringify({ schemaVersion: 1, frames: clockedFrames,
      states: [{ pipeline: 'pose', status: 'lost', elapsedMs: clockedFrames[30].elapsedMs - 1 }] }));
    const loss = JSON.parse(execFileSync(process.execPath, ['scripts/replay-wrist-report.mjs', lossFile], { encoding: 'utf8' }));
    const gate = new WristMotion(); let expectedPaused = 0;
    for (const [i, frame] of clockedFrames.entries()) {
      if (i === 30) gate.interrupt();
      const result = gate.update({ x: frame.inputNorm[0], y: frame.inputNorm[1] }, frame.motionTimeMs, Math.max(...frame.videoSize),
        { gain: { x: frame.screenSize[0] / (frame.calibration[0] - frame.calibration[1]),
          y: frame.screenSize[1] / (frame.calibration[3] - frame.calibration[2]) }, tolerancePx: wristCursorTolerance(...frame.screenSize as [number, number]) });
      if (result.paused) expectedPaused++;
    }
    // Loss events use report-clock ordering, while qualification uses media
    // time. Resetting a trend window does not imply fewer total paused frames.
    expect(loss.paused).toBe(expectedPaused);
  });
});
