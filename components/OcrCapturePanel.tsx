'use client';
/**
 * OcrCapturePanel — turn a screenshot or photo into spoken text.
 *
 * Closes the "screenshot reader" line item from the Reddit r/AAC
 * "free Read & Write alternatives" thread (May 2026). The user
 * uploads or pastes an image (worksheet photo, screenshot of a
 * webpage, photographed page), Tesseract.js extracts the text in
 * the user's UI language, and the result drops into the message
 * bar so they can tap Speak (or auto-speak fires via existing
 * sentence-end logic).
 */
import { useCallback, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { runOcr, tesseractCodeFor } from '@/services/ocr';

export default function OcrCapturePanel() {
  const sidePanel = useUIStore((s) => s.sidePanel);
  const close = useUIStore((s) => s.closeSidePanel);
  const { speechRate, speechVolume, language } = useSettingsStore();
  const { setText, activeTone } = useMessageStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; confidence: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    const out = await runOcr(file, language);
    setLoading(false);
    if (out.ok) setResult({ text: out.text, confidence: out.confidence });
    else setError(out.error);
  }, [language, previewUrl]);

  const insertIntoBar = useCallback(() => {
    if (!result) return;
    tapFeedback();
    setText(result.text);
  }, [result, setText]);

  const speakNow = useCallback(() => {
    if (!result) return;
    tapFeedback();
    aacSpeak(result.text, speechRate, speechVolume, activeTone);
  }, [result, speechRate, speechVolume, activeTone]);

  if (sidePanel !== 'ocr-capture') return null;

  // Slim mode when nothing's loaded yet — same pattern AIChatPanel +
  // PdfReaderPanel use so the qwerty underneath gets full natural
  // height instead of being squeezed by a flex-[3] panel claiming
  // space for an empty preview area (per "where is full keyboard"
  // user feedback 2026-05-08).
  const hasContent = !!(previewUrl || loading || error || result);

  if (!hasContent) {
    return (
      <section
        aria-label="OCR capture"
        data-testid="ocr-capture-panel"
        data-state="slim"
        className="shrink-0 surface-bar border-y border-theme"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">👁</span>
            <span className="font-bold">Screenshot Reader (OCR)</span>
            <span className="text-xs text-muted hidden sm:inline">— lang: {tesseractCodeFor(language)} — pick an image to read</span>
          </div>
          <div className="flex items-center gap-2">
            <label
              data-testid="ocr-capture-pick"
              className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#2196F3] text-white cursor-pointer"
            >
              ＋ Open image
              <input
                type="file"
                accept="image/*"
                onChange={onPick}
                className="hidden"
                data-testid="ocr-capture-input"
              />
            </label>
            <button
              onClick={() => { tapFeedback(); close(); }}
              aria-label="Close OCR"
              className="aac-btn rounded-md px-2 py-1 text-muted text-lg"
            >×</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="OCR capture"
      data-testid="ocr-capture-panel"
      data-state="expanded"
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-theme shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">👁</span>
          <span className="font-bold">Screenshot Reader (OCR)</span>
          <span className="text-xs text-muted">— lang: {tesseractCodeFor(language)}</span>
        </div>
        <div className="flex items-center gap-2">
          <label
            data-testid="ocr-capture-pick"
            className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#2196F3] text-white cursor-pointer"
          >
            ＋ Open image
            <input
              type="file"
              accept="image/*"
              onChange={onPick}
              className="hidden"
              data-testid="ocr-capture-input"
            />
          </label>
          <button
            onClick={() => { tapFeedback(); close(); }}
            aria-label="Close OCR"
            className="aac-btn rounded-md px-2 py-1 text-muted text-lg"
          >×</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold mb-2 text-muted">Image</h3>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Uploaded for OCR"
              data-testid="ocr-capture-preview"
              className="max-w-full rounded-md border border-theme"
            />
          ) : (
            <p className="text-muted">No image yet — tap “＋ Open image”.</p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold mb-2 text-muted">Recognized text</h3>
          {loading && (
            <p className="text-muted animate-pulse" data-testid="ocr-capture-loading">
              Reading the image… (first run downloads the OCR model — may take 10-30 s)
            </p>
          )}
          {error && (
            <p className="text-[#F44336]" data-testid="ocr-capture-error">⚠️ {error}</p>
          )}
          {!loading && result && (
            <>
              <p
                data-testid="ocr-capture-text"
                className="border border-theme rounded-md p-2 text-sm whitespace-pre-wrap leading-relaxed bg-[var(--surface-key)] mb-2"
              >
                {result.text}
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={speakNow}
                  data-testid="ocr-capture-speak"
                  className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white"
                >
                  ▶ Speak
                </button>
                <button
                  onClick={insertIntoBar}
                  data-testid="ocr-capture-insert"
                  className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#FF9800] text-white"
                >
                  ↧ Send to message bar
                </button>
                <span className="text-xs text-muted">confidence: {result.confidence}%</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
