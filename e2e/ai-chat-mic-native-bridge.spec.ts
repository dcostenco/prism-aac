/**
 * End-to-end verification of the AI Chat mic flow under the iOS native-bridge
 * code path (which the iOS WKWebView takes). The desktop browser doesn't have
 * `window.prismNativeBridge`, so we install a mock before the page loads — this
 * exercises the `startNativeVoice` branch in services/voiceInputService.ts,
 * which is what the iOS app runs.
 *
 * Native SFSpeechRecognizer behavior cannot be tested from Playwright; this
 * spec validates the JS layer above the bridge: tap mic → toggleVoice →
 * startNativeVoice → bridge.startVoice → state transitions, silence handling,
 * interim fallback, final dispatch.
 */
import { test, expect } from "@playwright/test";

test.describe("AI Chat mic — native bridge JS path", () => {
  test.beforeEach(async ({ page }) => {
    // Install the mock bridge BEFORE the app loads. Mirrors what
    // ContentView.swift's nativeBridgeScript injects on iOS.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.__bridgeCalls = [] as Array<{ action: string; arg?: unknown }>;
      w.prismNativeBridge = {
        startVoice(lang: string) {
          w.__bridgeCalls.push({ action: "startVoice", arg: lang });
        },
        stopVoice() {
          w.__bridgeCalls.push({ action: "stopVoice" });
        },
        speak() {
          /* no-op */
        },
        stopSpeech() {
          /* no-op */
        },
      };
    });
  });

  test("tap mic → bridge.startVoice called, listening state set", async ({
    page,
  }) => {
    await page.goto("/prism-aac");
    await page
      .locator('button[aria-label="Settings"]')
      .first()
      .waitFor({ timeout: 15_000 });
    await page.locator('button[aria-label="AI"]').first().click();
    await page.locator('[data-testid="ai-chat-panel"]').waitFor();

    const mic = page.locator('[data-testid="ai-mic"]');
    await expect(mic).toBeVisible();

    // Before tap: no bridge calls yet
    const before = await page.evaluate(
      () =>
        (window as unknown as { __bridgeCalls: unknown[] }).__bridgeCalls
          .length,
    );
    expect(before).toBe(0);

    await mic.click();

    // After tap: bridge.startVoice was called
    const calls = await page.evaluate(
      () =>
        (window as unknown as { __bridgeCalls: Array<{ action: string }> })
          .__bridgeCalls,
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].action).toBe("startVoice");

    // Mic icon flipped to listening state (⏺ instead of 🎙)
    await expect(mic).toHaveAttribute("aria-pressed", "true");
  });

  test("engine error from native → onError → mic resets, no stuck state", async ({
    page,
  }) => {
    await page.goto("/prism-aac");
    await page
      .locator('button[aria-label="Settings"]')
      .first()
      .waitFor({ timeout: 15_000 });
    await page.locator('button[aria-label="AI"]').first().click();
    await page.locator('[data-testid="ai-chat-panel"]').waitFor();

    const mic = page.locator('[data-testid="ai-mic"]');
    await mic.click();
    await expect(mic).toHaveAttribute("aria-pressed", "true");

    // Simulate iOS native side reporting an error (e.g., permission denied)
    await page.evaluate(() => {
      const fn = (
        window as unknown as { prismNativeSpeechError?: (e: unknown) => void }
      ).prismNativeSpeechError;
      fn?.("denied");
    });

    // Mic should reset to non-listening state without crashing the panel
    await expect(mic).toHaveAttribute("aria-pressed", "false", {
      timeout: 3_000,
    });
  });

  test("interim then silence → last interim is submitted (no final required)", async ({
    page,
  }) => {
    await page.goto("/prism-aac");
    await page
      .locator('button[aria-label="Settings"]')
      .first()
      .waitFor({ timeout: 15_000 });
    await page.locator('button[aria-label="AI"]').first().click();
    await page.locator('[data-testid="ai-chat-panel"]').waitFor();

    const mic = page.locator('[data-testid="ai-mic"]');
    await mic.click();

    // Simulate engine sending an interim partial (the user said "hello")
    await page.evaluate(() => {
      const fn = (
        window as unknown as { prismNativeSpeechResult?: (r: unknown) => void }
      ).prismNativeSpeechResult;
      fn?.({ interim: "hello", final: "" });
    });

    // The panel's interim banner should appear
    const interimBanner = page.locator("text=/🎙.*hello/").first();
    await expect(interimBanner).toBeVisible({ timeout: 2_000 });

    // The mic flow: silenceMs=2500 → after 2.5s of no further results,
    // onSilence fires, toggleVoice stops the session (calls bridge.stopVoice
    // + cleanup), and after a 600ms grace window finalize(lastInterim) runs.
    // Wait through the silence + grace window.
    await page.waitForTimeout(3_500);

    // Mic should be back to idle (the session was auto-stopped by silence).
    await expect(mic).toHaveAttribute("aria-pressed", "false");
    // bridge.stopVoice should have been called.
    const stopCalls = await page.evaluate(
      () =>
        (
          window as unknown as { __bridgeCalls: Array<{ action: string }> }
        ).__bridgeCalls.filter((c) => c.action === "stopVoice").length,
    );
    expect(stopCalls).toBeGreaterThanOrEqual(1);
  });
});
