/**
 * Screenshot validation — refuse to save a screenshot that obviously
 * doesn't show the page the spec asked for.
 *
 * Why: a Playwright spec that "passes" but writes a blank-screen /
 * 404 / auth-redirect / Next.js-error PNG into the docs is worse than
 * a failing test. It looks like real coverage and silently lies in
 * the documentation.
 *
 * What we detect:
 *   1. URL drift — page navigated away from the requested path
 *      (auth redirect, 404, server error route).
 *   2. Visible error UI — Next.js error overlay or "Application error"
 *      / "404" text in the DOM.
 *   3. Blank canvas — the rendered viewport has fewer than N distinct
 *      pixel colors (uniform-color page → background only, no UI).
 *   4. No content — body has zero rendered children, or only the
 *      auth gate / loading spinner.
 *
 * Returns a list of human-readable reasons. An empty list means the
 * page is safe to screenshot.
 */
import type { Page } from "@playwright/test";
import { createRequire } from "node:module";

// This validator is shared by Portal and POS screenshot specs. Resolve Sharp
// from the package that launched Playwright, not from this file's directory;
// POS-only installs intentionally do not create portal/node_modules.
const requireFromActiveProject = createRequire(`${process.cwd()}/package.json`);
const sharp = requireFromActiveProject("sharp") as typeof import("sharp");

export interface ValidationOptions {
  /** The path the spec navigated to (used to detect URL drift). */
  expectedPath: string;
  /** Minimum distinct pixel colors required in the captured canvas.
   *  A solid-color page (background only) hits 1-3 colors; a real UI
   *  with text + buttons + icons easily exceeds 200. Default: 50. */
  minDistinctColors?: number;
  /** Selector(s) the page MUST contain to count as rendered. Defaults
   *  to common shell anchors. */
  requiredSelectors?: string[];
  /** Rule 9 — critical targets whose full rect must be inside the viewport,
   *  must not intersect any occluder, and must win a center+4-corner hit
   *  test. Rect math alone cannot see a higher-z-index overlay. */
  criticalSelectors?: string[];
  /** Rule 9 — fixed/sticky chrome that can cover critical targets
   *  (bottom ribbons, toolbars, FABs, toasts). */
  occluderSelectors?: string[];
}

export interface ValidationFailure {
  reason: string;
  detail?: string;
}

const DEFAULT_REQUIRED_SELECTORS = [
  'h1, h2, [role="heading"], main, [role="main"]',
];

const ERROR_TEXT_PATTERNS = [
  /Application error: a client-side exception/i,
  /Application error: a server-side exception/i,
  /This page could not be found/i,
  /^404\s*[-—|]/im,
  /Internal Server Error/i,
  /Cannot GET \//i,
];

const AUTH_DRIFT_PATTERNS = [
  /^\/auth(\b|\/|\?)/,
  /^\/login(\b|\/|\?)/,
  /^\/signin(\b|\/|\?)/,
];

const VALIDATION_RETRY_ATTEMPTS = 5;
const VALIDATION_RETRY_DELAY_MS = 250;
const RETRYABLE_VALIDATION_REASONS = new Set([
  "missing_selector",
  "blank_canvas",
]);

