// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

const children: ChildProcess[] = [];

afterEach(async () => {
  await Promise.all(children.splice(0).map(async (child) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGKILL');
    await once(child, 'exit');
  }));
});

describe('Playwright watchdog process isolation', () => {
  it('pins process-group cleanup and forbids machine-wide browser kills', () => {
    const script = readFileSync(resolve('scripts/playwright-watchdog.sh'), 'utf8');

    expect(script).toContain('PW_PGID=');
    expect(script).toContain('/bin/kill -KILL "-${PW_PGID}"');
    expect(script).not.toContain('pkill -KILL -f');
  });

  it.skipIf(process.platform !== 'darwin')(
    'an aborted run leaves an unrelated Playwright-like process alive',
    async () => {
      const sentinel = spawn(process.execPath, [
        '-e',
        'setInterval(() => {}, 1000)',
        'playwright/unrelated-webkit',
      ], { stdio: 'ignore' });
      children.push(sentinel);

      await new Promise((resolveReady) => setTimeout(resolveReady, 100));
      expect(sentinel.exitCode).toBeNull();

      const watchdog = spawn('bash', [
        'scripts/playwright-watchdog.sh',
        '--exec',
        process.execPath,
        '-e',
        'setInterval(() => {}, 1000)',
      ], {
        cwd: resolve('.'),
        env: {
          ...process.env,
          MIN_FREE_GB: '999',
          MAX_STALL_S: '30',
          MAX_TOTAL_S: '30',
          POLL_S: '1',
        },
        stdio: 'ignore',
      });
      children.push(watchdog);

      const [code] = await once(watchdog, 'exit');
      expect(code).toBe(99);
      expect(sentinel.exitCode).toBeNull();
    },
  );
});
