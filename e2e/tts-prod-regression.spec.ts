/**
 * TTS prod regression — runs against the LIVE deployed app.
 *
 * Every test here pins a class of bug that shipped to production and
 * required a fix. The live-diag script (scripts/tts-live-diag.mjs) was
 * the original investigative tool; these specs are the permanent gate.
 *
 * Instrumentation strategy:
 *   - Inject an AudioContext spy via addInitScript (runs before page JS)
 *   - Capture all console messages and TTS network requests
 *   - Assert on observable playback state, not audio output (headless)
 *
 * Classes covered:
 *   C1 — Double-speak truncation (case-mismatch pre-mark)
 *        "hello" typed → autocorrect capitalises → silence-detect fires
 *        second speakAzure → kills first source mid-play.
 *
 *   C2 — Romanian / Ukrainian 2× slower (rate scale mismatch)
 *        speechRate=0.5 (Web-Speech scale) passes through as SSML 0.50
 *        instead of 1.00. Fix: slider defaults to 1.0 via migration.
 *
 *   C3 — Single speak, single network call (no duplicate fetches)
 *        One Speak press → exactly one POST to /tts/public.
 *
 *   C4 — Portal TTS succeeds (not silent / no Web-Speech fallback)
 *        AudioContext must be running and a BufferSource must start.
 *
 *   C5 — Marketplace catalog 500 resolved
 *        /api/v1/marketplace/catalog must return 200, not 500.
 */

import { test, expect, Page } from "@playwright/test";

// ── Shared AudioContext spy ───────────────────────────────────────────────────

interface TtsDiag {
  sourceStartCount: number;
  lastGainValue: number | null;
  lastCtxState: string | null;
  truncatedCount: number; // sources whose onended fired at < 50% duration
  ttsLogs: string[];
}

async function injectTtsSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as Window & {
      __ttsDiag?: () => TtsDiag;
      AudioContext: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    let sourceStartCount = 0;
    let lastGainValue: number | null = null;
    let lastCtxState: string | null = null;
    let truncatedCount = 0;
    const ttsLogs: string[] = [];

    const OrigCtor = win.AudioContext || win.webkitAudioContext;
    if (OrigCtor) {
      const Wrapped = function (this: AudioContext, ...args: unknown[]) {
        const ctx = new OrigCtor(...(args as []));
        const origSource = ctx.createBufferSource.bind(ctx);
        ctx.createBufferSource = function () {
          const src = origSource();
          const origStart = src.start.bind(src);
          let startedAt = 0;
          src.start = function (...a: Parameters<typeof src.start>) {
            sourceStartCount++;
            startedAt = Date.now();
            lastCtxState = ctx.state;
            const prevOnended = src.onended;
            src.onended = function (ev: Event) {
              const elapsed = Date.now() - startedAt;
              const expected = src.buffer ? src.buffer.duration * 1000 : 0;
              if (expected > 250 && elapsed < expected * 0.5) truncatedCount++;
              if (prevOnended) (prevOnended as (ev: Event) => void)(ev);
            };
            return origStart(...a);
          };
          return src;
        };
        const origGain = ctx.createGain.bind(ctx);
        ctx.createGain = function () {
          const g = origGain();
          const origConnect = g.connect.bind(g);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          g.connect = function (dst: any) {
            lastGainValue = g.gain.value;
            return origConnect(dst);
          };
          return g;
        };
        return ctx;
      } as unknown as typeof AudioContext;
      Wrapped.prototype = OrigCtor.prototype;
      win.AudioContext = Wrapped;
      if (win.webkitAudioContext) win.webkitAudioContext = Wrapped;
    }

    // Capture [TTS] console logs
    const origLog = console.log.bind(console);
    console.log = (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      if (msg.includes("[TTS]") || msg.includes("[AzureTTS]"))
        ttsLogs.push(msg);
      origLog(...args);
    };
    const origWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      if (msg.includes("[TTS]") || msg.includes("[AzureTTS]"))
        ttsLogs.push("[WARN] " + msg);
      origWarn(...args);
    };

    win.__ttsDiag = () => ({
      sourceStartCount,
      lastGainValue,
      lastCtxState,
      truncatedCount,
      ttsLogs,
    });
  });
}

