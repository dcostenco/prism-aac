import { describe, it, expect, beforeEach } from 'vitest';
import { useVisionStore } from '@/store/visionStore';

describe('visionStore', () => {
  beforeEach(() => {
    useVisionStore.getState().reset();
    useVisionStore.getState().setEnabled(false);
  });

  it('starts disabled with no scene', () => {
    const s = useVisionStore.getState();
    expect(s.enabled).toBe(false);
    expect(s.activeScene).toBeNull();
    expect(s.detectedObjects).toEqual([]);
  });

  it('setEnabled toggles the flag', () => {
    useVisionStore.getState().setEnabled(true);
    expect(useVisionStore.getState().enabled).toBe(true);
    useVisionStore.getState().setEnabled(false);
    expect(useVisionStore.getState().enabled).toBe(false);
  });

  it('setScene updates activeScene and confidence', () => {
    useVisionStore.getState().setScene('mealtime', 0.85);
    const s = useVisionStore.getState();
    expect(s.activeScene).toBe('mealtime');
    expect(s.sceneConfidence).toBe(0.85);
  });

  it('setDetectedObjects updates objects and uses provided timestamp', () => {
    useVisionStore.getState().setDetectedObjects(['cup', 'fork'], 1700000000000);
    const s = useVisionStore.getState();
    expect(s.detectedObjects).toEqual(['cup', 'fork']);
    expect(s.lastDetectionTime).toBe(1700000000000);
  });

  it('reset clears all vision state but preserves enabled', () => {
    useVisionStore.getState().setEnabled(true);
    useVisionStore.getState().setScene('mealtime', 0.9);
    useVisionStore.getState().setDetectedObjects(['cup']);
    useVisionStore.getState().reset();
    const s = useVisionStore.getState();
    expect(s.enabled).toBe(true);
    expect(s.activeScene).toBeNull();
    expect(s.detectedObjects).toEqual([]);
    expect(s.sceneConfidence).toBe(0);
  });

  it('setProcessing updates flag', () => {
    useVisionStore.getState().setProcessing(true);
    expect(useVisionStore.getState().isProcessing).toBe(true);
    useVisionStore.getState().setProcessing(false);
    expect(useVisionStore.getState().isProcessing).toBe(false);
  });
});
