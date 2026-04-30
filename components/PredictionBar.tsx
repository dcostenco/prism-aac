'use client';
import { useEffect, useState, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { speakWord } from '@/services/speechService';
import { tapFeedback } from '@/services/feedback';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
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

function PredictionTile({ word, color, onTap }: { word: string; color: string; onTap: (w: string) => void }) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPictogramUrl(word, language, pictureMode).then((url) => {
      if (!cancelled) setIconUrl(url);
    });
    return () => { cancelled = true; };
  }, [word, language, pictureMode]);

  return (
    <button
      onClick={() => onTap(word)}
      aria-label={`Predict: ${word}`}
      className="aac-btn flex-1 surface-key rounded-2xl flex flex-col items-center justify-center gap-1 text-xl md:text-2xl font-semibold select-none truncate px-3 py-2 border-l-[6px] border border-theme"
      style={{ borderLeftColor: color, color }}
    >
      {iconUrl && (
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          loading="lazy"
          className="w-10 h-10 md:w-14 md:h-14 object-contain"
        />
      )}
      <span className="truncate w-full text-center">{word}</span>
    </button>
  );
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
    // Auto-speak the cumulative phrase, not just the tapped tile. User-
    // reported bug: tapping "Can" after "we" pronounced only "can". Now
    // the latest utterance interrupts the previous (speakLocal cancels
    // first) and reads the whole message in context.
    if (autoSpeak && soundEnabled) {
      const fullText = (text.trim() ? text.trim() + ' ' : '') + word;
      speakWord(fullText, speechRate, speechVolume, ttsCode);
    }
  };

  return (
    <div className="flex items-stretch gap-3 px-3 py-2 shrink-0 min-h-[88px] md:min-h-[140px]">
      {displayed.map((word, i) => {
        const color = CATEGORY_COLORS[classifyWord(word)];
        return <PredictionTile key={`slot-${i}`} word={word} color={color} onTap={handleTap} />;
      })}
    </div>
  );
}
