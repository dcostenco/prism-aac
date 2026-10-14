import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';
import { ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useUIStore } from '@/store/uiStore';

const BASIC_NOUN_FORMS = [
  ['bottle', 'bottles', 'w-bottle.png'],
  ['box', 'boxes', 'w-box.png'],
  ['bed', 'beds', 'w-bed.png'],
  ['towel', 'towels', 'w-towel.png'],
  ['clock', 'clocks', 'w-clock.png'],
  ['girl', 'girls', 'pp-girl.png'],
  ['boy', 'boys', 'pp-boy.png'],
  ['kid', 'kids', 'pp-kid.png'],
  ['child', 'children', 'pp-kid.png'],
  ['camel', 'camels', 'w-camel.png'],
  ['pill', 'pills', 'hb-pill.png'],
  ['pillar', 'pillars', 'w-pillar.png'],
] as const;

beforeEach(async () => {
  cleanup();
  await ensureLangCorpusLoaded('en');
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en', cloudPredictionEnabled: false });
  useMessageStore.setState({ text: '', soundEnabled: false });
  useUIStore.setState({ sidePanel: 'none', categoryKeyboardOpen: true, keyboardMaximized: true });
});

describe('basic noun word-form pictures', () => {
  it.each(BASIC_NOUN_FORMS)('%s and %s retain the same noun picture', (singular, plural, file) => {
    const expected = { url: `/prism-aac/symbols/${file}` };
    expect(builtInVocabularySymbol(singular, 'en')).toEqual(expected);
    expect(builtInVocabularySymbol(plural, 'en')).toEqual(expected);
  });

  it('renders bottle and bottles as picture cards instead of silently centering plural text', async () => {
    useMessageStore.setState({ text: 'bot' });
    usePredictionStore.setState({
      predictions: ['bottle', 'bottles', 'both', 'bottom', 'bother'],
      aiCompletion: null,
      updatePredictions: vi.fn(),
    });
    await act(async () => { render(<PredictionBar />); });
    for (const word of ['bottle', 'bottles']) {
      await waitFor(() => {
        const tile = screen.getByRole('button', { name: `Predict: ${word}` });
        expect(tile).toHaveAttribute('data-picture', 'symbol');
        expect(tile.querySelector('img')).toHaveAttribute('src', '/prism-aac/symbols/w-bottle.png');
      });
    }
    expect(useMessageStore.getState().text).toBe('bot');
  });

  it('does not guess a new meaning from an ending', () => {
    expect(builtInVocabularySymbol('securities', 'en')?.url).not.toBe('/prism-aac/symbols/w-security.png');
    expect(builtInVocabularySymbol('flies', 'en')?.url).not.toBe('/prism-aac/symbols/w-fly.png');
    expect(builtInVocabularySymbol('boyd', 'en')?.url).not.toBe('/prism-aac/symbols/pp-boy.png');
  });

  it('gives bother an interruption picture rather than a generic annoyed face', () => {
    for (const word of ['bother', 'bothered', 'bothering', 'bothers']) {
      expect(builtInVocabularySymbol(word, 'en')).toEqual({ url: '/prism-aac/symbols/w-bother.png' });
    }
  });
});
