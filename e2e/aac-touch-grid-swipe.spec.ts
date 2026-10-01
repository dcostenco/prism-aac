import { expect, test, type Locator, type Page } from '@playwright/test';
import { checkCriticalOcclusion, safeScreenshot } from './helpers/screenshot-validation';

test.use({ serviceWorkers: 'block', hasTouch: true });

async function swipe(page: Page, grid: Locator, dx: number, dy = 0) {
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  const start = { x: box!.x + box!.width * (dx < 0 ? 0.75 : 0.25), y: box!.y + box!.height / 4 };
  if (page.context().browser()!.browserType().name() === 'chromium') {
    const input = await page.context().newCDPSession(page);
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 5; step++) {
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: start.x + dx * step / 5, y: start.y + dy * step / 5,
      }] });
    }
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await input.detach();
    return;
  }
  // WebKit's automation exposes tap only and Touch is not constructible.
  // Exercise its DOM event handler; do not present this as physical iOS proof.
  await grid.evaluate((element, { start, dx, dy }) => {
    const send = (type: string, x: number, y: number) => {
      const touch = { identifier: 1, target: element, clientX: x, clientY: y };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === 'touchend' ? [] : [touch] }, changedTouches: { value: [touch] },
      });
      element.dispatchEvent(event);
    };
    send('touchstart', start.x, start.y);
    send('touchmove', start.x + dx, start.y + dy);
    send('touchend', start.x + dx, start.y + dy);
  }, { start, dx, dy });
}

async function expectFilledGrid(grid: Locator, size: number, cols: number) {
  const blocks = grid.locator(':scope > *');
  await expect(blocks).toHaveCount(size);
  const bounds = (await grid.boundingBox())!;
  const boxes = await Promise.all((await blocks.all()).map(block => block.boundingBox()));
  const rows = size / cols;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]!;
    expect(box.width).toBeGreaterThan(bounds.width / cols - 20);
    expect(box.height).toBeGreaterThan(bounds.height / rows - 20);
    expect(box.y).toBeCloseTo(boxes[Math.floor(i / cols) * cols]!.y, 0);
    if (i >= cols) expect(box.y).toBeGreaterThan(boxes[i - cols]!.y + boxes[i - cols]!.height);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  }
  expect(boxes.at(-1)!.y + boxes.at(-1)!.height).toBeGreaterThan(bounds.y + bounds.height - 12);
}

test.afterEach(async ({ page, context }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close();
  await context.close();
});

