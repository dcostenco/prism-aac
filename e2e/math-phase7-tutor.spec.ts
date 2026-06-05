/**
 * Phase 7 — Biology / Statistics / Music / Earth Science integration.
 *
 * Per-tab assertions (mirroring the Phase 6 pattern):
 *   1. Tab swap mounts the right keyboard component
 *   2. A representative glyph commits to the cell grid
 *   3. AI tutor uses a domain-specific prompt (mocked askAI captures
 *      the request body — we assert the user-message content mentions
 *      biology / statistics / music / earth-science explicitly)
 *   4. The overlay's data-domain attribute matches the active tab
 */
import { test, expect, type Page, type Route } from "@playwright/test";

async function gotoDev(page: Page, baseURL: string | undefined) {
  const start = (baseURL || "") + "/dev/math-grid";
  await page.goto(start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
  await page.waitForFunction(
    () => {
      const svg = document.querySelector('[data-testid="math-grid-svg"]');
      return !!svg && svg.getBoundingClientRect().width > 100;
    },
    { timeout: 5000 },
  );
}

async function pickCategory(page: Page, id: string) {
  await page.locator(`[data-testid="math-category-${id}"]`).click();
  await page.waitForTimeout(120);
}

function sseBody(chunks: string[]): string {
  return (
    chunks
      .map(
        (c) =>
          `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`,
      )
      .join("") + "data: [DONE]\n\n"
  );
}

async function blockLocalOllama(page: Page) {
  await page.route("**/11434/**", (route) => route.abort());
  await page.route("**/generate", (route) => route.abort());
}

interface ChatBody {
  messages: Array<{ role: string; content: string }>;
}

async function captureChatPrompt(
  page: Page,
  response: string,
): Promise<() => string> {
  let captured = "";
  await page.route("**/chat", async (route: Route) => {
    const body = route.request().postDataJSON() as ChatBody;
    captured = body?.messages?.find((m) => m.role === "user")?.content ?? "";
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: sseBody([response]),
    });
  });
  return () => captured;
}

test.describe("Phase 7 — Biology tab", () => {
  test("chip mounts the biology keyboard with nucleotides + taxonomy + organelles", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "biology");
    await expect(
      page.locator('[data-testid="math-biology-keyboard"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-biology-nucleotides-adenine"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-biology-nucleotides-thymine"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-biology-genetics-heterozygous"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-biology-taxonomy-kingdom"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-biology-organelles-mitochondria"]'),
    ).toBeVisible();
  });

  test("typing A T G commits 3 nucleotide cells", async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "biology");
    await page
      .locator('[data-testid="math-biology-nucleotides-adenine"]')
      .click();
    await page
      .locator('[data-testid="math-biology-nucleotides-thymine"]')
      .click();
    await page
      .locator('[data-testid="math-biology-nucleotides-guanine"]')
      .click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cells=3/);
  });

  test("AI tutor uses a biology-flavoured prompt + data-domain=biology", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, "biology");
    await page
      .locator('[data-testid="math-biology-nucleotides-adenine"]')
      .click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "Adenine pairs with Thymine in DNA.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("Adenine pairs with Thymine", {
      timeout: 5000,
    });
    await expect(overlay).toHaveAttribute("data-domain", "biology");
    expect(getPrompt().toLowerCase(), "prompt mentions biology").toContain(
      "biology",
    );
  });
});

test.describe("Phase 7 — Statistics tab", () => {
  test("chip mounts the statistics keyboard with parameters + ops + distributions", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "statistics");
    await expect(
      page.locator('[data-testid="math-statistics-keyboard"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-stats-params-population-mean"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-stats-params-sample-mean"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-stats-ops-summation-stats"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-stats-dist-z-score"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-stats-dist-chi-squared"]'),
    ).toBeVisible();
  });

  test("typing μ commits one cell (population mean)", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "statistics");
    await page
      .locator('[data-testid="math-stats-params-population-mean"]')
      .click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cells=1/);
  });

  test("AI tutor uses a statistics-flavoured prompt", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, "statistics");
    await page.locator('[data-testid="math-stats-params-sample-mean"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "Use x̄ for the sample mean.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("sample mean", { timeout: 5000 });
    await expect(overlay).toHaveAttribute("data-domain", "statistics");
    expect(getPrompt().toLowerCase(), "prompt mentions statistics").toContain(
      "statistics",
    );
  });
});

