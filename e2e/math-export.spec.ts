import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { safeScreenshot } from './helpers/screenshot-validation';

test.use({ viewport: { width: 1264, height: 590 } });

test.afterEach(async ({ page, context }) => {
  try { await page.close(); } catch { /* fixture may already be closed */ }
  try { await context.close(); } catch { /* fixture may already be closed */ }
});

async function openMath(page: Page) {
  await page.getByRole('button', { name: /^(Math|Matemat)/i }).first().click();
  await expect(page.getByTestId('math-panel')).toBeVisible();
  await expect(page.getByTestId('math-grid-svg')).toBeVisible();
}

test('exports an image and PDF, then restores a saved math file through visible controls', async ({ page }, testInfo) => {
  const pdfPath = testInfo.outputPath('math-export.pdf');
  await page.exposeFunction('__captureMathPdf', async (base64: string) => {
    await writeFile(pdfPath, Buffer.from(base64, 'base64'));
  });
  await page.addInitScript(() => {
    class MockClipboardItem {
      readonly data: Record<string, Blob | Promise<Blob>>;
      constructor(data: Record<string, Blob | Promise<Blob>>) { this.data = data; }
    }
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: MockClipboardItem });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async ([item]: Array<{ data: Record<string, Blob | Promise<Blob>> }>) => {
          const image = await item.data['image/png'];
          localStorage.setItem('__prism_math_image', `${image.type}:${image.size}`);
        },
      },
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: { suggestedName?: string }) => ({
        createWritable: async () => ({
          write: async (blob: Blob) => {
            if (blob.type === 'application/pdf') {
              const bytes = new Uint8Array(await blob.arrayBuffer());
              let binary = '';
              for (const byte of bytes) binary += String.fromCharCode(byte);
              await (window as unknown as { __captureMathPdf: (value: string) => Promise<void> }).__captureMathPdf(btoa(binary));
              localStorage.setItem('__prism_math_pdf', `${options.suggestedName}:${blob.type}:${binary.slice(0, 8)}`);
            } else if (blob.type === 'application/json') {
              localStorage.setItem('__prism_math_file', await blob.text());
              localStorage.setItem('__prism_math_filename', options.suggestedName ?? '');
            }
          },
          close: async () => undefined,
        }),
      }),
    });
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [{
        getFile: async () => new File(
          [localStorage.getItem('__prism_math_file') ?? ''],
          localStorage.getItem('__prism_math_filename') ?? 'prism-math.json',
          { type: 'application/json' },
        ),
      }],
    });
  });

  await page.goto('/prism-aac', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^(Math|Matemat)/i }).first()).toBeVisible({ timeout: 30_000 });
  await openMath(page);
  await page.getByTestId('math-key-1').click();
  await page.getByTestId('math-key-divided-by').click();
  await page.getByTestId('math-key-3').click();

  await page.getByTestId('math-docs-open-toggle').click();
  await expect(page.getByTestId('math-docs-copy-image')).toBeVisible();
  await expect(page.getByTestId('math-docs-save-pdf')).toBeVisible();
  await expect(page.getByTestId('math-docs-save-file')).toBeVisible();
  await expect(page.getByTestId('math-docs-restore-file')).toBeVisible();
  await safeScreenshot(page, testInfo.outputPath('math-export-actions.png'), {
    expectedPath: '/prism-aac',
    requiredSelectors: ['[data-testid="math-panel"]', '[data-testid="math-docs-list"]'],
    criticalSelectors: [
      '[data-testid="math-docs-copy-image-label"]',
      '[data-testid="math-docs-save-pdf-label"]',
      '[data-testid="math-docs-save-file-label"]',
      '[data-testid="math-docs-restore-file-label"]',
    ],
    occluderSelectors: [],
  });

  await page.getByTestId('math-docs-copy-image').click();
  await expect(page.getByTestId('math-docs-toast')).toContainText('Copied math image');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('__prism_math_image'))).toMatch(/^image\/png:[1-9]\d+$/u);

  await page.getByTestId('math-docs-open-toggle').click();
  await page.getByTestId('math-docs-save-pdf').click();
  await expect(page.getByTestId('math-docs-toast')).toContainText('Saved PDF');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('__prism_math_pdf'))).toContain('application/pdf:%PDF-1.4');

  await page.getByTestId('math-docs-open-toggle').click();
  await page.getByTestId('math-docs-save-file').click();
  await expect(page.getByTestId('math-docs-toast')).toContainText('Saved math file');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('__prism_math_file'))).toContain('prism-aac-math');

  await page.getByTestId('math-panel-close').click();
  await openMath(page);
  await expect(page.locator('[data-testid="math-grid-glyphs"] text')).toHaveCount(0);
  await page.getByTestId('math-docs-open-toggle').click();
  await page.getByTestId('math-docs-restore-file').click();
  await expect(page.getByTestId('math-docs-toast')).toContainText('Restored math file');
  await expect(page.locator('[data-testid="math-grid-glyphs"] text')).toHaveCount(3);
  await expect(page.locator('[data-testid="math-grid-glyphs"]')).toContainText('1÷3');
});
