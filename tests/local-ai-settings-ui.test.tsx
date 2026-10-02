/**
 * LocalAISettings — Ollama detection state + model list tests
 *
 * Covers: checking state (pulse indicator), offline state, online state +
 * model list render, installed vs not_installed status, Refresh button,
 * URL input shown when offline, model labels.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  it('shows "Ollama is not running" when nothing answers', async () => {
    fetchMock.mockRejectedValue(new Error('refused'));
    render(<LocalAISettings />);
    await waitFor(() => {
      expect(screen.getByText(/ollama is not running/i)).toBeInTheDocument();
    });
    // The old hint cannot work from an https page (mixed content), so it is gone.
    expect(screen.queryByText(/iOS on same WiFi/i)).not.toBeInTheDocument();
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

// ── platform-aware states (October 2026) ──────────────────────────────────────

describe('LocalAISettings — platform-aware states', () => {
  const origLocation = window.location;
  const origUA = navigator.userAgent;
  const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const setPage = (protocol: string, ua: string) => {
    Object.defineProperty(window, 'location', { configurable: true, value: { ...origLocation, protocol, origin: `${protocol}//synalux.ai` } });
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: ua });
  };
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: origLocation });
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: origUA });
    delete (window as unknown as { prismNativeBridge?: unknown }).prismNativeBridge;
    localStorage.clear();
  });

  it('iOS app: shows the built-in on-device model and never calls Ollama', async () => {
    (window as unknown as { prismNativeBridge?: unknown }).prismNativeBridge = {};
    render(<LocalAISettings />);
    await waitFor(() => expect(screen.getByText(/built into this app/i)).toBeInTheDocument());
    expect(screen.getByText(/works offline and needs no Ollama/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('http://localhost:11434')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Safari on https: explains the block, offers other browsers or the iPad app, no fetch', async () => {
    setPage('https:', SAFARI);
    render(<LocalAISettings />);
    await waitFor(() => expect(screen.getByText(/safari can't reach ollama/i)).toBeInTheDocument());
    expect(screen.getByText(/Chrome, Edge or Firefox/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Ollama running but refusing the site: shows the OLLAMA_ORIGINS command to copy', async () => {
    // The CORS request fails, the opaque no-cors one succeeds → something is listening.
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ ok: false, type: 'opaque' });
    render(<LocalAISettings />);
    await waitFor(() => expect(screen.getByText(/running but blocks this site/i)).toBeInTheDocument());
    // The command itself (the OS-specific form; jsdom's user agent reads as Linux).
    expect(screen.getByText(/launchctl setenv OLLAMA_ORIGINS|setx OLLAMA_ORIGINS|systemctl edit ollama/)).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('a successful connection sets the opt-in flag the background services read', async () => {
    fetchMock.mockReturnValue(makeTagsResponse([]));
    render(<LocalAISettings />);
    await waitFor(() => expect(screen.getByText(/ollama connected/i)).toBeInTheDocument());
    expect(localStorage.getItem('prism-aac-local-ai-connected')).toBe('1');
  });
});

describe('LocalAISettings — revoked permission clears the opt-in (Fable review 2026-10-02)', () => {
  it('permission-denied removes the flag so background services stop probing', async () => {
    const origLocation = window.location;
    const origUA = navigator.userAgent;
    const origPerms = (navigator as unknown as { permissions?: unknown }).permissions;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...origLocation, protocol: 'https:', origin: 'https://synalux.ai' } });
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' });
    Object.defineProperty(window.navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: 'denied' }) } });
    localStorage.setItem('prism-aac-local-ai-connected', '1');
    try {
      render(<LocalAISettings />);
      await waitFor(() => expect(screen.getByText(/local network access is blocked/i)).toBeInTheDocument());
      expect(localStorage.getItem('prism-aac-local-ai-connected')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: origLocation });
      Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: origUA });
      Object.defineProperty(window.navigator, 'permissions', { configurable: true, value: origPerms });
      localStorage.clear();
    }
  });
});
