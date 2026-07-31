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

const IPAD_13_PORTRAIT = {
  ...devices['iPad Pro 11'],
  viewport: { width: 1032, height: 1376 },
};

const IPAD_13_LANDSCAPE = {
  ...devices['iPad Pro 11 landscape'],
  viewport: { width: 1376, height: 1032 },
};

// Playwright does not yet ship an iPhone 16 Pro Max descriptor. Keep its
// WebKit/mobile characteristics from the newest available Pro Max profile,
// but exercise the actual 6.9-inch CSS viewport used by App Store captures.
const IPHONE_6_9_PORTRAIT = {
  ...devices['iPhone 15 Pro Max'],
  viewport: { width: 440, height: 956 },
};

const IPHONE_6_9_LANDSCAPE = {
  ...devices['iPhone 15 Pro Max landscape'],
  viewport: { width: 956, height: 440 },
};

// The native Prism wrapper is a full-screen WKWebView. Playwright's stock
// phone profiles reserve Safari browser chrome and therefore report shorter
// page viewports; pin the full device surface used by the installed app.
const IPHONE_6_1_PORTRAIT = {
  ...devices['iPhone 14'],
  viewport: { width: 390, height: 844 },
};

const IPHONE_6_1_LANDSCAPE = {
  ...devices['iPhone 14 landscape'],
  viewport: { width: 844, height: 390 },
};

const IPHONE_PLUS_PORTRAIT = {
  ...devices['iPhone 14 Plus'],
  viewport: { width: 428, height: 926 },
};

const IPHONE_PLUS_LANDSCAPE = {
  ...devices['iPhone 14 Plus landscape'],
  viewport: { width: 926, height: 428 },
};

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
    { name: 'iphone-se',       use: { ...devices['iPhone SE (3rd gen)'] } },
    { name: 'iphone-6.1',      use: IPHONE_6_1_PORTRAIT },
    { name: 'iphone-6.5',      use: IPHONE_PLUS_PORTRAIT },
    { name: 'iphone-6.9',      use: IPHONE_6_9_PORTRAIT },
    { name: 'ipad-7',          use: { ...devices['iPad Mini'] } },
    { name: 'ipad-13',         use: IPAD_13_PORTRAIT },
    { name: 'iphone-se-land',  use: { ...devices['iPhone SE (3rd gen) landscape'] } },
    { name: 'iphone-6.1-land', use: IPHONE_6_1_LANDSCAPE },
    { name: 'iphone-6.5-land', use: IPHONE_PLUS_LANDSCAPE },
    { name: 'iphone-6.9-land', use: IPHONE_6_9_LANDSCAPE },
    { name: 'ipad-7-land',     use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-13-land',    use: IPAD_13_LANDSCAPE },
  ],
});
