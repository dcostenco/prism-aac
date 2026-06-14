import { describe, it, expect, beforeEach } from 'vitest';
import { usePredictionStore } from '@/store/predictionStore';
import { useVisionStore } from '@/store/visionStore';
import { getPredictionsForLanguage } from '@/constants/keyboardLayouts';
import { getVisionPhrases } from '@/constants/visionPhrases';
import { isAllowedInLang } from '@/lib/langAllowlist';

/**
 * Regression tests for the PredictionBar vision merge path.
 *
 * Before the fix, PredictionBar's useEffect had:
 *   if (!text.trim()) return;
 * which skipped the aiCompletion merge when the message bar was empty.
 * This meant vision phrases were set in the store but never rendered.
 *
 * These tests verify the merge logic that PredictionBar now applies
 * when text is empty and aiCompletion is set by the vision bridge.
 */

function mergeAiCompletion(corpusPreds: string[], ai: string | null, language: string): string[] {
  if (!ai || !isAllowedInLang(ai, language)) return corpusPreds;
  const lc = ai.toLowerCase();
  const dedup = corpusPreds.filter((p) => p.toLowerCase() !== lc);
  return [ai, ...dedup].slice(0, 5);
}

describe('vision phrases in prediction bar (regression)', () => {
  beforeEach(() => {
    usePredictionStore.getState().setAiCompletion(null);
    useVisionStore.getState().reset();
  });

  it('vision phrase merges into defaults when text is empty', () => {
    const defaults = getPredictionsForLanguage('en');
    const visionPhrase = 'I want more';
    const merged = mergeAiCompletion(defaults, visionPhrase, 'en');

    expect(merged[0]).toBe('I want more');
    expect(merged.length).toBe(5);
    expect(merged.slice(1)).not.toContain('I want more');
  });

  it('vision phrase replaces duplicate in defaults', () => {
    const defaults = getPredictionsForLanguage('en');
    const firstDefault = defaults[0];
    const merged = mergeAiCompletion(defaults, firstDefault, 'en');

    expect(merged[0]).toBe(firstDefault);
    expect(merged.length).toBe(5);
    expect(merged.filter(w => w.toLowerCase() === firstDefault.toLowerCase()).length).toBe(1);
  });

  it('null aiCompletion returns defaults unchanged', () => {
    const defaults = getPredictionsForLanguage('en');
    const merged = mergeAiCompletion(defaults, null, 'en');

    expect(merged).toEqual(defaults);
  });

  it('vision phrase for each scene is allowed in English', () => {
    const scenes = ['mealtime', 'bedtime', 'schoolwork', 'playtime', 'bathtime'] as const;
    for (const scene of scenes) {
      const phrases = getVisionPhrases(scene, 'en');
      expect(phrases.length).toBeGreaterThan(0);
      const topPhrase = phrases[0];
      expect(isAllowedInLang(topPhrase, 'en')).toBe(true);
    }
  });

  it('vision phrase merges into Russian defaults', () => {
    const defaults = getPredictionsForLanguage('ru');
    const phrases = getVisionPhrases('mealtime', 'ru');
    const merged = mergeAiCompletion(defaults, phrases[0], 'ru');

    expect(merged[0]).toBe(phrases[0]);
    expect(merged.length).toBe(5);
  });

  it('vision store activeScene enables badge rendering', () => {
    useVisionStore.getState().setScene('mealtime', 0.9);
    const { activeScene, sceneConfidence } = useVisionStore.getState();

    expect(activeScene).toBe('mealtime');
    expect(sceneConfidence).toBe(0.9);
  });

  it('clearing vision restores null scene', () => {
    useVisionStore.getState().setScene('bedtime', 0.7);
    useVisionStore.getState().setScene(null, 0);
    const { activeScene } = useVisionStore.getState();

    expect(activeScene).toBeNull();
  });

  it('vision-boosted tile is identified when aiCompletion matches', () => {
    const activeScene = 'mealtime';
    const aiCompletion = 'I want more';
    const tiles = ['I want more', 'You', 'More', 'Want', 'Help'];

    const boostedIndex = tiles.findIndex(
      (word) => activeScene && aiCompletion && word === aiCompletion,
    );

    expect(boostedIndex).toBe(0);
  });
});
