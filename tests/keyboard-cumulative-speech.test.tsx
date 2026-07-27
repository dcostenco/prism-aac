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
}));

vi.mock('@/services/aiChatBridge', () => ({
  triggerAISubmit: vi.fn(),
}));

vi.mock('@/services/searchKeyBridge', () => ({
  dispatchToSearch: vi.fn(() => false),
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
});
