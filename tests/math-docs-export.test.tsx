import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SerializedMathGrid } from '@/engine/mathGrid';
import MathDocsTool from '@/components/math/MathDocsTool';
import { useMathGridStore } from '@/store/mathGridStore';

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn() }));

const exportsMock = vi.hoisted(() => ({
  copyMathGridImage: vi.fn(),
  saveMathGridPdf: vi.fn(),
  saveMathGridFile: vi.fn(),
  pickMathGridFile: vi.fn(),
  parseMathDocumentFile: vi.fn(),
}));

vi.mock('@/services/mathExport', () => exportsMock);

const CURRENT: SerializedMathGrid = {
  cells: [['0,0', { glyph: '9' }]],
  decorations: [],
  cursor: { r: 0, c: 1 },
  viewport: { cellSizePx: 56, scale: 1, panX: 0, panY: 0 },
};

const RESTORED: SerializedMathGrid = {
  cells: [['0,0', { glyph: '1' }], ['0,1', { glyph: '÷' }], ['0,2', { glyph: '3' }]],
  decorations: [{ type: 'fraction-bar', anchor: { r: 1, c: 0 }, length: 3 }],
  cursor: { r: 0, c: 3 },
  viewport: { cellSizePx: 56, scale: 1, panX: 0, panY: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useMathGridStore.getState().reset();
  exportsMock.copyMathGridImage.mockResolvedValue('copied');
  exportsMock.saveMathGridPdf.mockResolvedValue('saved');
  exportsMock.saveMathGridFile.mockResolvedValue('saved');
  exportsMock.pickMathGridFile.mockResolvedValue(null);
  exportsMock.parseMathDocumentFile.mockReturnValue(null);
});

async function openActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('math-docs-open-toggle'));
}

describe('MathDocsTool portable export actions', () => {
  it('shows image, PDF, file save, and restore actions without the removed text clipboard controls', async () => {
    const user = userEvent.setup();
    render(<MathDocsTool />);

    await openActions(user);

    expect(screen.getByRole('button', { name: 'Copy current math as an image' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save current math as PDF' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save math document to a file' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore math document from a file' })).toBeVisible();
    expect(screen.queryByTestId('math-docs-copy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('math-docs-paste')).not.toBeInTheDocument();
  });

  it('exports the current grid through each visible action', async () => {
    useMathGridStore.getState().loadFromSerialized(CURRENT);
    const user = userEvent.setup();
    render(<MathDocsTool />);

    await openActions(user);
    await user.click(screen.getByTestId('math-docs-copy-image'));
    expect(exportsMock.copyMathGridImage).toHaveBeenCalledWith(CURRENT);
    expect(screen.getByRole('status')).toHaveTextContent('Copied math image');

    await openActions(user);
    await user.click(screen.getByTestId('math-docs-save-pdf'));
    expect(exportsMock.saveMathGridPdf).toHaveBeenCalledWith(CURRENT, 'prism-math');
    expect(screen.getByRole('status')).toHaveTextContent('Saved PDF');

    await openActions(user);
    await user.click(screen.getByTestId('math-docs-save-file'));
    expect(exportsMock.saveMathGridFile).toHaveBeenCalledWith(CURRENT, 'prism-math');
    expect(screen.getByRole('status')).toHaveTextContent('Saved math file');
  });

  it('restores a chosen file, preserves its name, and leaves the current grid unchanged on cancellation', async () => {
    useMathGridStore.getState().loadFromSerialized(CURRENT);
    exportsMock.pickMathGridFile.mockResolvedValueOnce(null).mockResolvedValueOnce({ name: 'Division work', body: RESTORED });
    const user = userEvent.setup();
    render(<MathDocsTool />);

    await openActions(user);
    await user.click(screen.getByTestId('math-docs-restore-file'));
    expect(useMathGridStore.getState().toSerialized()).toEqual(CURRENT);

    await user.click(screen.getByTestId('math-docs-restore-file'));
    expect(useMathGridStore.getState().toSerialized()).toEqual(RESTORED);
    expect(screen.getByRole('status')).toHaveTextContent('Restored math file');

    await user.click(screen.getByTestId('math-docs-save'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved as Division work');
  });

  it('uses the upload fallback and rejects invalid files without replacing the current grid', async () => {
    useMathGridStore.getState().loadFromSerialized(CURRENT);
    exportsMock.pickMathGridFile.mockResolvedValue(undefined);
    exportsMock.parseMathDocumentFile.mockReturnValueOnce(null).mockReturnValueOnce({ name: 'Imported', body: RESTORED });
    const user = userEvent.setup();
    render(<MathDocsTool />);

    await openActions(user);
    await user.click(screen.getByTestId('math-docs-restore-file'));
    const input = screen.getByTestId('math-docs-restore-input');
    await user.upload(input, new File(['invalid'], 'bad.json', { type: 'application/json' }));
    expect(useMathGridStore.getState().toSerialized()).toEqual(CURRENT);
    expect(screen.getByRole('status')).toHaveTextContent('not a valid Prism Math document');

    await user.upload(input, new File(['valid'], 'good.json', { type: 'application/json' }));
    expect(useMathGridStore.getState().toSerialized()).toEqual(RESTORED);
  });
});
