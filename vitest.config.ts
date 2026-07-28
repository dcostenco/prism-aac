import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Playwright owns e2e/. vitest accidentally picks up *.spec.ts files
    // there and fails because Playwright's `test` global isn't defined
    // under vitest. Explicit exclude so the suite stays green.
    exclude: ['**/node_modules/**', 'e2e/**'],
    /**
     * Cap the worker pool.
     *
     * Vitest defaults to one worker per core — 18 concurrent jsdom
     * environments on this machine. jsdom is not cheap, and every worker also
     * parses the prediction seeds, where one locale file is ~300 KB of TS.
     * Peak RSS for a full run climbs into several GB, and it multiplies when
     * suites overlap: this repo's suite, the portal pre-push gate, and any
     * parallel editor session each spawn their own pool against the same 18
     * cores.
     *
     * Half the cores mirrors portal/vitest.config.ts, so two concurrent
     * suites cannot oversubscribe the machine. Override with
     * VITEST_MAX_WORKERS on a bigger box or in CI.
     */
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS) || Math.max(2, Math.floor(os.cpus().length / 2)),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Optional WASM TTS packages not installed in dev/test; stub them out
      // so wasmTTS.ts can be imported without Vite import-analysis errors.
      'espeak-ng': path.resolve(__dirname, 'tests/mocks/espeak-ng.ts'),
      'espeak-ng-emscripten': path.resolve(__dirname, 'tests/mocks/espeak-ng.ts'),
      'synalux-hrr': path.resolve(__dirname, 'tests/mocks/synalux-hrr.ts'),
    },
  },
});
