/**
 * The prediction bar colours a tile by the word's class in the ACTIVE language.
 *
 * PredictionBar called classifyWord(word) without the language, so the English fallbacks (-ed = verb, -ly = grammar) coloured
 * foreign words: Spanish "usted" and "red" (a network) got the green action colour. A non-English word without a dictionary entry is a
 * noun (orange).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { CATEGORY_COLORS } from '@/engine/colorCoding';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';

const hex = (c: string) => {
  const m = /^#(..)(..)(..)$/.exec(c)!;
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
};

async function tileColour(lang: string, word: string, prefix: string): Promise<string | null> {
  await loadPredictionSeed(lang);
  useSettingsStore.setState({ language: lang, outputLanguage: lang } as never);
  useMessageStore.setState({ text: prefix } as never);
  usePredictionStore.setState({ aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {}, predictions: [] });
  usePredictionStore.getState().ensureSeed();
  usePredictionStore.getState().updatePredictions(prefix, lang as never);
  await act(async () => { render(<PredictionBar />); });
  const tile = screen.getAllByRole('button').find((b) => b.textContent?.trim().toLowerCase() === word);
  if (!tile) return null;
  const el = [tile, ...Array.from(tile.querySelectorAll('*'))].find((e) => (e as HTMLElement).style?.backgroundColor) as HTMLElement | undefined;
  return el?.style.backgroundColor ?? null;
}

beforeEach(() => { cleanup(); window.localStorage.clear(); });

describe('tile colour follows the active language', () => {
  it('Spanish "usted" is not an English -ed verb', async () => {
    const colour = await tileColour('es', 'usted', 'ust');
    expect(colour).not.toBeNull();
    expect(colour).toBe(hex(CATEGORY_COLORS.noun));
    expect(colour).not.toBe(hex(CATEGORY_COLORS.verb));
  });
});
