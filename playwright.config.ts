import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright runs against the LIVE deployed app by default so we catch the
 * class of bug that was slipping through unit tests: things that work in
 * a node test runner but break in the actual rendered + hydrated app.
 *
 * Override BASE_URL to point at a localhost dev server when iterating:
 *   BASE_URL=http://localhost:3000 npx playwright test
 */

const BASE_URL = process.env.BASE_URL || 'https://prism-aac.vercel.app/prism-aac';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,            // some tests share localStorage state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'desktop',         use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-6.1',      use: { ...devices['iPhone 14'] } },
    { name: 'iphone-6.5',      use: { ...devices['iPhone 14 Plus'] } },
    { name: 'iphone-6.9',      use: { ...devices['iPhone 15 Pro Max'] } },
    { name: 'ipad-7',          use: { ...devices['iPad Mini'] } },
    { name: 'ipad-13',         use: { ...devices['iPad Pro 11'] } },
    { name: 'iphone-6.1-land', use: { ...devices['iPhone 14 landscape'] } },
    { name: 'iphone-6.5-land', use: { ...devices['iPhone 14 Plus landscape'] } },
    { name: 'iphone-6.9-land', use: { ...devices['iPhone 15 Pro Max landscape'] } },
    { name: 'ipad-7-land',     use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-13-land',    use: { ...devices['iPad Pro 11 landscape'] } },
  ],
});
