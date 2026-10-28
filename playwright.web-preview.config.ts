import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3338';
const target = new URL(baseURL);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Web preview tests require an isolated local server');

export default defineConfig({
  testDir: process.env.AAC_BASELINE_TEST_DIR || './e2e',
  testMatch: process.env.AAC_BASELINE_TEST_DIR ? '**/*.spec.ts' : ['web-signin-gate.spec.ts', 'web-preview-warning.spec.ts', 'emergency-no-auto-call.spec.ts'],
  outputDir: process.env.AAC_PREVIEW_EVIDENCE_DIR || './test-results/web-preview',
  fullyParallel: false, workers: 1, retries: 0, timeout: 60_000,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', deviceScaleFactor: 1, serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone-portrait', use: { viewport: { width: 390, height: 844 } } },
    { name: 'phone-landscape', use: { viewport: { width: 844, height: 390 } } },
    { name: 'tablet-portrait', use: { viewport: { width: 820, height: 1180 } } },
    { name: 'tablet-landscape', use: { viewport: { width: 1180, height: 820 } } },
  ],
  webServer: {
    command: `npm run build && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${target.port || '3338'}`,
    url: `${baseURL}/prism-aac`, reuseExistingServer: false, timeout: 300_000,
    env: {
      NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE: '1', NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SYNALUX_API: `${baseURL}/prism-aac/api/v1`,
      PROXY_API_URL: 'http://127.0.0.1:1/api/v1',
    },
  },
});
