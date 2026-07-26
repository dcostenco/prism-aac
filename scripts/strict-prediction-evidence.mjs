/**
 * Strict deployed prediction-TTS evidence.
 *
 * A screenshot cannot prove which speech path ran. This diagnostic couples
 * each screenshot with tap-by-tap DOM state, Web Speech lifecycle calls,
 * active timer ownership, service-worker state, and TTS network requests.
 *
 * Run only through scripts/playwright-watchdog.sh --exec.
 */
import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const targets = (process.env.TARGETS ||
  'https://prism-aac.vercel.app/prism-aac,https://synalux.ai/prism-aac')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const captureScreenshots = process.env.CAPTURE_SCREENSHOTS !== '0';
const browserName = process.env.BROWSER_NAME === 'chromium' ? 'chromium' : 'webkit';
const expectServiceWorker = process.env.EXPECT_SERVICE_WORKER === '1';
const vercelProtectionBypass =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const outputDirectory =
  process.env.EVIDENCE_DIR || `/tmp/prism-aac-strict-${Date.now()}`;
const scenarios = [
  { name: 'fresh-en', language: 'en', controlledRevisit: false },
  { name: 'persisted-ro-sw', language: 'ro', controlledRevisit: true },
];

fs.mkdirSync(outputDirectory, { recursive: true });
const browser = await (browserName === 'chromium' ? chromium : webkit).launch({
  headless: true,
});
const results = [];

