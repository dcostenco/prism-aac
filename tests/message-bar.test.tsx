/**
 * MessageBar — core action button + display tests
 *
 * Covers: text display via role=status, auto-speak toggle (aria-pressed),
 * undo action, speak action (calls aacSpeak), delete short-press (deleteLastWord),
 * tone button free-tier gate.
 *
 * Heavy async effects (TTS highlight, debounced autocorrect) are mocked.
 * All store getState() calls are covered by attaching getState to each mock hook.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MessageBar from '@/components/MessageBar';

// ── vi.hoisted — these run before vi.mock factories ───────────────────────────

const mocks = vi.hoisted(() => {
  const toggleAutoSpeakMock = vi.fn();
  const toggleSoundMock     = vi.fn();
  const deleteLastWordMock   = vi.fn();
  const clearAllMock         = vi.fn();
  const undoMock             = vi.fn();
  const addToHistoryMock     = vi.fn();
  const setTextMock          = vi.fn();
  const setToneMock          = vi.fn();
  const setToneModeMock      = vi.fn();
  const aacSpeakMock         = vi.fn();
  const speakWordMock        = vi.fn();
  const correctTextMock      = vi.fn().mockResolvedValue(null);
  const safeCorrectionMock   = vi.fn(() => false);
  const rememberPhraseMock   = vi.fn().mockResolvedValue(true);
  const recordHrrPhraseMock  = vi.fn();
  const setAiCompletionMock  = vi.fn();
  const learnWordMock        = vi.fn();
  const ttsHighlightListeners = new Set<(event: {
    type: 'tts-highlight-start' | 'tts-highlight-end';
    text?: string;
    estimatedDurationMs?: number;
    timestamp: number;
  }) => void>();

  const messageState = {
    text: '',
    activeTone: 'neutral' as string,
    toneMode: 'auto' as 'auto' | 'manual',
    autoSpeak: false as boolean,
    soundEnabled: true as boolean,
    deleteLastWord: deleteLastWordMock,
    clearAll: clearAllMock,
    undo: undoMock,
    addToHistory: addToHistoryMock,
    toggleAutoSpeak: toggleAutoSpeakMock,
    toggleSound: toggleSoundMock,
    setText: setTextMock,
    setTone: setToneMock,
    setToneMode: setToneModeMock,
  };

  const settingsState = {
    speechRate: 1,
    speechVolume: 1,
    language: 'en' as string,
    outputLanguage: 'en' as string,
    aiAutocorrectEnabled: false,
    cloudPredictionEnabled: false,
  };

  const uiState = { sidePanel: 'none' };
  const authState = { profile: null as null | { email: string } };

  const useMessageStore = Object.assign(
    (sel?: (s: typeof messageState) => unknown) => sel ? sel(messageState) : messageState,
    { getState: () => messageState },
  );

  const useSettingsStore = Object.assign(
    (sel?: (s: typeof settingsState) => unknown) => sel ? sel(settingsState) : settingsState,
    { getState: () => settingsState },
  );

  const useUIStore = Object.assign(
    (sel?: (s: typeof uiState) => unknown) => sel ? sel(uiState) : uiState,
    { getState: () => uiState },
  );

  return {
    toggleAutoSpeakMock, toggleSoundMock, deleteLastWordMock, clearAllMock, undoMock,
    addToHistoryMock, setTextMock, setToneMock, setToneModeMock, aacSpeakMock,
    speakWordMock,
    correctTextMock, safeCorrectionMock, rememberPhraseMock, recordHrrPhraseMock,
    setAiCompletionMock, learnWordMock,
    ttsHighlightListeners,
    messageState, settingsState, uiState, authState,
    useMessageStore, useSettingsStore, useUIStore,
  };
});

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/store/messageStore',  () => ({ useMessageStore: mocks.useMessageStore, setLatestTranslated: vi.fn(), getLatestTranslated: vi.fn().mockReturnValue(null), cancelActiveEmergency: vi.fn() }));
vi.mock('@/store/settingsStore', () => ({ useSettingsStore: mocks.useSettingsStore }));
vi.mock('@/store/uiStore',       () => ({ useUIStore:       mocks.useUIStore       }));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel?: (s: typeof mocks.authState) => unknown) =>
    sel ? sel(mocks.authState) : mocks.authState,
}));

vi.mock('@/store/predictionStore', () => ({
  usePredictionStore: (sel?: (s: { setAiCompletion: () => void; learnWord: () => void }) => unknown) => {
    const s = {
      setAiCompletion: mocks.setAiCompletionMock,
      learnWord: mocks.learnWordMock,
    };
    return sel ? sel(s) : s;
  },
}));

vi.mock('@/services/aacSpeak', () => ({
  aacSpeak: (...args: unknown[]) => mocks.aacSpeakMock(...args),
}));

vi.mock('@/services/speechService', () => ({
  speakWord: (...args: unknown[]) => mocks.speakWordMock(...args),
}));

vi.mock('@/constants/predictionSeeds', () => ({
  loadPredictionSeed: vi.fn(async () => ({
    wordFreq: {
      i: { count: 1732, lastUsed: 0 },
      need: { count: 330, lastUsed: 0 },
    },
    bigrams: {},
    trigrams: {},
  })),
}));

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
  speakFeedback: vi.fn(),
  alertFeedback: vi.fn(),
}));

vi.mock('@/services/ttsHighlightBus', () => ({
  subscribeTtsHighlight: (listener: (event: {
    type: 'tts-highlight-start' | 'tts-highlight-end';
    text?: string;
    estimatedDurationMs?: number;
    timestamp: number;
  }) => void) => {
    mocks.ttsHighlightListeners.add(listener);
    return () => { mocks.ttsHighlightListeners.delete(listener); };
  },
}));

vi.mock('@/services/azureTTS', () => ({
  TONE_OPTIONS: [
    { id: 'neutral', label: 'Neutral', icon: '😊' },
    { id: 'happy',   label: 'Happy',   icon: '😄' },
  ],
  warmupAzureAudio: vi.fn(),
}));

vi.mock('@/services/textCorrectService', () => ({
  correctText: (...args: unknown[]) => mocks.correctTextMock(...args),
}));

vi.mock('@/services/predictionMemoryService', () => ({
  getPredictionSessionScope: (email?: string | null) => (
    email ? `user:${email.toLowerCase()}` : 'anon:test-tab'
  ),
  rememberConfirmedPhrase: (...args: unknown[]) => mocks.rememberPhraseMock(...args),
}));

vi.mock('@/services/hrrContext', () => ({
  initAacHrr: vi.fn(async () => true),
  isAacHrrReady: () => true,
  recordPhrase: (...args: unknown[]) => mocks.recordHrrPhraseMock(...args),
}));

vi.mock('@/services/translateService', () => ({
  translateWithAIRefine: (_t: string, _s: string, _d: string, _cb: (s: string) => void) => _t,
  looksLikeTargetLang: () => false,
}));

vi.mock('@/services/autocorrectSafety', () => ({
  isSafeAutoCorrection: (...args: unknown[]) => mocks.safeCorrectionMock(...args),
}));

vi.mock('@/services/aiChatBridge', () => ({
  triggerAISubmit: vi.fn(),
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (k: string) => k,
    ttsCode: 'en-US',
    rtl: false,
    ready: true,
  }),
}));

vi.mock('@/components/ColoredText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.messageState.text = '';
  mocks.messageState.autoSpeak = false;
  mocks.messageState.soundEnabled = true;
  mocks.messageState.toneMode = 'auto';
  mocks.settingsState.language = 'en';
  mocks.settingsState.outputLanguage = 'en';
  mocks.settingsState.aiAutocorrectEnabled = false;
  mocks.settingsState.cloudPredictionEnabled = false;
  mocks.uiState.sidePanel = 'none';
  mocks.authState.profile = null;
  mocks.correctTextMock.mockReset();
  mocks.correctTextMock.mockResolvedValue(null);
  mocks.safeCorrectionMock.mockReset();
  mocks.safeCorrectionMock.mockReturnValue(false);
  mocks.rememberPhraseMock.mockReset();
  mocks.rememberPhraseMock.mockResolvedValue(true);
  mocks.recordHrrPhraseMock.mockReset();
  mocks.ttsHighlightListeners.clear();
  mocks.toggleSoundMock.mockImplementation(() => {
    mocks.messageState.soundEnabled = !mocks.messageState.soundEnabled;
  });
});

// ── text display ──────────────────────────────────────────────────────────────

describe('MessageBar — text display', () => {
  it('renders text in role=status element', () => {
    mocks.messageState.text = 'I want water';
    render(<MessageBar />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('I want water');
  });

  it('renders nothing in status area when text is empty', () => {
    mocks.messageState.text = '';
    render(<MessageBar />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('role=status has aria-live="polite"', () => {
    render(<MessageBar />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});

// ── auto-speak toggle ─────────────────────────────────────────────────────────

describe('MessageBar — auto-speak toggle', () => {
  it('auto-speak button shows aria-pressed=false when autoSpeak is off', () => {
    mocks.messageState.autoSpeak = false;
    render(<MessageBar />);
    const btn = screen.getByRole('button', { name: /auto_speak_off/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('auto-speak button shows aria-pressed=true when autoSpeak is on', () => {
    mocks.messageState.autoSpeak = true;
    render(<MessageBar />);
    const btn = screen.getByRole('button', { name: /auto_speak_on/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking auto-speak button calls toggleAutoSpeak', () => {
    render(<MessageBar />);
    fireEvent.click(screen.getByRole('button', { name: /auto_speak/i }));
    expect(mocks.toggleAutoSpeakMock).toHaveBeenCalledOnce();
  });

  it('auto-speaks a one-letter keyboard phrase without waiting for Play or AI autocorrect', async () => {
    vi.useFakeTimers();
    try {
      mocks.messageState.text = 'I';
      mocks.messageState.autoSpeak = true;
      mocks.messageState.soundEnabled = true;
      mocks.settingsState.language = 'en';
      mocks.settingsState.outputLanguage = 'en';
      mocks.settingsState.aiAutocorrectEnabled = false;

      render(<MessageBar />);
      await act(async () => { await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(399); });
      expect(mocks.speakWordMock).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(1); });

      expect(mocks.speakWordMock).toHaveBeenCalledOnce();
      expect(mocks.speakWordMock).toHaveBeenCalledWith('I', 1, 1);
      expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows the same phrase to auto-speak after the direct-tap dedupe window expires', async () => {
    vi.useFakeTimers();
    try {
      mocks.messageState.text = 'I';
      mocks.messageState.autoSpeak = true;

      const { rerender } = render(<MessageBar />);
      await act(async () => { await Promise.resolve(); });
      act(() => {
        for (const listener of mocks.ttsHighlightListeners) {
          listener({
            type: 'tts-highlight-start',
            text: 'I',
            estimatedDurationMs: 300,
            timestamp: Date.now(),
          });
        }
      });
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(mocks.speakWordMock).not.toHaveBeenCalled();

      mocks.messageState.text = '';
      rerender(<MessageBar />);
      await act(async () => {
        vi.advanceTimersByTime(3001);
      });
      mocks.messageState.text = 'I';
      rerender(<MessageBar />);
      await act(async () => { await Promise.resolve(); });
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(mocks.speakWordMock).toHaveBeenCalledOnce();
      expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not send a delayed last-word cloud call after direct cumulative prediction speech', async () => {
    vi.useFakeTimers();
    try {
      mocks.messageState.text = 'I need';
      mocks.messageState.autoSpeak = true;
      mocks.messageState.soundEnabled = true;
      mocks.settingsState.aiAutocorrectEnabled = true;

      render(<MessageBar />);
      await act(async () => { await Promise.resolve(); });
      act(() => {
        for (const listener of mocks.ttsHighlightListeners) {
          listener({
            type: 'tts-highlight-start',
            text: 'I need',
            estimatedDurationMs: 500,
            timestamp: Date.now(),
          });
        }
      });
      await act(async () => {
        vi.advanceTimersByTime(2500);
        await Promise.resolve();
      });

      expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
      expect(mocks.speakWordMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── undo ──────────────────────────────────────────────────────────────────────

describe('MessageBar — undo', () => {
  it('clicking undo button calls undo', () => {
    render(<MessageBar />);
    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(mocks.undoMock).toHaveBeenCalledOnce();
  });
});

// ── speak ─────────────────────────────────────────────────────────────────────

describe('MessageBar — speak', () => {
  it('Play suppresses the pending auto-speak timer even when prediction seed loading finishes afterward', async () => {
    vi.useFakeTimers();
    try {
      mocks.messageState.text = 'I need';
      mocks.messageState.autoSpeak = true;
      mocks.messageState.soundEnabled = true;

      render(<MessageBar />);
      fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));

      // The prediction seed resolves asynchronously. It must not be able to
      // schedule a second utterance after the explicit Play action.
      await act(async () => { await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(2_100); });

      expect(mocks.aacSpeakMock).toHaveBeenCalledOnce();
      expect(mocks.speakWordMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clicking speak button calls aacSpeak with current text', async () => {
    mocks.messageState.text = 'Help me please';
    mocks.messageState.soundEnabled = true;
    render(<MessageBar />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));
    });
    expect(mocks.aacSpeakMock).toHaveBeenCalledWith(
      'Help me please',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      true,
    );
  });

  // soundEnabled is a master mute — Play does not override it, and must not
  // clear it as a side effect. See tests/keyboard-cumulative-speech.test.tsx
  // for the same guarantee on the keyboard Speak key.
  it('clicking speak does NOT call aacSpeak when soundEnabled is false', async () => {
    mocks.messageState.text = 'some text';
    mocks.messageState.soundEnabled = false;
    render(<MessageBar />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));
    });
    expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
  });

  it('clicking speak while muted leaves the mute setting untouched', async () => {
    mocks.messageState.text = 'some text';
    mocks.messageState.soundEnabled = false;
    render(<MessageBar />);
    const play = screen.getByRole('button', { name: /^speak$/i });

    await act(async () => {
      fireEvent.click(play);
      fireEvent.click(play);
    });

    expect(mocks.toggleSoundMock).not.toHaveBeenCalled();
    expect(mocks.messageState.soundEnabled).toBe(false);
    expect(mocks.aacSpeakMock).not.toHaveBeenCalled();
  });

  it('clicking speak calls addToHistory', async () => {
    mocks.messageState.text = 'I need help';
    mocks.messageState.soundEnabled = true;
    render(<MessageBar />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));
    });
    expect(mocks.addToHistoryMock).toHaveBeenCalled();
  });

  it('shows a correction string without writing memory or rewriting authored text', async () => {
    mocks.messageState.text = 'I nede help';
    mocks.settingsState.aiAutocorrectEnabled = true;
    mocks.authState.profile = { email: 'aac@example.com' };
    mocks.correctTextMock.mockResolvedValue('I need help');

    render(<MessageBar />);

    const correction = await screen.findByTestId('autocorrect-suggestion', {}, { timeout: 1_000 });
    expect(correction).toHaveTextContent('I need help');
    const correctionText = correction.querySelector('span.font-semibold');
    expect(correctionText).toHaveClass('whitespace-normal', 'break-words');
    expect(correctionText).not.toHaveClass('truncate');
    expect(mocks.setTextMock).not.toHaveBeenCalled();
    expect(mocks.rememberPhraseMock).not.toHaveBeenCalled();
  });

  it('Play speaks and learns the authored text but never auto-rewrites it to a suggestion', async () => {
    mocks.messageState.text = 'I nede help';
    mocks.settingsState.aiAutocorrectEnabled = true;
    mocks.settingsState.cloudPredictionEnabled = true;
    mocks.authState.profile = { email: 'aac@example.com' };
    mocks.correctTextMock.mockResolvedValue('I need help');
    mocks.safeCorrectionMock.mockReturnValue(true);

    render(<MessageBar />);
    await screen.findByTestId('autocorrect-suggestion', {}, { timeout: 1_000 });
    fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));

    expect(mocks.setTextMock).not.toHaveBeenCalled();
    expect(mocks.aacSpeakMock).toHaveBeenCalledWith(
      'I nede help',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      true,
    );
    expect(mocks.rememberPhraseMock).toHaveBeenCalledOnce();
    expect(mocks.rememberPhraseMock).toHaveBeenCalledWith('I nede help', 'en');
  });

  it.each([
    ['I need I', 'en'],
    ['I need a', 'en'],
    ['yo y', 'es'],
    ['я хочу я', 'ru'],
  ])(
    'Play preserves a valid trailing one-character word in %s',
    async (authored, language) => {
      mocks.messageState.text = authored;
      mocks.settingsState.language = language;
      mocks.settingsState.outputLanguage = language;
      mocks.settingsState.cloudPredictionEnabled = true;
      mocks.authState.profile = { email: 'aac@example.com' };

      render(<MessageBar />);
      fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));

      expect(mocks.setTextMock).not.toHaveBeenCalled();
      expect(mocks.addToHistoryMock).toHaveBeenCalledWith(authored);
      expect(mocks.aacSpeakMock).toHaveBeenCalledWith(
        authored,
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        true,
      );
      expect(mocks.rememberPhraseMock).toHaveBeenCalledWith(authored, language);
    },
  );

  it('keeps a confirmed phrase local while cloud memory opt-in is disabled', async () => {
    mocks.messageState.text = 'I need help';
    mocks.settingsState.cloudPredictionEnabled = false;
    mocks.authState.profile = { email: 'aac@example.com' };

    render(<MessageBar />);
    fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));

    expect(mocks.aacSpeakMock).toHaveBeenCalledWith(
      'I need help',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      true,
    );
    expect(mocks.rememberPhraseMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.recordHrrPhraseMock).toHaveBeenCalledWith(
        'I need help',
        expect.objectContaining({
          language: 'en',
          scope: 'user:aac@example.com',
        }),
      );
    });
  });

  it('explicitly accepting a correction learns the accepted phrase exactly once', async () => {
    mocks.messageState.text = 'I nede help';
    mocks.settingsState.aiAutocorrectEnabled = true;
    mocks.settingsState.cloudPredictionEnabled = true;
    mocks.authState.profile = { email: 'aac@example.com' };
    mocks.correctTextMock.mockResolvedValue('I need help');

    render(<MessageBar />);
    const correction = await screen.findByTestId('autocorrect-suggestion', {}, { timeout: 1_000 });
    await act(async () => {
      fireEvent.click(correction);
      await Promise.resolve();
    });

    expect(mocks.setTextMock).toHaveBeenCalledWith('I need help');
    expect(mocks.rememberPhraseMock).toHaveBeenCalledOnce();
    expect(mocks.rememberPhraseMock).toHaveBeenCalledWith('I need help', 'en');
    await waitFor(() => {
      expect(mocks.recordHrrPhraseMock).toHaveBeenCalledWith('I need help', expect.objectContaining({
        language: 'en',
        scope: 'user:aac@example.com',
      }));
    });
  });
});

// ── delete short-press → deleteLastWord ───────────────────────────────────────

describe('MessageBar — delete', () => {
  it('short press (pointerDown + pointerUp immediately) calls deleteLastWord', () => {
    render(<MessageBar />);
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.pointerDown(deleteBtn);
    fireEvent.pointerUp(deleteBtn);
    expect(mocks.deleteLastWordMock).toHaveBeenCalledOnce();
    expect(mocks.clearAllMock).not.toHaveBeenCalled();
  });
});

// ── tone button ───────────────────────────────────────────────────

describe('MessageBar — tone button', () => {
  it('renders tone button for all users', () => {
    render(<MessageBar />);
    expect(screen.queryByRole('button', { name: /tone:/i })).not.toBeNull();
  });
});
