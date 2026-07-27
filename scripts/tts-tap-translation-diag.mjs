/**
 * Live tap-to-translate diagnostic.
 *
 * Captures the exact user path where English input and Spanish output differ:
 * tapping a prediction must translate and automatically speak only Spanish.
 * Run through scripts/playwright-watchdog.sh --exec.
 */
import { webkit } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const targetUrl =
  process.env.TARGET_URL || "https://prism-aac.vercel.app/prism-aac";
const reportPath =
  process.env.TTS_REPORT_PATH || "/tmp/tts-tap-translation-diag.json";
const screenshotPath =
  process.env.TTS_SCREENSHOT_PATH || "/tmp/tts-tap-translation-diag.png";
const inputMode = process.env.INPUT_MODE || "prediction";
const inputText = process.env.INPUT_TEXT || "I";
const secondInputText = process.env.SECOND_INPUT_TEXT || "need";
const predictionSequence = (process.env.PREDICTION_SEQUENCE || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const sequenceDelayMs = Number(process.env.SEQUENCE_DELAY_MS || "500");
const outputLanguage = process.env.OUTPUT_LANGUAGE || "es";
const pressPlay = process.env.PRESS_PLAY === "1";
const vercelProtectionBypass =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "en-US",
});
if (
  vercelProtectionBypass &&
  new URL(targetUrl).hostname.endsWith(".vercel.app")
) {
  let authorizationResponse;
  try {
    authorizationResponse = await context.request.get(targetUrl, {
      headers: {
        "x-vercel-protection-bypass": vercelProtectionBypass,
        "x-vercel-set-bypass-cookie": "true",
      },
    });
  } catch {
    throw new Error("Preview authorization request failed");
  }
  if (!authorizationResponse.ok()) {
    throw new Error(
      `Preview authorization failed with ${authorizationResponse.status()}`,
    );
  }
}
const page = await context.newPage();
const report = {
  targetUrl,
  inputMode,
  inputText,
  secondInputText,
  predictionSequence,
  sequenceDelayMs,
  outputLanguage,
  pressPlay,
  playClickedAt: null,
  documentStatus: null,
  storedSettings: null,
  tappedTile: null,
  tappedTiles: [],
  stepSnapshots: [],
  predictionTitles: [],
  messageText: null,
  speechUtterances: [],
  audio: null,
  network: [],
  relevantButtons: [],
  console: [],
  pageErrors: [],
  screenshotPath,
};
const requestEntries = new Map();

await page.addInitScript((selectedOutputLanguage) => {
  try {
    localStorage.setItem(
      "prism-aac-settings",
      JSON.stringify({
        state: {
          language: "en",
          outputLanguage: selectedOutputLanguage,
          speechRate: 1,
          speechVolume: 1,
        },
        version: 18,
      }),
    );
    sessionStorage.setItem("prism-greeting-dismissed", "1");
  } catch {
    // The persisted-state assertion in the report will expose this.
  }

  const utterances = [];
  const audio = {
    contextStates: [],
    resumeCalls: [],
    sourceStarts: [],
    sourceEnds: [],
  };
  const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
  if (OriginalAudioContext) {
    const WrappedAudioContext = function (...args) {
      const audioContext = new OriginalAudioContext(...args);
      audio.contextStates.push({ state: audioContext.state, at: Date.now() });
      const originalResume = audioContext.resume.bind(audioContext);
      audioContext.resume = async (...resumeArgs) => {
        audio.resumeCalls.push({ stateBefore: audioContext.state, at: Date.now() });
        const result = await originalResume(...resumeArgs);
        audio.resumeCalls.at(-1).stateAfter = audioContext.state;
        return result;
      };
      const originalCreateBufferSource =
        audioContext.createBufferSource.bind(audioContext);
      audioContext.createBufferSource = () => {
        const source = originalCreateBufferSource();
        const originalStart = source.start.bind(source);
        source.start = (...startArgs) => {
          audio.sourceStarts.push({ state: audioContext.state, at: Date.now() });
          const previousOnEnd = source.onended;
          source.onended = (event) => {
            audio.sourceEnds.push({ state: audioContext.state, at: Date.now() });
            previousOnEnd?.call(source, event);
          };
          return originalStart(...startArgs);
        };
        return source;
      };
      return audioContext;
    };
    WrappedAudioContext.prototype = OriginalAudioContext.prototype;
    window.AudioContext = WrappedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAudioContext;
  }
  const speech = window.speechSynthesis;
  if (speech) {
    const originalSpeak = speech.speak.bind(speech);
    speech.speak = (utterance) => {
      utterances.push({
        text: utterance.text,
        lang: utterance.lang,
        rate: utterance.rate,
        volume: utterance.volume,
        at: Date.now(),
      });
      return originalSpeak(utterance);
    };
  }
  window.__tapTranslationDiag = () => ({
    utterances: [...utterances],
    audio: JSON.parse(JSON.stringify(audio)),
  });
}, outputLanguage);

