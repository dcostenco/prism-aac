/**
 * Multi-language TTS diagnostic.
 *
 * Verifies that persisted language state reaches the primary public TTS
 * endpoint with the expected lang/rate/text, that exactly one primary request
 * is sent for one explicit Speak press, and that the returned bytes decode as
 * audio. Any failed invariant exits non-zero.
 *
 * Run only through scripts/playwright-watchdog.sh --exec.
 */
import { webkit } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_URL =
  process.env.TARGET_URL ||
  process.env.BASE_URL ||
  'https://prism-aac.vercel.app/prism-aac';
const REPORT_PATH =
  process.env.TTS_REPORT_PATH || '/tmp/multilang-results.json';
const VERIFY_SERVER_AUDIO = process.env.VERIFY_SERVER_AUDIO !== '0';
const VERCEL_PROTECTION_BYPASS =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const ALL_LANGS = [
  { code: 'en', locale: 'en-US', native: 'English', expectLang: /^en/, phrase: 'HELLO' },
  { code: 'ro', locale: 'ro-RO', native: 'Română', expectLang: /^ro/, phrase: 'BUNA' },
  { code: 'es', locale: 'es-ES', native: 'Español', expectLang: /^es/, phrase: 'HOLA' },
  { code: 'fr', locale: 'fr-FR', native: 'Français', expectLang: /^fr/, phrase: 'BONJOUR' },
];
const requestedCodes = new Set(
  (process.env.TTS_LANGS || ALL_LANGS.map((language) => language.code).join(','))
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean),
);
const LANGS = ALL_LANGS.filter((language) => requestedCodes.has(language.code));
if (LANGS.length === 0) {
  throw new Error(
    `TTS_LANGS did not match a diagnostic locale: ${[...requestedCodes].join(',')}`,
  );
}

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
const targetOrigin = new URL(TARGET_URL).origin;
const runs = [];
const results = [];

function isPrimaryTtsRequest(request) {
  if (request.method() !== 'POST') return false;
  return /\/api\/v1\/tts\/public$/.test(new URL(request.url()).pathname);
}

for (const language of LANGS) {
  console.log(`\n=== ${language.native} (${language.code}) ===`);
  const run = {
    lang: language.code,
    native: language.native,
    storedLanguage: null,
    storedOutputLanguage: null,
    composedTextLength: 0,
    documentStatus: null,
    error: null,
  };
  runs.push(run);

  // Launch per locale so WebKit releases all memory before the next language.
  const browser = await webkit.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: language.locale,
    });
    if (
      VERCEL_PROTECTION_BYPASS &&
      new URL(TARGET_URL).hostname.endsWith('.vercel.app')
    ) {
      const authorizationResponse = await context.request.get(TARGET_URL, {
        headers: {
          'x-vercel-protection-bypass': VERCEL_PROTECTION_BYPASS,
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
    const captured = [];
    const capturedByRequest = new Map();

    await page.addInitScript((langCode) => {
      try {
        localStorage.setItem(
          'prism-aac-settings',
          JSON.stringify({
            state: {
              language: langCode,
              outputLanguage: langCode,
              speechRate: 1,
              speechVolume: 1,
            },
            version: 18,
          }),
        );
        sessionStorage.setItem('prism-greeting-dismissed', '1');
      } catch {
        // Persisted-state assertions below fail loud if storage is unavailable.
      }
    }, language.code);

    page.on('request', (request) => {
      if (!isPrimaryTtsRequest(request)) return;
      let body = null;
      try {
        body = JSON.parse(request.postData() || 'null');
      } catch {
        body = null;
      }
      const entry = {
        lang: language.code,
        requestUrl: request.url(),
        status: null,
        body,
        audioVerified: null,
        audioDurationSeconds: null,
        audioBytes: null,
        audioError: null,
      };
      captured.push(entry);
      capturedByRequest.set(request, entry);
    });
    page.on('response', (response) => {
      const entry = capturedByRequest.get(response.request());
      if (entry) entry.status = response.status();
    });

    const documentResponse = await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    run.documentStatus = documentResponse?.status() || null;
    await page.waitForSelector('button[data-key="Q"]', { timeout: 20_000 });
    await page.waitForTimeout(800);

    const stored = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('prism-aac-settings') || 'null');
      } catch {
        return null;
      }
    });
    run.storedLanguage = stored?.state?.language ?? null;
    run.storedOutputLanguage = stored?.state?.outputLanguage ?? null;

    const ascii = language.phrase.toUpperCase().replace(/[^A-Z]/g, '');
    for (const character of ascii) {
      await page.locator(`button[data-key="${character}"]`).first().click({
        delay: 30,
      });
    }
    run.composedTextLength = (
      await page.locator('[data-scan-group="message-bar"] [role="status"]').innerText()
    ).trim().length;

    const primaryResponse = page.waitForResponse(
      (response) => isPrimaryTtsRequest(response.request()),
      { timeout: 20_000 },
    );
    await page.locator('button.aac-speak').first().click({ delay: 50 });
    await primaryResponse;
    await page.waitForTimeout(250);

    results.push(...captured);
    console.log(
      `  primary_posts=${captured.length} status=${captured.map((entry) => entry.status).join(',') || 'none'}`,
    );
    await context.close();
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
    console.error(`  browser diagnostic failed: ${run.error}`);
  } finally {
    await browser.close();
  }
}