test.describe("Phase 7 — Music tab", () => {
  test("chip mounts the music keyboard with clefs + notes + accidentals + dynamics", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "music");
    await expect(
      page.locator('[data-testid="math-music-keyboard"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-music-clefs-treble-clef"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-music-notes-quarter-note"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-music-accidentals-sharp"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-music-dynamics-fortissimo"]'),
    ).toBeVisible();
  });

  test("typing a treble-clef + quarter-note commits 2 cells", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "music");
    await page.locator('[data-testid="math-music-clefs-treble-clef"]').click();
    await page.locator('[data-testid="math-music-notes-quarter-note"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cells=2/);
  });

  test("AI tutor uses a music-flavoured prompt", async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, "music");
    await page.locator('[data-testid="math-music-notes-quarter-note"]').click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "A quarter note gets one beat in 4/4 time.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("quarter note", { timeout: 5000 });
    await expect(overlay).toHaveAttribute("data-domain", "music");
    expect(getPrompt().toLowerCase(), "prompt mentions music").toContain(
      "music",
    );
  });
});

test.describe("Phase 7 — Earth Science tab", () => {
  test("chip mounts the earth-science keyboard with weather + plates + astro + units", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "earth-science");
    await expect(
      page.locator('[data-testid="math-earth-science-keyboard"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-earth-weather-sun"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-earth-plates-subduction"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-earth-astro-mars"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-earth-units-light-year"]'),
    ).toBeVisible();
  });

  test("typing ☉ ♂ commits 2 astronomy cells", async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await pickCategory(page, "earth-science");
    await page.locator('[data-testid="math-earth-astro-sun-symbol"]').click();
    await page.locator('[data-testid="math-earth-astro-mars"]').click();
    await page.waitForTimeout(120);
    const header = await page.locator("header").first().innerText();
    expect(header).toMatch(/cells=2/);
  });

  test("AI tutor uses an earth-science-flavoured prompt", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await pickCategory(page, "earth-science");
    await page
      .locator('[data-testid="math-earth-units-astronomical-unit"]')
      .click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "1 AU is the distance from the Sun to Earth.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("AU", { timeout: 5000 });
    await expect(overlay).toHaveAttribute("data-domain", "earth-science");
    expect(getPrompt().toLowerCase(), "prompt mentions earth-science").toMatch(
      /earth.science/,
    );
  });
});

test.describe("Phase 7 — domain switching across all subjects", () => {
  test("switching across all 4 new tabs updates data-domain on the overlay", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    let counter = 0;
    await page.route("**/chat", async (route: Route) => {
      counter++;
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sseBody([`response-${counter}`]),
      });
    });

    const cases: Array<{ tab: string; tile: string; domain: string }> = [
      {
        tab: "biology",
        tile: "math-biology-nucleotides-adenine",
        domain: "biology",
      },
      {
        tab: "statistics",
        tile: "math-stats-params-population-mean",
        domain: "statistics",
      },
      { tab: "music", tile: "math-music-notes-quarter-note", domain: "music" },
      {
        tab: "earth-science",
        tile: "math-earth-astro-mars",
        domain: "earth-science",
      },
    ];

    const overlay = page.locator('[data-testid="math-tutor-response"]');
    for (const c of cases) {
      await pickCategory(page, c.tab);
      await page.locator(`[data-testid="${c.tile}"]`).click();
      await page.waitForTimeout(80);
      await page.locator('[data-testid="math-tutor-hint"]').click();
      await expect(overlay).toHaveAttribute("data-domain", c.domain);
      await expect(overlay).toContainText(/response-\d/, { timeout: 5000 });
      // Reset for next iteration.
      await page.locator('[data-testid="math-tutor-dismiss"]').click();
      await page.waitForTimeout(80);
    }
    expect(counter, "4 tutor invocations across 4 domains").toBe(4);
  });
});
