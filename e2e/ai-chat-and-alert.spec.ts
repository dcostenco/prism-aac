/**
 * End-to-end verification for two AI-chat fixes from this session and the
 * new caregiver-alert workflow. Runs against the LIVE app (the dev server
 * the suite is pointed at via BASE_URL, or the deployed Vercel URL).
 *
 * Covers:
 *   - Bug #2: AI Chat panel renders a typed-input preview strip (the global
 *     MessageBar is hidden in ai-chat mode; without the strip the user types
 *     into the void).
 *   - Toolbar 🚨 alert button → confirmation modal → Cancel path (Send is
 *     intentionally NOT exercised here — sending a real SMS to a caregiver
 *     contact from an e2e run would be an unwanted side effect).
 *
 * Bug #1 (streaming TTS uses interrupt=true) is covered by the vitest L3
 * test `tests/ai-chat-streaming-tts.test.tsx`. The audio path is too
 * platform-dependent for a Playwright assertion.
 */
import { test, expect } from "@playwright/test";

test.describe("AI Chat verification", () => {
  test("input preview strip renders and reflects typed characters", async ({
    page,
  }) => {
    await page.goto("/prism-aac");
    await page.waitForLoadState("domcontentloaded");
    // Toolbar is the first stable render landmark
    await page
      .locator('button[aria-label="Settings"]')
      .first()
      .waitFor({ timeout: 15_000 });

    // Open the AI chat panel via the toolbar ✨ button (aria-label "AI").
    const aiToolbarBtn = page.locator('button[aria-label="AI"]').first();
    await expect(aiToolbarBtn).toBeVisible({ timeout: 10_000 });
    await aiToolbarBtn.click();

    const panel = page.locator('[data-testid="ai-chat-panel"]');
    await expect(panel).toBeVisible();

    // The input preview strip — this is the fix for bug #2.
    const preview = page.locator('[data-testid="ai-chat-input-preview"]');
    await expect(preview).toBeVisible();

    // Type via the on-screen keyboard. Find the keyboard letter "h" by its data-key.
    // The keyboard mounts inside the bottom keyboard shell; data-key is set in Keyboard.tsx.
    const hKey = page.locator('button[data-display="h"]').first();
    const iKey = page.locator('button[data-display="i"]').first();
    await expect(hKey).toBeVisible();
    await hKey.click();
    await iKey.click();

    // The preview strip should reflect what was typed.
    await expect(preview).toContainText(/hi/i);

    // Visual evidence
    await page.screenshot({
      path: "e2e/_screenshots/ai-chat-input-preview.png",
      fullPage: false,
    });
  });

  test("toolbar 🚨 alert opens confirmation modal; Cancel dismisses without sending", async ({
    page,
  }) => {
    await page.goto("/prism-aac");
    await page.waitForLoadState("domcontentloaded");
    // Toolbar is the first stable render landmark
    await page
      .locator('button[aria-label="Settings"]')
      .first()
      .waitFor({ timeout: 15_000 });

    // Click the alert toolbar button (aria-label "Alert").
    const alertBtn = page.locator('button[aria-label="Alert"]').first();
    await expect(alertBtn).toBeVisible({ timeout: 10_000 });
    await alertBtn.click();

    const modal = page.locator('[data-testid="alert-confirm-modal"]');
    await expect(modal).toBeVisible();

    // Cancel must be present and clickable
    const cancelBtn = page.locator('[data-testid="alert-cancel"]');
    const sendBtn = page.locator('[data-testid="alert-send"]');
    await expect(cancelBtn).toBeVisible();
    await expect(sendBtn).toBeVisible();

    await page.screenshot({
      path: "e2e/_screenshots/alert-confirm-modal.png",
      fullPage: false,
    });

    await cancelBtn.click();
    await expect(modal).toBeHidden();

    // No status toast should appear after cancel
    await expect(
      page.locator('[data-testid="alert-status-toast"]'),
    ).toHaveCount(0);
  });
});
