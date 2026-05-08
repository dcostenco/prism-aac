'use client';
/**
 * PdfReaderPanel — open a PDF, see one tile per page, tap to speak.
 *
 * Closes the "PDF reader" line item from the Reddit r/AAC "free
 * Read & Write alternatives" thread (May 2026). No Adobe Reader, no
 * native plugin — pdfjs-dist runs entirely in the browser, the
 * extracted text is fed into the existing aacSpeak() chain so it
 * gets the same voice + tone + speakOnSentenceEnd parity as the rest
 * of the app.
 */
import { useCallback, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { extractPdfText, type PdfPage } from '@/services/pdfReader';

interface LoadedPdf {
  title: string;
  fileName: string;
  pages: PdfPage[];
  totalChars: number;
}

export default function PdfReaderPanel() {
  const sidePanel = useUIStore((s) => s.sidePanel);
  const close = useUIStore((s) => s.closeSidePanel);
  const { speechRate, speechVolume } = useSettingsStore();
  const activeTone = useMessageStore((s) => s.activeTone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<LoadedPdf | null>(null);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setDoc(null);
    try {
      const result = await extractPdfText(file);
      setDoc({
        title: result.title || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        pages: result.pages,
        totalChars: result.totalChars,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this PDF.');
    } finally {
      setLoading(false);
    }
  }, []);

  const speakPage = useCallback((page: PdfPage) => {
    tapFeedback();
    if (!page.text) return;
    aacSpeak(page.text, speechRate, speechVolume, activeTone);
  }, [speechRate, speechVolume, activeTone]);

  const speakAll = useCallback(() => {
    if (!doc || doc.pages.length === 0) return;
    tapFeedback();
    const all = doc.pages.map((p) => p.text).filter(Boolean).join(' ');
    if (all) aacSpeak(all, speechRate, speechVolume, activeTone);
  }, [doc, speechRate, speechVolume, activeTone]);

  if (sidePanel !== 'pdf-reader') return null;

  return (
    <section
      aria-label="PDF reader"
      data-testid="pdf-reader-panel"
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-theme shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <span className="font-bold">PDF Reader</span>
          {doc && <span className="text-sm text-muted">— {doc.title} ({doc.pages.length} pages)</span>}
        </div>
        <div className="flex items-center gap-2">
          {doc && (
            <button
              onClick={speakAll}
              data-testid="pdf-reader-speak-all"
              className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white"
            >
              ▶ Read all
            </button>
          )}
          <label
            data-testid="pdf-reader-pick"
            className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#2196F3] text-white cursor-pointer"
          >
            {doc ? '↺ Open another' : '＋ Open PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={onPick}
              className="hidden"
              data-testid="pdf-reader-input"
            />
          </label>
          <button
            onClick={() => { tapFeedback(); close(); }}
            aria-label="Close PDF reader"
            className="aac-btn rounded-md px-2 py-1 text-muted text-lg"
          >×</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-muted animate-pulse" data-testid="pdf-reader-loading">
            Loading PDF…
          </p>
        )}
        {error && (
          <p className="text-[#F44336]" data-testid="pdf-reader-error">⚠️ {error}</p>
        )}
        {!loading && !error && !doc && (
          <p className="text-muted">
            Tap “＋ Open PDF” to pick a document. Each page becomes a tile you can tap to hear it spoken.
          </p>
        )}
        {doc && doc.pages.length === 0 && (
          <p className="text-muted" data-testid="pdf-reader-empty">
            This PDF has no readable text — it might be scanned images. Try the OCR tool instead.
          </p>
        )}
        {doc && doc.pages.length > 0 && (
          <ul className="space-y-2" data-testid="pdf-reader-page-list">
            {doc.pages.map((page) => (
              <li
                key={page.pageNumber}
                className="border border-theme rounded-lg p-3 surface-key"
                data-testid={`pdf-reader-page-${page.pageNumber}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => speakPage(page)}
                    aria-label={`Read page ${page.pageNumber}`}
                    className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white shrink-0"
                  >
                    ▶ Page {page.pageNumber}
                  </button>
                  <p className="text-sm leading-relaxed line-clamp-3 flex-1">
                    {page.text || <em className="text-muted">(empty page)</em>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
