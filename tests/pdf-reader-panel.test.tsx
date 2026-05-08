/**
 * PdfReaderPanel — slim-when-empty layout invariant.
 *
 * Mirrors the AIChatPanel slim/expanded state machine. Before a doc
 * is loaded the panel renders as a single-row strip (header + Open
 * PDF + ✕) with `shrink-0`, NOT a flex-[3] block — so the qwerty
 * underneath keeps its full natural height instead of being squeezed
 * by an empty page-list scroll area.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PdfReaderPanel from '@/components/PdfReaderPanel';
import { useUIStore } from '@/store/uiStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

beforeEach(() => {
  useUIStore.setState({ sidePanel: 'pdf-reader' });
});

describe('PdfReaderPanel — slim mode when no doc loaded', () => {
  it('renders slim strip (shrink-0, NOT flex-[3]) before a PDF is picked', () => {
    render(<PdfReaderPanel />);
    const panel = screen.getByTestId('pdf-reader-panel');
    expect(panel).toHaveAttribute('data-state', 'slim');
    expect(panel.className).toMatch(/shrink-0/);
    expect(panel.className).not.toMatch(/flex-\[3\]/);
  });

  it('exposes the Open PDF picker affordance in slim mode', () => {
    render(<PdfReaderPanel />);
    expect(screen.getByTestId('pdf-reader-pick')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-reader-input')).toBeInTheDocument();
  });

  it('does NOT render when sidePanel !== pdf-reader', () => {
    useUIStore.setState({ sidePanel: 'none' });
    const { container } = render(<PdfReaderPanel />);
    expect(container.querySelector('[data-testid="pdf-reader-panel"]')).toBeNull();
  });
});
