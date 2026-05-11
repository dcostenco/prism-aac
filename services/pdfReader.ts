'use client';
/**
 * pdfReader — extract text from a PDF file (browser-side via pdfjs).
 *
 * pdfjs-dist is dynamic-imported so the ~3 MB worker payload doesn't
 * land in the main bundle until the user opens a PDF. The worker
 * itself is loaded from the same module via the bundler's URL
 * resolution (Next.js + Webpack/Turbopack handles
 * `new URL('./worker.mjs', ...)` for npm packages).
 *
 * Used by the PDF Reader panel to feed each page into aacSpeak() so
 * the AAC user can listen to school documents instead of trying to
 * read them — one of the dealbreaker features in the Reddit r/AAC
 * "free Read & Write alternatives" thread (May 2026).
 */

export interface PdfPage {
  /** 1-based page number. */
  pageNumber: number;
  /** Plain text extracted from the page (whitespace-collapsed). */
  text: string;
}

export interface PdfExtractResult {
  pages: PdfPage[];
  /** Document metadata title — falls back to '' when unknown. */
  title: string;
  /** Document character count across all pages. */
  totalChars: number;
}

let pdfjsModule: typeof import('pdfjs-dist') | null = null;
let workerSet = false;

async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsModule) return pdfjsModule;
  // pdfjs-dist's browser entry uses Top-Level Await for the worker,
  // which Next.js handles via a separate chunk on dynamic import.
  let mod: typeof import('pdfjs-dist');
  try {
    mod = await import('pdfjs-dist');
  } catch (e) {
    throw new Error(
      `Could not load PDF reader runtime — ${e instanceof Error ? e.message : String(e)}. ` +
        'Check your internet connection and reload.',
    );
  }
  // Defensive checks: dynamic-import shape regressions on the pdfjs
  // side have produced "undefined is not a function (near '…of e…')"
  // user reports when a `for…of` walk inside pdfjs hit an undefined
  // entries collection (May 2026 user Image #28). Surfacing the
  // missing piece by name makes future failures diagnosable instead
  // of a generic JS engine message.
  if (!mod || typeof (mod as { getDocument?: unknown }).getDocument !== 'function') {
    throw new Error(
      'PDF reader runtime loaded but `getDocument` is missing — pdfjs-dist version mismatch. Reload the page.',
    );
  }
  if (!mod.GlobalWorkerOptions) {
    throw new Error(
      'PDF reader runtime missing GlobalWorkerOptions — pdfjs-dist module shape changed. Reload the page.',
    );
  }
  if (!workerSet) {
    // Resolve the worker from the installed npm package via Next.js/Webpack
    // URL bundling. The resulting URL is content-hashed and served locally,
    // eliminating any CDN dependency or SRI risk at runtime.
    mod.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    workerSet = true;
  }
  pdfjsModule = mod;
  return mod;
}

/**
 * Extract text + metadata from a PDF File (or any ArrayBuffer source).
 * Returns one entry per page so the AAC UI can let the user pick
 * which page to listen to.
 */
/**
 * Diagnostic logger. Writes to console so a user retesting in real
 * Safari can paste the output back without us having to guess at
 * what pdfjs returned. Each line is prefixed `[pdfReader]` so the
 * user can grep-filter their console.
 */
function diag(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console !== 'undefined') console.log('[pdfReader]', ...args);
}

export async function extractPdfText(source: File | ArrayBuffer): Promise<PdfExtractResult> {
  const pdfjs = await loadPdfjs();
  const data = source instanceof File ? await source.arrayBuffer() : source;
  diag(`pdfjs version=${pdfjs.version} workerSrc=${pdfjs.GlobalWorkerOptions?.workerSrc?.slice(0, 80)}`);
  diag(`source bytes=${data instanceof ArrayBuffer ? data.byteLength : '?'}`);
  // First try with the cross-origin worker (faster). If that path
  // throws on EVERY page (worker unreachable / blocked / mismatched
  // version) the per-page error count would be `numPages` and we'd
  // report a sentinel-marked unreadable for everyone. The 4th
  // strategy in extractOnePage falls back to disableWorker for
  // image-only / tagged-content pages — but the WHOLE-document path
  // still depends on the initial getDocument honoring whatever
  // worker state was set. Robust loop: attempt with worker; if
  // every page returns unreadable, retry the entire document with
  // disableWorker: true so pdfjs runs on the main thread and is
  // independent of the cross-origin worker fetch entirely.
  let doc: import('pdfjs-dist').PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (e) {
    // getDocument itself failed — likely worker-load failure. Retry
    // with disableWorker.
    doc = await pdfjs.getDocument({ data, disableWorker: true } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  }

  let title = '';
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string } | undefined;
    title = info?.Title?.trim() ?? '';
  } catch { /* metadata is optional */ }

  diag(`getDocument ok numPages=${doc.numPages}`);
  let pages: PdfPage[] = [];
  let totalChars = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const r = await extractOnePage(doc, i);
    pages.push(r);
    totalChars += r.text.length;
    if (i <= 3 || isUnreadable(r) || !r.text) {
      // Log first 3 pages always + any error/empty for diagnosis
      diag(`page ${i}: chars=${r.text.length} unreadable=${isUnreadable(r)} preview="${r.text.slice(0, 60).replace(/\s+/g, ' ')}"`);
    }
  }
  diag(`extraction summary: total=${pages.length} unreadable=${pages.filter(isUnreadable).length} empty=${pages.filter(p => !isUnreadable(p) && !p.text).length} ok=${pages.filter(p => !isUnreadable(p) && p.text).length} totalChars=${totalChars}`);

  // Whole-document worker-failure retry. If EVERY page came back as
  // unreadable, the most likely cause is the cross-origin worker
  // (cdn.jsdelivr.net/pdfjs-dist/...pdf.worker.min.mjs) failed to
  // load OR fails on every getTextContent call — Safari + a stale SW
  // intercepting the worker fetch produced this exact pattern in the
  // May 2026 user report (every page of Vineland-3 unreadable, even
  // though pdfjs's main module loaded fine). Re-running getDocument
  // with `disableWorker: true` puts the parser on the main thread,
  // independent of the cross-origin worker entirely.
  const allUnreadable = pages.length > 0 && pages.every(isUnreadable);
  if (allUnreadable && doc.numPages > 0) {
    doc.destroy();
    try {
      const docMain = await pdfjs.getDocument({
        data,
        disableWorker: true,
      } as Parameters<typeof pdfjs.getDocument>[0]).promise;
      const retryPages: PdfPage[] = [];
      let retryChars = 0;
      for (let i = 1; i <= docMain.numPages; i++) {
        const r = await extractOnePage(docMain, i);
        retryPages.push(r);
        retryChars += r.text.length;
      }
      docMain.destroy();
      // Only commit the retry if it actually moved the needle —
      // i.e. at least one page came back not-unreadable.
      const retryHelped = retryPages.some((p) => !isUnreadable(p));
      if (retryHelped) {
        pages = retryPages;
        totalChars = retryChars;
      }
    } catch {
      // Retry-mode getDocument failed. Keep the original results
      // (already sentinel-marked) — the user gets graceful "image-
      // only" tiles rather than a hard error.
    }
  } else {
    doc.destroy();
  }
  return { pages, title, totalChars };
}

