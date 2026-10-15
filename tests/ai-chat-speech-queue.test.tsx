/**
 * The AI chat answer is read sentence by sentence as it streams in.
 *
 * - Each sentence starts only once the previous one finished playing (it used to
 *   advance on an estimated duration and cut slow speech off), and never sooner
 *   than that estimate (on iOS the device voice reports finishing on a timer).
 * - The queue keeps reading after the stream ends: it used to be dropped then,
 *   so a fast answer was read only in part.
 * - It stops when someone else takes over the speech (the user tapping a line,
 *   Stop), when the panel closes, and on a new question; a cancelled answer
 *   leaves no timer behind.
 * - Hands-free listening waits until the answer has been read, or the mic would
 *   hear it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const voice = vi.hoisted(() => ({ supported: false, start: vi.fn(() => ({ stop: () => {} })) }));
// The speech epoch moves when someone else speaks or presses Stop.
const epoch = vi.hoisted(() => ({ value: 0 }));
vi.mock('@/services/speechService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/speechService')>()),
  currentSpeechEpoch: () => epoch.value,
}));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/aiService', () => ({ askAI: vi.fn() }));
vi.mock('@/services/textCorrectService', () => ({ correctText: vi.fn(async (t: string) => t) }));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => voice.supported,
  startVoiceInput: voice.start,
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/crisisSafetyFilter', () => ({
  checkCrisisSafety: () => ({ safe: true }),
  checkModelOutputSafety: () => ({ safe: true }),
}));
// Pace: 200 + 300 ms per sentence.
vi.mock('@/services/ttsHighlightBus', () => ({ estimateSpeechDurationMs: () => 200 }));

import AIChatPanel from '@/components/AIChatPanel';
import { aacSpeak } from '@/services/aacSpeak';
import { askAI } from '@/services/aiService';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';

Element.prototype.scrollIntoView = vi.fn();

const speakMock = aacSpeak as ReturnType<typeof vi.fn>;
const spoken = () => speakMock.mock.calls.map(c => c[0] as string);
const ANSWER = ['First sentence here. ', 'Second sentence here. ', 'Third sentence here. '];
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const PACE = 500;

/** aacSpeak calls that settle only when the test says how the sentence ended. */
function controlledSpeech() {
  const finishers: Array<(how: 'finished' | 'halted') => void> = [];
  speakMock.mockImplementation(() => new Promise(r => { finishers.push(r); }));
  return async (index: number, how: 'finished' | 'halted' = 'finished') => {
    await act(async () => { finishers[index](how); await settle(); });
  };
}
const advance = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); await settle(); }); };

async function ask() {
  (askAI as ReturnType<typeof vi.fn>).mockImplementationOnce(
    async (_q: string, _abort: unknown, onDelta: (d: string) => void) => { for (const s of ANSWER) onDelta(s); },
  );
  const { triggerAISubmit } = await import('@/services/aiChatBridge');
  await act(async () => { triggerAISubmit(); await settle(); });
}

beforeEach(() => {
  vi.useFakeTimers();
  speakMock.mockReset();
  voice.supported = false;
  epoch.value = 0;
  voice.start.mockClear();
  useUIStore.setState({ sidePanel: 'ai-chat' });
  useMessageStore.setState({ text: 'why is the sky blue', soundEnabled: true, autoSpeak: true } as never);
});
afterEach(() => vi.useRealTimers());