page.on("console", (message) => {
  const text = message.text();
  if (/TTS|translat|speech|audio/i.test(text)) {
    report.console.push(`[${message.type()}] ${text}`);
  }
});
page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("request", (request) => {
  const url = request.url();
  if (
    request.method() !== "POST" ||
    !/translat|\/tts\/|aacSpeak|speech/i.test(url)
  ) {
    return;
  }
  let body = request.postData();
  try {
    body = body ? JSON.parse(body) : null;
  } catch {
    // Keep the raw body.
  }
  const entry = {
    url,
    method: request.method(),
    body,
    at: Date.now(),
    status: null,
    failure: null,
    responseHeaders: null,
    responseBody: null,
  };
  report.network.push(entry);
  requestEntries.set(request, entry);
});
page.on("requestfailed", (request) => {
  const entry = requestEntries.get(request);
  if (entry) entry.failure = request.failure()?.errorText || "request failed";
});
page.on("response", async (response) => {
  const entry = requestEntries.get(response.request());
  if (!entry) return;
  entry.status = response.status();
  entry.responseHeaders = {
    contentType: response.headers()["content-type"] || null,
    contentLength: response.headers()["content-length"] || null,
    backend: response.headers()["x-tts-backend"] || null,
    voice: response.headers()["x-tts-voice"] || null,
  };
  try {
    const contentType = response.headers()["content-type"] || "";
    if (/json|text/.test(contentType)) {
      entry.responseBody = (await response.text()).slice(0, 2000);
    }
  } catch {
    entry.responseBody = "<unavailable>";
  }
});