test.describe('desktop input without touch emulation', () => {
  test.use({ hasTouch: false, viewport: { width: 1280, height: 720 } });
  for (const mode of ['wheel', 'drag'] as const) {
    test(`Mac ${mode} pages both surfaces without choosing or speaking a word`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.addInitScript(() => {
        localStorage.setItem('prism-cat-kb-open', 'false');
        localStorage.setItem('prism-kb-max', 'false');
        localStorage.setItem('prism-aac-message', JSON.stringify({ state: { text: '', autoSpeak: false, soundEnabled: false }, version: 3 }));
      });
      await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /settings/i }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: '4', exact: true }).click();
      await page.keyboard.press('Escape');
      const grid = page.locator('.aac-picture-grid');
      const strip = page.getByTestId('category-strip');
      const vocabularyStatus = page.getByTestId('vocabulary-page-indicator');
      const categoryStatus = page.getByTestId('category-page-indicator');
      const gesture = async (surface: Locator, forward: boolean) => {
        const box = (await surface.boundingBox())!;
        const x = box.x + box.width * .6, y = box.y + box.height * .3;
        await page.mouse.move(x, y);
        if (mode === 'wheel') {
          await page.waitForTimeout(220); // a distinct trackpad burst, not momentum
          for (let i = 0; i < 8; i++) await page.mouse.wheel(forward ? 12 : -12, 0);
        } else {
          await page.mouse.down();
          await page.mouse.move(x + (forward ? -120 : 120), y, { steps: 8 });
          await page.mouse.up();
        }
      };
      for (const [surface, status] of [[grid, vocabularyStatus], [strip, categoryStatus]] as const) {
        await gesture(surface, false);
        await expect(status).toHaveText(/^1\s*\//);
        await gesture(surface, true);
        await expect(status).toHaveText(/^2\s*\//);
        await expect(page.getByRole('region', { name: 'Home vocabulary board' })).toBeVisible();
        await expect(page.getByTestId('message-content')).toContainText('Type here');
        if (surface === strip) {
          await expect.poll(() => grid.getByTestId('phrase-tile-card').evaluateAll(cards => cards.length === 4 && cards.every(card => {
            const img = card.querySelector('img'); return img?.complete && img.naturalWidth > 0;
          })), { timeout: 20_000 }).toBe(true);
          await safeScreenshot(page, testInfo.outputPath(`desktop-${mode}-category.png`), {
            expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="category-strip"]'],
            criticalSelectors: ['.aac-category-label'], occluderSelectors: ['[data-testid="picture-mode-sidebar"]'],
          });
        }
        await gesture(surface, false);
        await expect(status).toHaveText(/^1\s*\//);
      }
      await strip.getByTestId('category-tile').filter({ hasText: 'Core Verbs' }).click();
      await expect(page.getByRole('region', { name: 'Core Verbs', exact: true })).toBeVisible();
      await gesture(grid, true);
      await expect(vocabularyStatus).toHaveText(/^2\s*\//);
      await expect(page.getByTestId('message-content')).toContainText('Type here');
      await expect.poll(() => grid.getByTestId('phrase-tile-card').evaluateAll(cards => cards.length === 4 && cards.every(card => {
        const img = card.querySelector('img'); return img?.complete && img.naturalWidth > 0;
      })), { timeout: 20_000 }).toBe(true);
      await safeScreenshot(page, testInfo.outputPath(`desktop-${mode}.png`), {
        expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="picture-board"]'],
        criticalSelectors: ['.aac-picture-grid .aac-tile-label'],
        occluderSelectors: ['[data-testid="picture-mode-sidebar"]'],
      });
      const word = await grid.getByTestId('phrase-tile-card').first().getAttribute('aria-label');
      await grid.getByTestId('phrase-tile-card').first().click();
      await expect(page.getByTestId('message-content')).toContainText(word!, { ignoreCase: true });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(grid.locator(':scope > *')).toHaveCount(4);
      await gesture(grid, true);
      await expect(vocabularyStatus).toHaveText(/^2\s*\//);
    });
  }
});

test('category-strip swipe reveals choices without opening a category or selecting a word', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('prism-cat-kb-open', 'false');
    localStorage.setItem('prism-kb-max', 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
      gridSize: 4, theme: 'light', language: 'en', outputLanguage: 'en',
      cloudPredictionEnabled: false, aiAutocorrectEnabled: false,
    }, version: 20 }));
    localStorage.setItem('prism-aac-message', JSON.stringify({ state: {
      text: '', autoSpeak: false, soundEnabled: false,
    }, version: 3 }));
  });
  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  const strip = page.getByTestId('category-strip');
  const status = page.getByTestId('category-page-indicator');
  const home = page.getByRole('region', { name: 'Home vocabulary board' });
  await expect(strip).toBeVisible({ timeout: 30_000 });
  const firstLabels = await strip.getByTestId('category-tile').allTextContents();
  const pages = Number((await status.textContent())!.split('/')[1]);
  expect(pages).toBeGreaterThan(1);
  await swipe(page, strip, 100); // first boundary
  await expect(status).toHaveText(`1/${pages}`);
  await swipe(page, strip, -10, 80); // ordinary vertical movement
  await expect(status).toHaveText(`1/${pages}`);
  for (let next = 2; next <= pages; next++) {
    await swipe(page, strip, -100);
    await expect(status).toHaveText(`${next}/${pages}`);
    await expect(home).toBeVisible();
    await expect(page.getByTestId('message-content')).toContainText('Type here');
  }
  await swipe(page, strip, -100); // last boundary
  await expect(status).toHaveText(`${pages}/${pages}`);
  await expect(page.getByTestId('category-page-next')).toBeDisabled();
  // Paging is fast enough to finish before lazy pictograms load. A capture of
  // blank tiles is not visual evidence of the user's working board.
  await expect.poll(() => home.getByTestId('phrase-tile-card').evaluateAll(cards =>
    cards.length === 4 && cards.every(card => {
      const img = card.querySelector('img');
      return img?.complete && img.naturalWidth > 0;
    })), { timeout: 20_000 }).toBe(true);
  await safeScreenshot(page, testInfo.outputPath('category-strip-swiped.png'), {
    expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="category-strip"]'],
    criticalSelectors: ['.aac-category-label'], occluderSelectors: ['[data-testid="picture-mode-sidebar"]'],
  });
  for (let previous = pages - 1; previous >= 1; previous--) {
    await swipe(page, strip, 100);
    await expect(status).toHaveText(`${previous}/${pages}`);
  }
  expect(await strip.getByTestId('category-tile').allTextContents()).toEqual(firstLabels);
  await page.getByTestId('category-page-next').click();
  await expect(status).toHaveText(`2/${pages}`);
  await page.getByTestId('category-page-prev').click();
  await expect(status).toHaveText(`1/${pages}`);
  await strip.getByTestId('category-tile').filter({ hasText: 'Core Verbs' }).tap();
  await expect(page.getByRole('region', { name: 'Core Verbs', exact: true })).toBeVisible();
  await swipe(page, page.locator('.aac-picture-grid'), -100);
  await expect(page.getByTestId('vocabulary-page-indicator')).toContainText('2 /');
});