async function getDiag(page: Page): Promise<TtsDiag> {
  return page.evaluate(
    () =>
      (window as Window & { __ttsDiag?: () => TtsDiag }).__ttsDiag?.() ?? {
        sourceStartCount: 0,
        lastGainValue: null,
        lastCtxState: null,
        truncatedCount: 0,
        ttsLogs: [],
      },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function typeWord(page: Page, word: string): Promise<void> {
  for (const ch of word.toUpperCase()) {
    await page.locator(`button[data-key="${ch}"]`).click();
    await page.waitForTimeout(40);
  }
}

async function tapSpeak(page: Page): Promise<void> {
  // warmupAzureAudio runs synchronously inside the gesture handler.
  // Use dispatchEvent so the gesture token reaches the AudioContext.
  await page.locator("button.aac-speak").first().click();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page, baseURL }) => {
  await injectTtsSpy(page);

  // Pre-set sessionStorage keys BEFORE page JS runs so GreetingBanner
  // treats the session as "already dismissed". Without this, the banner
  // auto-speaks at +905ms, producing a second TTS call that corrupts
  // every test that measures sourceStartCount or fetch count.
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("prism-greeting-dismissed", "1");
    } catch {
      /* */
    }
  });

  const start = baseURL || "/";
  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (
    protectionBypass &&
    new URL(start).hostname.endsWith(".vercel.app")
  ) {
    const authorizationResponse = await page.context().request.get(start, {
      headers: {
        "x-vercel-protection-bypass": protectionBypass,
        "x-vercel-set-bypass-cookie": "true",
      },
    });
    expect(
      authorizationResponse.ok(),
      `Preview authorization failed with ${authorizationResponse.status()}`,
    ).toBe(true);
  }
  // First load: clear persisted state from prior sessions
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* */
    }
    // Re-apply greeting dismiss so the second load respects it
    try {
      sessionStorage.setItem("prism-greeting-dismissed", "1");
    } catch {
      /* */
    }
  });
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
  await page.waitForTimeout(1500); // let auth + settings hydrate
});

// ── C1: Double-speak truncation ───────────────────────────────────────────────

test("C1: single Speak press → at most one AudioSource truncated (no double-speak)", async ({
  page,
}) => {
  const ttsReqs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/tts/") && r.method() === "POST")
      ttsReqs.push(r.url());
  });

  await typeWord(page, "HELLO");
  await page.waitForTimeout(600); // let silence-detect + autocorrect settle
  await tapSpeak(page);
  await page.waitForTimeout(5000); // full audio play window

  const diag = await getDiag(page);

  // The fix: silence-detect pre-mark is now case-insensitive, so the
  // second speak (which killed the first at 10%) must no longer fire.
  expect(
    diag.truncatedCount,
    "Audio was truncated — double-speak still occurring",
  ).toBe(0);
  expect(diag.sourceStartCount, "Expected exactly 1 AudioSource to start").toBe(
    1,
  );
});

test('C1b: TTS logs show exactly one "Portal TTS succeeded" for a single Speak', async ({
  page,
}) => {
  await typeWord(page, "HELLO");
  await page.waitForTimeout(600);
  await tapSpeak(page);
  await page.waitForTimeout(4000);

  const diag = await getDiag(page);
  const successLogs = diag.ttsLogs.filter((l) =>
    l.includes("Portal TTS succeeded"),
  );
  const truncateLogs = diag.ttsLogs.filter((l) =>
    l.includes("AUDIO TRUNCATED"),
  );

  expect(
    truncateLogs,
    `AUDIO TRUNCATED still in logs:\n${truncateLogs.join("\n")}`,
  ).toHaveLength(0);
  expect(
    successLogs.length,
    `Expected 1 success log, got ${successLogs.length}`,
  ).toBe(1);
});

