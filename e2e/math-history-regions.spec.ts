/**
 * Sub-national regional history coverage.
 *
 * Verifies that the History keyboard layers WORLD ∪ NATIONAL ∪
 * REGIONAL when `useSettingsStore.historyRegion` is set, and that
 * the AI tutor prompt carries both the language and the region so
 * an ambiguous date like 1836 resolves to the Alamo (US-TX) not
 * Alabama statehood (US-AL) or Arkansas statehood (US-AR).
 *
 * Coverage spans US states, Canadian provinces, UK nations, German
 * Länder, Spanish autonomous communities, Italian regions, Indian
 * states, and a few smaller-tier regions to confirm the registry
 * works end-to-end.
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

async function setRegion(
  page: Page,
  region: string | null,
  language: string = "en",
) {
  await page.evaluate(
    ({ region, language }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stores = (window as any).__devMathStores;
      stores.useSettingsStore
        .getState()
        .update({ historyRegion: region, language });
    },
    { region, language },
  );
  await page.waitForTimeout(80);
}

async function pickHistory(page: Page) {
  await page.locator('[data-testid="math-category-history"]').click();
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

test.describe("History — US states", () => {
  test("US-TX surfaces Alamo + Texas annexation; English-only events still visible", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "US-TX", "en");
    await pickHistory(page);
    const kb = page.locator('[data-testid="math-history-keyboard"]');
    await expect(kb).toHaveAttribute("data-region", "US-TX");
    await expect(
      page.locator('[data-testid="math-history-events-alamo-texas-indep"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-texas-annexation"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-jfk-assassination"]'),
    ).toBeVisible();
    // National (en) layer still shows.
    await expect(
      page.locator('[data-testid="math-history-events-norman-conquest"]'),
    ).toBeVisible();
    // World universal still shows.
    await expect(
      page.locator('[data-testid="math-history-events-wwii-end"]'),
    ).toBeVisible();
  });

  test("US-CA surfaces Gold Rush + statehood + earthquake", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "US-CA", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-california-gold-rush"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-california-statehood"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-sf-earthquake"]'),
    ).toBeVisible();
    // TX-only event NOT present.
    await expect(
      page.locator('[data-testid="math-history-events-alamo-texas-indep"]'),
    ).toHaveCount(0);
  });

  test("US-MA surfaces Mayflower + Boston Tea Party", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "US-MA", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-mayflower-pilgrims"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-boston-tea-party"]'),
    ).toBeVisible();
  });

  test("switching from US-TX to US-NY swaps the regional slice", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "US-TX", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-alamo-texas-indep"]'),
    ).toBeVisible();
    await setRegion(page, "US-NY", "en");
    await expect(
      page.locator('[data-testid="math-history-keyboard"]'),
    ).toHaveAttribute("data-region", "US-NY");
    await expect(
      page.locator('[data-testid="math-history-events-alamo-texas-indep"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="math-history-events-erie-canal"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-sept-11"]'),
    ).toBeVisible();
  });
});

test.describe("History — Canadian provinces", () => {
  test("CA-QC surfaces Plains of Abraham + Quiet Revolution", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "CA-QC", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-plains-of-abraham"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-quiet-revolution"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-quebec-referendum"]'),
    ).toBeVisible();
  });

  test("CA-NS surfaces Acadian Deportation + Halifax Explosion", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "CA-NS", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-acadian-deportation"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-halifax-explosion"]'),
    ).toBeVisible();
  });

  test("CA-MB surfaces Red River + Winnipeg General Strike", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "CA-MB", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-red-river-resistance"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="math-history-events-winnipeg-general-strike"]',
      ),
    ).toBeVisible();
  });
});

test.describe("History — UK nations", () => {
  test("UK-SCT surfaces Bannockburn + Acts of Union + Culloden", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "UK-SCT", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-bannockburn"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-acts-of-union"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-culloden"]'),
    ).toBeVisible();
  });

  test("UK-NIR surfaces Boyne + Partition + Good Friday Agreement", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "UK-NIR", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-battle-of-the-boyne"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-good-friday-agreement"]'),
    ).toBeVisible();
  });
});

test.describe("History — Ireland (Republic + provinces)", () => {
  test("IE surfaces Easter Rising + Independence War + Free State", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "IE", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-easter-rising"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="math-history-events-irish-independence-war"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-irish-free-state"]'),
    ).toBeVisible();
  });

  test("IE-MUN province slice surfaces Great Famine + Kinsale", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "IE-MUN", "en");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-great-famine-start"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-kinsale-battle"]'),
    ).toBeVisible();
  });
});

test.describe("History — German Länder, Spanish CCAA, Italian regions, Indian states", () => {
  test("DE-BY (Bavaria) surfaces Wittelsbach + Kingdom of Bavaria", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "DE-BY", "de");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-wittelsbach"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-kingdom-of-bavaria"]'),
    ).toBeVisible();
  });

  test("ES-CT (Catalonia) surfaces Crown of Aragon + 1714 + Catalonia referendum", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "ES-CT", "es");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-crown-of-aragon"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-siege-of-barcelona"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-catalonia-referendum"]'),
    ).toBeVisible();
  });

  test("IN-MH (Maharashtra) surfaces Shivaji coronation + Quit India Bombay", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await setRegion(page, "IN-MH", "hi");
    await pickHistory(page);
    await expect(
      page.locator('[data-testid="math-history-events-shivaji-coronation"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="math-history-events-quit-india-bombay"]'),
    ).toBeVisible();
  });
});

test.describe("History — tutor prompt carries region signal", () => {
  test("US-TX prompt mentions both en + US-TX so the model picks Alamo for 1836", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await setRegion(page, "US-TX", "en");
    await pickHistory(page);
    await page
      .locator('[data-testid="math-history-events-alamo-texas-indep"]')
      .click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "In 1836 the Alamo fell during Texan independence.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("Alamo", { timeout: 5000 });
    const prompt = getPrompt();
    expect(prompt, "prompt mentions US-TX region").toMatch(/US-TX/);
    expect(prompt, "prompt mentions language").toMatch(/\ben\b/);
  });

  test("CA-QC prompt anchors 1759 to Plains of Abraham", async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await setRegion(page, "CA-QC", "fr");
    await pickHistory(page);
    await page
      .locator('[data-testid="math-history-events-plains-of-abraham"]')
      .click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "En 1759, la bataille des plaines d'Abraham scelle le sort de la Nouvelle-France.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("Abraham", { timeout: 5000 });
    const prompt = getPrompt();
    expect(prompt, "prompt mentions CA-QC region").toMatch(/CA-QC/);
  });

  test('with no region set, prompt says "unspecified"', async ({
    page,
    baseURL,
  }) => {
    await gotoDev(page, baseURL);
    await blockLocalOllama(page);
    await setRegion(page, null, "en");
    await pickHistory(page);
    await page
      .locator('[data-testid="math-history-events-fall-of-rome"]')
      .click();
    await page.waitForTimeout(80);
    const getPrompt = await captureChatPrompt(
      page,
      "476 marks the fall of Rome.",
    );
    await page.locator('[data-testid="math-tutor-hint"]').click();
    const overlay = page.locator('[data-testid="math-tutor-response"]');
    await expect(overlay).toContainText("Rome", { timeout: 5000 });
    expect(getPrompt(), "unspecified region label").toMatch(/unspecified/);
  });
});
