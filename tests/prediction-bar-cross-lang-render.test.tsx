/**
 * PredictionBar — cross-language render regression.
 *
 * Reproduces what the user actually sees in the screenshot: a row of
 * tiles like `eu / I / to / a / noise` while language=ro. The leak
 * comes via PredictionBar's `mergeAiCompletion` which prepends the
 * autocorrect-service `aiCompletion` as the leftmost tile WITHOUT
 * checking it against the active language. correctText can return
 * English (the user typed "I Want" in RO mode, server reads it as
 * English, returns an English completion → leftmost tile is "I").
 *
 * The earlier prediction-cross-lang-leak test only covered the user
 * wordFreq merge — `aiCompletion` was unguarded. This test renders
 * the actual component and asserts the rendered DOM has no English
 * leak.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { loadPredictionSeed } from '@/constants/predictionSeeds';

beforeEach(async () => {
  cleanup();
  if (typeof window !== 'undefined') window.localStorage.clear();
  // Preload the RO corpus so the allowlist gate is strict in tests.
  await loadPredictionSeed('ro');
  await loadPredictionSeed('en');
  // language=ro mirrors what the user picked in the screenshot's
  // RO → RO chip pair.
  useSettingsStore.setState({
    language: 'ro',
    outputLanguage: 'ro',
    speechRate: 0.5,
    speechVolume: 1.0,
  } as never);
  useMessageStore.setState({ text: 'I Want ' } as never);
  // Empty user history; corpus + seed alone produce the predictions.
  usePredictionStore.setState({
    aiCompletion: null,
    wordFreq: {},
    bigrams: {},
    trigrams: {},
    predictions: ['nu', 'am', 'de', 'mai', 'la'],
  });
});

describe('PredictionBar — RO cross-lang leak via aiCompletion', () => {
  it('does NOT render an English aiCompletion as the leftmost tile when lang=ro', async () => {
    // Simulate the autocorrect service returning an English completion.
    // Real-world trigger: user typed "I want" (English-looking text)
    // in RO mode → text/correct sees Latin chars, returns English.
    usePredictionStore.setState({
      aiCompletion: 'I',
      predictions: ['nu', 'am', 'de', 'mai', 'la'],
    });

    await act(async () => {
      render(<PredictionBar />);
    });

    // None of the tiles should be the English "I" leak. The screenshot
    // shows `eu / I / to / a / noise` — "I" is the aiCompletion leak.
    const buttons = screen.getAllByRole('button');
    const labels = buttons.map((b) => b.textContent?.trim() ?? '').filter(Boolean);
    expect(labels).not.toContain('I');
    expect(labels).not.toContain('i');
    // Romanian "Eu" / "eu" is fine.
    // Pin: tiles still render some Romanian predictions (PredictionBar's
    // updatePredictions path computes its own RO list from the seed; the
    // injected `predictions` array is illustrative — what matters is
    // (a) no EN leak and (b) the bar isn't empty).
    const englishOnly = new Set(['the', 'a', 'an', 'and', 'is', 'it', 'to', 'of', 'in', 'on', 'noise', 'I']);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => !englishOnly.has(l.toLowerCase()))).toBe(true);
  });

  it('does render a Romanian aiCompletion (passes the script filter)', async () => {
    usePredictionStore.setState({
      aiCompletion: 'aici',
      predictions: ['nu', 'am', 'de', 'mai', 'la'],
    });
    await act(async () => {
      render(<PredictionBar />);
    });
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim().toLowerCase() ?? '');
    // 'aici' is Romanian (means "here"). Should appear as leftmost tile.
    expect(labels).toContain('aici');
  });

  it('drops English aiCompletion words like "to" / "noise" too', async () => {
    usePredictionStore.setState({
      aiCompletion: 'noise',
      predictions: ['nu', 'am', 'de', 'mai', 'la'],
    });
    await act(async () => {
      render(<PredictionBar />);
    });
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim().toLowerCase() ?? '');
    expect(labels).not.toContain('noise');
  });

  it('keeps EN aiCompletion when language=en (no filter)', async () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'en' } as never);
    usePredictionStore.setState({
      aiCompletion: 'I',
      predictions: ['the', 'a', 'and', 'is', 'it'],
    });
    await act(async () => {
      render(<PredictionBar />);
    });
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim() ?? '');
    expect(labels).toContain('I');
  });
});