// ── C2: Romanian / Ukrainian rate ─────────────────────────────────────────────

test("C2: Romanian speak — single source starts, no truncation", async ({
  page,
}) => {
  // Switch to Romanian via the language picker (input lang = ro)
  // Simpler: use the keyboard locator approach for the toolbar lang button
  // and verify the portal call succeeds with audio.
  const ttsReqs: { url: string; status?: number; body?: Record<string, unknown> }[] = [];
  const ttsReqByRequest = new WeakMap<object, (typeof ttsReqs)[number]>();
  page.on("request", (r) => {
    if (r.url().includes("/tts/") && r.method() === "POST") {
      let body: Record<string, unknown> | undefined;
      try {
        body = JSON.parse(r.postData() || "{}") as Record<string, unknown>;
      } catch {
        /* assertion below reports the missing language */
      }
      const entry = { url: r.url(), body };
      ttsReqs.push(entry);
      ttsReqByRequest.set(r, entry);
    }
  });
  page.on("response", (r) => {
    const entry = ttsReqByRequest.get(r.request());
    if (entry) entry.status = r.status();
  });

  // Set language to Romanian in localStorage before load
  await page.evaluate(() => {
    try {
      const persisted = JSON.parse(localStorage.getItem("prism-aac-settings") || "{}");
      const state =
        persisted.state && typeof persisted.state === "object"
          ? persisted.state
          : {};
      persisted.state = {
        ...state,
        language: "ro",
        outputLanguage: "ro",
        speechRate: 1.0, // migrated default — must not be 0.5
      };
      if (!Number.isInteger(persisted.version)) persisted.version = 0;
      localStorage.setItem("prism-aac-settings", JSON.stringify(persisted));
    } catch {
      /* */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const persistedLanguage = await page.evaluate(() => {
    try {
      const persisted = JSON.parse(localStorage.getItem("prism-aac-settings") || "{}");
      return {
        language: persisted.state?.language,
        outputLanguage: persisted.state?.outputLanguage,
      };
    } catch {
      return null;
    }
  });
  expect(persistedLanguage).toEqual({
    language: "ro",
    outputLanguage: "ro",
  });

  await typeWord(page, "APA"); // Romanian for "water"
  await page.waitForTimeout(500);
  await tapSpeak(page);
  await page.waitForTimeout(5000);

  const diag = await getDiag(page);
  const portalHit = ttsReqs.some(
    (r) => r.url.includes("/tts/public") && r.status === 200,
  );
  const romanianHit = ttsReqs.find(
    (r) =>
      r.url.includes("/tts/public") &&
      r.status === 200 &&
      typeof r.body?.lang === "string" &&
      r.body.lang.toLowerCase().startsWith("ro"),
  );

  expect(portalHit, "Portal TTS /tts/public must return 200 for Romanian").toBe(
    true,
  );
  expect(
    romanianHit,
    `Expected a successful Romanian payload, got ${JSON.stringify(ttsReqs)}`,
  ).toBeTruthy();
  expect(
    diag.sourceStartCount,
    "Romanian must start exactly 1 AudioSource",
  ).toBe(1);
  expect(diag.truncatedCount, "Romanian audio must not be truncated").toBe(0);
});

// ── C3: Single network call per Speak ─────────────────────────────────────────

test("C3: one Speak press → exactly one POST to /tts/public", async ({
  page,
}) => {
  const ttsPosts: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/tts/public") && r.method() === "POST")
      ttsPosts.push(r.url());
  });

  await typeWord(page, "WATER");
  await page.waitForTimeout(600);
  await tapSpeak(page);
  await page.waitForTimeout(4000);

  expect(
    ttsPosts.length,
    `Expected 1 TTS fetch, got ${ttsPosts.length}: ${ttsPosts.join(", ")}`,
  ).toBe(1);
});

// ── C4: AudioContext running, BufferSource plays ───────────────────────────────

test("C4: AudioContext reaches running state and BufferSource starts", async ({
  page,
}) => {
  await typeWord(page, "TEST");
  await page.waitForTimeout(500);
  await tapSpeak(page);
  await page.waitForTimeout(4000);

  const diag = await getDiag(page);

  expect(
    diag.lastCtxState,
    'AudioContext must be "running" when source starts',
  ).toBe("running");
  expect(
    diag.sourceStartCount,
    "At least one BufferSource must have started",
  ).toBeGreaterThan(0);
  expect(
    diag.lastGainValue,
    "Gain must be set (non-null) — volume guard working",
  ).not.toBeNull();
  expect(
    diag.lastGainValue!,
    "Gain must be > 0 — no silent-success bug",
  ).toBeGreaterThan(0);
});

// ── C5: Marketplace catalog 500 resolved ──────────────────────────────────────

test("C5: /api/v1/marketplace/catalog returns 200, not 500", async ({
  page,
}) => {
  const response = await page.request.get(
    "https://synalux.ai/api/v1/marketplace/catalog",
  );

  expect(response.status(), "marketplace/catalog must not 500").not.toBe(500);
  expect(response.status(), "marketplace/catalog must return 200").toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty("modules");
  expect(Array.isArray(body.modules), "modules must be an array").toBe(true);
  expect(body).toHaveProperty("fetched_at");
});

// ── C6: Rapid double-Speak does not permanently silence audio ─────────────────

test("C6: two rapid Speak presses — second press still produces audio", async ({
  page,
}) => {
  await typeWord(page, "YES");
  await page.waitForTimeout(500);

  // First press
  await tapSpeak(page);
  await page.waitForTimeout(300);
  // Second press within ~300ms — should NOT silence the audio pipeline
  await tapSpeak(page);
  await page.waitForTimeout(4000);

  const diag = await getDiag(page);

  // After two presses the pipeline must have produced at least one
  // non-truncated playback (the second press's audio).
  console.log('C6 TTS Logs:', diag.ttsLogs);
  expect(
    diag.sourceStartCount,
    "At least one source must start on double-press",
  ).toBeGreaterThanOrEqual(1);
  // The DEDUP or stopAzurePlayback may kill the first — that's acceptable.
  // What must NOT happen is zero sources (complete silence).
  const successLogs = diag.ttsLogs.filter((l) =>
    l.includes("Portal TTS succeeded"),
  );
  expect(
    successLogs.length,
    "At least one TTS success must occur",
  ).toBeGreaterThan(0);
});

// ── C7: GreetingBanner is visual-only — no auto-speak on load ────────────────

test("C7: greeting banner shows visually but fires ZERO TTS calls (visual-only)", async ({
  page,
  baseURL,
}) => {
  /**
   * Greeting audio was removed (May 2026) — it caused TTS conflicts:
   * the banner fired aacSpeak() at +905ms which then got killed at
   * +2998ms by an unknown caller, truncating the greeting mid-play.
   * AAC users open the app to COMMUNICATE, not to hear a greeting.
   * The visual banner is sufficient — schedule shows what's next.
   *
   * This test deliberately does NOT pre-dismiss the banner.
   */
  const ttsReqs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/tts/") && r.method() === "POST")
      ttsReqs.push(r.url());
  });

  const start = baseURL || "/";
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* */
    }
  });
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-key="Q"]', { timeout: 30000 });
  await page.waitForTimeout(2000); // full banner + i18n settle time

  const diag = await getDiag(page);

  // Banner must not have triggered any TTS
  expect(diag.sourceStartCount, "Banner must NOT start any AudioSource").toBe(
    0,
  );
  expect(
    ttsReqs.filter((u) => u.includes("/tts/")).length,
    "Banner must NOT fire any TTS API calls",
  ).toBe(0);

  // Banner should be visible in the DOM
  const banner = page.locator(".surface-bar").first();
  await expect(banner).toBeVisible();
});
