/**
 * Chinese AAC input must be owned by a real operating-system IME. A Latin
 * QWERTY-looking grid without candidate composition commits raw pinyin into
 * the user's message, which is not Chinese communication.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Keyboard from '@/components/Keyboard';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';

const speechMocks = vi.hoisted(() => ({
  aacSpeak: vi.fn(),
  speakWord: vi.fn(),
}));

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(), keyFeedback: vi.fn(), deleteFeedback: vi.fn(),
}));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: speechMocks.aacSpeak }));
vi.mock('@/services/speechService', () => ({ speakWord: speechMocks.speakWord }));
vi.mock('@/services/azureTTS', () => ({ warmupAzureAudio: vi.fn() }));
vi.mock('@/services/aiChatBridge', () => ({ triggerAISubmit: vi.fn() }));
vi.mock('@/services/searchKeyBridge', () => ({ dispatchToSearch: () => false }));
vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (key: string) => ({ type_here: '在此輸入...', speak: '説話' })[key] ?? key,
    ttsCode: 'zh-HK', rtl: false, ready: true,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useMessageStore.setState({
    text: '', undoStack: [], autoSpeak: true, soundEnabled: true,
    activeTone: 'friendly',
  } as never);
  useSettingsStore.setState({
    language: 'zh-HK', outputLanguage: 'zh-HK', speechRate: 0.5,
    speechVolume: 1, gridSize: 12,
  } as never);
  useUIStore.setState({
    keyboardMode: 'letters', isUpperCase: false, capsLock: false,
    keyboardMaximized: false,
  } as never);
});

describe('Chinese native IME keyboard', () => {
  it('does not expose a fake Latin character grid in AAC mode', () => {
    const { container } = render(<Keyboard />);
    expect(screen.getByTestId('native-ime-composer')).toHaveAttribute('lang', 'zh-HK');
    expect(container.querySelector('button[data-key="Q"]')).not.toBeInTheDocument();
  });

  it('keeps composition provisional and commits the selected Han text once', () => {
    render(<Keyboard />);
    const composer = screen.getByTestId('native-ime-composer');

    fireEvent.compositionStart(composer);
    fireEvent.change(composer, { target: { value: 'bong' } });
    expect(useMessageStore.getState().text).toBe('');
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    expect(speechMocks.speakWord).not.toHaveBeenCalled();

    fireEvent.compositionEnd(composer, { data: '幫', target: { value: '幫' } });
    // WebKit may deliver a final non-composing input after compositionend.
    // Replaying that event must not create a duplicate undo entry.
    fireEvent.change(composer, { target: { value: '幫' } });
    expect(useMessageStore.getState().text).toBe('幫');
    expect(useMessageStore.getState().undoStack).toEqual(['']);
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    expect(speechMocks.speakWord).not.toHaveBeenCalled();
  });

  it('keeps AAC Backspace and Speak from acting on stale committed text during composition', () => {
    useMessageStore.setState({ text: '我', undoStack: [] } as never);
    render(<Keyboard />);
    const composer = screen.getByTestId('native-ime-composer');

    fireEvent.compositionStart(composer);
    fireEvent.change(composer, { target: { value: '我bang' } });

    const backspace = screen.getByRole('button', { name: 'Backspace' });
    const speak = screen.getByRole('button', { name: '説話' });
    expect(backspace).toBeDisabled();
    expect(speak).toBeDisabled();
    fireEvent.click(backspace);
    fireEvent.click(speak);

    expect(useMessageStore.getState().text).toBe('我');
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    expect(speechMocks.speakWord).not.toHaveBeenCalled();
  });

  it('does not commit raw composition text when the native IME cancels', () => {
    useMessageStore.setState({ text: '我', undoStack: [] } as never);
    render(<Keyboard />);
    const composer = screen.getByTestId('native-ime-composer');

    fireEvent.compositionStart(composer);
    fireEvent.change(composer, { target: { value: '我bang' } });
    fireEvent.change(composer, { target: { value: '我bong' } });
    expect(useMessageStore.getState().text).toBe('我');

    fireEvent.compositionEnd(composer, { data: '', target: { value: '我bang' } });
    expect(useMessageStore.getState().text).toBe('我');
    expect(useMessageStore.getState().undoStack).toEqual([]);
  });

  it('backspace removes one committed Han character', () => {
    useMessageStore.setState({ text: '幫我' } as never);
    render(<Keyboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(useMessageStore.getState().text).toBe('幫');
  });

  it('locale switching cancels provisional composition', () => {
    render(<Keyboard />);
    const composer = screen.getByTestId('native-ime-composer');
    fireEvent.compositionStart(composer);
    fireEvent.change(composer, { target: { value: 'bang' } });

    act(() => {
      useSettingsStore.setState({ language: 'zh-Hant', outputLanguage: 'zh-Hant' } as never);
    });

    expect(screen.getByTestId('native-ime-composer')).toHaveValue('');
    expect(screen.getByTestId('native-ime-composer')).toHaveAttribute('lang', 'zh-TW');
    expect(useMessageStore.getState().text).toBe('');
  });

  it('unmounting Typing mode discards the provisional draft and preserves committed text', () => {
    useMessageStore.setState({ text: '我', undoStack: [] } as never);
    const { unmount } = render(<Keyboard />);
    const composer = screen.getByTestId('native-ime-composer');
    fireEvent.compositionStart(composer);
    fireEvent.change(composer, { target: { value: '我bang' } });

    unmount();

    expect(useMessageStore.getState().text).toBe('我');
    expect(useMessageStore.getState().undoStack).toEqual([]);
  });

  it('preserves QWERTY for browser URL input', () => {
    const { container } = render(<Keyboard browserMode />);
    expect(screen.queryByTestId('native-ime-composer')).not.toBeInTheDocument();
    expect(container.querySelector('button[data-key="Q"]')).toBeInTheDocument();
  });

  it.each([
    ['zh', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hant', 'zh-TW'],
    ['zh-HK', 'zh-HK'],
  ] as const)('uses the native composer for %s with lang=%s', (language, ttsCode) => {
    useSettingsStore.setState({ language, outputLanguage: language } as never);
    const { container } = render(<Keyboard />);
    expect(screen.getByTestId('native-ime-composer')).toHaveAttribute('lang', ttsCode);
    expect(container.querySelector('button[data-key]')).not.toBeInTheDocument();
  });
});
