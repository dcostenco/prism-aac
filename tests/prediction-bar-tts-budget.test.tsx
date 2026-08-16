/**
 * PredictionBar TTS request-budget regression.
 *
 * A rapid five-word AAC composition previously sent the entire growing phrase
 * to cloud TTS after every prediction tap. That multiplied one user action
 * sequence into five overlapping provider requests and consumed shared
 * concurrency needed by other AAC users.
 *
 * Same-language prediction taps replay the cumulative phrase locally.
 * Translation-mode taps must route the composed phrase through aacSpeak so
 * the user hears the configured output language rather than the source word.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { loadPredictionSeed } from '@/constants/predictionSeeds';

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

  useSettingsStore.setState({
    language: 'en',
    outputLanguage: 'en',
    speechRate: 0.5,
    speechVolume: 0.8,
  } as never);
  useMessageStore.setState({ text: '' } as never);
  usePredictionStore.setState({
    aiCompletion: null,
    wordFreq: {},
    bigrams: {},
    trigrams: {},
    predictions: [],
  });
});

describe('PredictionBar selection feedback', () => {
  // These previously pinned "each tap speaks the growing phrase". That is
  // message speech — the public utterance to a communication partner —
  // produced without the user choosing to produce it. A selection may confirm
  // the ITEM selected; the message is spoken when the user presses Speak.
  // The cloud-TTS budget concern the file was written for still holds, and is
  // now stronger: by default a tap makes no request at all.

  it('makes no sound at all by default', async () => {
    render(<PredictionBar />);
    const tiles = screen.getAllByRole('button', { name: /^Predict:/ });
    await act(async () => { fireEvent.click(tiles[0]); });

    expect(speechMocks.speakWord).not.toHaveBeenCalled();
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
  });

  it('speaks only the tapped word locally when feedback is enabled, never the growing phrase', async () => {
    act(() => { useSettingsStore.setState({ speakSelectionFeedback: true } as never); });
    render(<PredictionBar />);

    const predictionTiles = screen.getAllByRole('button', { name: /^Predict:/ });
    const firstWord = predictionTiles[0].getAttribute('title');
    expect(firstWord).toBeTruthy();
    await act(async () => { fireEvent.click(predictionTiles[0]); });

    const updatedTiles = screen.getAllByRole('button', { name: /^Predict:/ });
    const secondWord = updatedTiles[1].getAttribute('title');
    expect(secondWord).toBeTruthy();
    await act(async () => { fireEvent.click(updatedTiles[1]); });

    // Each call is the WORD selected — not "first second".
    expect(speechMocks.speakWord).toHaveBeenNthCalledWith(1, firstWord, 0.5, 0.8);
    expect(speechMocks.speakWord).toHaveBeenNthCalledWith(2, secondWord, 0.5, 0.8);
    // Local path only: no cloud TTS request per keystroke.
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
  });

  it('speaks only "need", not the accumulated "I need"', async () => {
    const updatePredictions = usePredictionStore.getState().updatePredictions;
    act(() => {
      useSettingsStore.setState({ speakSelectionFeedback: true } as never);
      useMessageStore.setState({ text: 'I' } as never);
      usePredictionStore.setState({ predictions: ['need'], updatePredictions: vi.fn() });
    });
    render(<PredictionBar />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Predict: need' }));
    });

    expect(speechMocks.speakWord).toHaveBeenCalledOnce();
    expect(speechMocks.speakWord).toHaveBeenCalledWith('need', 0.5, 0.8);
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
    usePredictionStore.setState({ updatePredictions });
  });

  it('speaks only the tapped word in translation mode', async () => {
    act(() => {
      useSettingsStore.setState({ outputLanguage: 'es', speakSelectionFeedback: true } as never);
    });
    render(<PredictionBar />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Predict: I' }));
    });

    expect(speechMocks.speakWord).not.toHaveBeenCalled();
    expect(speechMocks.aacSpeak).toHaveBeenCalledOnce();
    expect(speechMocks.aacSpeak).toHaveBeenCalledWith('I', 0.5, 0.8, undefined, true);
  });
});
