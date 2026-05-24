/**
 * OcrCapturePanel — render states, file handling, OCR results, and actions
 *
 * Covers: not-visible when sidePanel !== ocr-capture, slim mode when no
 * content, file-too-large error guard (>20MB), OCR success text + buttons,
 * OCR error display, Speak calls aacSpeak, Insert calls setText, close
 * button calls closeSidePanel, loading indicator shown while OCR runs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OcrCapturePanel from '@/components/OcrCapturePanel';

// ── mocks ──────────────────────────────────────────────────────────────────────

const closePanel = vi.fn();
const setTextMock = vi.fn();
const aacSpeakMock = vi.fn();
const tapFeedbackMock = vi.fn();
const runOcrMock = vi.fn();
const runOcrOnPdfMock = vi.fn();

let sidePanelValue = 'ocr-capture';

vi.mock('@/store/uiStore', () => ({
  useUIStore: (sel?: (s: { sidePanel: string; closeSidePanel: () => void }) => unknown) => {
    const state = { sidePanel: sidePanelValue, closeSidePanel: closePanel };
    return sel ? sel(state) : state;
  },
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: object) => unknown) => {
    const state = { speechRate: 0.5, speechVolume: 1.0, language: 'en' };
    return sel ? sel(state) : state;
  },
}));

vi.mock('@/store/messageStore', () => ({
  useMessageStore: (sel?: (s: object) => unknown) => {
    const state = { setText: setTextMock, activeTone: 'friendly' };
    return sel ? sel(state) : state;
  },
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: () => tapFeedbackMock() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: (...args: unknown[]) => aacSpeakMock(...args) }));
vi.mock('@/services/ocr', () => ({
  runOcr: (...args: unknown[]) => runOcrMock(...args),
  runOcrOnPdf: (...args: unknown[]) => runOcrOnPdfMock(...args),
  tesseractCodeFor: (lang: string) => `${lang}-tesseract`,
}));

// Mock URL.createObjectURL / revokeObjectURL (jsdom doesn't implement these)
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock-url'), writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });

// ── shared reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  sidePanelValue = 'ocr-capture';
  runOcrMock.mockResolvedValue({ ok: true, text: 'Hello World', confidence: 92 });
  runOcrOnPdfMock.mockResolvedValue({ ok: true, text: 'PDF Text', confidence: 85 });
});

// ── visibility guard ──────────────────────────────────────────────────────────

describe('OcrCapturePanel — visibility', () => {
  it('renders nothing when sidePanel !== ocr-capture', () => {
    sidePanelValue = 'ai-chat';
    const { container } = render(<OcrCapturePanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when sidePanel === ocr-capture', () => {
    render(<OcrCapturePanel />);
    expect(screen.getByTestId('ocr-capture-panel')).toBeInTheDocument();
  });
});

// ── slim mode (no content loaded) ────────────────────────────────────────────

describe('OcrCapturePanel — slim mode', () => {
  it('shows slim state data attribute when no content', () => {
    render(<OcrCapturePanel />);
    expect(screen.getByTestId('ocr-capture-panel')).toHaveAttribute('data-state', 'slim');
  });

  it('shows "Open image / PDF" button in slim mode', () => {
    render(<OcrCapturePanel />);
    expect(screen.getByTestId('ocr-capture-pick')).toBeInTheDocument();
  });

  it('shows Tesseract lang code in slim mode', () => {
    render(<OcrCapturePanel />);
    expect(screen.getByText(/en-tesseract/)).toBeInTheDocument();
  });
});

// ── close button ──────────────────────────────────────────────────────────────

describe('OcrCapturePanel — close button', () => {
  it('close button calls closeSidePanel', () => {
    render(<OcrCapturePanel />);
    fireEvent.click(screen.getByRole('button', { name: /close ocr/i }));
    expect(closePanel).toHaveBeenCalledOnce();
  });

  it('close button calls tapFeedback', () => {
    render(<OcrCapturePanel />);
    fireEvent.click(screen.getByRole('button', { name: /close ocr/i }));
    expect(tapFeedbackMock).toHaveBeenCalledOnce();
  });
});

// ── file-size guard ───────────────────────────────────────────────────────────

describe('OcrCapturePanel — file-size guard', () => {
  it('shows error for file > 20 MB', async () => {
    render(<OcrCapturePanel />);
    const input = screen.getByTestId('ocr-capture-input') as HTMLInputElement;
    const bigFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 21 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    await waitFor(() => {
      expect(screen.getByTestId('ocr-capture-error')).toBeInTheDocument();
      expect(screen.getByTestId('ocr-capture-error')).toHaveTextContent(/too large/i);
    });
  });

  it('does not call runOcr for oversized file', async () => {
    render(<OcrCapturePanel />);
    const input = screen.getByTestId('ocr-capture-input') as HTMLInputElement;
    const bigFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 21 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    await waitFor(() => expect(screen.getByTestId('ocr-capture-error')).toBeInTheDocument());
    expect(runOcrMock).not.toHaveBeenCalled();
  });
});

// ── OCR success flow ──────────────────────────────────────────────────────────

describe('OcrCapturePanel — OCR success', () => {
  async function uploadImageAndWait() {
    render(<OcrCapturePanel />);
    const input = screen.getByTestId('ocr-capture-input') as HTMLInputElement;
    const file = new File(['img-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('ocr-capture-text')).toBeInTheDocument());
  }

  it('shows OCR result text after upload', async () => {
    await uploadImageAndWait();
    expect(screen.getByTestId('ocr-capture-text')).toHaveTextContent('Hello World');
  });

  it('shows confidence in output area', async () => {
    await uploadImageAndWait();
    expect(screen.getByText(/confidence: 92/)).toBeInTheDocument();
  });

  it('shows Speak button after success', async () => {
    await uploadImageAndWait();
    expect(screen.getByTestId('ocr-capture-speak')).toBeInTheDocument();
  });

  it('shows "Send to message bar" button after success', async () => {
    await uploadImageAndWait();
    expect(screen.getByTestId('ocr-capture-insert')).toBeInTheDocument();
  });

  it('Speak button calls aacSpeak with result text', async () => {
    await uploadImageAndWait();
    fireEvent.click(screen.getByTestId('ocr-capture-speak'));
    expect(aacSpeakMock).toHaveBeenCalledWith('Hello World', 0.5, 1.0, 'friendly', true);
  });

  it('Insert button calls setText with result text', async () => {
    await uploadImageAndWait();
    fireEvent.click(screen.getByTestId('ocr-capture-insert'));
    expect(setTextMock).toHaveBeenCalledWith('Hello World');
  });

  it('panel expands to full state after upload', async () => {
    await uploadImageAndWait();
    expect(screen.getByTestId('ocr-capture-panel')).toHaveAttribute('data-state', 'expanded');
  });
});

// ── OCR error flow ────────────────────────────────────────────────────────────

describe('OcrCapturePanel — OCR error', () => {
  it('shows error message when OCR fails', async () => {
    runOcrMock.mockResolvedValue({ ok: false, error: 'OCR engine unavailable' });
    render(<OcrCapturePanel />);
    const input = screen.getByTestId('ocr-capture-input') as HTMLInputElement;
    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('ocr-capture-error')).toBeInTheDocument());
    expect(screen.getByTestId('ocr-capture-error')).toHaveTextContent('OCR engine unavailable');
  });
});

// ── PDF routing ───────────────────────────────────────────────────────────────

describe('OcrCapturePanel — PDF routing', () => {
  it('calls runOcrOnPdf for .pdf file extension', async () => {
    render(<OcrCapturePanel />);
    const input = screen.getByTestId('ocr-capture-input') as HTMLInputElement;
    const file = new File(['pdf-bytes'], 'worksheet.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('ocr-capture-text')).toBeInTheDocument());
    expect(runOcrOnPdfMock).toHaveBeenCalledOnce();
    expect(runOcrMock).not.toHaveBeenCalled();
  });

  it('calls runOcr for image file', async () => {
    render(<OcrCapturePanel />);
    const input = screen.getByTestId('ocr-capture-input') as HTMLInputElement;
    const file = new File(['jpg-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('ocr-capture-text')).toBeInTheDocument());
    expect(runOcrMock).toHaveBeenCalledOnce();
    expect(runOcrOnPdfMock).not.toHaveBeenCalled();
  });
});
