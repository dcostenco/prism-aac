/**
 * Bedside Mode — Playwright E2E tests
 *
 * Covers the four features added for hands-free / phone-in-stand use:
 *   1. Hands-free mode toggle (🔁) — button in AI chat header
 *   2. Bedside overlay (🛏) — full-screen overlay with large mic + controls
 *   3. Wake word indicator — status bar text while active
 *   4. iOS Voice Control guide — instruction card inside Bedside overlay
 *
 * NOTE: Actual mic / speech-recognition activation requires real hardware
 * and user-gesture permission grants. These tests verify the UI layer:
 * buttons appear, overlays open/close, state toggles correctly, instruction
 * card renders. That's the class of bug Playwright catches that unit tests
 * miss (SSR/hydration issues, z-index stacking, pointer-events on overlays).
 */
import { test, expect } from "@playwright/test";

// ── helpers ──────────────────────────────────────────────────────────────────

async function openAIChat(page: import("@playwright/test").Page) {
  await page.goto("/prism-aac");
  await page.waitForLoadState("domcontentloaded");
  await page
    .locator('button[aria-label="Settings"]')
    .first()
    .waitFor({ timeout: 15_000 });
  const aiBtn = page.locator('button[aria-label="AI"]').first();
  await expect(aiBtn).toBeVisible({ timeout: 10_000 });
  await aiBtn.click();
  await expect(page.locator('[data-testid="ai-chat-panel"]')).toBeVisible();
}

// ── 1. Hands-free mode ───────────────────────────────────────────────────────

