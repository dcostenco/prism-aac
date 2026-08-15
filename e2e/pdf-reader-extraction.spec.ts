/**
 * Behavioural guard for the pdfjs-dist major version.
 *
 * pdfjs-dist 5.x carried GHSA "arbitrary JavaScript execution upon opening a
 * malicious PDF", patched only in 6.2.108 — a semver-major bump. This app lets
 * an AAC user open a PDF a caregiver sent them, so that path is reachable.
 *
 * The v6 upgrade moved destroy() off PDFDocumentProxy and onto the loading
 * task, which typechecks but would silently leak the worker if migrated wrong.
 * Unit tests all mock pdfjs, so nothing else here proves the REAL library still
 * extracts text through our own code path.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('PDF reader extracts text with the patched pdfjs-dist', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.addInitScript(() => {
    localStorage.setItem('prism-aac-settings', JSON.stringify({
      state: { language: 'en', outputLanguage: 'en', speechVolume: 0 }, version: 0,
    }));
  });
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="keyboard-shell"]', { timeout: 30_000 });

  await page.getByRole('button', { name: /pdf reader/i }).first().click();
  const input = page.locator('[data-testid="pdf-reader-input"]');
  await input.waitFor({ state: 'attached', timeout: 15_000 });
  await input.setInputFiles(path.join(__dirname, '_fixtures', 'pdfjs-smoke.pdf'));

  // The extracted text must actually surface in the panel.
  await expect(page.locator('body')).toContainText(
    'PRISM AAC PDFJS SIX SMOKE TEST', { timeout: 30_000 });

  const fatal = consoleErrors.filter((e) =>
    /pdfjs|worker|getDocument|version mismatch|module shape/i.test(e));
  expect(fatal, `pdfjs console errors: ${JSON.stringify(fatal)}`).toEqual([]);
});