for (const [size, cols] of [[4, 2], [6, 3]] as const) {
  test(`grid ${size} fills home and category board and swipes without selecting a word`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.addInitScript(size => {
      if (localStorage.getItem('prism-aac-settings')) return;
      localStorage.setItem('prism-cat-kb-open', 'false');
      localStorage.setItem('prism-kb-max', 'false');
      localStorage.setItem('prism-aac-settings', JSON.stringify({ state: {
        gridSize: size, theme: 'light', language: 'en', outputLanguage: 'en',
        cloudPredictionEnabled: false, aiAutocorrectEnabled: false,
      }, version: 20 }));
      localStorage.setItem('prism-aac-message', JSON.stringify({ state: {
        text: '', autoSpeak: false, soundEnabled: false,
      }, version: 3 }));
    }, size);
    await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
    const grid = page.locator('.aac-picture-grid');
    await expect(grid).toBeVisible({ timeout: 30_000 });
    if (process.env.AAC_LAYOUT_DIAGNOSTICS === '1') console.log('GRID_RUNTIME', await page.evaluate(() => {
      const selectors = ['[data-testid="greeting-banner"]', '[data-testid="prediction-bar"]', '[data-scan-group="message-bar"]',
        '[data-testid="picture-mode-sidebar"]', '.aac-picture-grid', '.aac-home-footer', '.aac-vocabulary-pager', '[data-testid="category-strip-shell"]'];
      return selectors.map(selector => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return { selector, absentInThisRun: true };
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { selector, y: rect.y, height: rect.height, width: rect.width, columns: style.gridTemplateColumns,
          rows: style.gridTemplateRows, direction: style.flexDirection, predictionSize: style.getPropertyValue('--aac-phone-prediction-size') };
      });
    }));
    await expectFilledGrid(grid, size, cols);
    const capture = async (state: string, requireImages = true) => {
      if (requireImages || state === 'home') await expect.poll(() => grid.locator('[data-testid="phrase-tile-card"]').evaluateAll((cards, allowKnownMissingAsset) =>
        cards.length > 0 && cards.every(card => {
          if (allowKnownMissingAsset && card.getAttribute('aria-label') === 'Excuse me') return true;
          const img = card.querySelector('img');
          return img?.complete && img.naturalWidth > 0;
        }), !requireImages && state === 'home'),
      { timeout: 20_000 }).toBe(true);
      await safeScreenshot(page, testInfo.outputPath(`${state}-${size}.png`), {
        expectedPath: '/prism-aac', requiredSelectors: ['[data-testid="picture-board"]'],
        criticalSelectors: ['.aac-picture-grid .aac-tile-label', '.aac-page-label > button'],
        occluderSelectors: ['[data-testid="category-strip"]', '[data-testid="picture-mode-sidebar"]'],
      });
    };
    // Home's pre-existing "Excuse me" asset is unresolved; do not weaken the
    // loaded-image gate or claim that asset fixed. Capture grid-4 home and
    // both sizes of the user's Core Verbs state with every image present.
    await capture('home', size === 4);
    const homeFirst = await grid.locator('button').first().getAttribute('aria-label');
    await swipe(page, grid, -100);
    await expect(grid.locator('button').first()).not.toHaveAttribute('aria-label', homeFirst!);
    await swipe(page, grid, 100);
    await expect(grid.locator('button').first()).toHaveAttribute('aria-label', homeFirst!);

    await page.getByTestId('category-tile').filter({ hasText: 'Core Verbs' }).click();
    await expect(page.getByRole('region', { name: 'Core Verbs', exact: true })).toBeVisible();
    await expectFilledGrid(grid, size, cols);
    await capture('core-verbs');
    const first = await grid.locator('button').first().getAttribute('aria-label');
    const pager = page.getByTestId('vocabulary-page-indicator');
    await expect(pager).toHaveClass('sr-only');
    await expect(page.locator('.aac-vocabulary-pager')).toHaveCount(0);
    await expect(pager).toContainText('1 /');
    await swipe(page, grid, 100); // boundary must not wrap
    await expect(pager).toContainText('1 /');
    await swipe(page, grid, -10, 100); // vertical scrolling is not paging
    await expect(pager).toContainText('1 /');
    await swipe(page, grid, -100);
    await expect(pager).toContainText('2 /');
    await expect(grid.locator('button').first()).not.toHaveAttribute('aria-label', first!);
    await expect(page.getByTestId('message-content')).toContainText('Type here');
    await page.getByRole('button', { name: 'Previous page', exact: true }).click();
    await expect(pager).toContainText('1 /');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(pager).toContainText('2 /');
    await swipe(page, grid, 100);
    await expect(pager).toContainText('1 /');
    await grid.locator('button').first().tap();
    await expect(page.getByTestId('message-content')).toContainText(new RegExp(first!, 'i'));
    await page.getByRole('button', { name: /settings/i }).first().click();
    const settings = page.getByRole('dialog');
    const nextSize = size === 4 ? 6 : 4;
    await settings.getByRole('button', { name: String(nextSize), exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();
    await expectFilledGrid(grid, nextSize, nextSize === 4 ? 2 : 3);
    await expect(pager).toContainText('1 /');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(grid).toBeVisible();
    await expectFilledGrid(grid, nextSize, nextSize === 4 ? 2 : 3);
    if (size === 4) {
      for (const [largerSize, columns] of [[9, 3], [12, 4], [16, 4], [20, 5]]) {
        await page.getByRole('button', { name: /settings/i }).first().click();
        await settings.getByRole('button', { name: String(largerSize), exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(settings).toBeHidden();
        await expectFilledGrid(grid, largerSize, columns);
        if (process.env.AAC_LAYOUT_DIAGNOSTICS === '1') console.log('DENSE_GRID', largerSize, await grid.evaluate(element =>
          [...element.querySelectorAll<HTMLElement>('.aac-tile-label')].map(label => {
            const rect = label.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.x + rect.width / 4, rect.y + rect.height / 4);
            return { text: label.textContent, height: rect.height, cardHeight: label.parentElement!.getBoundingClientRect().height,
              hit: hit?.outerHTML.slice(0, 300) };
          })));
        await expect.poll(() => checkCriticalOcclusion(page, { criticalSelectors: ['.aac-picture-grid .aac-tile-label'] })).toEqual([]);
      }
      await page.getByRole('button', { name: /settings/i }).first().click();
      await settings.getByRole('button', { name: '4', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('region', { name: 'Home vocabulary board' })).toBeVisible();
      const food = page.getByTestId('category-tile').filter({ hasText: 'Food & Drink' });
      for (let attempt = 0; attempt < 12 && await food.count() === 0; attempt++) {
        await page.getByTestId('category-page-next').click();
      }
      await food.click();
      await expectFilledGrid(grid, 4, 2);
      await expect(grid.locator('.aac-picture-card')).toHaveCount(4);
      await capture('folders', false);
      const folder = grid.locator('button').first();
      const folderName = await folder.getAttribute('aria-label');
      await folder.click();
      await expect(page.getByRole('region', { name: folderName!, exact: true })).toBeVisible();
      await expect(page.getByTestId('vocabulary-page-indicator')).toContainText('1 /');
    }
  });
}
