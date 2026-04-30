'use client';
import { useEffect, useState, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speakWord } from '@/services/speechService';
import { tapFeedback } from '@/services/feedback';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { useT } from '@/engine/useT';

function computeStableSlots(prev: string[], predictions: string[]): string[] {
  const next = [...prev];
  const used = new Set(next.map(s => s.toLowerCase()));
  for (let i = 0; i < 5; i++) {
    const pred = predictions[i];
    if (pred && !used.has(pred.toLowerCase())) {
      const deadSlot = next.findIndex(
        (s) => !predictions.some((p) => p.toLowerCase() === s.toLowerCase())
      );
      if (deadSlot >= 0) {
        used.delete(next[deadSlot].toLowerCase());
        next[deadSlot] = pred;
        used.add(pred.toLowerCase());
      }
    }
  }
  return next;
}

export default function PredictionBar() {
  const { text, appendWord, autoSpeak, soundEnabled } = useMessageStore();
  const { predictions, updatePredictions, learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();
  const { ttsCode } = useT();
  const [displayed, setDisplayed] = useState<string[]>(DEFAULT_PREDICTIONS);
  const prevRef = useRef<string[]>(DEFAULT_PREDICTIONS);

  useEffect(() => {
    updatePredictions(text);
  }, [text, updatePredictions]);

  useEffect(() => {
    const next = computeStableSlots(prevRef.current, predictions);
    prevRef.current = next;
    setDisplayed(next);
  }, [predictions]);

  const handleTap = (word: string) => {
    tapFeedback();
    const words = text.trim().split(/\s+/).filter(Boolean);
    const previousWord = words.length > 0 ? words[words.length - 1] : undefined;
    appendWord(word);
    learnWord(word.toLowerCase(), previousWord?.toLowerCase());
    if (autoSpeak && soundEnabled) speakWord(word, speechRate, speechVolume, ttsCode);
  };

  return (
    <div className="flex items-stretch gap-3 px-3 py-2 shrink-0 min-h-[88px] md:min-h-[112px]">
      {displayed.map((word, i) => {
        const color = CATEGORY_COLORS[classifyWord(word)];
        return (
          <button
            key={`slot-${i}`}
            onClick={() => handleTap(word)}
            aria-label={`Predict: ${word}`}
            className="aac-btn flex-1 surface-key rounded-2xl flex items-center justify-center text-xl md:text-2xl font-semibold select-none truncate px-3 border-l-[6px] border border-theme"
            style={{ borderLeftColor: color, color }}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}