describe('AIChatPanel — reading the answer', () => {
  it('starts each sentence only after the previous one finished, and reads all of it after the stream ends', async () => {
    const finish = controlledSpeech();
    render(<AIChatPanel />);
    await ask();

    // The whole answer has streamed in, but only the first sentence is playing.
    expect(spoken()).toEqual(['First sentence here.']);
    await advance(PACE);
    await finish(0);
    expect(spoken()).toEqual(['First sentence here.', 'Second sentence here.']);
    await advance(PACE);
    await finish(1);
    expect(spoken()).toEqual(['First sentence here.', 'Second sentence here.', 'Third sentence here.']);
  });

  it('never moves on sooner than the paced estimate, even if speech reports finishing early', async () => {
    const finish = controlledSpeech();
    render(<AIChatPanel />);
    await ask();

    await finish(0);
    await advance(PACE - 50);
    expect(spoken()).toEqual(['First sentence here.']);
    await advance(50);
    expect(spoken()).toEqual(['First sentence here.', 'Second sentence here.']);
  });

  it('stops reading when someone else takes over the speech (the user tapping a line, Stop)', async () => {
    const finish = controlledSpeech();
    render(<AIChatPanel />);
    await ask();

    await finish(0, 'halted');
    await advance(60_000);

    expect(spoken()).toEqual(['First sentence here.']);
  });

  it('stops reading when the panel closes, and releases its wait at once', async () => {
    speakMock.mockImplementation(() => new Promise(() => {}));
    render(<AIChatPanel />);
    await ask();

    const timersWhileReading = vi.getTimerCount();
    await act(async () => { useUIStore.setState({ sidePanel: null } as never); await settle(); });
    // Closing released the wait at once: its watchdog is gone (the panel's own
    // frame callback is the only other timer).
    expect(vi.getTimerCount()).toBe(timersWhileReading - 1);
    await advance(60_000);

    expect(spoken()).toEqual(['First sentence here.']);
  });

  it('moves on when a sentence never reports that it finished', async () => {
    speakMock.mockImplementation(() => new Promise(() => {}));
    render(<AIChatPanel />);
    await ask();
    expect(spoken()).toEqual(['First sentence here.']);

    await advance(PACE * 3 + 10_000);

    expect(spoken()).toEqual(['First sentence here.', 'Second sentence here.']);
  });

  it('does not start hands-free listening until the answer has been read', async () => {
    voice.supported = true;
    const finish = controlledSpeech();
    render(<AIChatPanel />);
    fireEvent.click(screen.getByTestId('ai-hands-free'));
    await ask();

    // The stream is done, but the answer is still being read.
    await advance(5_000);
    expect(voice.start).not.toHaveBeenCalled();

    for (let i = 0; i < ANSWER.length; i++) { await finish(i); await advance(PACE); }
    await advance(1_000);
    expect(voice.start).toHaveBeenCalled();
  });

  it('stops reading when someone else speaks during the pause after a sentence', async () => {
    const finish = controlledSpeech();
    render(<AIChatPanel />);
    await ask();

    await finish(0);
    await advance(100);
    epoch.value += 1; // the user taps a line
    await advance(PACE);

    expect(spoken()).toEqual(['First sentence here.']);
  });

  it('stops reading when someone else speaks while the rest of the answer is still arriving', async () => {
    const finish = controlledSpeech();
    let more!: () => void;
    (askAI as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_q: string, _abort: unknown, onDelta: (d: string) => void) => {
        onDelta(ANSWER[0]);
        await new Promise<void>(r => { more = r; });
        onDelta(ANSWER[1]);
      },
    );
    render(<AIChatPanel />);
    const { triggerAISubmit } = await import('@/services/aiChatBridge');
    await act(async () => { triggerAISubmit(); await settle(); });

    await finish(0);
    await advance(PACE);
    epoch.value += 1; // the user speaks while the answer is still streaming
    await act(async () => { more(); await settle(); });
    await advance(PACE);

    expect(spoken()).toEqual(['First sentence here.']);
  });

  it('lets hands-free work again after the panel was closed mid-answer', async () => {
    voice.supported = true;
    speakMock.mockImplementation(() => new Promise(() => {}));
    render(<AIChatPanel />);
    await ask();

    await act(async () => { useUIStore.setState({ sidePanel: null } as never); await settle(); });
    await act(async () => { useUIStore.setState({ sidePanel: 'ai-chat' }); await settle(); });
    fireEvent.click(screen.getByTestId('ai-hands-free'));
    await advance(1_500);

    expect(voice.start).toHaveBeenCalled();
  });
});
