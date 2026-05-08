'use client';
/**
 * ocr — extract text from an image via Tesseract.js.
 *
 * tesseract.js is dynamic-imported so the ~3 MB worker + the per-
 * language data (~10 MB for English, more for CJK) only download
 * when the user opens the OCR panel for the first time. Subsequent
 * runs in the same session reuse the worker.
 *
 * Used by the OCR Capture panel — the AAC user uploads or pastes a
 * screenshot of a worksheet, the recognized text drops into the
 * message bar, and they tap Speak to hear it. One of the secondary
 * features in the Reddit r/AAC "free Read & Write alternatives"
 * thread (May 2026) — not as critical as speak-on-sentence-end and
 * word highlight, but a useful classroom tool.
 */

export interface OcrSuccess {
  ok: true;
  text: string;
  /** Average character-level confidence (0..100). */
  confidence: number;
}

export interface OcrFailure {
  ok: false;
  error: string;
}

export type OcrResult = OcrSuccess | OcrFailure;

type TesseractWorker = {
  recognize: (image: File | Blob | string) => Promise<{
    data: { text: string; confidence: number };
  }>;
  terminate: () => Promise<void>;
};

type TesseractModule = {
  createWorker: (lang: string) => Promise<TesseractWorker>;
};

let workerByLang = new Map<string, TesseractWorker>();
let initPromiseByLang = new Map<string, Promise<TesseractWorker>>();
let mod: TesseractModule | null = null;

async function getModule(): Promise<TesseractModule> {
  if (mod) return mod;
  mod = (await import('tesseract.js')) as unknown as TesseractModule;
  return mod;
}

async function getWorker(lang: string): Promise<TesseractWorker> {
  const cached = workerByLang.get(lang);
  if (cached) return cached;
  const inflight = initPromiseByLang.get(lang);
  if (inflight) return inflight;
  const promise = (async () => {
    const tesseract = await getModule();
    const worker = await tesseract.createWorker(lang);
    workerByLang.set(lang, worker);
    initPromiseByLang.delete(lang);
    return worker;
  })();
  initPromiseByLang.set(lang, promise);
  return promise;
}

/** Map a PrismAAC language code to a Tesseract traineddata code.
 *  Tesseract uses ISO 639-2/B (3-letter) codes; not every PrismAAC
 *  locale has a direct mapping (e.g. zh has zh-Hans / zh-Hant). */
const TESSERACT_LANG_MAP: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fra', pt: 'por', de: 'deu',
  ro: 'ron', uk: 'ukr', ru: 'rus', ja: 'jpn', ko: 'kor',
  zh: 'chi_sim', ar: 'ara', it: 'ita', pl: 'pol', nl: 'nld',
  he: 'heb', hi: 'hin', vi: 'vie', tr: 'tur', id: 'ind',
};

export function tesseractCodeFor(lang: string): string {
  const base = (lang || 'en').toLowerCase().split(/[-_]/)[0];
  return TESSERACT_LANG_MAP[base] ?? 'eng';
}

export async function runOcr(
  image: File | Blob | string,
  lang: string = 'en',
): Promise<OcrResult> {
  if (!image) {
    return { ok: false, error: 'No image to read.' };
  }
  try {
    const worker = await getWorker(tesseractCodeFor(lang));
    const result = await worker.recognize(image);
    const text = (result.data.text || '').trim();
    if (!text) {
      return { ok: false, error: 'No readable text found in this image.' };
    }
    return { ok: true, text, confidence: Math.round(result.data.confidence) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendlyOcrError(raw) };
  }
}

/** Cleanup hook for tests / page unload. Tesseract workers hold
 *  WebAssembly memory; freeing them when nobody's using OCR is
 *  polite to the AAC user's RAM-constrained device. */
export async function disposeOcr(): Promise<void> {
  const workers = Array.from(workerByLang.values());
  workerByLang = new Map();
  initPromiseByLang = new Map();
  await Promise.all(workers.map((w) => w.terminate().catch(() => {})));
}

function friendlyOcrError(raw: string): string {
  if (/network|fetch|cdn/i.test(raw)) {
    return "Couldn't load the OCR model — check your internet connection.";
  }
  if (/memory|allocation|heap/i.test(raw)) {
    return 'Image is too large for OCR — try a smaller crop.';
  }
  return raw.length > 100 ? raw.slice(0, 97) + '…' : raw;
}
