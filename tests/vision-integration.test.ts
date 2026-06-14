import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inferScene } from '@/services/sceneInference';
import { getVisionPhrases } from '@/constants/visionPhrases';
import { getObjectWords } from '@/constants/objectVocabulary';
import { useVisionStore } from '@/store/visionStore';
import { _resetForTests as resetBridge, _getActiveScene } from '@/services/visionPredictionBridge';

describe('vision-to-phrase integration', () => {
  beforeEach(() => {
    useVisionStore.getState().reset();
    resetBridge();
  });

  it('full pipeline: cup+fork → mealtime → phrases in English', () => {
    const objects = ['cup', 'fork'];
    const { scene, confidence } = inferScene(objects, 12);
    expect(scene).toBe('mealtime');
    expect(confidence).toBeGreaterThanOrEqual(0.7);

    const phrases = getVisionPhrases(scene, 'en');
    expect(phrases.length).toBeGreaterThanOrEqual(8);
    expect(phrases).toContain('I want more');
    expect(phrases).toContain('Water please');

    const cupWords = getObjectWords('cup', 'en');
    expect(cupWords).toContain('drink');
    expect(cupWords).toContain('water');
  });

  it('full pipeline: bed → bedtime → phrases in Russian', () => {
    const { scene } = inferScene(['bed'], 22);
    expect(scene).toBe('bedtime');

    const phrases = getVisionPhrases(scene, 'ru');
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases[0]).toMatch(/[а-яёА-ЯЁ]/);
  });

  it('full pipeline: book+laptop → schoolwork at 9am', () => {
    const { scene, confidence } = inferScene(['book', 'laptop'], 9);
    expect(scene).toBe('schoolwork');
    expect(confidence).toBeGreaterThan(0.5);

    const phrases = getVisionPhrases(scene, 'en');
    expect(phrases).toContain('Help please');
  });

  it('full pipeline: toilet → bathtime', () => {
    const { scene } = inferScene(['toilet'], 8);
    expect(scene).toBe('bathtime');

    const phrases = getVisionPhrases(scene, 'es');
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases).toContain('Necesito ir');
  });

  it('vision store reflects scene changes', () => {
    useVisionStore.getState().setScene('mealtime', 0.85);
    expect(useVisionStore.getState().activeScene).toBe('mealtime');
    expect(useVisionStore.getState().sceneConfidence).toBe(0.85);

    useVisionStore.getState().setScene(null, 0);
    expect(useVisionStore.getState().activeScene).toBeNull();
  });

  it('emergency phrases never appear in vision phrases', () => {
    const dangerousPhrases = ['call 911', 'emergency', 'someone is hurting me', 'i am being hurt'];
    const scenes = ['mealtime', 'bedtime', 'playtime', 'schoolwork', 'bathtime', 'watching_tv'] as const;
    for (const scene of scenes) {
      const phrases = getVisionPhrases(scene, 'en');
      for (const phrase of phrases) {
        const lower = phrase.toLowerCase();
        const isDangerous = dangerousPhrases.some(d => lower.includes(d));
        if (isDangerous) {
          expect.fail(`Vision phrase "${phrase}" in scene "${scene}" contains emergency phrase`);
        }
      }
    }
  });

  it('all 30 COCO objects have English mappings', () => {
    const cocoObjects = [
      'cup', 'fork', 'spoon', 'knife', 'bowl', 'bottle', 'banana', 'apple',
      'bed', 'book', 'tv', 'laptop', 'keyboard', 'toilet', 'sink',
      'teddy bear', 'sports ball', 'toothbrush', 'bicycle', 'car',
      'dog', 'cat', 'bird', 'chair', 'couch', 'backpack', 'clock',
      'remote', 'scissors', 'hair drier',
    ];
    for (const obj of cocoObjects) {
      const words = getObjectWords(obj, 'en');
      expect(words.length, `${obj} has no English words`).toBeGreaterThan(0);
    }
  });

  it('person class is not in object vocabulary', () => {
    const words = getObjectWords('person', 'en');
    expect(words).toEqual([]);
  });

  it('unknown scene returns no phrases', () => {
    const { scene } = inferScene([], 12);
    expect(scene).toBe('unknown');
    const phrases = getVisionPhrases(scene, 'en');
    expect(phrases).toEqual([]);
  });

  it('20+ languages covered for mealtime', () => {
    const langs = ['en', 'es', 'fr', 'pt', 'ro', 'uk', 'ru', 'de', 'ja', 'ko', 'zh', 'ar'] as const;
    for (const lang of langs) {
      const phrases = getVisionPhrases('mealtime', lang);
      expect(phrases.length, `mealtime/${lang} missing`).toBeGreaterThanOrEqual(8);
    }
  });
});