export async function validateRenderedPage(
  page: Page,
  opts: ValidationOptions,
): Promise<ValidationFailure[]> {
  const failures: ValidationFailure[] = [];

  // 1. URL drift
  const url = new URL(page.url());
  const expectedPathname = opts.expectedPath.split('?')[0];
  const explicitlyTestingAuth = AUTH_DRIFT_PATTERNS.some((re) => re.test(expectedPathname));
  if (!explicitlyTestingAuth && AUTH_DRIFT_PATTERNS.some((re) => re.test(url.pathname))) {
    failures.push({
      reason: "auth_redirect",
      detail: `expected ${opts.expectedPath}, ended on ${url.pathname}${url.search}`,
    });
  } else if (!url.pathname.startsWith(expectedPathname)) {
    failures.push({
      reason: "url_drift",
      detail: `expected ${opts.expectedPath}, ended on ${url.pathname}`,
    });
  }

  // 2. Visible error UI
  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 5_000 })
    .catch(() => "");
  for (const re of ERROR_TEXT_PATTERNS) {
    const m = bodyText.match(re);
    if (m) {
      failures.push({ reason: "error_overlay", detail: m[0].slice(0, 200) });
      break;
    }
  }

  // 3. Required selectors
  const required = opts.requiredSelectors ?? DEFAULT_REQUIRED_SELECTORS;
  for (const sel of required) {
    const matches = await page.locator(sel).all().catch(() => []);
    const visible = await Promise.all(
      matches.map((match) => match.isVisible().catch(() => false)),
    );
    if (!visible.some(Boolean)) {
      failures.push({ reason: "missing_selector", detail: `${sel} (visible)` });
      break;
    }
  }

  // 4. Blank canvas — count distinct pixel colors in a downsampled
  //    screenshot of the actual viewport. The former foreignObject
  //    implementation created an empty synthetic div rather than
  //    cloning the document, so every valid page looked like a
  //    one-color canvas.
  const minDistinct = opts.minDistinctColors ?? 50;
  const distinct = await (async () => {
    try {
      const screenshot = await page.screenshot({ type: "png" });
      const { data, info } = await sharp(screenshot)
        .resize(64, 48, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const colors = new Set<number>();
      for (let offset = 0; offset < data.length; offset += info.channels) {
        colors.add(
          (data[offset] << 16)
          | (data[offset + 1] << 8)
          | data[offset + 2],
        );
      }
      return colors.size;
    } catch (error) {
      throw new Error(
        `Screenshot pixel validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  })();
  if (distinct < minDistinct) {
    failures.push({
      reason: "blank_canvas",
      detail: `only ${distinct} distinct colors (threshold ${minDistinct})`,
    });
  }

  return failures;
}

/**
 * Convenience — validate then screenshot. If validation fails, throws
 * with a human-readable summary of what was wrong, and skips writing
 * the PNG so the docs never silently ingest a blank/error capture.
 */
/**
 * Rule 9 — critical-target occlusion gate. Runs in-page: viewport
 * containment + occluder intersection + center/4-corner hit test via
 * document.elementFromPoint. Canonical implementation and rationale live in
 * skills/visual-screenshot-verification/occlusion_gate.js.
 *
 * 2026-07-30 incident: AAC board pictogram labels were sliced by the fixed
 * bottom category ribbon. Every label rect fit inside its own card, so the
 * pre-Rule-9 checks passed and the capture was accepted as evidence.
 */
export async function checkCriticalOcclusion(
  page: Page,
  opts: ValidationOptions,
): Promise<ValidationFailure[]> {
  const critical = opts.criticalSelectors ?? [];
  const occluders = opts.occluderSelectors ?? [];
  if (critical.length === 0) return [];
  const result = await page.evaluate(
    ([criticalSelectors, occluderSelectors]) => {
      const INSET = 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rectOf = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      type R = ReturnType<typeof rectOf>;
      const intersects = (a: R, b: R) =>
        !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const isSelfOrDescendant = (node: Element | null, target: Element) => {
        for (let n: Element | null = node; n; n = n.parentElement) if (n === target) return true;
        return false;
      };
      const occ: Array<{ sel: string; rect: R }> = [];
      for (const sel of occluderSelectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
          const r = rectOf(el);
          if (r.width > 0 && r.height > 0) occ.push({ sel, rect: r });
        }
      }
      const failures: Array<{ selector: string; reason: string; detail?: string }> = [];
      for (const sel of criticalSelectors) {
        const el = document.querySelector(sel);
        if (!el) { failures.push({ selector: sel, reason: "not_found" }); continue; }
        const r = rectOf(el);
        const cs = getComputedStyle(el);
        if (r.width <= 0 || r.height <= 0 || cs.visibility === "hidden" ||
            cs.display === "none" || parseFloat(cs.opacity || "1") === 0) {
          failures.push({ selector: sel, reason: "not_rendered", detail: `${r.width}x${r.height} vis=${cs.visibility}` });
          continue;
        }
        if (r.top < 0 || r.left < 0 || r.bottom > vh || r.right > vw) {
          failures.push({ selector: sel, reason: "clipped_by_viewport", detail: `rect ${JSON.stringify(r)} vs ${vw}x${vh}` });
        }
        for (const o of occ) {
          if (intersects(r, o.rect)) {
            failures.push({ selector: sel, reason: "occluded_by", detail: `${o.sel} covers ${JSON.stringify(r)}` });
          }
        }
        const probes: Array<[string, number, number]> = [
          ["center", r.left + r.width / 2, r.top + r.height / 2],
          ["top-left", r.left + INSET, r.top + INSET],
          ["top-right", r.right - INSET, r.top + INSET],
          ["bottom-left", r.left + INSET, r.bottom - INSET],
          ["bottom-right", r.right - INSET, r.bottom - INSET],
        ];
        for (const [name, x, y] of probes) {
          if (x < 0 || y < 0 || x > vw || y > vh) continue;
          const hit = document.elementFromPoint(x, y);
          if (!hit || !isSelfOrDescendant(hit, el)) {
            failures.push({
              selector: sel, reason: "hit_test_blocked",
              detail: `${name} resolved to ${hit ? hit.tagName.toLowerCase() : "null"}`,
            });
          }
        }
      }
      return failures;
    },
    [critical, occluders] as const,
  );
  return result.map((f) => ({ reason: f.reason, detail: `${f.selector}: ${f.detail ?? ""}`.trim() }));
}

export async function safeScreenshot(
  page: Page,
  pngPath: string,
  opts: ValidationOptions,
): Promise<void> {
  let failures: ValidationFailure[] = [];
  for (let attempt = 1; attempt <= VALIDATION_RETRY_ATTEMPTS; attempt += 1) {
    failures = await validateRenderedPage(page, opts);
    if (failures.length === 0) break;
    const retryable = failures.every((failure) => (
      RETRYABLE_VALIDATION_REASONS.has(failure.reason)
    ));
    if (!retryable || attempt === VALIDATION_RETRY_ATTEMPTS) break;
    // Wait on render state, not on time: fonts settled and two painted frames.
    await page.evaluate(() => Promise.race([
      document.fonts.ready.then(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ]));
  }
  // Rule 9 runs after render validation and BEFORE the write: an occluded
  // critical target must never reach disk as evidence.
  if (failures.length === 0) {
    failures = await checkCriticalOcclusion(page, opts);
  }
  if (failures.length > 0) {
    const summary = failures
      .map((f) => `[${f.reason}] ${f.detail ?? ""}`.trim())
      .join("\n  ");
    throw new Error(
      `Refusing to save ${pngPath} — page did not render valid content:\n  ${summary}`,
    );
  }
  await page.screenshot({ path: pngPath, fullPage: false });
}
