'use client';

import { subscribeVisionContext, type VisionContext } from './objectDetectionService';
import { inferScene, type SceneType } from './sceneInference';
import { getVisionPhrases } from '@/constants/visionPhrases';
import { getObjectWords } from '@/constants/objectVocabulary';
import { useVisionStore } from '@/store/visionStore';
import { useSettingsStore } from '@/store/settingsStore';

const SCENE_STABILITY_FRAMES = 3;
const VISION_BOOST_DECAY_MS = 30_000;
const TYPING_IDLE_MS = 2000;

let unsubscribe: (() => void) | null = null;
let pendingScene: SceneType | null = null;
let pendingCount = 0;
let activeScene: SceneType | null = null;
let boostTimestamps = new Map<string, number>();

interface PredictionStore {
  setAiCompletion: (word: string | null) => void;
  learnWord: (word: string, previousWord?: string, prevPrevWord?: string) => void;
  aiCompletion: string | null;
}

interface MessageStore {
  text: string;
  lastEditTime?: number;
}

export function startVisionPredictionBridge(
  predictionStore: PredictionStore,
  messageStore: MessageStore,
): () => void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  pendingScene = null;
  pendingCount = 0;
  activeScene = null;
  boostTimestamps = new Map();

  unsubscribe = subscribeVisionContext((ctx: VisionContext) => {
    const lang = useSettingsStore.getState().language;

    useVisionStore.getState().setDetectedObjects(
      ctx.stableObjects,
      ctx.timestamp,
    );

    const { scene, confidence } = inferScene(ctx.stableObjects);

    if (scene === 'unknown' || confidence < 0.5) {
      if (activeScene) clearScene(predictionStore);
      pendingScene = null;
      pendingCount = 0;
      return;
    }

    if (scene === pendingScene) {
      pendingCount++;
    } else {
      pendingScene = scene;
      pendingCount = 1;
    }

    if (pendingCount < SCENE_STABILITY_FRAMES) return;

    if (scene === activeScene) {
      decayBoosts();
      return;
    }

    activeScene = scene;
    boostTimestamps = new Map();
    useVisionStore.getState().setScene(scene, confidence);

    const isTyping = messageStore.text.trim().length > 0 &&
      (messageStore.lastEditTime ?? 0) > Date.now() - TYPING_IDLE_MS;

    if (!isTyping) {
      const phrases = getVisionPhrases(scene, lang);
      if (phrases.length > 0) {
        predictionStore.setAiCompletion(phrases[0]);
      }
    }

    const now = Date.now();
    for (const label of ctx.stableObjects) {
      const words = getObjectWords(label, lang);
      for (const word of words) {
        if (!boostTimestamps.has(word)) {
          predictionStore.learnWord(word);
          boostTimestamps.set(word, now);
        }
      }
    }
  });

  return () => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    clearScene(predictionStore);
    pendingScene = null;
    pendingCount = 0;
    activeScene = null;
    boostTimestamps = new Map();
  };
}

function clearScene(predictionStore: PredictionStore): void {
  activeScene = null;
  useVisionStore.getState().setScene(null, 0);
  predictionStore.setAiCompletion(null);
}

function decayBoosts(): void {
  const now = Date.now();
  for (const [word, ts] of boostTimestamps) {
    if (now - ts > VISION_BOOST_DECAY_MS) {
      boostTimestamps.delete(word);
    }
  }
}

export function _getActiveScene(): SceneType | null {
  return activeScene;
}

export function _resetForTests(): void {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  pendingScene = null;
  pendingCount = 0;
  activeScene = null;
  boostTimestamps = new Map();
}
