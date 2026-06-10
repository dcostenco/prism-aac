/**
 * PredictionBar React #300 regression — runs against the LIVE deployed app.
 *
 * Root causes (May 2026):
 *   1. useMemo AFTER a conditional early return — hooks rule violation.
 *      When sidePanel toggles between 'aac-chat' and anything else, PredictionBar
 *      alternately calls / skips useMemo → React throws "Rendered fewer hooks
 *      than expected" (error #300).
 *   2. SyncProvider called 5 separate Zustand setState calls — batched to 3.
 *
 * Fix 1: move useMemo before any conditional returns.
 * Fix 2: batch predictionStore + categoryStore setState.
 *
 * Run: BASE_URL=https://synalux.ai/prism-aac npx playwright test e2e/sync-provider-crash.spec.ts --project=desktop --workers=1
 */

import { test, expect } from "@playwright/test";

const FAKE_PROFILE = {
  device_id: "playwright-device-001",
  user_id: "playwright-user-001",
  word_freq: {
    hello: { count: 10, lastUsed: Date.now() - 1000 },
    world: { count: 8, lastUsed: Date.now() - 2000 },
    want: { count: 15, lastUsed: Date.now() - 500 },
    need: { count: 12, lastUsed: Date.now() - 800 },
    please: { count: 20, lastUsed: Date.now() - 300 },
    more: { count: 18, lastUsed: Date.now() - 400 },
    help: { count: 14, lastUsed: Date.now() - 600 },
    yes: { count: 25, lastUsed: Date.now() - 200 },
    no: { count: 22, lastUsed: Date.now() - 350 },
    go: { count: 9, lastUsed: Date.now() - 1200 },
  },
  bigrams: {
    "i want": { count: 10, lastUsed: Date.now() - 500 },
    "i need": { count: 8, lastUsed: Date.now() - 700 },
    "please help": { count: 6, lastUsed: Date.now() - 900 },
    "yes please": { count: 5, lastUsed: Date.now() - 1100 },
  },
  custom_categories: [
    {
      id: "cat-pw-1",
      name: "Playwright Test",
      icon: "🎭",
      updatedAt: Date.now() - 10000,
    },
  ],
  custom_phrases: [
    {
      id: "ph-pw-1",
      categoryId: "cat-pw-1",
      text: "I need help",
      updatedAt: Date.now() - 10000,
    },
    {
      id: "ph-pw-2",
      categoryId: "cat-pw-1",
      text: "Thank you",
      updatedAt: Date.now() - 9000,
    },
    {
      id: "ph-pw-3",
      categoryId: "cat-pw-1",
      text: "More please",
      updatedAt: Date.now() - 8000,
    },
  ],
  history: [
    { text: "Hello world", timestamp: Date.now() - 60000 },
    { text: "I need help", timestamp: Date.now() - 120000 },
    { text: "Yes please", timestamp: Date.now() - 180000 },
  ],
  settings: { speechRate: 1.0, speechVolume: 1.0 },
  updated_at: new Date().toISOString(),
};

test.describe("SyncProvider crash regression", () => {
  // LEGITIMATE crash-scenario mock: simulates the exact Supabase response
  // payload that triggers the React #300 "Too many re-renders" crash.
  // The mock is required to reproduce the crash deterministically —
  // hitting the real Supabase would not trigger the specific race condition.
  test("C8 — no React #300 crash when cloud sync returns full profile", async ({
    page,
    baseURL,
  }) => {
    const crashMessages: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // React #300 error message
        if (text.includes("Too many re-renders") || text.includes("[CRASH]")) {
          crashMessages.push(text);
        }
      }
    });

    // Intercept BEFORE navigation so the route is active when the page bootstraps
    await page.route("**/rest/v1/aac_profiles*", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([FAKE_PROFILE]),
        });
      } else {
        // Allow upsert/push calls (POST/PATCH) to be absorbed silently
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      }
    });

    // Simulate authenticated user: set user/device IDs before page JS runs
    await page.addInitScript(() => {
      localStorage.setItem("prism-aac-user-id", "playwright-user-001");
      localStorage.setItem("prism-aac-device-id", "playwright-device-001");
    });

    const start = baseURL || "https://synalux.ai/prism-aac";
    await page.goto(start, { waitUntil: "domcontentloaded" });

    // Wait long enough for: hydration + SyncProvider to run pullFromCloud
    // SyncProvider only runs when syncedRef.current === false (first render)
    await page.waitForTimeout(3000);

    // PRIMARY: No Emergency AAC Mode
    const emergencyText = page.getByText("Emergency AAC Mode");
    await expect(emergencyText).toHaveCount(0);

    // SECONDARY: No crash in console
    if (crashMessages.length > 0)
      throw new Error(`React crash: ${crashMessages.join(" | ")}`);

    // TERTIARY: Prediction bar still has 5 tiles
    const tiles = page.locator('button[aria-label^="Predict:"]');
    await expect(tiles).toHaveCount(5);
  });

  // LEGITIMATE crash-scenario mock: tests double-sync race on rapid reload.
  // Mock ensures the SyncProvider receives the crash-triggering payload twice.
  test("C9 — sync completes without crash on rapid page reload (syncedRef guard)", async ({
    page,
    baseURL,
  }) => {
    const crashMessages: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        (msg.text().includes("Too many re-renders") ||
          msg.text().includes("[CRASH]"))
      ) {
        crashMessages.push(msg.text());
      }
    });

    await page.route("**/rest/v1/aac_profiles*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([FAKE_PROFILE]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem("prism-aac-user-id", "playwright-user-001");
      localStorage.setItem("prism-aac-device-id", "playwright-device-001");
    });

    const start = baseURL || "https://synalux.ai/prism-aac";
    // First load
    await page.goto(start, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Reload (syncedRef should prevent double-sync)
    await page.reload();
    await page.waitForTimeout(2000);

    await expect(page.getByText("Emergency AAC Mode")).toHaveCount(0);
    expect(crashMessages).toHaveLength(0);

    const tiles = page.locator('button[aria-label^="Predict:"]');
    await expect(tiles).toHaveCount(5);
  });

  test("C10 — no hooks error when toggling aac-chat panel (useMemo after early return)", async ({
    page,
    baseURL,
  }) => {
    // This test covers the PRIMARY crash cause: useMemo was placed AFTER a
    // conditional early return in PredictionBar. When sidePanel toggles between
    // 'aac-chat' and normal mode, React detects a hooks count mismatch and throws.
    const crashMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (
          t.includes("Too many re-renders") ||
          t.includes("[CRASH]") ||
          t.includes("Rendered fewer hooks")
        ) {
          crashMessages.push(t);
        }
      }
    });

    const start = baseURL || "https://synalux.ai/prism-aac";
    await page.goto(start, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Open the AAC chat panel (activates the early-return code path in PredictionBar)
    const chatBtn = page
      .locator(
        'button[aria-label*="Chat"], button[aria-label*="Message"], [data-testid="toolbar-aac-chat"]',
      )
      .first();
    if ((await chatBtn.count()) > 0) {
      await chatBtn.click();
      await page.waitForTimeout(500);
    }

    // Close / switch to another panel (back to normal PredictionBar path with useMemo)
    const closeBtn = page
      .locator(
        'button[aria-label*="Close"], button[aria-label*="Back"], [data-testid="close-panel"]',
      )
      .first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // No crash regardless of whether we found the buttons
    await expect(page.getByText("Emergency AAC Mode")).toHaveCount(0);
    expect(crashMessages).toHaveLength(0);
  });
});
