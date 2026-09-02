/**
 * Representative iPhone portrait proof for every authored keyboard family.
 *
 * Latin languages share a layout engine, so one plain and one diacritic
 * layout cover that family. Every distinct script/composition model gets its
 * own case. Chinese intentionally uses the native iOS IME surface: a custom
 * Latin grid cannot provide Pinyin/Zhuyin/Cangjie candidate composition.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { SupportedLanguage } from '@/engine/i18n';
import { buildKeyboardRows, getLetterRows } from '@/constants/keyboardLayouts';

test.use({ serviceWorkers: 'block' });

const ARTIFACT_DIR = process.env.AAC_IPHONE_KEYBOARD_FAMILY_ARTIFACT_DIR
  ?? path.resolve('test-results', 'aac-iphone-keyboard-families');

type CustomFamily = {
  slug: string;
  label: string;
  language: SupportedLanguage;
  kind: 'custom';
  expectedKeyCount: number;
  samples: string[];
  minimumFont: number;
  minimumKeyHeight?: number;
  rtl?: boolean;
};

type NativeFamily = {
  slug: string;
  label: string;
  language: SupportedLanguage;
  kind: 'native-ime';
  rtl?: boolean;
};

const KEYBOARD_FAMILIES: Array<CustomFamily | NativeFamily> = [
  { slug: 'latin-qwerty-en', label: 'Latin QWERTY', language: 'en', kind: 'custom', expectedKeyCount: 26, samples: ['Q', 'A', 'M'], minimumFont: 36 },
  { slug: 'latin-diacritics-ro', label: 'Latin with diacritics', language: 'ro', kind: 'custom', expectedKeyCount: 31, samples: ['Ă', 'Ș', 'Ț'], minimumFont: 36, minimumKeyHeight: 64 },
  { slug: 'latin-dense-tr', label: 'Dense Latin', language: 'tr', kind: 'custom', expectedKeyCount: 32, samples: ['Ğ', 'Ü', 'Ş', 'İ', 'Ö', 'Ç'], minimumFont: 36, minimumKeyHeight: 64 },
  { slug: 'cyrillic-uk', label: 'Cyrillic', language: 'uk', kind: 'custom', expectedKeyCount: 33, samples: ['Й', 'І', 'Ї', 'Ґ'], minimumFont: 32 },
  { slug: 'arabic-ar', label: 'Arabic RTL', language: 'ar', kind: 'custom', expectedKeyCount: 33, samples: ['ض', 'ا', 'ة'], minimumFont: 32, rtl: true },
  { slug: 'hebrew-he', label: 'Hebrew RTL', language: 'he', kind: 'custom', expectedKeyCount: 27, samples: ['ק', 'א', 'ת'], minimumFont: 32, rtl: true },
  { slug: 'devanagari-hi', label: 'Devanagari', language: 'hi', kind: 'custom', expectedKeyCount: 29, samples: ['ौ', 'क', 'म'], minimumFont: 32 },
  { slug: 'bengali-bn', label: 'Bengali', language: 'bn', kind: 'custom', expectedKeyCount: 31, samples: ['ৌ', 'ক', 'ম'], minimumFont: 32 },
  { slug: 'ethiopic-am', label: 'Ethiopic / Ge\'ez', language: 'am', kind: 'custom', expectedKeyCount: 39, samples: ['ሀ', 'ለ', 'ፐ'], minimumFont: 27 },
  { slug: 'kana-ja', label: 'Japanese Kana', language: 'ja', kind: 'custom', expectedKeyCount: 49, samples: ['あ', 'ん', '゛'], minimumFont: 30, minimumKeyHeight: 52 },
  { slug: 'hangul-ko', label: 'Korean Hangul', language: 'ko', kind: 'custom', expectedKeyCount: 26, samples: ['ㅂ', 'ㅇ', 'ㅡ'], minimumFont: 36 },
  { slug: 'chinese-native-zh-hans', label: 'Chinese native IME', language: 'zh-Hans', kind: 'native-ime' },
];

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

async function safeScreenshot(page: Page, fileName: string): Promise<void> {
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception')).toHaveCount(0);
  await expect(page.getByText(/internal server error/i)).toHaveCount(0);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, fileName), fullPage: false });
}

async function expectPredictionPictogramsReady(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => (
    [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')]
      .filter((tile) => {
        const image = tile.querySelector<HTMLImageElement>('img');
        return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      }).length
  )), { timeout: 20_000 }).toBe(5);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-6.1', 'fixed 390x844 family review viewport');
  await proxyArasaacForLocalWebKit(page);
});

test.afterEach(async ({ page, context }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

for (const family of KEYBOARD_FAMILIES) {
  test(`keyboard family: ${family.slug}`, async ({ page }) => {
    await page.addInitScript(({ language }) => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('prism-greeting-dismissed', '1');
      localStorage.setItem('prism-cat-kb-open', 'true');
      localStorage.setItem('prism-kb-max', 'true');
      localStorage.setItem('prism-aac-settings', JSON.stringify({
        state: {
          language,
          outputLanguage: language,
          theme: 'light',
          gridSize: 12,
          cloudPredictionEnabled: false,
          aiAutocorrectEnabled: false,
        },
        version: 20,
      }));
      localStorage.setItem('prism-aac-message', JSON.stringify({
        state: { text: '', autoSpeak: false, soundEnabled: false },
        version: 3,
      }));
    }, { language: family.language });

    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('prediction-bar')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('keyboard-shell')).toBeVisible();
    await expect(page.getByTestId('typing-mode-sidebar')).toBeHidden();
    await expectPredictionPictogramsReady(page);

    const predictionGeometry = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-tile"]')];
      const icons = tiles.map((tile) => tile.querySelector<HTMLElement>('.aac-tile-icon')!);
      const images = icons.map((icon) => icon.querySelector<HTMLImageElement>('img')!);
      const labels = tiles.map((tile) => tile.querySelector<HTMLElement>('[data-testid="prediction-label"]')!);
      return {
        minimumCardRadius: Math.min(...tiles.map((tile) => Number.parseFloat(getComputedStyle(tile).borderTopLeftRadius))),
        minimumIconRadius: Math.min(...icons.map((icon) => Number.parseFloat(getComputedStyle(icon).borderTopLeftRadius))),
        minimumLabelFont: Math.min(...labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize))),
        maximumImageWidthRatio: Math.max(...images.map((image, index) => (
          image.getBoundingClientRect().width / icons[index].getBoundingClientRect().width
        ))),
        maximumImageHeightRatio: Math.max(...images.map((image, index) => (
          image.getBoundingClientRect().height / icons[index].getBoundingClientRect().height
        ))),
      };
    });

    expect(predictionGeometry.minimumCardRadius, `${family.label}: rounded prediction cards`).toBeGreaterThanOrEqual(20);
    expect(predictionGeometry.minimumIconRadius, `${family.label}: rounded pictogram wells`).toBeGreaterThanOrEqual(16);
    expect(predictionGeometry.minimumLabelFont, `${family.label}: large prediction words`).toBeGreaterThanOrEqual(24);
    expect(predictionGeometry.maximumImageWidthRatio, `${family.label}: bounded pictogram width`).toBeLessThanOrEqual(0.72);
    expect(predictionGeometry.maximumImageHeightRatio, `${family.label}: bounded pictogram height`).toBeLessThanOrEqual(0.72);

    const root = page.locator('[data-scan-group="keyboard"]');
    await expect(root).toHaveAttribute('data-language', family.language);
    const appDirection = await page.locator('.h-svh').getAttribute('dir');
    expect(appDirection).toBe(family.rtl ? 'rtl' : 'ltr');

    if (family.kind === 'native-ime') {
      await expect(root).toHaveAttribute('data-aac-keyboard-rows', 'native');
      await expect(page.getByTestId('native-ime-keyboard')).toBeVisible();
      await expect(page.getByTestId('native-ime-composer')).toHaveAttribute('lang', 'zh-CN');
      await expect(root.locator('button[data-key]')).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const composer = document.querySelector<HTMLElement>('[data-testid="native-ime-composer"]')!;
        const keyboard = document.querySelector<HTMLElement>('[data-testid="native-ime-keyboard"]')!;
        const prediction = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!;
        const rect = keyboard.getBoundingClientRect();
        const composerRect = composer.getBoundingClientRect();
        return {
          composerHeight: composerRect.height,
          composerFont: Number.parseFloat(getComputedStyle(composer).fontSize),
          keyboardHeight: rect.height,
          predictionHeight: prediction.getBoundingClientRect().height,
          offscreen: rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1,
          documentOverflowX: document.documentElement.scrollWidth - innerWidth,
          documentOverflowY: document.documentElement.scrollHeight - innerHeight,
        };
      });

      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      fs.writeFileSync(path.join(ARTIFACT_DIR, `${family.slug}.json`), `${JSON.stringify({ family, predictionGeometry, metrics }, null, 2)}\n`);
      await safeScreenshot(page, `${family.slug}.png`);

      expect(metrics.composerHeight).toBeGreaterThanOrEqual(200);
      expect(metrics.composerFont).toBeGreaterThanOrEqual(24);
      expect(metrics.keyboardHeight, `${family.label}: keyboard is the dominant typing surface`)
        .toBeGreaterThan(metrics.predictionHeight);
      expect(metrics.offscreen).toBe(false);
      expect(metrics.documentOverflowX).toBeLessThanOrEqual(1);
      expect(metrics.documentOverflowY).toBeLessThanOrEqual(1);
      return;
    }

    await expect(root).not.toHaveAttribute('data-phone-grid');
    await expect(root).toHaveAttribute(
      'data-aac-keyboard-rows',
      String(buildKeyboardRows(getLetterRows(family.language), true).length),
    );
    const expectedRows = buildKeyboardRows(getLetterRows(family.language), true);
    const expectedMaxColumns = Math.max(...expectedRows.map((row) => (
      row.keys.length + (row.util ? 2 : 0)
    )));
    await expect(root).toHaveAttribute('data-aac-keyboard-columns', String(expectedMaxColumns));
    for (const key of family.samples) {
      await expect(root.locator(`button[data-key="${key}"]`).first(), `${family.label}: ${key}`).toBeVisible();
    }

    const metrics = await page.evaluate(() => {
      const keys = [...document.querySelectorAll<HTMLElement>(
        '[data-scan-group="keyboard"] [data-key-row="letters"] button[data-key]',
      )];
      const rects = keys.map((key) => key.getBoundingClientRect());
      const fonts = keys.map((key) => Number.parseFloat(getComputedStyle(key).fontSize));
      const rowKeys = [...document.querySelectorAll<HTMLElement>(
        '[data-scan-group="keyboard"] [data-key-row="letters"]',
      )].map((row) => [...row.querySelectorAll<HTMLElement>(':scope > button[data-key]')]
        .map((key) => key.dataset.key));
      const keyboardRect = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!.getBoundingClientRect();
      const predictionRect = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
      const messageBar = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!;
      const messageBarRect = messageBar.getBoundingClientRect();
      const messageContent = document.querySelector<HTMLElement>('[data-testid="message-content"]')!;
      const messageContentRect = messageContent.getBoundingClientRect();
      const messageContentStyle = getComputedStyle(messageContent);
      const messageText = document.querySelector<HTMLElement>('[data-testid="message-text"]')!;
      const messageTextRect = messageText.getBoundingClientRect();
      const messageTextLineHeight = Number.parseFloat(getComputedStyle(messageText).lineHeight);
      const messageControls = [...messageBar.children]
        .filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
        .map((button) => button.getBoundingClientRect());
      const emptyPrompt = document.querySelector<HTMLElement>('[data-testid="message-empty-prompt"]');
      const predictionLabels = [...document.querySelectorAll<HTMLElement>('[data-testid="prediction-label"]')];
      return {
        keyCount: keys.length,
        minimumFont: Math.min(...fonts),
        minimumWidth: Math.min(...rects.map((rect) => rect.width)),
        minimumHeight: Math.min(...rects.map((rect) => rect.height)),
        maximumAspectRatio: Math.max(...rects.map((rect) => Math.max(rect.width / rect.height, rect.height / rect.width))),
        rowKeys,
        clippedKeys: keys.filter((key) => key.scrollWidth > key.clientWidth || key.scrollHeight > key.clientHeight).length,
        clippedKeyDetails: keys
          .filter((key) => key.scrollWidth > key.clientWidth || key.scrollHeight > key.clientHeight)
          .map((key) => ({
            key: key.dataset.key,
            clientWidth: key.clientWidth,
            scrollWidth: key.scrollWidth,
            clientHeight: key.clientHeight,
            scrollHeight: key.scrollHeight,
          })),
        offscreenKeys: rects.filter((rect) => rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1).length,
        keyboardOffscreen: keyboardRect.left < -1 || keyboardRect.top < -1 || keyboardRect.right > innerWidth + 1 || keyboardRect.bottom > innerHeight + 1,
        keyboardHeight: keyboardRect.height,
        predictionHeight: predictionRect.height,
        messageBarHeight: messageBarRect.height,
        messageContentHeight: messageContentRect.height,
        messageTextLineCapacity: messageTextRect.height / messageTextLineHeight,
        messageControlCount: messageControls.length,
        messageControlsInsideBar: messageControls.every((rect) => (
          rect.top >= messageBarRect.top && rect.bottom <= messageBarRect.bottom + 1
        )),
        messageControlsPredictionOverlap: Math.max(
          0,
          Math.max(...messageControls.map((rect) => rect.bottom)) - predictionRect.top,
        ),
        messageContentDisplay: messageContentStyle.display,
        messageContentBackground: messageContentStyle.backgroundColor,
        messageContentBorderWidth: Number.parseFloat(messageContentStyle.borderTopWidth),
        emptyPromptText: emptyPrompt?.textContent?.trim() ?? '',
        emptyPromptVisible: Boolean(emptyPrompt && emptyPrompt.getBoundingClientRect().width > 0 && emptyPrompt.getBoundingClientRect().height > 0),
        predictionColors: predictionLabels.map((label) => getComputedStyle(label).color),
        documentOverflowX: document.documentElement.scrollWidth - innerWidth,
        documentOverflowY: document.documentElement.scrollHeight - innerHeight,
      };
    });

    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, `${family.slug}.json`), `${JSON.stringify({ family, predictionGeometry, metrics }, null, 2)}\n`);
    await safeScreenshot(page, `${family.slug}.png`);

    expect(metrics.keyCount, `${family.label}: missing or duplicate keys`).toBe(family.expectedKeyCount);
    expect(metrics.minimumFont, `${family.label}: key font`).toBeGreaterThanOrEqual(family.minimumFont);
    expect(metrics.minimumWidth, `${family.label}: key width`).toBeGreaterThanOrEqual(24);
    // A 44px generic web target is not sufficient for a child using an AAC
    // device with impaired fine motor control. Dense Japanese keeps a lower
    // bound because seven total rows must coexist with predictions; every
    // other custom family must provide at least a 60px-tall letter target.
    expect(metrics.minimumHeight, `${family.label}: motor-accessible key height`)
      .toBeGreaterThanOrEqual(family.minimumKeyHeight ?? 60);
    expect(metrics.predictionHeight, `${family.label}: predictions remain usable`)
      .toBeGreaterThanOrEqual(72);
    expect(metrics.keyboardHeight, `${family.label}: keyboard is the dominant typing surface`)
      .toBeGreaterThan(metrics.predictionHeight);
    expect(metrics.messageContentHeight, `${family.label}: empty typing canvas remains visible`)
      .toBeGreaterThanOrEqual(112);
    expect(metrics.messageTextLineCapacity, `${family.label}: two-line typing canvas remains reserved`)
      .toBeGreaterThanOrEqual(2);
    expect(metrics.messageControlCount, `${family.label}: persistent message controls`).toBe(5);
    expect(metrics.messageControlsInsideBar, `${family.label}: message controls remain inside the composer`).toBe(true);
    expect(metrics.messageControlsPredictionOverlap, `${family.label}: predictions do not cover message controls`).toBe(0);
    expect(metrics.messageContentDisplay, `${family.label}: empty typing canvas display`)
      .not.toBe('none');
    expect(metrics.messageContentBackground, `${family.label}: typing canvas is visually identifiable`)
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(metrics.messageContentBorderWidth, `${family.label}: typing canvas boundary`)
      .toBeGreaterThanOrEqual(1);
    expect(metrics.emptyPromptText, `${family.label}: localized typing prompt`).not.toBe('');
    expect(metrics.emptyPromptVisible, `${family.label}: typing prompt is visible`).toBe(true);
    expect(metrics.maximumAspectRatio, `${family.label}: keyboard-like key geometry`).toBeLessThanOrEqual(1.85);
    expect(metrics.rowKeys, `${family.label}: expected accessible row layout`)
      .toEqual(expectedRows.map((row) => row.keys));
    expect(metrics.clippedKeys, `${family.label}: clipped glyphs`).toBe(0);
    expect(metrics.offscreenKeys, `${family.label}: offscreen keys`).toBe(0);
    expect(metrics.keyboardOffscreen, `${family.label}: keyboard bounds`).toBe(false);
    expect(metrics.predictionColors).toEqual(Array(5).fill('rgb(0, 0, 0)'));
    expect(metrics.documentOverflowX).toBeLessThanOrEqual(1);
    expect(metrics.documentOverflowY).toBeLessThanOrEqual(1);

    if (family.language === 'ro') {
      await root.locator('button[data-key="E"]').click();
      await root.locator('button[data-key="U"]').click();
      await expect(page.getByTestId('message-text')).toHaveText('eu');

      const typedMetrics = await page.evaluate(() => {
        const messageBar = document.querySelector<HTMLElement>('[data-scan-group="message-bar"]')!;
        const messageBarRect = messageBar.getBoundingClientRect();
        const messageControls = [...messageBar.children]
          .filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
          .map((button) => button.getBoundingClientRect());
        const messageContent = document.querySelector<HTMLElement>('[data-testid="message-content"]')!;
        const messageText = document.querySelector<HTMLElement>('[data-testid="message-text"]')!;
        const messageTextRect = messageText.getBoundingClientRect();
        const messageTextLineHeight = Number.parseFloat(getComputedStyle(messageText).lineHeight);
        const predictionRect = document.querySelector<HTMLElement>('[data-testid="prediction-bar"]')!.getBoundingClientRect();
        const keyboardRect = document.querySelector<HTMLElement>('[data-scan-group="keyboard"]')!.getBoundingClientRect();
        return {
          text: document.querySelector<HTMLElement>('[data-testid="message-text"]')!.textContent?.trim(),
          messageContentHeight: messageContent.getBoundingClientRect().height,
          messageTextLineCapacity: messageTextRect.height / messageTextLineHeight,
          messageTextFont: Number.parseFloat(getComputedStyle(
            document.querySelector<HTMLElement>('[data-testid="message-text"]')!,
          ).fontSize),
          messageControlCount: messageControls.length,
          messageControlsInsideBar: messageControls.every((rect) => (
            rect.top >= messageBarRect.top && rect.bottom <= messageBarRect.bottom + 1
          )),
          messageControlsPredictionOverlap: Math.max(
            0,
            Math.max(...messageControls.map((rect) => rect.bottom)) - predictionRect.top,
          ),
          predictionKeyboardOverlap: Math.max(0, predictionRect.bottom - keyboardRect.top),
          documentOverflowX: document.documentElement.scrollWidth - innerWidth,
          documentOverflowY: document.documentElement.scrollHeight - innerHeight,
        };
      });

      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `${family.slug}-typed.json`),
        `${JSON.stringify({ family, typedMetrics }, null, 2)}\n`,
      );
      await safeScreenshot(page, `${family.slug}-typed.png`);

      expect(typedMetrics.text).toBe('eu');
      expect(typedMetrics.messageContentHeight, 'Romanian typed-text canvas').toBeGreaterThanOrEqual(56);
      expect(typedMetrics.messageTextLineCapacity, 'Romanian two-line typed-text canvas').toBeGreaterThanOrEqual(2);
      expect(typedMetrics.messageTextFont, 'Romanian typed-text font').toBeGreaterThanOrEqual(32);
      expect(typedMetrics.messageControlCount, 'Romanian persistent message controls').toBe(5);
      expect(typedMetrics.messageControlsInsideBar, 'Romanian controls remain inside the composer').toBe(true);
      expect(typedMetrics.messageControlsPredictionOverlap, 'Romanian predictions do not cover controls').toBe(0);
      expect(typedMetrics.predictionKeyboardOverlap).toBe(0);
      expect(typedMetrics.documentOverflowX).toBeLessThanOrEqual(1);
      expect(typedMetrics.documentOverflowY).toBeLessThanOrEqual(1);
    }

    if (family.language === 'tr') {
      await root.locator('button[data-key="I"]').click();
      await root.locator('button[data-key="İ"]').click();
      await expect(page.getByTestId('message-text')).toHaveText('ıi');
      await expect(page.getByTestId('message-empty-prompt')).toHaveCount(0);
      await safeScreenshot(page, `${family.slug}-typed.png`);
    }
  });
}