/** Sentinel marker on text that came from the error path. Speak / read-
 *  all callers MUST filter on `isUnreadable(page)` before treating the
 *  text as content — otherwise an error placeholder ends up read aloud
 *  to the AAC user. (May 2026 user report: PDF reader looping the
 *  "could not be read" message via Read all.) */
/** SECURITY: This sentinel must not be exposed as user-configurable. R13 review. */
export const PDF_UNREADABLE_PREFIX = '⛔ ';

export function isUnreadable(page: PdfPage): boolean {
  return typeof page.text === 'string' &&
    page.text.startsWith(PDF_UNREADABLE_PREFIX) &&
    page.text.length < 200; // real PDF text starting with ⛔ would be longer
}

/** Per-page extraction with TWO fallback strategies. Designed so a
 *  failure inside one pdfjs option set falls through to the next
 *  instead of becoming a permanent error placeholder. The page text
 *  ends up in one of three states:
 *    1. Real extracted text (success)
 *    2. '' empty (no text layer — image-only / handwritten scan)
 *    3. PDF_UNREADABLE_PREFIX + reason (every strategy threw — true
 *       failure, surfaced to UI but filtered out of speak / read-all)
 */
async function extractOnePage(
  doc: import('pdfjs-dist').PDFDocumentProxy,
  i: number,
): Promise<PdfPage> {
  let page: import('pdfjs-dist').PDFPageProxy | null = null;
  try {
    page = await doc.getPage(i);
  } catch (e) {
    return {
      pageNumber: i,
      text: `${PDF_UNREADABLE_PREFIX}Page ${i} — getPage failed: ${e instanceof Error ? e.message : 'unknown'}`,
    };
  }

  // Try strategies in order. Each catches its own throw so a single
  // failure mode doesn't kill the page — image-only PDFs in particular
  // tend to throw inside pdfjs's normalization walk on tagged content,
  // which in Safari surfaces as "undefined is not a function (near
  // '...t of e...')". Strategy 3 (no options at all) is the last
  // resort.
  const strategies: Array<() => Promise<unknown>> = [
    () => page!.getTextContent({
      includeMarkedContent: false,
      disableNormalization: true,
    } as Parameters<typeof page['getTextContent']>[0]),
    () => page!.getTextContent({
      includeMarkedContent: true,
    } as Parameters<typeof page['getTextContent']>[0]),
    () => page!.getTextContent(),
  ];

  let text = '';
  let strategyOk = false;
  const errors: string[] = [];
  for (const strat of strategies) {
    try {
      const content = await strat();
      const rawItems: unknown[] = Array.isArray((content as { items?: unknown }).items)
        ? (content as { items: unknown[] }).items
        : [];
      const strs: string[] = [];
      for (const it of rawItems) {
        const s = (it as { str?: unknown })?.str;
        if (typeof s === 'string') strs.push(s);
      }
      text = strs.join(' ').replace(/\s+/g, ' ').trim();
      strategyOk = true;
      break;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'unknown');
    }
  }

  try { page.cleanup(); } catch { /* non-fatal */ }

  if (!strategyOk) {
    // Every strategy threw → this is a true unreadable page. Surface
    // a sentinel-prefixed message that callers filter out of speak /
    // read-all flows. The first strategy's error is the most
    // diagnostic.
    return {
      pageNumber: i,
      text: `${PDF_UNREADABLE_PREFIX}Page ${i} — could not be read: ${errors[0]?.slice(0, 120) || 'unknown'}`,
    };
  }

  // strategyOk === true. text is either real content or empty (image-
  // only / handwritten-scan PDFs have no text layer; pdfjs returns
  // items=[] without throwing, which is correct behavior — we surface
  // empty rather than fake an error).
  return { pageNumber: i, text };
}
