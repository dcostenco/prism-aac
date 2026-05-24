/**
 * LocalAISettings — Ollama detection state + model list tests
 *
 * Covers: checking state (pulse indicator), offline state, online state +
 * model list render, installed vs not_installed status, Refresh button,
 * URL input shown when offline, model labels.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import LocalAISettings from '@/components/LocalAISettings';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const makeTagsResponse = (modelNames: string[] = []) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ models: modelNames.map((name) => ({ name })) }),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── checking state ────────────────────────────────────────────────────────────

describe('LocalAISettings — checking state', () => {
  it('shows "Checking Ollama…" while request is in flight', async () => {
    // Hang the request indefinitely
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LocalAISettings />);
    // The component sets ollamaOnline=null initially, showing "Checking"
    expect(screen.getByText(/checking ollama/i)).toBeInTheDocument();
  });
});

// ── offline state ─────────────────────────────────────────────────────────────

describe('LocalAISettings — offline state', () => {
  it('shows "Ollama not found" when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('refused'));
    render(<LocalAISettings />);
    await waitFor(() => {
      expect(screen.getByText(/ollama not found/i)).toBeInTheDocument();
    });
  });

  it('shows Ollama URL input when offline', async () => {
    fetchMock.mockRejectedValue(new Error('refused'));
    render(<LocalAISettings />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('http://localhost:11434')).toBeInTheDocument();
    });
  });
});

// ── online state ──────────────────────────────────────────────────────────────

describe('LocalAISettings — online state', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(() => makeTagsResponse([]));
  });

  it('shows "Ollama connected" when tags API responds ok', async () => {
    render(<LocalAISettings />);
    await waitFor(() => {
      expect(screen.getByText(/ollama connected/i)).toBeInTheDocument();
    });
  });

  it('renders all four Prism model labels', async () => {
    render(<LocalAISettings />);
    await waitFor(() => {
      expect(screen.getByText(/prism 1\.7b/i)).toBeInTheDocument();
      expect(screen.getByText(/prism 8b/i)).toBeInTheDocument();
      expect(screen.getByText(/prism 14b/i)).toBeInTheDocument();
      expect(screen.getByText(/prism 32b/i)).toBeInTheDocument();
    });
  });

  it('models not in the installed list show download button', async () => {
    render(<LocalAISettings />);
    await waitFor(() => {
      // All 4 models not installed → at least 1 "Download" button
      const downloadBtns = screen.getAllByRole('button', { name: /download/i });
      expect(downloadBtns.length).toBeGreaterThan(0);
    });
  });

  it('installed model shows Remove button instead of Download', async () => {
    fetchMock.mockImplementation(() =>
      makeTagsResponse(['dcostenco/prism-coder:1b7']),
    );
    render(<LocalAISettings />);
    await waitFor(() => {
      // Installed model shows "Remove"; non-installed show "Download"
      expect(screen.getAllByText('Remove').length).toBe(1);
      expect(screen.getAllByText('Download').length).toBe(3);
    });
  });
});

// ── refresh button ────────────────────────────────────────────────────────────

describe('LocalAISettings — refresh button', () => {
  it('clicking Refresh re-calls the Ollama API', async () => {
    fetchMock.mockImplementation(() => makeTagsResponse([]));
    render(<LocalAISettings />);
    await waitFor(() => expect(screen.getByText(/ollama connected/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Refresh'));
    // fetch called at least twice (initial + refresh)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
