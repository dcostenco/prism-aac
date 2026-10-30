/**
 * The camera's object words fall back to the English list for languages that
 * have none. Now that the bar shows the user's own words even when no
 * dictionary has them, teaching those English words to a French user's
 * dictionary would put "potty" in the French bar. Object words are learned
 * only when the bar's language filter accepts them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisionContext } from '@/services/objectDetectionService';

const vision = vi.hoisted(() => ({ listener: null as ((ctx: VisionContext) => void) | null }));
vi.mock('@/services/objectDetectionService', () => ({
  subscribeVisionContext: (listener: (ctx: VisionContext) => void) => { vision.listener = listener; return () => { vision.listener = null; }; },
}));
vi.mock('@/services/sceneInference', () => ({ inferScene: () => ({ scene: 'bathroom', confidence: 1 }) }));

import { startVisionPredictionBridge } from '@/services/visionPredictionBridge';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { useSettingsStore } from '@/store/settingsStore';

async function learnedFor(language: string, label = 'toilet'): Promise<string[]> {
  useSettingsStore.setState({ language } as never);
  const learnWord = vi.fn();
  const stop = startVisionPredictionBridge({ setAiCompletion: vi.fn(), learnWord, aiCompletion: null }, { text: '' });
  const ctx = { stableObjects: [label], timestamp: Date.now() } as unknown as VisionContext;
  for (let i = 0; i < 3; i++) vision.listener?.(ctx);
  stop();
  return learnWord.mock.calls.map(call => call[0]);
}

beforeEach(async () => {
  for (const lang of ['en', 'fr', 'es', 'it', 'pt', 'ro', 'de']) await loadPredictionSeed(lang);
});

describe('object words learned from the camera', () => {
  it('never teaches the French dictionary the English fallback words', async () => {
    const learned = await learnedFor('fr');
    expect(learned).not.toContain('potty');
    expect(learned).not.toContain('toilet');
  });

  it('still learns the language\'s own object words, even ones another dictionary counts higher', async () => {
    expect(await learnedFor('es')).toContain('baño');
    // "lavabo" is in the Spanish list; the strict filter rejected it (other corpora count it higher).
    expect(await learnedFor('es', 'sink')).toContain('lavabo');
  });
});
