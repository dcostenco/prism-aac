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
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
