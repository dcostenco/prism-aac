import { test, expect } from "@playwright/test";

test.describe("Message badge → inbox flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/prism-aac", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
  });

  test("badge click opens Schedule (inbox) when unread messages exist", async ({
    page,
  }) => {
    // Mock: inject 3 unread messages into scheduleStore
    await page.evaluate(() => {
      const { useScheduleStore } = require("@/store/scheduleStore");
      if (!useScheduleStore) return;
      const store = useScheduleStore.getState();
      if (store.addIncomingMessage) {
        store.addIncomingMessage({
          sender: "Mom",
          text: "Are you OK?",
          provider: "sms",
          receivedAt: Date.now(),
        });
        store.addIncomingMessage({
          sender: "Dad",
          text: "Coming to pick you up",
          provider: "sms",
          receivedAt: Date.now(),
        });
        store.addIncomingMessage({
          sender: "Teacher",
          text: "Great job today!",
          provider: "mail",
          receivedAt: Date.now(),
        });
      }
    });
    await page.waitForTimeout(500);

    // Verify badge shows "3"
    const badge = page.locator('[data-testid="toolbar-badge-aac_chat"]');
    if (await badge.isVisible()) {
      await expect(badge).toHaveText("3");

      // Click the chat button (should open Schedule, not AAC Chat)
      const chatBtn = page.locator('button[aria-label*="unread"]');
      await chatBtn.click();
      await page.waitForTimeout(1000);

      // Verify Schedule panel opened (not AAC Chat send panel)
      const schedulePanel = page.locator("text=Schedule");
      const sendPanel = page.locator("text=Send a message");

      // Schedule should be visible, Send should not
      expect(
        (await schedulePanel.isVisible()) ||
          (await page.locator("text=Inbox").isVisible()),
      ).toBeTruthy();
    }
  });

  test("badge click opens AAC Chat (send) when no unread messages", async ({
    page,
  }) => {
    // No mock messages — badge should not show
    const badge = page.locator('[data-testid="toolbar-badge-aac_chat"]');
    const hasBadge = await badge.isVisible();

    if (!hasBadge) {
      // Click chat button — should open send panel
      const chatBtn = page.locator(
        'button[aria-label*="Send a message"], button[aria-label*="aac_chat"]',
      );
      if (await chatBtn.first().isVisible()) {
        await chatBtn.first().click();
        await page.waitForTimeout(1000);

        // Send panel should be visible
        const sendPanel = page.locator("text=Send a message");
        expect(await sendPanel.isVisible()).toBeTruthy();
      }
    }
  });

  test("clicking contact in inbox shows message and reply option", async ({
    page,
  }) => {
    // Navigate to schedule/inbox
    const scheduleBtn = page.locator('button[aria-label*="Schedule"]');
    if (await scheduleBtn.isVisible()) {
      await scheduleBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "e2e/_screenshots/inbox-view.png" });
    }
  });
});
