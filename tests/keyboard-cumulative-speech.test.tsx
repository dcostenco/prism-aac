/**
 * Keyboard word-boundary speech regression.
 *
 * A space confirms the word the user just typed, but AAC feedback must replay
 * the cumulative message. Speaking only the last word loses meaning for users
 * composing short phrases such as "I need".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import Keyboard from '@/components/Keyboard';
import MessageBar from '@/components/MessageBar';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';

const speechMocks = vi.hoisted(() => ({
  speakWord: vi.fn(),
  aacSpeak: vi.fn(),
}));

vi.mock('@/services/speechService', () => ({
  speakWord: speechMocks.speakWord,
}));

vi.mock('@/services/aacSpeak', () => ({
  aacSpeak: speechMocks.aacSpeak,
}));

vi.mock('@/services/feedback', () => ({
  keyFeedback: vi.fn(),
  tapFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
}));

vi.mock('@/services/azureTTS', () => ({
  warmupAzureAudio: vi.fn(),
  TONE_OPTIONS: [],
}));

vi.mock('@/services/aiChatBridge', () => ({
  triggerAISubmit: vi.fn(),
}));

vi.mock('@/services/searchKeyBridge', () => ({
  dispatchToSearch: vi.fn(() => false),
}));

// messageStore records committed text through a lazy adaptive-engine import.
// Keep that import inside this test environment so a late transform cannot
// race Vitest teardown and turn an otherwise-green suite into a false pass.
vi.mock('@/services/adaptiveEngine', () => ({
  recordMessage: vi.fn(),
}));

vi.mock('@/constants/predictionSeeds', () => ({
  loadPredictionSeed: vi.fn(async () => ({
    wordFreq: { i: { count: 1732, lastUsed: 0 } },
    bigrams: {},
    trigrams: {},
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useMessageStore.setState({
    text: 'I need',
    autoSpeak: true,
    soundEnabled: true,
    activeTone: 'neutral',
  } as never);
  useSettingsStore.setState({
    language: 'en',
    outputLanguage: 'en',
    speechRate: 0.5,
    speechVolume: 0.8,
    speakOnSentenceEnd: false,
    aiAutocorrectEnabled: false,
    gridSize: 12,
  } as never);
  useUIStore.setState({
    keyboardMode: 'letters',
    isUpperCase: false,
    capsLock: false,
    keyboardMaximized: false,
  } as never);
});

describe('Keyboard cumulative word-boundary speech', () => {
  it('offers Arabic punctuation and sentence-end speech for the Arabic question mark', () => {
    useMessageStore.setState({ text: 'كيف حالك' } as never);
    useSettingsStore.setState({
      language: 'ar',
      outputLanguage: 'ar',
      speakOnSentenceEnd: true,
    } as never);
    const { container } = render(<Keyboard />);
    const question = container.querySelector<HTMLButtonElement>('button[data-key="؟"]');
    const comma = container.querySelector<HTMLButtonElement>('button[data-key="،"]');

    expect(question).not.toBeNull();
    expect(comma).not.toBeNull();
    act(() => fireEvent.click(question!));

    expect(useMessageStore.getState().text).toBe('كيف حالك؟');
    expect(speechMocks.aacSpeak).toHaveBeenCalledOnce();
    expect(speechMocks.aacSpeak).toHaveBeenCalledWith('كيف حالك؟', 0.5, 0.8, 'neutral');
  });

  it('stores the default unshifted English i key as the visible pronoun I', () => {
    useMessageStore.setState({ text: '' } as never);
    const { container } = render(<Keyboard />);
    const iKey = container.querySelector<HTMLButtonElement>('button[data-key="I"]');
    expect(iKey).not.toBeNull();
    expect(iKey).toHaveAttribute('data-display', 'i');

    act(() => {
      fireEvent.click(iKey!);
    });

    expect(useMessageStore.getState().text).toBe('I');
    expect(speechMocks.speakWord).not.toHaveBeenCalled();
  });

  it('renders and phrase-speaks the unshifted English pronoun from the real input path', async () => {
    vi.useFakeTimers();
    try {
      useMessageStore.setState({ text: '' } as never);
      const { container } = render(
        <>
          <MessageBar />
          <Keyboard />
        </>,
      );

      act(() => {
        fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="I"]')!);
      });

      expect(container.querySelector('[role="status"]')).toHaveTextContent('I');
      await act(async () => { await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(399); });
      expect(speechMocks.speakWord).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(speechMocks.speakWord).toHaveBeenCalledOnce();
      expect(speechMocks.speakWord).toHaveBeenCalledWith('I', 0.5, 0.8);
      expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the provisional pronoun lowercase when another letter continues the word', () => {
    useMessageStore.setState({ text: '' } as never);
    const { container } = render(<Keyboard />);

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="I"]')!);
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="N"]')!);
    });

    expect(useMessageStore.getState().text).toBe('in');
    expect(speechMocks.speakWord).not.toHaveBeenCalled();
  });

  it('does not lowercase a deliberate I restored by an external text mutation', () => {
    useMessageStore.setState({ text: '' } as never);
    const { container } = render(<Keyboard />);

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="I"]')!);
    });
    expect(useMessageStore.getState().text).toBe('I');

    act(() => {
      useMessageStore.getState().setText('');
    });
    act(() => {
      useMessageStore.getState().setText('I');
    });
    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="N"]')!);
    });

    expect(useMessageStore.getState().text).toBe('In');
  });

  it('normalizes a provisional I when the input language changes mid-word', () => {
    useMessageStore.setState({ text: '' } as never);
    const { container } = render(<Keyboard />);

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="I"]')!);
    });
    expect(useMessageStore.getState().text).toBe('I');

    act(() => {
      useSettingsStore.setState({ language: 'ro', outputLanguage: 'ro' } as never);
    });
    expect(useMessageStore.getState().text).toBe('i');

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="N"]')!);
    });
    expect(useMessageStore.getState().text).toBe('in');
  });

  it('does not apply the English pronoun rule to the Romanian keyboard', () => {
    useMessageStore.setState({ text: '' } as never);
    useSettingsStore.setState({ language: 'ro', outputLanguage: 'ro' } as never);
    const { container } = render(<Keyboard />);

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="I"]')!);
    });

    expect(useMessageStore.getState().text).toBe('i');
    expect(speechMocks.speakWord).not.toHaveBeenCalled();
  });

  it('keeps Turkish dotless and dotted i as two distinct reachable keys', () => {
    useMessageStore.setState({ text: '' } as never);
    useSettingsStore.setState({ language: 'tr', outputLanguage: 'tr' } as never);
    const { container } = render(<Keyboard />);
    const dotless = container.querySelector<HTMLButtonElement>('button[data-key="I"]');
    const dotted = container.querySelector<HTMLButtonElement>('button[data-key="İ"]');

    expect(dotless).toHaveAttribute('data-display', 'ı');
    expect(dotted).toHaveAttribute('data-display', 'i');
    act(() => {
      fireEvent.click(dotless!);
      fireEvent.click(dotted!);
    });
    expect(useMessageStore.getState().text).toBe('ıi');
  });

  it('does not apply AAC pronoun normalization in browser input mode', () => {
    useMessageStore.setState({ text: '' } as never);
    const { container } = render(<Keyboard browserMode />);

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-key="I"]')!);
    });

    expect(useMessageStore.getState().text).toBe('i');
  });

  it('replays the complete same-language message locally on space', () => {
    const { container } = render(<Keyboard />);
    const space = container.querySelector<HTMLButtonElement>('[data-action="space"]');
    expect(space).not.toBeNull();

    act(() => {
      fireEvent.click(space!);
    });

    expect(speechMocks.speakWord).toHaveBeenCalledOnce();
    expect(speechMocks.speakWord).toHaveBeenCalledWith('I need', 0.5, 0.8);
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    expect(useMessageStore.getState().text).toBe('I need ');
  });

  it('translates the complete message immediately on space in output-language mode', () => {
    useSettingsStore.setState({ outputLanguage: 'es' } as never);
    const { container } = render(<Keyboard />);
    const space = container.querySelector<HTMLButtonElement>('[data-action="space"]');
    expect(space).not.toBeNull();

    act(() => {
      fireEvent.click(space!);
    });

    expect(speechMocks.speakWord).not.toHaveBeenCalled();
    expect(speechMocks.aacSpeak).toHaveBeenCalledOnce();
    expect(speechMocks.aacSpeak).toHaveBeenCalledWith(
      'I need',
      0.5,
      0.8,
      'neutral',
      true,
    );
  });

  it('explicit same-language Speak interrupts pending tap speech', () => {
    const { container } = render(<Keyboard />);
    const speak = container.querySelector<HTMLButtonElement>('button.aac-speak');
    expect(speak).not.toBeNull();

    act(() => {
      fireEvent.click(speak!);
    });

    expect(speechMocks.aacSpeak).toHaveBeenCalledWith(
      'I need',
      0.5,
      0.8,
      'neutral',
      true,
    );
  });

  // soundEnabled is a master mute. A caregiver who mutes the device in a
  // classroom, or a user who mutes in a quiet room, must stay silent — and
  // must not have that setting cleared behind their back by pressing Speak.
  it('keyboard Speak stays silent while muted', () => {
    useMessageStore.setState({ soundEnabled: false } as never);
    const { container } = render(<Keyboard />);
    const speak = container.querySelector<HTMLButtonElement>('button.aac-speak');
    expect(speak).not.toBeNull();

    act(() => {
      fireEvent.click(speak!);
    });

    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
  });

  it('keyboard Speak does not clear the mute setting', () => {
    useMessageStore.setState({ soundEnabled: false } as never);
    const { container } = render(<Keyboard />);
    const speak = container.querySelector<HTMLButtonElement>('button.aac-speak');
    expect(speak).not.toBeNull();

    act(() => {
      fireEvent.click(speak!);
      fireEvent.click(speak!);
    });

    expect(useMessageStore.getState().soundEnabled).toBe(false);
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
  });
});
