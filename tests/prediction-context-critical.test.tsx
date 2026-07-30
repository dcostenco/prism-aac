/**
 * Critical AAC prediction-path regressions.
 *
 * The prediction row is an input device, not decorative UI. A user with a
 * slow or sustained touch must get the word that was visible when the press
 * began even if an asynchronous corpus/model refresh reranks that slot before
 * click dispatch. The authored message must also remain unchanged until an
 * explicit key or prediction selection occurs.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PredictionBar from '@/components/PredictionBar';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { startScan, stopScan } from '@/services/switchScanService';

const realUpdatePredictions = usePredictionStore.getState().updatePredictions;
const memoryMocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  hrrInit: vi.fn(async () => true),
  hrrReady: vi.fn(() => false),
  hrrWords: vi.fn(() => []),
}));

vi.mock('@/services/predictionMemoryService', () => ({
  getPredictionSessionScope: (email?: string | null) =>
    email ? `user:${email.trim().toLowerCase()}` : 'anon:test-tab',
  fetchMemoryPredictions: (...args: unknown[]) => memoryMocks.fetch(...args),
}));

vi.mock('@/services/hrrContext', () => ({
  initAacHrr: (...args: unknown[]) => memoryMocks.hrrInit(...args),
  isAacHrrReady: () => memoryMocks.hrrReady(),
  getNextWordSuggestions: (...args: unknown[]) => memoryMocks.hrrWords(...args),
}));

vi.mock('@/services/speechService', () => ({
  speakWord: vi.fn(),
}));

vi.mock('@/services/aacSpeak', () => ({
  aacSpeak: vi.fn(),
}));

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(async () => null),
  pictureModeForProfile: vi.fn(() => 'none'),
}));

vi.mock('@/lib/datadog', () => ({
  ddAction: vi.fn(),
}));

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
}));

beforeEach(async () => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  await loadPredictionSeed('en');
  await ensureLangCorpusLoaded('en');

  useSettingsStore.setState({
    language: 'en',
    outputLanguage: 'en',
    aiAutocorrectEnabled: false,
    cloudPredictionEnabled: false,
    speechRate: 0.5,
    speechVolume: 0.8,
  } as never);
  useUIStore.setState({
    sidePanel: null,
    activeContactId: null,
  } as never);
  useAuthStore.setState({
    profile: null,
    loaded: true,
    loading: false,
  });
  useMessageStore.setState({
    text: '',
    undoStack: [],
  } as never);
  usePredictionStore.setState({
    aiCompletion: null,
    wordFreq: {},
    bigrams: {},
    trigrams: {},
    predictions: [],
    updatePredictions: realUpdatePredictions,
  });
  memoryMocks.fetch.mockReset();
  memoryMocks.fetch.mockResolvedValue([]);
  memoryMocks.hrrInit.mockReset();
  memoryMocks.hrrInit.mockResolvedValue(true);
  memoryMocks.hrrReady.mockReturnValue(false);
  memoryMocks.hrrWords.mockReturnValue([]);
});

afterEach(async () => {
  await act(async () => {
    stopScan();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('critical prediction context and selection identity', () => {
  it('inserts the word visible at press start when the same slot reranks before click', async () => {
    useMessageStore.setState({ text: 'I need my ' } as never);
    usePredictionStore.setState({
      predictions: ['mom', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    const pressedTile = screen.getByRole('button', { name: 'Predict: mom' });

    fireEvent.pointerDown(pressedTile, {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    });

    await act(async () => {
      usePredictionStore.setState({
        predictions: ['need', 'to', 'you', 'I', 'a'],
      });
      await Promise.resolve();
    });

    // The visual must remain frozen for the duration of the touch. A tile
    // changing under a held finger is itself deceptive, even if selection
    // identity is later recovered.
    expect(pressedTile).toHaveAttribute('title', 'mom');
    expect(screen.queryByRole('button', { name: 'Predict: need' })).toBeNull();
    fireEvent.click(pressedTile, { detail: 1 });

    expect(useMessageStore.getState().text).toBe('I need my mom ');
  });

  it('does not let a secondary touch cancellation release the primary word', async () => {
    useMessageStore.setState({ text: 'I need my ' } as never);
    usePredictionStore.setState({
      predictions: ['mom', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    const pressedTile = screen.getByRole('button', { name: 'Predict: mom' });

    fireEvent.pointerDown(pressedTile, {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    });
    fireEvent.pointerDown(pressedTile, {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false,
    });
    fireEvent.pointerCancel(pressedTile, {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false,
    });

    await act(async () => {
      usePredictionStore.setState({
        predictions: ['need', 'to', 'you', 'I', 'a'],
      });
      await Promise.resolve();
    });

    expect(pressedTile).toHaveAttribute('title', 'mom');
    fireEvent.click(pressedTile, { detail: 1 });
    expect(useMessageStore.getState().text).toBe('I need my mom ');
  });

  it('uses the committed two-word context for the exact critical phrase path', () => {
    const store = usePredictionStore.getState();

    store.updatePredictions('I ', 'en');
    expect(usePredictionStore.getState().predictions.map((word) => word.toLowerCase()))
      .toContain('need');

    store.updatePredictions('I need ', 'en');
    expect(usePredictionStore.getState().predictions.map((word) => word.toLowerCase()))
      .toContain('my');

    store.updatePredictions('I need my ', 'en');
    expect(usePredictionStore.getState().predictions.map((word) => word.toLowerCase()))
      .toContain('mom');
  });

  it('does not change authored text merely because predictions rerank', async () => {
    useMessageStore.setState({ text: 'I need my mom' } as never);
    usePredictionStore.setState({
      predictions: ['my', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    await act(async () => {
      usePredictionStore.setState({
        predictions: ['need', 'my', 'to', 'you', 'I'],
      });
      await Promise.resolve();
    });

    expect(useMessageStore.getState().text).toBe('I need my mom');
  });

  it('keeps a switch/keyboard-focused card semantically frozen during rerank', async () => {
    useMessageStore.setState({ text: 'I need my ' } as never);
    usePredictionStore.setState({
      predictions: ['mom', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    const focusedTile = screen.getByRole('button', { name: 'Predict: mom' });
    act(() => focusedTile.focus());

    await act(async () => {
      usePredictionStore.setState({
        predictions: ['need', 'to', 'you', 'I', 'a'],
      });
      await Promise.resolve();
    });

    expect(focusedTile).toHaveAttribute('title', 'mom');
    fireEvent.click(focusedTile, { detail: 0 });
    expect(useMessageStore.getState().text).toBe('I need my mom ');

    await act(async () => {
      usePredictionStore.setState({
        predictions: ['help', 'to', 'you', 'I', 'a'],
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(focusedTile).toHaveAttribute('title', 'help');
    });
    fireEvent.click(focusedTile, { detail: 0 });
    expect(useMessageStore.getState().text).toBe('I need my mom help ');
  });

  it('selects the originally highlighted word through the real switch scanner after rerank', async () => {
    useMessageStore.setState({ text: 'I need my ' } as never);
    usePredictionStore.setState({
      predictions: ['mom', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    const highlightedTile = screen.getByRole('button', { name: 'Predict: mom' });
    const scanTiles = screen.getAllByRole('button', { name: /^Predict:/ });
    for (const tile of scanTiles) {
      tile.style.position = 'fixed';
      tile.scrollIntoView = vi.fn();
    }

    await act(async () => {
      startScan({
        enabled: true,
        mode: 'manual',
        groupScan: false,
        loops: 5,
      });
      const targetIndex = scanTiles.indexOf(highlightedTile);
      for (let index = 0; index < targetIndex; index += 1) {
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        }));
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => {
      expect(highlightedTile).toHaveClass('switch-scan-active');
      expect(highlightedTile).toHaveAttribute('title', 'mom');
    });

    await act(async () => {
      usePredictionStore.setState({
        predictions: ['need', 'to', 'you', 'I', 'a'],
      });
      await Promise.resolve();
    });

    expect(highlightedTile).toHaveAttribute('title', 'mom');
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(useMessageStore.getState().text).toBe('I need my mom ');

    await act(async () => {
      usePredictionStore.setState({
        predictions: ['help', 'to', 'you', 'I', 'a'],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => {
      expect(highlightedTile).toHaveAttribute('title', 'help');
      expect(highlightedTile).toHaveClass('switch-scan-active');
    });

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(useMessageStore.getState().text).toBe('I need my mom help ');
  });

  it('does not call cloud memory when its separate opt-in is disabled', async () => {
    vi.useFakeTimers();
    try {
      useMessageStore.setState({ text: 'I need ' } as never);
      usePredictionStore.setState({
        predictions: ['help', 'to', 'you', 'I', 'a'],
        updatePredictions: vi.fn(),
      });

      render(<PredictionBar />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(memoryMocks.fetch).not.toHaveBeenCalled();
      expect(useMessageStore.getState().text).toBe('I need ');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not send an anonymous AAC phrase to cloud prediction', async () => {
    vi.useFakeTimers();
    try {
      useSettingsStore.setState({ cloudPredictionEnabled: true } as never);
      useMessageStore.setState({ text: 'I need ' } as never);
      usePredictionStore.setState({
        predictions: ['help', 'to', 'you', 'I', 'a'],
        updatePredictions: vi.fn(),
      });

      render(<PredictionBar />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(memoryMocks.fetch).not.toHaveBeenCalled();
      expect(useMessageStore.getState().text).toBe('I need ');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a stale memory response after the authored context changes', async () => {
    let resolveStale!: (words: string[]) => void;
    memoryMocks.fetch
      .mockReturnValueOnce(new Promise((resolve) => { resolveStale = resolve; }))
      .mockResolvedValueOnce(['grandma']);
    useSettingsStore.setState({ cloudPredictionEnabled: true } as never);
    useAuthStore.setState({
      profile: {
        email: 'aac@example.com',
        name: 'AAC User',
        plan: 'free',
        isPlatformAdmin: false,
      },
    });
    useMessageStore.setState({ text: 'I need ' } as never);
    usePredictionStore.setState({
      predictions: ['help', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    await waitFor(() => expect(memoryMocks.fetch).toHaveBeenCalledTimes(1), {
      timeout: 1_500,
    });

    act(() => {
      useMessageStore.setState({ text: 'I need my ' } as never);
    });
    await waitFor(() => expect(memoryMocks.fetch).toHaveBeenCalledTimes(2), {
      timeout: 2_000,
    });
    expect(await screen.findByRole('button', { name: 'Predict: grandma' }))
      .toBeVisible();

    await act(async () => {
      resolveStale(['yesterday']);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Predict: yesterday' })).toBeNull();
    expect(useMessageStore.getState().text).toBe('I need my ');
  }, 5_000);

  it('aborts User A prediction and rejects it after an account switch', async () => {
    let resolveUserA!: (words: string[]) => void;
    memoryMocks.fetch
      .mockReturnValueOnce(new Promise((resolve) => { resolveUserA = resolve; }))
      .mockResolvedValueOnce(['grandma']);
    useSettingsStore.setState({ cloudPredictionEnabled: true } as never);
    useAuthStore.setState({
      profile: {
        email: 'user-a@example.com',
        name: 'User A',
        plan: 'free',
        isPlatformAdmin: false,
      },
    });
    useMessageStore.setState({ text: 'I need my ' } as never);
    usePredictionStore.setState({
      predictions: ['mom', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    await waitFor(() => expect(memoryMocks.fetch).toHaveBeenCalledTimes(1), {
      timeout: 1_500,
    });
    const userASignal = (
      memoryMocks.fetch.mock.calls[0][2] as { signal: AbortSignal }
    ).signal;
    expect(userASignal.aborted).toBe(false);

    act(() => {
      useAuthStore.setState({
        profile: {
          email: 'user-b@example.com',
          name: 'User B',
          plan: 'free',
          isPlatformAdmin: false,
        },
      });
    });
    await waitFor(() => expect(memoryMocks.fetch).toHaveBeenCalledTimes(2), {
      timeout: 2_500,
    });
    expect(userASignal.aborted).toBe(true);
    expect(memoryMocks.fetch.mock.calls[1][2]).toEqual(expect.objectContaining({
      sessionScope: 'user:user-b@example.com',
    }));
    expect(await screen.findByRole('button', { name: 'Predict: grandma' }))
      .toBeVisible();

    await act(async () => {
      resolveUserA(['yesterday']);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Predict: yesterday' })).toBeNull();
    expect(useMessageStore.getState().text).toBe('I need my ');
  }, 6_000);

  it('rejects a late English prediction after switching the authored language', async () => {
    let resolveEnglish!: (words: string[]) => void;
    memoryMocks.fetch
      .mockReturnValueOnce(new Promise((resolve) => { resolveEnglish = resolve; }))
      .mockResolvedValueOnce(['ayuda']);
    useSettingsStore.setState({ cloudPredictionEnabled: true } as never);
    useAuthStore.setState({
      profile: {
        email: 'aac@example.com',
        name: 'AAC User',
        plan: 'free',
        isPlatformAdmin: false,
      },
    });
    useMessageStore.setState({ text: 'I need ' } as never);
    usePredictionStore.setState({
      predictions: ['help', 'to', 'you', 'I', 'a'],
      updatePredictions: vi.fn(),
    });

    render(<PredictionBar />);
    await waitFor(() => expect(memoryMocks.fetch).toHaveBeenCalledTimes(1), {
      timeout: 1_500,
    });

    await loadPredictionSeed('es');
    await ensureLangCorpusLoaded('es');
    act(() => {
      useSettingsStore.setState({
        language: 'es',
        outputLanguage: 'es',
      } as never);
      useMessageStore.setState({ text: 'yo necesito ' } as never);
      usePredictionStore.setState({
        predictions: ['ayuda', 'agua', 'más', 'yo', 'sí'],
      });
    });
    await waitFor(() => expect(memoryMocks.fetch).toHaveBeenCalledTimes(2), {
      timeout: 2_500,
    });
    expect(memoryMocks.fetch.mock.calls[1][1]).toBe('es');
    expect(await screen.findByRole('button', { name: 'Predict: ayuda' }))
      .toBeVisible();

    await act(async () => {
      resolveEnglish(['yesterday']);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Predict: yesterday' })).toBeNull();
    expect(useMessageStore.getState().text).toBe('yo necesito ');
  }, 7_000);
});