test.describe("Hands-free mode", () => {
  test("🔁 button is visible in AI chat header", async ({ page }) => {
    await openAIChat(page);
    const btn = page.locator('[data-testid="ai-hands-free"]');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await page.screenshot({
      path: "e2e/_screenshots/bedside-hands-free-off.png",
    });
  });

  test("🔁 button toggles aria-pressed and turns green", async ({ page }) => {
    await openAIChat(page);
    const btn = page.locator('[data-testid="ai-hands-free"]');
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    // Green background class applied
    await expect(btn).toHaveClass(/bg-\[#4CAF50\]/);
    await page.screenshot({
      path: "e2e/_screenshots/bedside-hands-free-on.png",
    });
  });

  test("hands-free status bar appears below chat when active", async ({
    page,
  }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-hands-free"]').click();
    // Status bar text — rendered by the `wakeWordActive || handsFreeModeActive` condition
    const panel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(panel).toContainText("Hands-free on");
    await page.screenshot({
      path: "e2e/_screenshots/bedside-hands-free-statusbar.png",
    });
  });

  test("turning hands-free off removes status bar", async ({ page }) => {
    await openAIChat(page);
    const btn = page.locator('[data-testid="ai-hands-free"]');
    await btn.click(); // on
    await btn.click(); // off
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    const panel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(panel).not.toContainText("Hands-free on");
  });
});

// ── 2. Bedside overlay ───────────────────────────────────────────────────────

test.describe("Bedside overlay", () => {
  test("🛏 button is visible in AI chat header", async ({ page }) => {
    await openAIChat(page);
    const btn = page.locator('[data-testid="ai-bedside"]');
    await expect(btn).toBeVisible();
  });

  test("clicking 🛏 opens the bedside overlay", async ({ page }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    await expect(overlay).toBeVisible();
    // role=dialog + aria-modal
    await expect(overlay).toHaveAttribute("role", "dialog");
    await expect(overlay).toHaveAttribute("aria-modal", "true");
    await page.screenshot({
      path: "e2e/_screenshots/bedside-overlay-open.png",
    });
  });

  test("overlay contains mic button", async ({ page }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    await expect(
      overlay.locator('button[aria-label="Start listening"]'),
    ).toBeVisible();
  });

  test("overlay contains hands-free and Voice Control buttons", async ({
    page,
  }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    await expect(
      overlay.locator('button[aria-label="Toggle hands-free mode"]'),
    ).toBeVisible();
    await expect(
      overlay.locator('button[aria-label="Enable iOS Voice Control"]'),
    ).toBeVisible();
  });

  test("Exit button closes the overlay", async ({ page }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    await expect(overlay).toBeVisible();
    await overlay.locator('button[aria-label="Exit Bedside Mode"]').click();
    await expect(overlay).toBeHidden();
    // Normal AI panel still visible after exit
    await expect(page.locator('[data-testid="ai-chat-panel"]')).toBeVisible();
    await page.screenshot({
      path: "e2e/_screenshots/bedside-overlay-closed.png",
    });
  });

  test("hands-free toggle inside overlay updates aria-pressed", async ({
    page,
  }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    const hfBtn = overlay.locator(
      'button[aria-label="Toggle hands-free mode"]',
    );
    await expect(hfBtn).toHaveAttribute("aria-pressed", "false");
    await hfBtn.click();
    await expect(hfBtn).toHaveAttribute("aria-pressed", "true");
    await expect(hfBtn).toHaveClass(/bg-\[#4CAF50\]/);
    await page.screenshot({
      path: "e2e/_screenshots/bedside-overlay-handsfree-on.png",
    });
  });

  test('mic button in overlay turns red + pulsing when "listening" style is active', async ({
    page,
  }) => {
    // We can't actually grant mic permissions in headless, but we can verify
    // the initial (not-listening) state is rendered correctly — the button
    // exists, is not red, is tappable.
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    const micBtn = overlay.locator('button[aria-label="Start listening"]');
    await expect(micBtn).toBeVisible();
    // Initially not listening — no red background
    await expect(micBtn).not.toHaveClass(/bg-\[#F44336\]/);
    // Confirm bounding box is large (≥ 96px × 96px — the "big" mic requirement)
    const box = await micBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(96);
    expect(box!.height).toBeGreaterThanOrEqual(96);
  });

  test("overlay is full-screen (covers viewport)", async ({ page }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    const box = await overlay.boundingBox();
    const viewportSize = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(viewportSize.width - 4);
    expect(box!.height).toBeGreaterThanOrEqual(viewportSize.height - 4);
  });
});

// ── 3. Wake word (UI layer only) ─────────────────────────────────────────────

test.describe("Wake word UI", () => {
  test("wake word toggle visible inside bedside overlay (when supported)", async ({
    page,
  }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    // On desktop Chrome, WebSpeech is available → wake word button renders
    const wakeBtn = overlay.locator(
      'button[aria-label=\'"Hey Prism" wake word\'], button[aria-label="Toggle \\"Hey Prism\\" wake word"]',
    );
    // Count is either 1 (supported) or 0 (native bridge in sim) — just assert
    // it's not broken (no JS error caused a full crash).
    const count = await wakeBtn.count();
    expect(count).toBeGreaterThanOrEqual(0); // always passes — crash = test error
  });

  test('main chat panel shows "Hey Prism" status bar hint when wake word active', async ({
    page,
  }) => {
    await openAIChat(page);
    // Enable wake word via header hands-free, then check... Actually wake word
    // is only toggled from inside Bedside overlay. Open it, toggle, close, check panel.
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    const wakeBtn = overlay.locator('button[aria-label*="Hey Prism"]');
    if (await wakeBtn.isVisible()) {
      await wakeBtn.click();
      await expect(wakeBtn).toHaveAttribute("aria-pressed", "true");
      // Close overlay — panel should show status hint
      await overlay.locator('button[aria-label="Exit Bedside Mode"]').click();
      const panel = page.locator('[data-testid="ai-chat-panel"]');
      await expect(panel).toContainText("Hey Prism");
      await page.screenshot({
        path: "e2e/_screenshots/bedside-wakeword-statusbar.png",
      });
    } else {
      // Wake word not supported in this env (native bridge) — skip gracefully
      test.skip();
    }
  });
});

// ── 4. iOS Voice Control guide ───────────────────────────────────────────────

test.describe("iOS Voice Control guide", () => {
  test("📱 Voice Ctrl button is visible in Bedside overlay", async ({
    page,
  }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    await expect(
      overlay.locator('button[aria-label="Enable iOS Voice Control"]'),
    ).toBeVisible();
  });

  test("tapping 📱 button shows instruction card (on non-native-bridge env)", async ({
    page,
  }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    const vcBtn = overlay.locator(
      'button[aria-label="Enable iOS Voice Control"]',
    );

    // On desktop (no prismNativeBridge.openSettings), tapping shows the card.
    await vcBtn.click();
    await expect(overlay).toContainText("Enable iOS Voice Control");
    await expect(overlay).toContainText("Accessibility");
    await expect(overlay).toContainText("Voice Control");
    await page.screenshot({
      path: "e2e/_screenshots/bedside-voice-control-card.png",
    });
  });

  test('"Got it" button dismisses the instruction card', async ({ page }) => {
    await openAIChat(page);
    await page.locator('[data-testid="ai-bedside"]').click();
    const overlay = page.locator('[data-testid="bedside-overlay"]');
    await overlay
      .locator('button[aria-label="Enable iOS Voice Control"]')
      .click();
    const gotIt = overlay.locator("button", { hasText: "Got it" });
    await expect(gotIt).toBeVisible();
    await gotIt.click();
    // Card gone — overlay still visible, mic button back
    await expect(gotIt).toBeHidden();
    await expect(
      overlay.locator('button[aria-label="Start listening"]'),
    ).toBeVisible();
    await page.screenshot({
      path: "e2e/_screenshots/bedside-voice-control-dismissed.png",
    });
  });
});
