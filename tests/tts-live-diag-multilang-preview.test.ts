// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('multi-language live diagnostic preview authorization', () => {
  it('replays protected-preview audio with the bypass kept out of argv and reports', () => {
    const script = readFileSync(
      resolve('scripts/tts-live-diag-multilang.mjs'),
      'utf8',
    );

    expect(script).toContain("curlArgs.unshift('--config', '-')");
    expect(script).toContain(
      '`header = "x-vercel-protection-bypass: ${escapedBypass}"\\n`',
    );
    expect(script).toContain('input: curlInput');
    expect(script).toContain('audioUrl.origin === targetOrigin');

    const safeReportSource = script.slice(script.indexOf('const safeReport ='));
    expect(safeReportSource).not.toContain('VERCEL_PROTECTION_BYPASS');
    expect(safeReportSource).not.toContain('curlInput');
  });
});
