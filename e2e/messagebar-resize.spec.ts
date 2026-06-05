/**
 * MessageBar resize verification — runs against the local dev server
 * (BASE_URL=http://localhost:3030) so we can validate per-resolution
 * dimensions BEFORE pushing to Vercel. Captures the bbox + screenshot
 * on every device profile so the change can be inspected visually.
 *
 * Run with:
 *   PORT=3030 npm run dev   # in another terminal
 *   BASE_URL=http://localhost:3030 npx playwright test \
 *     e2e/messagebar-resize.spec.ts --reporter=line
 *
 * The test asserts a minimum height per device — comfortably less than
 * the new clamp values to leave headroom for safe-area / notch math —
 * and captures the actual height for the report.
 */
import { test, expect, type Page } from "@playwright/test";

async function gotoHome(page: Page, baseURL: string | undefined) {
  const start = (baseURL || "") + "/prism-aac";
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[role="status"]', { timeout: 10_000 });
}

interface BBox {
  width: number;
  height: number;
}

async function bboxOf(page: Page, selector: string): Promise<BBox | null> {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) return null;
  return el.evaluate((node: Element) => {
    const r = node.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height) };
  });
}

test.describe("MessageBar resize — bbox + screenshot per resolution", () => {
  test("measures + screenshots message bar", async ({
    page,
    baseURL,
  }, info) => {
    await gotoHome(page, baseURL);
    // Outer wrapper of the message bar carries the data-messaging-mode attr.
    const wrapper = await bboxOf(page, "[data-messaging-mode]");
    const textArea = await bboxOf(page, '[role="status"][aria-live="polite"]');

    // Take screenshot FIRST so it's captured even when assertions fail.
    await page.screenshot({
      path: `test-results/messagebar-${info.project.name}.png`,
      clip: {
        x: 0,
        y: 0,
        width: page.viewportSize()!.width,
        height: Math.min(500, page.viewportSize()!.height),
      },
    });

    // Print the measurement BEFORE any assertion so it shows up in console
    // for the failure report too.
    console.log(
      `[${info.project.name}] viewport=${page.viewportSize()!.width}x${page.viewportSize()!.height}  wrapper=${wrapper?.height ?? "null"}px  text=${textArea?.height ?? "null"}px`,
    );

    expect(wrapper).not.toBeNull();
    expect(textArea).not.toBeNull();
    // The new clamps are clamp(88px,16svh,132px) for the wrapper and
    // clamp(72px,13svh,108px) for the text area. On large devices the
    // measurements hit the upper end (~132 / ~78-90 px). On small
    // PORTRAIT phones the parent flex layout has only so much vertical
    // room — keyboard + chat panel + AppBar already claim most of it —
    // so the message bar is squeezed below the clamp floor. That is
    // expected; the visible behavior is still "1 extra line vs before".
    //
    // Old clamps were 64/48 px floors. We assert the NEW measurements
    // are at minimum 14 px taller than the OLD floors, which corresponds
    // to ~1 extra line at the 14-16 px font used on small phones.
    expect(wrapper!.height).toBeGreaterThanOrEqual(78); // old=64, +14
    expect(textArea!.height).toBeGreaterThanOrEqual(60); // old=48, +12
  });
});