if (VERIFY_SERVER_AUDIO) {
  console.log('\n=== Verifying server-side audio bytes ===');
  for (const result of results) {
    result.audioVerified = false;
    if (!result.body?.text) {
      result.audioError = 'request body has no text';
      continue;
    }
    const audioPath = path.join(
      path.dirname(REPORT_PATH),
      `multilang-${result.lang}.mp3`,
    );
    try {
      const audioRequestUrl =
        process.env.TTS_API_URL || result.requestUrl;
      const curlArgs = [
        '--fail-with-body',
        '--show-error',
        '--silent',
        '--output', audioPath,
        '--request', 'POST',
        audioRequestUrl,
        '--header', `Origin: ${targetOrigin}`,
        '--header', 'Content-Type: application/json',
        '--data-raw', JSON.stringify(result.body),
      ];
      let curlInput;
      const audioUrl = new URL(audioRequestUrl);
      if (
        VERCEL_PROTECTION_BYPASS &&
        audioUrl.origin === targetOrigin &&
        audioUrl.hostname.endsWith('.vercel.app')
      ) {
        if (/[\r\n]/.test(VERCEL_PROTECTION_BYPASS)) {
          throw new Error('Vercel preview bypass contains an invalid newline');
        }
        const escapedBypass = VERCEL_PROTECTION_BYPASS
          .replaceAll('\\', '\\\\')
          .replaceAll('"', '\\"');
        curlArgs.unshift('--config', '-');
        curlInput =
          `header = "x-vercel-protection-bypass: ${escapedBypass}"\n`;
      }
      execFileSync(
        'curl',
        curlArgs,
        {
          input: curlInput,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      const info = execFileSync('afinfo', [audioPath], { encoding: 'utf8' });
      const duration = Number(
        info.match(/estimated duration:\s*([\d.]+)/)?.[1] || 0,
      );
      const bytes = Number(info.match(/audio bytes:\s*(\d+)/)?.[1] || 0);
      result.audioDurationSeconds = duration;
      result.audioBytes = bytes;
      result.audioVerified = duration > 0 && bytes > 0;
      if (!result.audioVerified) {
        result.audioError = 'afinfo reported no decodable audio';
      }
      console.log(
        `  ${result.lang}: duration=${duration}s bytes=${bytes} verified=${result.audioVerified}`,
      );
    } catch (error) {
      result.audioError = error instanceof Error ? error.message : String(error);
      console.error(`  ${result.lang}: audio verification failed`);
    }
  }
}

console.log('\n=== VERDICT ===');
let failed = false;
for (const language of LANGS) {
  const run = runs.find((candidate) => candidate.lang === language.code);
  const requests = results.filter((result) => result.lang === language.code);
  const request = requests[0];
  const actualLang =
    request?.body?.lang ||
    request?.body?.ssml?.match?.(/xml:lang="([^"]+)"/)?.[1] ||
    '';
  const actualRate = Number(request?.body?.rate);
  const checks = {
    browserRun: !run?.error,
    document200: run?.documentStatus === 200,
    persistedLanguage:
      run?.storedLanguage === language.code &&
      run?.storedOutputLanguage === language.code,
    composedMessage: (run?.composedTextLength || 0) > 0,
    exactlyOnePrimaryPost: requests.length === 1,
    primary200: request?.status === 200,
    correctLanguage: language.expectLang.test(String(actualLang)),
    saneRate: Number.isFinite(actualRate) && actualRate >= 0.5 && actualRate <= 1.5,
    nonEmptyText: typeof request?.body?.text === 'string' && request.body.text.length > 0,
    decodableAudio: !VERIFY_SERVER_AUDIO || request?.audioVerified === true,
  };
  const pass = Object.values(checks).every(Boolean);
  if (!pass) failed = true;
  run.checks = checks;
  run.pass = pass;
  console.log(
    `  ${language.code} ${language.native}: ${pass ? 'PASS' : 'FAIL'} ` +
      `lang=${actualLang || 'none'} rate=${Number.isFinite(actualRate) ? actualRate : 'none'} ` +
      `posts=${requests.length}`,
  );
}

const safeReport = {
  target: TARGET_URL,
  verifyServerAudio: VERIFY_SERVER_AUDIO,
  runs,
  requests: results.map((result) => ({
    lang: result.lang,
    requestUrl: result.requestUrl,
    status: result.status,
    requestLang: result.body?.lang ?? null,
    requestRate: result.body?.rate ?? null,
    textLength:
      typeof result.body?.text === 'string' ? result.body.text.length : 0,
    audioVerified: result.audioVerified,
    audioDurationSeconds: result.audioDurationSeconds,
    audioBytes: result.audioBytes,
    audioError: result.audioError,
  })),
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(safeReport, null, 2));
console.log(`report=${REPORT_PATH}`);
if (failed) process.exitCode = 1;
