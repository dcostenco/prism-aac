import { create } from 'zustand';
import type { SceneType } from '@/services/sceneInference';

interface VisionState {
  enabled: boolean;
  activeScene: SceneType | null;
  sceneConfidence: number;
  detectedObjects: string[];
  lastDetectionTime: number;
  isProcessing: boolean;

  setEnabled: (v: boolean) => void;
  setScene: (scene: SceneType | null, confidence: number) => void;
  setDetectedObjects: (objects: string[], timestamp: number) => void;
  setProcessing: (v: boolean) => void;
  reset: () => void;
}

export const useVisionStore = create<VisionState>()((set) => ({
  enabled: false,
  activeScene: null,
  sceneConfidence: 0,
  detectedObjects: [],
  lastDetectionTime: 0,
  isProcessing: false,

  setEnabled: (v) => set({ enabled: v }),
  setScene: (scene, confidence) => set({ activeScene: scene, sceneConfidence: Math.max(0, Math.min(1, confidence)) }),
  setDetectedObjects: (objects, timestamp) => set({ detectedObjects: objects, lastDetectionTime: timestamp }),
  setProcessing: (v) => set({ isProcessing: v }),
  reset: () => set({
    activeScene: null,
    sceneConfidence: 0,
    detectedObjects: [],
    lastDetectionTime: 0,
    isProcessing: false,
  }),
}));
