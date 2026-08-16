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
  // Sentence-end speech is back, but strictly opt-in: it is MESSAGE speech made
  // without pressing Speak, so it fires ONLY when the user has cycled Echo to
  // Sentence. This test previously asserted silence unconditionally, from the
  // window when the feature was removed outright. It now pins both directions,
  // so neither a silent regression nor an unasked-for broadcast can pass.
  //
  // Arabic is the right case to pin it on: `؟` is the Arabic question mark, and
  // an ASCII-only terminator check would leave Arabic users unable to use the
  // feature at all while every Latin-script user could.
  it('offers Arabic punctuation for the Arabic question mark and comma', () => {
    useMessageStore.setState({ text: 'كيف حالك' } as never);
    useSettingsStore.setState({
      language: 'ar',
      outputLanguage: 'ar',
      speakOnSentenceEnd: false,
    } as never);
    const { container } = render(<Keyboard />);
    const question = container.querySelector<HTMLButtonElement>('button[data-key="؟"]');
    const comma = container.querySelector<HTMLButtonElement>('button[data-key="،"]');

    expect(question).not.toBeNull();
    expect(comma).not.toBeNull();
    act(() => fireEvent.click(question!));

    expect(useMessageStore.getState().text).toBe('كيف حالك؟');
    // Sentence mode off — the default — so nothing is broadcast.
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
  });

  it('speaks the completed Arabic sentence ONLY when Sentence mode is on', () => {
    useMessageStore.setState({ text: 'كيف حالك' } as never);
    useSettingsStore.setState({
      language: 'ar',
      outputLanguage: 'ar',
      speakOnSentenceEnd: true,
    } as never);
    const { container } = render(<Keyboard />);
    const question = container.querySelector<HTMLButtonElement>('button[data-key="؟"]');
    act(() => fireEvent.click(question!));

    expect(useMessageStore.getState().text).toBe('كيف حالك؟');
    expect(speechMocks.aacSpeak).toHaveBeenCalledTimes(1);
    expect(speechMocks.aacSpeak.mock.calls[0][0]).toBe('كيف حالك؟');
  });

  it('speaks only the sentence that just ended, never the whole message', () => {
    useMessageStore.setState({ text: 'I am fine. I need water' } as never);
    useSettingsStore.setState({
      language: 'en', outputLanguage: 'en', speakOnSentenceEnd: true,
    } as never);
    const { container } = render(<Keyboard />);
    const period = container.querySelector<HTMLButtonElement>('button[data-key="."]');
    expect(period).not.toBeNull();
    act(() => fireEvent.click(period!));

    // The accumulated message is what Speak is for; this channel says one sentence.
    expect(speechMocks.aacSpeak).toHaveBeenCalledTimes(1);
    expect(speechMocks.aacSpeak.mock.calls[0][0]).toBe('I need water.');
  });

  it('stays silent at a sentence end when the master mute is off', () => {
    useMessageStore.setState({ text: 'I need water', soundEnabled: false } as never);
    useSettingsStore.setState({
      language: 'en', outputLanguage: 'en', speakOnSentenceEnd: true,
    } as never);
    const { container } = render(<Keyboard />);
    const period = container.querySelector<HTMLButtonElement>('button[data-key="."]');
    act(() => fireEvent.click(period!));

    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
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

  // The composition silence timer that spoke the message after 400ms is gone.
  // What this test uniquely covers — the unshifted "i" key reaching the
  // message bar as the capitalised pronoun through the REAL input path — is
  // unaffected and is what it now asserts.
  it('renders the unshifted English pronoun as I from the real input path', async () => {
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
      await act(async () => { vi.advanceTimersByTime(5000); });
      // Nothing is voiced by a pause. The message is spoken on Speak.
      expect(speechMocks.speakWord).not.toHaveBeenCalled();
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

  // Space used to replay the whole accumulated message. That is message speech
  // — the public utterance to a communication partner — produced without the
  // user choosing to produce it. Space now confirms the WORD just completed,
  // and only when auditory feedback is enabled. The message is spoken on Speak.
  it('says nothing on space by default', () => {
    const { container } = render(<Keyboard />);
    const space = container.querySelector<HTMLButtonElement>('[data-action="space"]');
    act(() => { fireEvent.click(space!); });

    expect(speechMocks.speakWord).not.toHaveBeenCalled();
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    // The word still enters the message — only the speech changed.
    expect(useMessageStore.getState().text).toBe('I need ');
  });

  it('speaks only the completed word on space when feedback is enabled', () => {
    useSettingsStore.setState({ speakSelectionFeedback: true } as never);
    const { container } = render(<Keyboard />);
    const space = container.querySelector<HTMLButtonElement>('[data-action="space"]');
    act(() => { fireEvent.click(space!); });

    // "need" — the word just finished. NOT "I need", the running message.
    expect(speechMocks.speakWord).toHaveBeenCalledOnce();
    expect(speechMocks.speakWord).toHaveBeenCalledWith('need', 0.5, 0.8);
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    expect(useMessageStore.getState().text).toBe('I need ');
  });

  it('speaks only the completed word on space in output-language mode', () => {
    useSettingsStore.setState({ outputLanguage: 'es', speakSelectionFeedback: true } as never);
    const { container } = render(<Keyboard />);
    const space = container.querySelector<HTMLButtonElement>('[data-action="space"]');
    act(() => { fireEvent.click(space!); });

    expect(speechMocks.speakWord).not.toHaveBeenCalled();
    expect(speechMocks.aacSpeak).toHaveBeenCalledOnce();
    expect(speechMocks.aacSpeak).toHaveBeenCalledWith('need', 0.5, 0.8, 'neutral', true);
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
