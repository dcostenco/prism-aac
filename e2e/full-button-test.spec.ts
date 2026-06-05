/**
 * Comprehensive button interaction test — ALL interactive elements across iPhone + iPad.
 * Run: npx playwright test e2e/full-button-test.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

const DEVICES = [
  { name: "iPhone", viewport: { width: 393, height: 852 } },
  { name: "iPad", viewport: { width: 1024, height: 1366 } },
];

for (const device of DEVICES) {
  test.describe(`${device.name} — full button test`, () => {
    let page: Page;

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage({ viewport: device.viewport });
      await page.goto("/prism-aac", { waitUntil: "networkidle" });
      await page.waitForTimeout(5000);
    });

    test.afterEach(async () => {
      await page.close();
    });

    const vis = (s: string) =>
      page.locator(s).first().isVisible({ timeout: 2000 });
    const clk = async (s: string) => {
      const l = page.locator(s).first();
      if (
        await (async () => {
          await expect(l).toBeVisible({ timeout: 2000 });
          return true;
        })()
      ) {
        await l.click({ timeout: 3000 });
        return true;
      }
      return false;
    };
    const close = async () => {
      await page
        .locator('[aria-label*="close" i]')
        .first()
        .click({ timeout: 2000 })
        .catch(async () => {
          await page.mouse.click(10, 10);
        });
      await page.waitForTimeout(500);
    };

    test("01. Toolbar visible", async () => {
      expect(await vis('[data-testid="aac-toolbar-strip"]')).toBe(true);
    });
    test("02. Prediction tiles visible", async () => {
      expect(await vis('button[aria-label*="Predict:"]')).toBe(true);
    });
    test("03. Keyboard visible", async () => {
      expect(await vis('button[data-key="H"]')).toBe(true);
    });
    test("04. Speak button visible", async () => {
      expect(await vis('button:has-text("Speak")')).toBe(true);
    });
    test("05. Language selector visible", async () => {
      expect(await vis('[data-testid="language-button-input"]')).toBe(true);
    });

    test("06. Keyboard hide/show toggle", async () => {
      const kbBtn = page
        .locator('button:has-text("Keyboard"), button:has-text("Hide KB")')
        .first();
      if (
        await (async () => {
          await expect(kbBtn).toBeVisible({ timeout: 2000 });
          return true;
        })()
      ) {
        await kbBtn.click();
        await page.waitForTimeout(600);
        expect(await vis('button[data-key="H"]')).toBe(false);
        await kbBtn.click();
        await page.waitForTimeout(600);
        expect(await vis('button[data-key="H"]')).toBe(true);
      }
    });

    test("07. Type HI and Speak enabled", async () => {
      await clk('button[data-key="H"]');
      await clk('button[data-key="I"]');
      await page.waitForTimeout(200);
      const disabled = await page
        .locator('button:has-text("Speak")')
        .last()
        .isDisabled();
      expect(disabled).toBe(false);
    });

    test("08. Backspace", async () => {
      await page.waitForTimeout(500);
      expect(await clk('button[aria-label="Backspace"]')).toBe(true);
    });

    test("09. Phrase tile tap", async () => {
      const ok =
        (await clk('button[aria-label="Hello"]')) ||
        (await clk('button[aria-label*="Predict:"]'));
      expect(ok).toBe(true);
    });

    test("10. Category folder (Feelings)", async () => {
      expect(await clk('button:has-text("Feelings")')).toBe(true);
      await page.waitForTimeout(500);
      await clk('button:has-text("GO BACK"), button[aria-label*="back" i]');
    });

    test("11. UP/DOWN scroll", async () => {
      const up = await clk('button:has-text("UP")');
      const down = await clk('button:has-text("DOWN")');
      expect(up || down).toBe(true);
    });

    test("12. SEARCH", async () => {
      // SidebarBtn renders label "Search" with CSS uppercase — use case-insensitive match.
      // On landscape viewports the sidebar may need a moment to layout.
      await page.waitForTimeout(500);
      const ok =
        (await clk('button:has-text("SEARCH")')) ||
        (await clk('button:has-text("Search")'));
      expect(ok).toBe(true);
      await page.waitForTimeout(500);
      (await clk('button:has-text("GO BACK")')) ||
        (await clk('button:has-text("Go back")'));
    });

    test("13. HOME", async () => {
      expect(await clk('button:has-text("HOME")')).toBe(true);
    });

    test("14. Panel: AI Chat", async () => {
      expect(await clk('button[aria-label*="AI"]')).toBe(true);
      await page.waitForTimeout(1000);
      expect(await vis('[data-testid="ai-chat-panel"]')).toBe(true);
      // Keyboard should be visible in AI Chat
      expect(await vis('button[data-key="H"]')).toBe(true);
      await close();
    });

    test("15. Panel: Schedule", async () => {
      expect(await clk('button[aria-label*="Schedule"]')).toBe(true);
      await page.waitForTimeout(1000);
      await close();
    });

    test("16. Panel: Settings", async () => {
      expect(await clk('button[aria-label*="Settings"]')).toBe(true);
      await page.waitForTimeout(1000);
      expect(await vis("text=Settings")).toBe(true);
      await close();
    });

    test("17. Panel: Games", async () => {
      expect(await clk('button[aria-label*="Games"]')).toBe(true);
      await page.waitForTimeout(1000);
      await close();
    });

    test("18. Panel: AAC Chat", async () => {
      expect(await clk('button[aria-label*="aac_chat"]')).toBe(true);
      await page.waitForTimeout(1000);
      expect(await vis('[data-testid="aac-chat-panel"]')).toBe(true);
      await close();
    });

    test("19. Language picker opens", async () => {
      await clk('[data-testid="language-button-input"]');
      await page.waitForTimeout(500);
      expect(await vis('[data-testid="language-picker"]')).toBe(true);
      await page.mouse.click(10, 10);
    });

    test("20. Auto button", async () => {
      expect(await clk('button:has-text("Auto")')).toBe(true);
    });
    test("21. Delete/Clear", async () => {
      expect(
        await clk('button[aria-label*="Delete"], button[aria-label*="Clear"]'),
      ).toBe(true);
    });

    test("22. Return home — keyboard visible", async () => {
      await clk('button[aria-label*="Games"]');
      await page.waitForTimeout(1000);
      await close();
      await page.waitForTimeout(500);
      expect(await vis('button[data-key="H"]')).toBe(true);
    });
  });
}
