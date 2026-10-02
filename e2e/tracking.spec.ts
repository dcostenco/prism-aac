/**
 * Tracking features end-to-end coverage.
 *
 * Pins behavior the May 2026 prod probe (scripts/tracking-prod-probe.mjs)
 * surfaced:
 *   • Head-tracking toggle in Settings flips the saved setting and
 *     mounts <HeadTrackingOverlay>.
 *   • Camera/head input starts OFF for privacy; explicit toggles mount
 *     and unmount their overlays.
 *   • Both overlays expose data-status so an external watchdog
 *     (oncall page test) can detect a stuck "starting" → "lost" loop.
 *   • The blaze_face_short_range fallback model URL returns 200, not
 *     404. The .task → .tflite fix in commit f81bac3 closed the
 *     silent-fail gap on phones where the GPU-heavy FaceLandmarker
 *     hits the memory cap and we need the lighter detector.
 *
 * Camera permission handling: WebKit headless has no real camera, so
 * we shim navigator.mediaDevices in addInitScript with a canvas-driven
 * MediaStream. This tests mounting/settings, NOT recognition accuracy.
 */
import { test, expect } from "@playwright/test";
import { installLocalCameraAccess } from './helpers/camera-access-fixture';
test.beforeEach(async ({ page, baseURL }, info) => installLocalCameraAccess(page, baseURL, info));
test.use({ serviceWorkers: 'block' });
test.afterEach(async ({ page, context }) => { await page.close(); await context.close(); });

const SHIM = () => {
  let stream: MediaStream | null = null;
  const makeStream = () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 240;
    const ctx = c.getContext("2d");
    setInterval(() => {
      if (!ctx) return;
      ctx.fillStyle = `rgb(${(Math.random() * 200) | 0},${(Math.random() * 200) | 0},${(Math.random() * 200) | 0})`;
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = "#fff";
      ctx.fillRect(140, 80, 40, 80);
    }, 33);
    return (
      (
        c as HTMLCanvasElement & {
          captureStream?: (fps: number) => MediaStream;
        }
      ).captureStream?.(15) ?? null
    );
  };
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {},
      writable: true,
    });
  }
  navigator.mediaDevices.getUserMedia = async () => {
    if (!stream) stream = makeStream();
    if (!stream) throw new Error("captureStream unavailable");
    return stream;
  };
  navigator.mediaDevices.enumerateDevices = async () => [
    {
      kind: "videoinput",
      deviceId: "fake-cam-0",
      label: "Fake Camera",
      groupId: "g0",
    } as MediaDeviceInfo,
  ];
  // Instance-only shims may be replaced by WebKit during navigation.
  MediaDevices.prototype.getUserMedia = navigator.mediaDevices.getUserMedia;
  MediaDevices.prototype.enumerateDevices = navigator.mediaDevices.enumerateDevices;
};

test.describe("Tracking features", () => {
  test("camera-input toggle mounts the finger-tracking overlay", async ({
    page
  }) => {
    await page.addInitScript(SHIM);
    await page.goto('/prism-aac');

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    const toggle = page.locator('button[aria-label="Camera input"]');
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    expect(await toggle.getAttribute("aria-pressed")).toBe("false"); // settingsStore default
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", {
      timeout: 3_000,
    });

    const overlay = page.getByTestId("camera-input-overlay");
    await expect(overlay).toBeAttached({ timeout: 20_000 });
    const status = await overlay.getAttribute("data-status");
    expect(
      ["starting", "tracking", "lost"].includes(status ?? ""),
    ).toBeTruthy();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(overlay).toHaveCount(0);
  });

  test("default tracking target chip is visibly selected", async ({ page }) => {
    // Pins the May 2026 probe finding: settings stored 'any_wrist' as the
    // default but no matching chip existed in the UI grid. Without a
    // visible selection, the user couldn't tell what was being tracked
    // and was forced to pick a specific side, losing the auto-side
    // fallback that handles asymmetric reach.
    await page.addInitScript(SHIM);
    await page.goto('/prism-aac');
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    const camToggle = page.locator('button[aria-label="Camera input"]');
    await expect(camToggle).toBeVisible({ timeout: 5_000 });
    if ((await camToggle.getAttribute("aria-pressed")) === "false")
      await camToggle.click();
    const defaultChip = page.getByTestId("tracking-target-any_wrist");
    await expect(defaultChip).toBeVisible();
    await expect(defaultChip).toHaveAttribute("data-selected", "true");
  });

  test("head-tracking toggle in Settings mounts the overlay", async ({
    page
  }) => {
    await page.addInitScript(SHIM);
    await page.goto('/prism-aac');

    // Open Settings
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    // Find and click the Head tracking toggle by its aria-label
    const toggle = page.locator('button[aria-label="Head tracking"]');
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    expect(await toggle.getAttribute("aria-pressed")).toBe("false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", {
      timeout: 3_000,
    });

    // Overlay should mount within a reasonable window — model load takes
    // up to 10s on a cold cache.
    const overlay = page.getByTestId("head-tracking-overlay");
    await expect(overlay).toBeAttached({ timeout: 15_000 });
    const status = await overlay.getAttribute("data-status");
    expect(
      ["starting", "tracking", "lost"].includes(status ?? ""),
    ).toBeTruthy();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(overlay).toHaveCount(0);
  });

  test("setup wizard Cancel escapes detection and disables camera input", async ({ page }) => {
    // Before calibration, Cancel must not leave an unusable tracker on.
    // Accuracy-phase Skip is exercised by camera-calibration-reliability.
    await page.addInitScript(SHIM);
    await page.goto('/prism-aac');
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole('button', { name: /Accessibility & Input Modes/ }).click();
    const toggle = page.getByRole('button', { name: 'Camera input', exact: true });
    await toggle.click();
    // Open the wizard
    const setupBtn = page.locator('button:has-text("Set Up Tracking")');
    await expect(setupBtn).toBeVisible({ timeout: 5_000 });
    await setupBtn.click();
    const wiz = page.getByTestId("tracking-setup-wizard");
    await expect(wiz).toBeVisible({ timeout: 5_000 });
    await expect(wiz).toHaveAttribute('data-phase', 'intro');
    await page.getByTestId('tracking-setup-start').click();
    await expect(wiz).toHaveAttribute('data-phase', 'detecting');
    await wiz.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(wiz).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('camera-input-overlay')).toHaveCount(0);
  });

  test("mediapipe model URLs return 200 (no .task→.tflite regression)", async ({
    request,
  }) => {
    // The faceLandmarker model — primary head-tracker
    const landmarker = await request.fetch(
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      { method: "HEAD" },
    );
    expect(landmarker.status()).toBe(200);

    // The fallback face detector — used when Landmarker hits GPU cap
    const detector = await request.fetch(
      "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
      { method: "HEAD" },
    );
    expect(detector.status()).toBe(200);

    // Negative pin: the .task URL we used to fetch IS still 404, so if
    // someone re-introduces the wrong extension the test that passes
    // is the one above, not this one. (Documented for next dev.)
    const broken = await request.fetch(
      "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.task",
      { method: "HEAD" },
    );
    expect(broken.status()).toBe(404);
  });
});