try {
  const response = await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  report.documentStatus = response?.status() || null;
  await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
  await page.waitForTimeout(1500);

  report.storedSettings = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("prism-aac-settings") || "null");
    } catch {
      return null;
    }
  });

  const tapKeyboardText = async (value) => {
    for (const character of value.toUpperCase()) {
      if (character === " ") {
        await page.locator('button[data-key="SPACE"]').first().click({ delay: 50 });
      } else {
        await page
          .locator(`button[data-key="${character}"]`)
          .first()
          .click({ delay: 50 });
      }
    }
    const tapped = { text: value, ariaLabel: "keyboard input" };
    report.tappedTile = tapped;
    report.tappedTiles.push(tapped);
  };

  const tapPrediction = async (value) => {
    const predictionTiles = page.locator('[data-testid="prediction-bar"] button');
    await predictionTiles.first().waitFor({ state: "visible", timeout: 10_000 });
    report.predictionTitles = await predictionTiles.evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: (button.textContent || "").trim(),
        title: button.getAttribute("title"),
        ariaLabel: button.getAttribute("aria-label"),
      })),
    );
    const matchingIndex = report.predictionTitles.findIndex(
      (prediction) =>
        prediction.title?.toLowerCase() === value.toLowerCase() ||
        prediction.ariaLabel?.toLowerCase() === `predict: ${value}`.toLowerCase(),
    );
    if (matchingIndex < 0) {
      throw new Error(
        `Prediction "${value}" was not available: ${JSON.stringify(report.predictionTitles)}`,
      );
    }
    const predictionTile = predictionTiles.nth(matchingIndex);
    await predictionTile.waitFor({ state: "visible", timeout: 10_000 });
    const tapped = {
      text: (await predictionTile.innerText()).trim(),
      ariaLabel: await predictionTile.getAttribute("aria-label"),
    };
    report.tappedTile = tapped;
    report.tappedTiles.push(tapped);
    await predictionTile.click({ delay: 50 });
  };

  const recordStep = async (label) => {
    const browserDiag = await page.evaluate(() => window.__tapTranslationDiag?.());
    const messageText = (
      await page
        .locator('[data-scan-group="message-bar"] [role="status"]')
        .innerText()
    ).trim();
    report.stepSnapshots.push({
      label,
      at: Date.now(),
      messageText,
      speechUtterances: browserDiag?.utterances || [],
      network: report.network.map((entry) => ({
        body: entry.body,
        status: entry.status,
        at: entry.at,
      })),
    });
  };

  if (inputMode === "prediction-sequence") {
    for (const value of predictionSequence) {
      await tapPrediction(value);
      await page.waitForTimeout(sequenceDelayMs);
      await recordStep(`after-prediction-${value}`);
    }
    if (pressPlay) {
      report.playClickedAt = Date.now();
      await page.locator("button.aac-speak").first().click({ delay: 50 });
      await page.waitForTimeout(500);
      await recordStep("after-play");
    }
  } else if (inputMode === "keyboard") {
    await tapKeyboardText(inputText);
  } else if (inputMode === "keyboard-prediction") {
    await tapKeyboardText(inputText);
    await page.waitForTimeout(500);
    await recordStep("after-keyboard");
    await tapPrediction(secondInputText);
    await page.waitForTimeout(500);
    await recordStep("after-prediction");
    if (pressPlay) {
      report.playClickedAt = Date.now();
      await page.locator("button.aac-speak").first().click({ delay: 50 });
      await page.waitForTimeout(500);
      await recordStep("after-play");
    }
  } else {
    await tapPrediction(inputText);
  }
  report.inputCompletedAt = Date.now();
  await page.waitForTimeout(8000);

  report.messageText = (
    await page
      .locator('[data-scan-group="message-bar"] [role="status"]')
      .innerText()
  ).trim();
  const browserDiag = await page.evaluate(() => window.__tapTranslationDiag?.());
  report.speechUtterances = browserDiag?.utterances || [];
  report.audio = browserDiag?.audio || null;
  report.relevantButtons = await page.locator("button").evaluateAll((buttons) =>
    buttons
      .map((button) => ({
        text: (button.textContent || "").trim(),
        ariaLabel: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
      }))
      .filter((button) =>
        /play|speak|translat|hello|hola|^i$/i.test(
          `${button.text} ${button.ariaLabel || ""} ${button.title || ""}`,
        ),
      ),
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
} catch (error) {
  report.error = error instanceof Error ? error.stack || error.message : String(error);
}

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  report.error ||
  report.documentStatus !== 200 ||
  report.pageErrors.length > 0 ||
  report.speechUtterances.length > 0 ||
  report.storedSettings?.state?.language !== "en" ||
  report.storedSettings?.state?.outputLanguage !== outputLanguage ||
  report.tappedTiles.some((tile, index) =>
    predictionSequence[index]
    && tile.text.trim().toLowerCase() !== predictionSequence[index].toLowerCase()
  ) ||
  (pressPlay && report.audio?.sourceStarts?.filter(
    (start) => start.at >= report.playClickedAt,
  ).length !== 1)
) {
  process.exitCode = 1;
}
