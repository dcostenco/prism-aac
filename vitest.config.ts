import { defineConfig } from 'vitest/config';
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Optional WASM TTS packages not installed in dev/test; stub them out
      // so wasmTTS.ts can be imported without Vite import-analysis errors.
      'espeak-ng': path.resolve(__dirname, 'tests/mocks/espeak-ng.ts'),
      'espeak-ng-emscripten': path.resolve(__dirname, 'tests/mocks/espeak-ng.ts'),
    },
  },
});
