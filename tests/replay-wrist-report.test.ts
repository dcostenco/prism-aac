import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  });
});
