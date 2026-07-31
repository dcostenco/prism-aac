/**
 * Multilingual AAC acceptance on the primary 1024x768 iPad landscape form.
 *
 * The two input modes are intentional and mutually exclusive:
 *   - Typing: message + predictions + one complete keyboard
 *   - Picture: message + predictions + one complete picture board
 *
 * Every shipped locale receives a mechanical Typing-mode pass. Arabic and
 * all three user-visible Chinese variants additionally receive inspected
 * Picture/Typing artifacts because they exercise RTL and native IME paths.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  LANG_META,
  getTTSCode,
  isRTL,
  type SupportedLanguage,
} from '../engine/i18n';
import {
  getLetterRows,
  getPredictionsForLanguage,
  usesNativeImeKeyboard,
} from '../constants/keyboardLayouts';

test.use({ serviceWorkers: 'block' });

const ARTIFACT_DIR = process.env.AAC_LABEL_ARTIFACT_DIR
  ?? path.resolve('test-results', 'aac-multilingual-label-integrity');

const VISUAL_LANGUAGES: SupportedLanguage[] = ['ar', 'zh-Hans', 'zh-Hant', 'zh-HK'];
const IPAD_STAGE_PROJECTS = new Set(['ipad-7', 'ipad-7-land', 'ipad-13', 'ipad-13-land']);

async function installBootstrap(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const params = new URLSearchParams(location.search);
    const language = params.get('__aacLang') || 'en';
    const mode = params.get('__aacMode') === 'picture' ? 'picture' : 'typing';
    const theme = params.get('__aacTheme') === 'dark' ? 'dark' : 'light';

    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', mode === 'typing' ? 'true' : 'false');
    localStorage.setItem('prism-kb-max', mode === 'typing' ? 'true' : 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: {
        language,
        outputLanguage: language,
        theme,
        gridSize: 12,
        aiAutocorrectEnabled: false,
        cloudPredictionEnabled: false,
        cameraInputEnabled: false,
        headTrackingEnabled: false,
        showHandCalibration: false,
        visionContextEnabled: false,
        speechRate: 0.5,
        speechVolume: 1,
      },
      version: 20,
    }));
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: {
        text: '',
        autoSpeak: false,
        soundEnabled: false,
        activeTone: 'friendly',
        toneMode: 'auto',
      },
      version: 3,
    }));
  });
}

async function goToLanguage(
  page: Page,
  language: SupportedLanguage,
  mode: 'typing' | 'picture' = 'typing',
  theme: 'light' | 'dark' = 'light',
): Promise<void> {
  const query = new URLSearchParams({
    __aacLang: language,
    __aacMode: mode,
    __aacTheme: theme,
  });
  await page.goto(`/prism-aac?${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('prediction-bar')).toBeVisible({ timeout: 20_000 });
  const board = page.getByRole('region', { name: /home vocabulary board/i });
  await expect(board).toHaveAttribute('data-aac-mode', mode);
  if (mode === 'typing') {
    await expect(page.getByTestId('keyboard-shell')).toBeVisible();
    await expect(page.getByTestId('picture-board')).toHaveCount(0);
  } else {
    await expect(page.getByTestId('keyboard-shell')).toHaveCount(0);
    await expect(page.getByTestId('picture-board')).toBeVisible();
  }
}

async function proxyArasaacForLocalWebKit(page: Page): Promise<void> {
  if (process.env.AAC_E2E_PROXY_ARASAAC !== '1') return;
  await page.route(/^https:\/\/(api|static)\.arasaac\.org\//, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*' },
    });
  });
}

async function expectLoadedImages(page: Page, tileSelector: string, minimum: number): Promise<void> {
  await expect.poll(async () => page.evaluate(({ selector }) => (
    [...document.querySelectorAll(selector)].filter((tile) => {
      const image = tile.querySelector<HTMLImageElement>('img');
      if (!image || !image.complete || image.naturalWidth <= 0) return false;
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).length
  ), { selector: tileSelector }), { timeout: 20_000 }).toBeGreaterThanOrEqual(minimum);
}

async function expectUnobscuredLabels(page: Page, selector: string, minimum: number): Promise<void> {
  await expect.poll(async () => page.evaluate(({ labelSelector }) => (
    [...document.querySelectorAll(labelSelector)].filter((label) => {
      const rect = label.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.bottom > innerHeight) return false;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === label || (hit instanceof Element && label.contains(hit));
    }).length
  ), { labelSelector: selector }), { timeout: 10_000 }).toBeGreaterThanOrEqual(minimum);
}

async function collectGeometry(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const boxes = (selector: string) => [...document.querySelectorAll(selector)]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      direction: document.querySelector('.h-svh')?.getAttribute('dir') ?? null,
      mode: document.querySelector('[data-aac-mode]')?.getAttribute('data-aac-mode') ?? null,
      predictions: boxes('[data-testid="prediction-tile"]'),
      phrases: boxes('[data-testid="phrase-tile-card"]'),
      categories: boxes('[data-testid="category-tile"]'),
      keyboardShell: boxes('[data-testid="keyboard-shell"]'),
      keys: boxes('[data-scan-group="keyboard"] button'),
      nativeComposer: boxes('[data-testid="native-ime-composer"]'),
    };
  });
}

async function safeArtifact(page: Page, stem: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  await expect(page.getByText(/internal server error/i)).toHaveCount(0);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const geometry = await collectGeometry(page);
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${stem}.json`), `${JSON.stringify(geometry, null, 2)}\n`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, `${stem}.png`), fullPage: false });
}

async function expectPredictionLabelReadability(
  page: Page,
  language: SupportedLanguage,
): Promise<void> {
  const labels = page.getByTestId('prediction-label');
  await expect(labels).toHaveCount(5);
  const colors = await labels.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      background: style.backgroundColor,
      fontSize: Number.parseFloat(style.fontSize),
    };
  }));
  for (const style of colors) {
    expect(style.color).toBe('rgb(0, 0, 0)');
    expect(style.background).toBe('rgb(255, 255, 255)');
    expect(style.fontSize, `${language}: prediction label font size`).toBeGreaterThanOrEqual(30);
  }
}

async function expectPredictionContract(page: Page, language: SupportedLanguage): Promise<void> {
  const labels = page.getByTestId('prediction-label');
  const expected = getPredictionsForLanguage(language);
  await expectPredictionLabelReadability(page, language);
  await expect(labels).toHaveText(expected);
}

async function beginImeComposition(page: Page, draft: string): Promise<void> {
  await page.getByTestId('native-ime-composer').evaluate((node, provisional) => {
    const composer = node as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('textarea value setter unavailable');
    composer.dispatchEvent(new CompositionEvent('compositionstart', {
      bubbles: true,
      data: '',
    }));
    setter.call(composer, provisional);
    composer.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: provisional,
      inputType: 'insertCompositionText',
      isComposing: true,
    }));
  }, draft);
}

async function endImeComposition(page: Page, committed: string, cancelled = false): Promise<void> {
  await page.getByTestId('native-ime-composer').evaluate((node, result) => {
    const composer = node as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('textarea value setter unavailable');
    if (!result.cancelled) setter.call(composer, result.committed);
    composer.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: result.cancelled ? '' : result.committed,
    }));
    if (!result.cancelled) {
      // iOS WebKit may follow compositionend with a final non-composing input.
      // Replaying it here verifies the candidate is not committed twice.
      composer.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: result.committed,
        inputType: 'insertText',
        isComposing: false,
      }));
    }
  }, { committed, cancelled });
}

test('prediction labels remain black on white in Dark mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-7-land', 'primary iPad Mini landscape acceptance');
  await installBootstrap(page);
  await page.route(/^https:\/\/(api|static)\.arasaac\.org\//, (route) => route.abort());
  await goToLanguage(page, 'en', 'typing', 'dark');
  await expect(page.locator('.dark')).toHaveCount(1);
  await expectPredictionContract(page, 'en');
});

function minimumCharacterFontFor(language: SupportedLanguage, projectName: string): number {
  if (language === 'am') {
    if (projectName === 'ipad-7') return 36;
    if (projectName === 'ipad-7-land') return 50;
    if (projectName === 'ipad-13') return 51;
    return 73;
  }
  return projectName === 'ipad-7' ? 46 : 56;
}

async function expectUsableTypingSurface(
  page: Page,
  language: SupportedLanguage,
  projectName: string,
): Promise<void> {
  await goToLanguage(page, language, 'typing');
  await expectPredictionContract(page, language);
  await expect(page.locator('.h-svh').first()).toHaveAttribute('dir', isRTL(language) ? 'rtl' : 'ltr');
  await expect(page.getByTestId('keyboard-shell')).toHaveCount(1);

  if (usesNativeImeKeyboard(language)) {
    const composer = page.getByTestId('native-ime-composer');
    await expect(composer).toHaveCount(1);
    await expect(composer).toHaveAttribute('lang', getTTSCode(language));
    await expect(page.locator('[data-scan-group="keyboard"] button[data-key]')).toHaveCount(0);
    const committed = getPredictionsForLanguage(language).slice(0, 2).join('');
    await composer.fill(committed);
    await expect(page.locator('[data-scan-group="message-bar"] [role="status"]'))
      .toContainText(committed);
    return;
  }

  await expect(page.getByTestId('native-ime-composer')).toHaveCount(0);
  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="keyboard-shell"]')?.getBoundingClientRect();
    const keys = [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] button')];
    const rects = keys.map((key) => ({ rect: key.getBoundingClientRect(), font: Number.parseFloat(getComputedStyle(key).fontSize) }));
    const characterKeys = [...document.querySelectorAll<HTMLElement>('[data-scan-group="keyboard"] button[data-key]')];
    return {
      shellHeight: shell?.height ?? 0,
      minimumHeight: Math.min(...rects.map(({ rect }) => rect.height)),
      minimumFont: Math.min(...rects.map(({ font }) => font)),
      minimumCharacterFont: Math.min(...characterKeys.map((key) => Number.parseFloat(getComputedStyle(key).fontSize))),
      overflowKeys: characterKeys.filter((key) => (
        key.scrollWidth > key.clientWidth || key.scrollHeight > key.clientHeight
      )).map((key) => ({
        key: key.dataset.key,
        display: key.dataset.display,
        clientWidth: key.clientWidth,
        scrollWidth: key.scrollWidth,
        clientHeight: key.clientHeight,
        scrollHeight: key.scrollHeight,
        fontSize: Number.parseFloat(getComputedStyle(key).fontSize),
      })),
      outOfBounds: rects.filter(({ rect }) => (
        rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight
      )).length,
    };
  });
  expect(metrics.shellHeight, `${language}: keyboard shell`).toBeGreaterThanOrEqual(310);
  expect(metrics.minimumHeight, `${language}: smallest key`).toBeGreaterThanOrEqual(48);
  expect(metrics.minimumFont, `${language}: smallest glyph`).toBeGreaterThanOrEqual(14);
  expect(metrics.minimumCharacterFont, `${language}: character glyph`)
    .toBeGreaterThanOrEqual(minimumCharacterFontFor(language, projectName));
  expect(metrics.overflowKeys, `${language}: clipped character glyphs`).toEqual([]);
  expect(metrics.outOfBounds, `${language}: clipped keys`).toBe(0);

  for (const selector of ['[data-action="backspace"]', '[data-action="mode"]', '[data-action="space"]', '.aac-speak']) {
    await expect(page.locator(`[data-scan-group="keyboard"] ${selector}`).first(), `${language}: ${selector}`).toBeVisible();
  }

  const firstLetter = getLetterRows(language).flat().find((key) => /\p{L}/u.test(key));
  expect(firstLetter, `${language}: no typable letter`).toBeTruthy();
  const key = page.locator(`[data-scan-group="keyboard"] button[data-key="${firstLetter}"]`).first();
  const display = await key.getAttribute('data-display');
  await key.click();
  await expect(page.locator('[data-scan-group="message-bar"] [role="status"]'))
    .toContainText(display || firstLetter!);

  if (isRTL(language)) {
    const firstRow = getLetterRows(language)[0];
    const authoredFirst = page.locator(`button[data-key="${firstRow[0]}"]`).first();
    const authoredLast = page.locator(`button[data-key="${firstRow[firstRow.length - 1]}"]`).first();
    const [firstBox, lastBox] = await Promise.all([authoredFirst.boundingBox(), authoredLast.boundingBox()]);
    expect(firstBox?.x, `${language}: authored first key`).toBeGreaterThan(lastBox?.x ?? Number.POSITIVE_INFINITY);
  }
}

// A fresh Playwright context per locale prevents WebKit navigation caches from
// accumulating across the full language matrix and tripping the RAM watchdog.
for (const { code: language } of LANG_META) {
  test(`${language} keeps one complete usable Typing surface`, async ({ page }, testInfo) => {
    test.skip(!IPAD_STAGE_PROJECTS.has(testInfo.project.name), 'first-stage iPad acceptance matrix');
    await installBootstrap(page);
    await page.route(/^https:\/\/(api|static)\.arasaac\.org\//, (route) => route.abort());
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await expectUsableTypingSurface(page, language, testInfo.project.name);
    expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });
}

test('Hong Kong picker names the shipped written corpus accurately', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-7-land', 'primary iPad Mini landscape acceptance');
  await installBootstrap(page);
  await proxyArasaacForLocalWebKit(page);
  await goToLanguage(page, 'en', 'typing');
  await expectLoadedImages(page, '[data-testid="prediction-tile"]', 3);

  await page.getByTestId('language-button-input').click();
  const hongKong = page.getByTestId('language-option-zh-HK');
  await expect(hongKong).toBeVisible();
  await expect(hongKong).toContainText('繁體中文（香港）');
  await expect(hongKong).not.toContainText('廣東話');
  await expectPredictionLabelReadability(page, 'en');
  await safeArtifact(page, `zh-HK-language-picker-${testInfo.project.name}`);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('iOS-style Chinese composition commits once and cancellation never leaks pinyin', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-7-land', 'primary iPad Mini landscape acceptance');
  await installBootstrap(page);
  await proxyArasaacForLocalWebKit(page);
  await goToLanguage(page, 'zh-HK', 'typing');
  await expectLoadedImages(page, '[data-testid="prediction-tile"]', 3);

  const composer = page.getByTestId('native-ime-composer');
  const message = page.locator('[data-scan-group="message-bar"] [role="status"]');
  const backspace = page.locator('[data-testid="native-ime-keyboard"] [data-action="backspace"]');
  const speak = page.locator('[data-testid="native-ime-keyboard"] .aac-speak');

  await beginImeComposition(page, 'bang');
  await expect(message).toHaveText('');
  await expect(backspace).toBeDisabled();
  await expect(speak).toBeDisabled();

  await endImeComposition(page, '幫');
  await expect(message).toHaveText('幫');
  await expect(composer).toHaveValue('幫');
  await expect(backspace).toBeEnabled();
  await expect(speak).toBeEnabled();

  await beginImeComposition(page, '幫bang');
  await expect(message).toHaveText('幫');
  await endImeComposition(page, '', true);
  await composer.blur();
  await expect(message).toHaveText('幫');
  await expect(composer).toHaveValue('幫');
  await expectPredictionLabelReadability(page, 'zh-HK');
  await safeArtifact(page, `zh-HK-ime-lifecycle-${testInfo.project.name}`);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

for (const language of VISUAL_LANGUAGES) {
  test(`${language} has inspected Typing and Picture mode evidence`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'ipad-7-land', 'primary iPad Mini landscape acceptance');
    test.setTimeout(60_000);
    await proxyArasaacForLocalWebKit(page);
    await installBootstrap(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await goToLanguage(page, language, 'typing');
    await expectPredictionContract(page, language);
    await expectLoadedImages(page, '[data-testid="prediction-tile"]', 3);

    if (usesNativeImeKeyboard(language)) {
      const composer = page.getByTestId('native-ime-composer');
      await expect(composer).toHaveAttribute('lang', getTTSCode(language));
      await expect(page.locator('[data-scan-group="keyboard"] button[data-key]')).toHaveCount(0);
      const committed = getPredictionsForLanguage(language).slice(0, 2).join('');
      await composer.fill(committed);
      await expect(page.locator('[data-scan-group="message-bar"] [role="status"]'))
        .toContainText(committed);
    } else {
      await expect(page.locator('.h-svh').first()).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('button[data-key="؟"]')).toBeVisible();
    }

    await expectPredictionLabelReadability(page, language);
    await expectUnobscuredLabels(page, '[data-testid="prediction-label"]', 5);
    await safeArtifact(page, `${language}-typing-${testInfo.project.name}`);

    await page.getByTestId('kb-cycle-btn').click();
    const board = page.getByRole('region', { name: /home vocabulary board/i });
    await expect(board).toHaveAttribute('data-aac-mode', 'picture');
    await expect(page.getByTestId('keyboard-shell')).toHaveCount(0);
    await expect(page.getByTestId('picture-board')).toBeVisible();
    await expectLoadedImages(page, '[data-testid="phrase-tile-card"]', 4);
    await expectUnobscuredLabels(page, '[data-testid="phrase-tile-label"]', 4);
    await safeArtifact(page, `${language}-picture-${testInfo.project.name}`);

    // The lazy pictogram loader can leave off-screen ARASAAC searches in
    // flight after the visible acceptance images are complete. Detach the
    // test-only CORS proxy before Playwright closes the context so those
    // irrelevant requests cannot turn a visually complete case into a
    // teardown failure.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });
}
