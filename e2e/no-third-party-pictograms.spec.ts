/**
 * Third-party pictograms are retired from the app.
 *
 * The board and prediction bar show words, nothing is requested from the
 * retired pictogram hosts, and the copies earlier versions cached on the
 * device are deleted once while unrelated cache entries survive.
 *
 * Run against [::1] or a real host: on localhost / 127.0.0.1 the service-worker
 * kill switch deliberately wipes every cache, which would hide what the
 * cleanup itself removes and preserves.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';

test.use({ serviceWorkers: 'block' });

const RETIRED_HOST = /(^|\.)arasaac\.org$/i;
const RETIRED_ENTRY = 'https://static.arasaac.org/pictograms/1/1_500.png';

test('the board shows words, asks nothing of the retired pictogram service, and deletes its device copies', async ({ page, baseURL, browserName }, testInfo) => {
  const origin = new URL(baseURL!).origin;
  test.skip(['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
    'the loopback kill switch wipes every cache; use [::1] or a real host');
  const retiredRequests: string[] = [];
  page.on('request', request => {
    if (RETIRED_HOST.test(new URL(request.url()).hostname)) retiredRequests.push(request.url());
  });
  const keptEntry = `${origin}/prism-aac/__unrelated-cache-entry`;

  // A first visit lets the existing service-worker kill switch record this
  // version (it clears runtime caches once per version, where the engine
  // exposes service workers), so the cache checks below see only the cleanup.
  await page.goto('/prism-aac');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('prism-aac-sw-killswitch')),
    { timeout: 20_000 }).not.toBeNull();

  // Seed what an earlier version left behind, on a page that does not start the app.
  await page.goto('/prism-aac/docs');
  await page.evaluate(async ({ retiredEntry, keptEntry }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('prism-aac-pictograms', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('blobs');
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('blobs', 'readwrite');
        // A string: headless WebKit cannot store Blobs, and the cleanup deletes the whole database.
        transaction.objectStore('blobs').put('retired picture', 'fixture');
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    localStorage.setItem('prism-arasaac-misses', '["en:fixture"]');
    const cache = await caches.open('earlier-version-fixture');
    await cache.put(retiredEntry, new Response('retired picture'));
    await cache.put(keptEntry, new Response('unrelated'));
    sessionStorage.setItem('prism-greeting-dismissed', '1');
    localStorage.setItem('prism-cat-kb-open', 'false');
    localStorage.setItem('prism-aac-settings', JSON.stringify({ state: { language: 'en', outputLanguage: 'en',
      theme: 'light', gridSize: 12, cloudPredictionEnabled: false, aiAutocorrectEnabled: false }, version: 20 }));
  }, { retiredEntry: RETIRED_ENTRY, keptEntry });

  await page.goto('/prism-aac');
  await expect(page.getByTestId('picture-board')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('phrase-tile-card').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('prism-legacy-pictograms-cleared')),
    { timeout: 20_000 }).toBe('2');

  const device = await page.evaluate(async () => {
    const cache = await caches.open('earlier-version-fixture');
    return {
      databases: (await indexedDB.databases()).map(database => database.name),
      misses: localStorage.getItem('prism-arasaac-misses'),
      entries: (await cache.keys()).map(request => request.url),
    };
  });
  expect(device.databases).not.toContain('prism-aac-pictograms');
  expect(device.misses).toBeNull();
  // Playwright's ephemeral WebKit context keeps no Cache Storage entries across a
  // navigation, even between two static files, so only Chromium can show which
  // entries the cleanup kept. tests/legacy-pictogram-cache.test.ts covers both.
  if (browserName === 'webkit') testInfo.annotations.push({ type: 'note', description: 'cache entries not comparable in ephemeral WebKit' });
  else expect(device.entries).toEqual([keptEntry]);

  // Tiles and predictions carry their words and no picture.
  const labels = await page.getByTestId('phrase-tile-label').allInnerTexts();
  expect(labels.filter(label => label.trim()).length).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId('prediction-tile').first()).toBeVisible();
  const pictures = await page.locator('[data-testid="phrase-tile-card"] img, [data-testid="prediction-tile"] img')
    .evaluateAll(images => images.map(image => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src));
  expect(pictures.filter(source => /arasaac/i.test(source))).toEqual([]);

  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  await page.screenshot({ path: testInfo.outputPath('words-only-board.png') });
  expect(retiredRequests).toEqual([]);
});
