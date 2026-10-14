import { expect, it } from 'vitest';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resolveVocabularyPicture } from '@/lib/builtInSymbols';

it('picture lookup additions preserve ordinary completions of a pictured noun prefix', async () => {
  useSettingsStore.setState({ language: 'en' });
  await ensureLangCorpusLoaded('en');
  usePredictionStore.getState().updatePredictions('', 'en');
  await loadPredictionSeed('en');
  await Promise.resolve();
  usePredictionStore.getState().updatePredictions('were bee', 'en');
  const words = usePredictionStore.getState().predictions.filter(word => isAllowedInLang(word, 'en')).slice(0, 5);
  for (const word of ['been', 'beer', 'beef', 'bees', 'beers']) {
    expect(words, word).toContain(word);
    expect(resolveVocabularyPicture(word, 'en').url, word).toBeTruthy();
  }
});
