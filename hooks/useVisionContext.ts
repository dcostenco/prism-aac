'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useMessageStore } from '@/store/messageStore';
import { useVisionStore } from '@/store/visionStore';
import { inferScene } from '@/services/sceneInference';
import { getVisionPhrases } from '@/constants/visionPhrases';
import { getObjectWords } from '@/constants/objectVocabulary';

function exposeTestHarness(): void {
  if (process.env.NODE_ENV !== 'development') return;
  const predStore = usePredictionStore.getState();

  (window as any).__visionTest = {
    injectObjects: (labels: string[]) => {
      const lang = useSettingsStore.getState().language;
      const { scene, confidence } = inferScene(labels);
      useVisionStore.getState().setDetectedObjects(labels, Date.now());
      useVisionStore.getState().setScene(scene, confidence);
      if (scene !== 'unknown' && confidence >= 0.5) {
        const phrases = getVisionPhrases(scene, lang);
        if (phrases.length > 0) predStore.setAiCompletion(phrases[0]);
        for (const label of labels) {
          for (const word of getObjectWords(label, lang)) {
            predStore.learnWord(word);
          }
        }
      }
      return { scene, confidence, phrases: getVisionPhrases(scene, lang) };
    },
    clearScene: () => {
      useVisionStore.getState().setScene(null, 0);
      useVisionStore.getState().setDetectedObjects([], Date.now());
      predStore.setAiCompletion(null);
    },
    getState: () => useVisionStore.getState(),
  };

  (window as any).__enableVision = () => {
    useSettingsStore.getState().update({ visionContextEnabled: true });
    return 'Vision enabled';
  };
}

export function useVisionContext(): void {
  const enabled = useSettingsStore(s => s.visionContextEnabled);
  const handleRef = useRef<{ stop: () => void } | null>(null);
  const bridgeRef = useRef<(() => void) | null>(null);

  // Expose test harness immediately — no camera needed
  useEffect(() => {
    exposeTestHarness();
    return () => {
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).__visionTest;
        delete (window as any).__enableVision;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      handleRef.current?.stop();
      handleRef.current = null;
      bridgeRef.current?.();
      bridgeRef.current = null;
      useVisionStore.getState().reset();
      return;
    }

    let cancelled = false;

    (async () => {
      const { startObjectDetection } = await import('@/services/objectDetectionService');
      if (cancelled) return;
      const handle = await startObjectDetection();
      if (cancelled) return;
      if (handle) handleRef.current = handle;

      const { startVisionPredictionBridge } = await import('@/services/visionPredictionBridge');
      if (cancelled) return;
      const predStore = usePredictionStore.getState();
      const msgStore = useMessageStore.getState();
      bridgeRef.current = startVisionPredictionBridge(predStore, msgStore);
      useVisionStore.getState().setEnabled(true);
    })();

    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
      bridgeRef.current?.();
      bridgeRef.current = null;
      useVisionStore.getState().setEnabled(false);
      useVisionStore.getState().reset();
    };
  }, [enabled]);
}
