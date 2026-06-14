import { describe, it, expect } from 'vitest';
import { inferScene, getSceneRules, type SceneType } from '@/services/sceneInference';

describe('sceneInference', () => {
  describe('inferScene — scene detection from objects', () => {
    it('detects mealtime from cup + fork', () => {
      const r = inferScene(['cup', 'fork'], 12);
      expect(r.scene).toBe('mealtime');
      expect(r.confidence).toBeGreaterThanOrEqual(0.7);
      expect(r.matchedObjects).toContain('cup');
      expect(r.matchedObjects).toContain('fork');
    });

    it('detects mealtime from bowl + spoon + knife', () => {
      const r = inferScene(['bowl', 'spoon', 'knife'], 12);
      expect(r.scene).toBe('mealtime');
      expect(r.confidence).toBeGreaterThan(0.7);
    });

    it('boosts mealtime confidence at noon', () => {
      const noon = inferScene(['cup', 'fork'], 12);
      const midnight = inferScene(['cup', 'fork'], 2);
      expect(noon.confidence).toBeGreaterThan(midnight.confidence);
    });

    it('detects bedtime from bed', () => {
      const r = inferScene(['bed'], 22);
      expect(r.scene).toBe('bedtime');
      expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('boosts bedtime confidence at night', () => {
      const night = inferScene(['bed'], 23);
      const morning = inferScene(['bed'], 9);
      expect(night.confidence).toBeGreaterThan(morning.confidence);
    });

    it('detects playtime from teddy bear', () => {
      const r = inferScene(['teddy bear'], 15);
      expect(r.scene).toBe('playtime');
    });

    it('detects schoolwork from book + laptop', () => {
      const r = inferScene(['book', 'laptop'], 9);
      expect(r.scene).toBe('schoolwork');
      expect(r.confidence).toBeGreaterThan(0.5);
    });

    it('detects bathtime from toilet', () => {
      const r = inferScene(['toilet'], 8);
      expect(r.scene).toBe('bathtime');
    });

    it('detects watching_tv from tv', () => {
      const r = inferScene(['tv'], 20);
      expect(r.scene).toBe('watching_tv');
    });

    it('detects outdoors from bicycle + bird', () => {
      const r = inferScene(['bicycle', 'bird'], 14);
      expect(r.scene).toBe('outdoors');
    });

    it('detects grooming from hair drier', () => {
      const r = inferScene(['hair drier'], 7);
      expect(r.scene).toBe('grooming');
    });

    it('toothbrush maps to bathtime (higher base confidence)', () => {
      const r = inferScene(['toothbrush'], 7);
      expect(r.scene).toBe('bathtime');
    });

    it('returns unknown for no objects', () => {
      const r = inferScene([], 12);
      expect(r.scene).toBe('unknown');
      expect(r.confidence).toBe(0);
    });

    it('returns unknown for single unrecognized object', () => {
      const r = inferScene(['chair'], 12);
      expect(r.scene).toBe('unknown');
    });

    it('returns unknown when insufficient objects for minRequired', () => {
      const r = inferScene(['cup'], 12);
      expect(r.scene).not.toBe('mealtime');
    });

    it('handles case-insensitive object labels', () => {
      const r = inferScene(['CUP', 'Fork'], 12);
      expect(r.scene).toBe('mealtime');
    });

    it('picks highest-confidence scene when multiple match', () => {
      const r = inferScene(['book', 'bed'], 22);
      expect(r.scene).toBe('bedtime');
      expect(r.confidence).toBeGreaterThan(0.6);
    });

    it('extra matching objects boost confidence', () => {
      const two = inferScene(['cup', 'fork'], 12);
      const four = inferScene(['cup', 'fork', 'spoon', 'bowl'], 12);
      expect(four.confidence).toBeGreaterThan(two.confidence);
    });

    it('confidence never exceeds 1.0', () => {
      const r = inferScene(['cup', 'fork', 'spoon', 'bowl', 'knife', 'bottle', 'dining table'], 12);
      expect(r.confidence).toBeLessThanOrEqual(1.0);
    });

    it('uses current hour when hourOfDay not provided', () => {
      const r = inferScene(['cup', 'fork']);
      expect(r.scene).toBe('mealtime');
    });
  });

  describe('getSceneRules', () => {
    it('returns an array of rules', () => {
      const rules = getSceneRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('every rule has required fields', () => {
      for (const rule of getSceneRules()) {
        expect(rule.scene).toBeTruthy();
        expect(rule.objects.length).toBeGreaterThan(0);
        expect(rule.minRequired).toBeGreaterThan(0);
        expect(rule.baseConfidence).toBeGreaterThan(0);
        expect(rule.baseConfidence).toBeLessThanOrEqual(1);
      }
    });

    it('no duplicate scene types in rules', () => {
      const scenes = getSceneRules().map(r => r.scene);
      expect(new Set(scenes).size).toBe(scenes.length);
    });
  });
});
