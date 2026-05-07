/**
 * Phase 5D — math doc portal sync.
 *
 * mathDocService writes locally first, then fires-and-forgets a
 * POST upsert to the portal. Pulling merges remote docs newer than
 * the local copy.
 *
 * The dev harness page mounts MathDocsTool with a "↻ Sync" button
 * that invokes pullFromPortal. We mock the GET endpoint with two
 * canned remote docs and verify the local list ends up containing
 * them after sync.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

async function gotoDev(page: Page, baseURL: string | undefined) {
  const start = (baseURL || '') + '/dev/math-grid';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="math-main-keyboard"]');
}

async function clearLocalDocs(page: Page) {
  await page.evaluate(() => {
    try { localStorage.removeItem('prism-aac-math-docs'); } catch {}
  });
}

interface RemoteDoc {
  slug: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  body: { cells: Array<{ key: string; glyph: string }>; cursor: { r: number; c: number } };
}

function fakeBody(glyph: string): RemoteDoc['body'] {
  return { cells: [{ key: '0,0', glyph }], cursor: { r: 0, c: 0 } };
}

test.describe('Phase 5D — math doc portal sync', () => {
  test('Sync button merges remote docs into the local list', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await clearLocalDocs(page);

    const now = Date.now();
    const remote: RemoteDoc[] = [
      { slug: 'remote-one', name: 'Remote One', createdAt: now - 1000, updatedAt: now - 500, body: fakeBody('1') },
      { slug: 'remote-two', name: 'Remote Two', createdAt: now - 800, updatedAt: now - 200, body: fakeBody('2') },
    ];

    await page.route('**/prism-aac/math-doc', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ docs: remote }),
        });
      } else {
        await route.fulfill({ status: 204, body: '' });
      }
    });

    // Open the docs overlay.
    await page.locator('[data-testid="math-docs-open-toggle"]').click();
    await expect(page.locator('[data-testid="math-docs-list"]')).toBeVisible();

    // Trigger sync.
    await page.locator('[data-testid="math-docs-sync"]').click();
    await expect(page.locator('[data-testid="math-docs-toast"]')).toContainText('Synced 2');

    // Both rows show up in the list.
    await expect(page.locator('[data-testid="math-docs-row-remote-one"]')).toBeVisible();
    await expect(page.locator('[data-testid="math-docs-row-remote-two"]')).toBeVisible();
  });

  test('Sync failure (401) → toast asks user to sign in, list unchanged', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await clearLocalDocs(page);

    await page.route('**/prism-aac/math-doc', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauth"}' });
      } else {
        await route.fulfill({ status: 401, body: '' });
      }
    });

    await page.locator('[data-testid="math-docs-open-toggle"]').click();
    await page.locator('[data-testid="math-docs-sync"]').click();
    const toast = page.locator('[data-testid="math-docs-toast"]');
    await expect(toast).toContainText(/sign in|Sync failed/i);
    // No rows added.
    await expect(page.locator('[data-testid^="math-docs-row-"]')).toHaveCount(0);
  });

  test('Save → POST to portal upsert is fired (best-effort)', async ({ page, baseURL }) => {
    await gotoDev(page, baseURL);
    await clearLocalDocs(page);

    let upsertSlug: string | null = null;
    let upsertMethod: string | null = null;
    await page.route('**/prism-aac/math-doc/**', async (route: Route) => {
      const url = route.request().url();
      const m = url.match(/\/math-doc\/([^/?#]+)/);
      upsertSlug = m ? decodeURIComponent(m[1]) : null;
      upsertMethod = route.request().method();
      await route.fulfill({ status: 204, body: '' });
    });

    // Type a glyph so the grid is non-empty, then save. Verify the
    // commit landed before clicking Save — on slower environments a
    // bare click() can race the React commit phase.
    await page.locator('[data-testid="math-key-7"]').click();
    await page.waitForFunction(() => {
      const el = document.querySelector('header');
      return !!el && /cells=[1-9]/.test(el.textContent || '');
    }, { timeout: 5000 });
    await page.locator('[data-testid="math-docs-save"]').click();
    await expect(page.locator('[data-testid="math-docs-toast"]')).toContainText(/Saved as/, { timeout: 10000 });

    // Wait briefly for the fire-and-forget POST to land in the route handler.
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).performance?.getEntriesByType('resource')
        .some((r: { name: string }) => /\/prism-aac\/math-doc\//.test(r.name));
    }, { timeout: 3000 }).catch(() => {});

    expect(upsertMethod, 'upsert hits POST').toBe('POST');
    expect(upsertSlug, 'slug encoded into the URL').toBeTruthy();
  });
});
