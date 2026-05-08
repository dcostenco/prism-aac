// Vitest config for the Chrome extension. Stays self-contained so the
// extension doesn't accidentally inherit the main app's setupFiles.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