for (const target of targets) {
  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: scenario.language === 'ro' ? 'ro-RO' : 'en-US',
    });
    if (
      vercelProtectionBypass &&
      new URL(target).hostname.endsWith('.vercel.app')
    ) {
      const authorizationResponse = await context.request.get(target, {
        headers: {
          'x-vercel-protection-bypass': vercelProtectionBypass,
          'x-vercel-set-bypass-cookie': 'true',
        },
      });
      if (!authorizationResponse.ok()) {
        throw new Error(
          `Preview authorization failed with ${authorizationResponse.status()}`,
        );
      }
    }
    const page = await context.newPage();
    const pageErrors = [];
    const requestFailures = [];
    const ttsRequests = [];
    const pictogramRequests = [];
    const serverErrors = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      requestFailures.push({
        url: request.url(),
        resourceType: request.resourceType(),
        error: request.failure()?.errorText || 'unknown',
      });
    });
    page.on('request', (request) => {
      const url = request.url();
      if (
        request.method() === 'POST' &&
        (/\/tts(?:\/|$)/i.test(url) || /aacSpeak/i.test(url))
      ) {
        let body = null;
        try {
          body = JSON.parse(request.postData() || 'null');
        } catch {
          body = request.postData();
        }
        ttsRequests.push({ url, method: request.method(), body });
      }
      if (/arasaac|pictogram/i.test(url)) pictogramRequests.push(url);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        serverErrors.push({ url: response.url(), status: response.status() });
      }
    });

    await page.addInitScript((language) => {
      const win = window;
      const diag = {
        speakCalls: [],
        cancelCalls: 0,
        resumeCalls: 0,
        requestedResumeTimers: 0,
        clearedResumeTimers: 0,
        activeResumeTimers: new Set(),
        staleCancelCallbacks: 0,
        instrumentationErrors: [],
      };
      win.__strictPredictionDiag = diag;

      try {
        localStorage.setItem(
          'prism-aac-settings',
          JSON.stringify({
            state: {
              language,
              outputLanguage: language,
              speechRate: 0.5,
              speechVolume: 0.8,
              theme: 'dark',
            },
            version: 18,
          }),
        );
        sessionStorage.setItem('prism-greeting-dismissed', '1');
      } catch (error) {
        diag.instrumentationErrors.push(`storage: ${String(error)}`);
      }

      const originalSetInterval = win.setInterval.bind(win);
      const originalClearInterval = win.clearInterval.bind(win);
      win.setInterval = ((handler, delay, ...args) => {
        const id = originalSetInterval(handler, delay, ...args);
        if (delay === 10_000) {
          diag.requestedResumeTimers += 1;
          diag.activeResumeTimers.add(id);
        }
        return id;
      });
      win.clearInterval = ((id) => {
        if (diag.activeResumeTimers.delete(id)) {
          diag.clearedResumeTimers += 1;
        }
        return originalClearInterval(id);
      });

      try {
        const nativeSynth = win.speechSynthesis;
        let activeUtterance = null;
        const synth = {
          get pending() { return false; },
          get paused() { return false; },
          get speaking() { return activeUtterance !== null; },
          speak: (utterance) => {
            activeUtterance = utterance;
            diag.speakCalls.push({
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
              volume: utterance.volume,
            });
            queueMicrotask(() => utterance.onstart?.(new Event('start')));
          },
          cancel: () => {
            diag.cancelCalls += 1;
            const cancelled = activeUtterance;
            activeUtterance = null;
            if (cancelled) {
              setTimeout(() => {
                diag.staleCancelCallbacks += 1;
                cancelled.onerror?.({ error: 'canceled' });
              }, 75);
            }
          },
          resume: () => {
            diag.resumeCalls += 1;
          },
          pause: () => {},
          getVoices: () => [],
          addEventListener: (...args) => nativeSynth?.addEventListener?.(...args),
          removeEventListener: (...args) => nativeSynth?.removeEventListener?.(...args),
          dispatchEvent: (...args) => nativeSynth?.dispatchEvent?.(...args) ?? true,
        };
        Object.defineProperty(win, 'speechSynthesis', {
          configurable: true,
          value: synth,
        });
        win.__finishCurrentStrictUtterance = () => {
          const current = activeUtterance;
          activeUtterance = null;
          current?.onend?.(new Event('end'));
        };
      } catch (error) {
        diag.instrumentationErrors.push(`speech: ${String(error)}`);
      }
    }, scenario.language);

    const firstResponse = await page.goto(target, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForSelector('[data-testid="prediction-bar"] button', {
      timeout: 20_000,
    });
    await page.waitForTimeout(800);

    const controllerOnFirstVisit = await page.evaluate(
      () => navigator.serviceWorker?.controller?.scriptURL || null,
    );
    let readyScope = null;
    try {
      readyScope = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return null;
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(() => resolve(null), 5_000)),
        ]);
        return registration?.scope || null;
      });
    } catch {
      readyScope = null;
    }

    if (scenario.controlledRevisit) {
      // Measure the controlled revisit itself. Requests from the registration
      // visit would otherwise look like duplicate work even when the second
      // navigation is served correctly.
      pictogramRequests.length = 0;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('[data-testid="prediction-bar"] button', {
        timeout: 20_000,
      });
      await page.waitForTimeout(800);
    }

    const controllerAtTest = await page.evaluate(
      () => navigator.serviceWorker?.controller?.scriptURL || null,
    );
    const registrationsAtTest = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return [];
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((registration) => ({
        scope: registration.scope,
        active: registration.active?.scriptURL || null,
        waiting: registration.waiting?.scriptURL || null,
        installing: registration.installing?.scriptURL || null,
      }));
    });
    const navigationType = await page.evaluate(
      () => performance.getEntriesByType('navigation')[0]?.type || null,
    );
    const storedSettings = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('prism-aac-settings') || 'null');
      } catch {
        return null;
      }
    });

    const tiles = page.locator('[data-testid="prediction-bar"] button');
    const firstTile = tiles.nth(0);
    const firstWord = await firstTile.getAttribute('title');
    await firstTile.click();
    await page.waitForTimeout(30);
    const afterFirst = (
      await page.locator('[data-scan-group="message-bar"] [role="status"]').innerText()
    ).trim();

    const refreshedTiles = page.locator('[data-testid="prediction-bar"] button');
    const secondTile = refreshedTiles.nth(1);
    const secondWord = await secondTile.getAttribute('title');
    await secondTile.click();
    await page.waitForTimeout(150);
    const afterSecond = (
      await page.locator('[data-scan-group="message-bar"] [role="status"]').innerText()
    ).trim();

    const beforeFinish = await page.evaluate(() => {
      const diag = window.__strictPredictionDiag;
      return {
        speakCalls: diag.speakCalls,
        cancelCalls: diag.cancelCalls,
        resumeCalls: diag.resumeCalls,
        requestedResumeTimers: diag.requestedResumeTimers,
        clearedResumeTimers: diag.clearedResumeTimers,
        activeResumeTimerCount: diag.activeResumeTimers.size,
        staleCancelCallbacks: diag.staleCancelCallbacks,
        instrumentationErrors: diag.instrumentationErrors,
      };
    });
    await page.evaluate(() => window.__finishCurrentStrictUtterance?.());
    await page.waitForTimeout(30);
    const afterFinish = await page.evaluate(() => ({
      activeResumeTimerCount:
        window.__strictPredictionDiag.activeResumeTimers.size,
      clearedResumeTimers:
        window.__strictPredictionDiag.clearedResumeTimers,
    }));

    const layout = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="prediction-bar"]');
      const rect = bar?.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        predictionBar: rect
          ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            }
          : null,
      };
    });

    const safeTarget = new URL(target).hostname.replace(/[^a-z0-9.-]/gi, '_');
    const screenshotPath = path.join(
      outputDirectory,
      `${safeTarget}-${scenario.name}.png`,
    );

    const duplicatePictograms = Object.entries(
      pictogramRequests.reduce((counts, url) => {
        counts[url] = (counts[url] || 0) + 1;
        return counts;
      }, {}),
    )
      .filter(([, count]) => count > 1)
      .map(([url, count]) => ({ url, count }));
    const criticalRequestFailures = requestFailures.filter(
      ({ url, resourceType }) =>
        !/arasaac|pictogram/i.test(url) &&
        ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(
          resourceType,
        ),
    );
    const expectedServiceWorkerScope = new URL('/prism-aac/', target).href;
    const expectedServiceWorkerUrl = new URL('/prism-aac/sw.js', target).href;
    const hasExpectedActiveRegistration = registrationsAtTest.some(
      (registration) =>
        registration.scope === expectedServiceWorkerScope &&
        registration.active !== null &&
        new URL(registration.active).origin === new URL(target).origin &&
        new URL(registration.active).pathname ===
          new URL(expectedServiceWorkerUrl).pathname,
    );
    const expectedLangPrefix = `${scenario.language}-`;
    const messageIncludesBoth =
      Boolean(firstWord) &&
      Boolean(secondWord) &&
      afterSecond.toLocaleLowerCase().includes(firstWord.toLocaleLowerCase()) &&
      afterSecond.toLocaleLowerCase().includes(secondWord.toLocaleLowerCase());
    const assertions = {
      mainDocument200: firstResponse?.status() === 200,
      exactlyTwoLocalUtterances: beforeFinish.speakCalls.length === 2,
      correctLocalLanguage: beforeFinish.speakCalls.every((call) =>
        call.lang.toLowerCase().startsWith(expectedLangPrefix),
      ),
      noCloudTts: ttsRequests.length === 0,
      delayedCancelObserved: beforeFinish.staleCancelCallbacks >= 1,
      currentResumeTimerSurvives:
        beforeFinish.activeResumeTimerCount === 1,
      timerClearsOnEnd: afterFinish.activeResumeTimerCount === 0,
      messageAfterFirst: Boolean(firstWord) &&
        afterFirst.toLocaleLowerCase().includes(firstWord.toLocaleLowerCase()),
      messageAfterSecond: messageIncludesBoth,
      distinctTappedWords:
        Boolean(firstWord) &&
        Boolean(secondWord) &&
        firstWord.toLocaleLowerCase() !== secondWord.toLocaleLowerCase(),
      noInstrumentationErrors:
        beforeFinish.instrumentationErrors.length === 0,
      noPageErrors: pageErrors.length === 0,
      noServerErrors: serverErrors.length === 0,
      noHorizontalOverflow:
        layout.bodyScrollWidth <= layout.viewport.width + 1 &&
        layout.documentScrollWidth <= layout.viewport.width + 1,
      predictionBarRendered:
        Boolean(layout.predictionBar) &&
        layout.predictionBar.width > 0 &&
        layout.predictionBar.height > 0,
      persistedLanguage:
        storedSettings?.state?.language === scenario.language &&
        storedSettings?.state?.outputLanguage === scenario.language,
      revisitNavigation:
        !scenario.controlledRevisit || navigationType === 'reload',
      serviceWorkerReadyScope:
        !scenario.controlledRevisit ||
        !expectServiceWorker ||
        readyScope === expectedServiceWorkerScope,
      controlledBranch:
        !scenario.controlledRevisit ||
        !expectServiceWorker ||
        (controllerAtTest !== null &&
          new URL(controllerAtTest).origin === new URL(target).origin &&
          new URL(controllerAtTest).pathname ===
            new URL(expectedServiceWorkerUrl).pathname &&
          hasExpectedActiveRegistration),
      pictogramRequestBudget: pictogramRequests.length <= 40,
      noDuplicatePictograms: duplicatePictograms.length === 0,
      noCriticalRequestFailures: criticalRequestFailures.length === 0,
    };
    const pass = Object.values(assertions).every(Boolean);
    // A failing run is diagnostic output, not visual evidence. Save PNGs only
    // after every semantic/network/timer assertion passes; every saved image
    // is still inspected manually before it is cited.
    if (captureScreenshots && pass) {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }
    results.push({
      target,
      scenario,
      pass,
      assertions,
      document: {
        status: firstResponse?.status() || null,
        etag: firstResponse?.headers()?.etag || null,
        vercelId: firstResponse?.headers()?.['x-vercel-id'] || null,
        navigationType,
      },
      serviceWorker: {
        controllerOnFirstVisit,
        readyScope,
        controllerAtTest,
        registrationsAtTest,
      },
      taps: { firstWord, secondWord, afterFirst, afterSecond },
      speech: { beforeFinish, afterFinish },
      network: {
        ttsRequests,
        pictogramRequestCount: pictogramRequests.length,
        duplicatePictograms,
        criticalRequestFailures,
        requestFailures,
        serverErrors,
      },
      layout,
      screenshotPath: captureScreenshots && pass ? screenshotPath : null,
      pageErrors,
    });

    console.log(
      `${pass ? 'PASS' : 'FAIL'} ${browserName} ${target} ${scenario.name} ` +
        `speech=${beforeFinish.speakCalls.length} cloud=${ttsRequests.length} ` +
        `timer=${beforeFinish.activeResumeTimerCount}->${afterFinish.activeResumeTimerCount} ` +
        `sw=${Boolean(controllerAtTest)}`,
    );
    await context.close();
  }
}

await browser.close();
const reportPath = path.join(outputDirectory, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`report=${reportPath}`);
if (results.some((result) => !result.pass)) process.exitCode = 1;
