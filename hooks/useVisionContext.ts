'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useMessageStore } from '@/store/messageStore';
import { useVisionStore } from '@/store/visionStore';

export function useVisionContext(): void {
  const enabled = useSettingsStore(s => s.visionContextEnabled);
  const handleRef = useRef<{ stop: () => void } | null>(null);
  const bridgeRef = useRef<(() => void) | null>(null);

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
      if (cancelled || !handle) return;
      handleRef.current = handle;

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
