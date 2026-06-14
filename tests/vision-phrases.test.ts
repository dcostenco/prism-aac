import { describe, it, expect } from 'vitest';
import { VISION_PHRASES, getVisionPhrases } from '@/constants/visionPhrases';
import type { SceneType } from '@/services/sceneInference';

describe('visionPhrases', () => {
  it('every scene has English phrases', () => {
    for (const [scene, langs] of Object.entries(VISION_PHRASES)) {
      expect(langs?.en, `${scene} missing English`).toBeDefined();
      expect(langs!.en!.length, `${scene} English is empty`).toBeGreaterThan(0);
    }
  });

  it('no empty phrase arrays', () => {
    for (const [scene, langs] of Object.entries(VISION_PHRASES)) {
      for (const [lang, phrases] of Object.entries(langs!)) {
        expect(phrases.length, `${scene}/${lang} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate phrases within a scene/language', () => {
    for (const [scene, langs] of Object.entries(VISION_PHRASES)) {
      for (const [lang, phrases] of Object.entries(langs!)) {
        const unique = new Set(phrases);
        expect(unique.size, `${scene}/${lang} has duplicates`).toBe(phrases.length);
      }
    }
  });

  it('getVisionPhrases returns phrases for known scene', () => {
    const phrases = getVisionPhrases('mealtime', 'en');
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases).toContain('I want more');
  });

  it('getVisionPhrases falls back to English for unsupported language', () => {
    const phrases = getVisionPhrases('bedtime', 'tl' as any);
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases).toContain("I'm tired");
  });

  it('getVisionPhrases returns empty for unknown scene', () => {
    expect(getVisionPhrases('unknown' as SceneType, 'en')).toEqual([]);
  });

  it('mealtime has at least 8 core phrases', () => {
    for (const [lang, phrases] of Object.entries(VISION_PHRASES.mealtime!)) {
      expect(phrases.length, `mealtime/${lang} too few`).toBeGreaterThanOrEqual(8);
    }
  });

  it('Russian phrases use Cyrillic', () => {
    const phrases = getVisionPhrases('mealtime', 'ru');
    for (const p of phrases) {
      expect(p, `"${p}" is not Cyrillic`).toMatch(/[а-яёА-ЯЁ]/);
    }
  });

  it('Japanese phrases use Japanese characters', () => {
    const phrases = getVisionPhrases('mealtime', 'ja');
    for (const p of phrases) {
      expect(p, `"${p}" is not Japanese`).toMatch(/[぀-ゟ゠-ヿ一-鿿ー]/);
    }
  });
});
