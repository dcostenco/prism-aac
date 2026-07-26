/**
 * PredictionBar TTS request-budget regression.
 *
 * A rapid five-word AAC composition previously sent the entire growing phrase
 * to cloud TTS after every prediction tap. That multiplied one user action
 * sequence into five overlapping provider requests and consumed shared
 * concurrency needed by other AAC users.
 *
 * Prediction taps must use local word feedback. Only the explicit Speak button
 * may send the completed phrase through aacSpeak's cloud-quality path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('PredictionBar cloud TTS request budget', () => {
  it('keeps rapid prediction feedback local instead of speaking each growing phrase through cloud TTS', () => {
    render(<PredictionBar />);

    const predictionTiles = screen.getAllByRole('button', { name: /^Predict:/ });
    const firstWord = predictionTiles[0].getAttribute('title');
    expect(firstWord).toBeTruthy();

    fireEvent.click(predictionTiles[0]);
    const updatedTiles = screen.getAllByRole('button', { name: /^Predict:/ });
    const secondWord = updatedTiles[1].getAttribute('title');
    expect(secondWord).toBeTruthy();
    fireEvent.click(updatedTiles[1]);

    expect(speechMocks.speakWord).toHaveBeenNthCalledWith(1, firstWord, 0.5, 0.8);
    expect(speechMocks.speakWord).toHaveBeenNthCalledWith(2, secondWord, 0.5, 0.8);
    expect(speechMocks.aacSpeak).not.toHaveBeenCalled();
  });
});
