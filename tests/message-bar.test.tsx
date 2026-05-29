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
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MessageBar from '@/components/MessageBar';

// ── vi.hoisted — these run before vi.mock factories ───────────────────────────

const mocks = vi.hoisted(() => {
  const toggleAutoSpeakMock = vi.fn();
  const deleteLastWordMock   = vi.fn();
  const clearAllMock         = vi.fn();
  const undoMock             = vi.fn();
  const addToHistoryMock     = vi.fn();
  const setTextMock          = vi.fn();
  const setToneMock          = vi.fn();
  const setToneModeMock      = vi.fn();
  const aacSpeakMock         = vi.fn();

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
  };

  const uiState = { sidePanel: 'none' };

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
    toggleAutoSpeakMock, deleteLastWordMock, clearAllMock, undoMock,
    addToHistoryMock, setTextMock, setToneMock, setToneModeMock, aacSpeakMock,
    messageState, settingsState, uiState,
    useMessageStore, useSettingsStore, useUIStore,
  };
});

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/store/messageStore',  () => ({ useMessageStore: mocks.useMessageStore, setLatestTranslated: vi.fn(), getLatestTranslated: vi.fn().mockReturnValue(null), cancelActiveEmergency: vi.fn() }));
vi.mock('@/store/settingsStore', () => ({ useSettingsStore: mocks.useSettingsStore }));
vi.mock('@/store/uiStore',       () => ({ useUIStore:       mocks.useUIStore       }));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel?: (s: { profile: null }) => unknown) =>
    sel ? sel({ profile: null }) : { profile: null },
}));

vi.mock('@/store/predictionStore', () => ({
  usePredictionStore: (sel?: (s: { setAiCompletion: () => void; learnWord: () => void }) => unknown) => {
    const s = { setAiCompletion: vi.fn(), learnWord: vi.fn() };
    return sel ? sel(s) : s;
  },
}));

vi.mock('@/services/aacSpeak', () => ({
  aacSpeak: (...args: unknown[]) => mocks.aacSpeakMock(...args),
}));

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
}));

vi.mock('@/services/ttsHighlightBus', () => ({
  subscribeTtsHighlight: () => () => {},
}));

vi.mock('@/services/azureTTS', () => ({
  TONE_OPTIONS: [
    { id: 'neutral', label: 'Neutral', icon: '😊' },
    { id: 'happy',   label: 'Happy',   icon: '😄' },
  ],
  warmupAzureAudio: vi.fn(),
}));

vi.mock('@/services/textCorrectService', () => ({
  correctText: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/translateService', () => ({
  translateWithAIRefine: (_t: string, _s: string, _d: string, _cb: (s: string) => void) => _t,
  looksLikeTargetLang: () => false,
}));

vi.mock('@/services/autocorrectSafety', () => ({
  isSafeAutoCorrection: () => false,
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
  mocks.uiState.sidePanel = 'none';
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

  it('clicking speak does NOT call aacSpeak when soundEnabled is false', async () => {
    mocks.messageState.text = 'some text';
    mocks.messageState.soundEnabled = false;
    render(<MessageBar />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));
    });
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

// ── tone button (free tier) ───────────────────────────────────────────────────

describe('MessageBar — tone button', () => {
  it('does NOT render tone button on free tier (profile=null)', () => {
    render(<MessageBar />);
    expect(screen.queryByRole('button', { name: /tone:/i })).toBeNull();
  });
});
