/**
 * PredictionBar — Romanian default tiles UI render regression.
 *
 * User-reported (May 2026, screenshot): in RO mode the prediction bar
 * shows ONLY two tiles — "Eu" and "Tu" — instead of the expected five
 * AAC core defaults. The other three (Mai Mult, A vrea, A ajuta) were
 * silently dropped by `dropForeignTiles → isAllowedInLang`.
 *
 * Root cause: AAC core defaults include lemma forms like "Mai Mult",
 * "A vrea", "A ajuta" — single tokens with internal spaces. The
 * allowlist gate only handled `|`-separated n-grams, so multi-word
 * phrases were looked up against the corpus as ONE word, found in
 * none, and dropped (langFreq=0, foundInAnyCorpus=false).
 *
 * This test renders PredictionBar with empty text in RO mode (the
 * exact configuration in the user's screenshot) and asserts the bar
 * shows five tiles, each containing the expected Romanian phrase.
 * Without the multi-word fix, this test FAILS — only Eu and Tu
 * render. With the fix, all five render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { loadPredictionSeed } from '@/constants/predictionSeeds';

beforeEach(async () => {
  cleanup();
  if (typeof window !== 'undefined') window.localStorage.clear();
  // Real corpora — keep the gate strict, no boot-race fail-open.
  await loadPredictionSeed('ro');
  await loadPredictionSeed('en');
  // "Tu" is shared by Romanian and Spanish. Loading ES reproduces the
  // cross-corpus competition that previously evicted a trusted RO core tile.
  await loadPredictionSeed('es');
  useSettingsStore.setState({
    language: 'ro',
    outputLanguage: 'ro',
    speechRate: 0.5,
    speechVolume: 1.0,
  } as never);
  // Empty text — the screenshot's state. With no text, PredictionBar
  // renders the per-language AAC core defaults.
  useMessageStore.setState({ text: '' } as never);
  usePredictionStore.setState({
    aiCompletion: null,
    wordFreq: {},
    bigrams: {},
    trigrams: {},
    predictions: [],
  });
});

describe('PredictionBar — Romanian default tiles', () => {
  it('renders all 5 RO default tiles, including multi-word phrases', async () => {
    render(<PredictionBar />);

    // The bar should show the first 5 entries of getAacCoreFor('ro'):
    //   Eu, Tu, Mai Mult, A vrea, A ajuta
    // (1st-person singular, 2nd-person singular, "more", "to want",
    // "to help" — Universal Core 36 ranking).
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      // Count must be 5 — two-tile state IS the bug.
      expect(buttons.length).toBe(5);
    });

    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim() ?? '');
    expect(labels).toEqual(expect.arrayContaining(['Eu', 'Tu', 'Mai Mult', 'A vrea', 'A ajuta']));
  });

  it('keeps single-word RO defaults that survived the old gate', async () => {
    render(<PredictionBar />);
    await waitFor(() => {
      expect(screen.getByText('Eu')).toBeDefined();
      expect(screen.getByText('Tu')).toBeDefined();
    });
  });

  it('keeps multi-word RO phrases that the old gate dropped (the regression)', async () => {
    render(<PredictionBar />);
    await waitFor(() => {
      // Each of these is what the user's screenshot was MISSING.
      expect(screen.getByText('Mai Mult')).toBeDefined();
      expect(screen.getByText('A vrea')).toBeDefined();
      expect(screen.getByText('A ajuta')).toBeDefined();
    });
  });
});
