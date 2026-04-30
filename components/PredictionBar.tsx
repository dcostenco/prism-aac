'use client';
import { useEffect, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { speakWord } from '@/services/speechService';
import { tapFeedback } from '@/services/feedback';
import { DEFAULT_PREDICTIONS } from '@/constants/keyboardLayouts';

export default function PredictionBar() {
  const { text, appendWord, autoSpeak, soundEnabled } = useMessageStore();
  const { predictions, updatePredictions, learnWord } = usePredictionStore();
  const { speechRate, speechVolume } = useSettingsStore();
  // LAMP principle: keep slots stable. Fill empty slots from defaults.
  const slotsRef = useRef<string[]>(DEFAULT_PREDICTIONS);

  useEffect(() => {
    updatePredictions(text);
  }, [text, updatePredictions]);

  // Stable slot assignment: only replace a slot if the prediction is genuinely new
  useEffect(() => {
    const next = [...slotsRef.current];
    const used = new Set(next.map(s => s.toLowerCase()));
    // Update existing slots if prediction still exists
    for (let i = 0; i < 5; i++) {
      const pred = predictions[i];
      if (pred && !used.has(pred.toLowerCase())) {
        // Find a slot whose word is no longer in predictions
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
    slotsRef.current = next;
  }, [predictions]);

  const displayed = slotsRef.current;

  const handleTap = (word: string) => {
    tapFeedback();
    const words = text.trim().split(/\s+/).filter(Boolean);
    const previousWord = words.length > 0 ? words[words.length - 1] : undefined;
    appendWord(word);
    learnWord(word.toLowerCase(), previousWord?.toLowerCase());
    if (autoSpeak && soundEnabled) speakWord(word, speechRate, speechVolume);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 shrink-0" style={{ height: 'calc(100svh / 6 - 8px)', minHeight: '60px', maxHeight: '96px' }}>
      {displayed.map((word, i) => (
        <button
          key={`slot-${i}`}
          onClick={() => handleTap(word)}
          aria-label={`Predict: ${word}`}
          className="aac-btn flex-1 h-full max-w-[200px] bg-[#2a2a3e] rounded-2xl flex items-center justify-center text-[#e0e0e0] text-lg font-semibold select-none truncate px-3 border border-[rgba(255,255,255,0.06)]"
        >
          {word}
        </button>
      ))}
    </div>
  );
}
