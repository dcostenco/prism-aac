'use client';
import { useEffect, useState, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { getPredictionsForLanguage } from '@/constants/keyboardLayouts';
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
      className="aac-btn flex-1 min-w-0 surface-key rounded-xl flex flex-col items-center justify-between py-1 px-1 border-l-[5px] border border-theme overflow-hidden"
      style={{ borderLeftColor: color, color }}
    >
      <span className="flex-1 flex items-center justify-center">
        {iconUrl && (
          <img src={iconUrl} alt="" aria-hidden loading="lazy" className="max-w-[clamp(1.5rem,4vw,2.5rem)] max-h-[clamp(1.5rem,5svh,2.5rem)] object-contain" />
        )}
      </span>
      <span className="truncate w-full text-center text-[clamp(0.6rem,1.8vw,1rem)] font-bold shrink-0 leading-tight">{word}</span>
    </button>
  );
}

export default function PredictionBar() {
  const { text } = useMessageStore();
  const { predictions, updatePredictions, learnWord } = usePredictionStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const langDefaults = getPredictionsForLanguage(language);
  const [displayed, setDisplayed] = useState<string[]>(langDefaults);
  const prevRef = useRef<string[]>(langDefaults);

  useEffect(() => {
    const defaults = getPredictionsForLanguage(language);
    if (!text.trim()) {
      prevRef.current = defaults;
      setDisplayed(defaults);
      return;
    }
    updatePredictions(text, language);
  }, [text, updatePredictions, language]);

  useEffect(() => {
    if (!text.trim()) return;
    const next = computeStableSlots(prevRef.current, predictions);
    prevRef.current = next;
    setDisplayed(next);
  }, [predictions, text]);

  const handleTap = (word: string) => {
    tapFeedback();
    const midWord = text.length > 0 && !text.endsWith(' ');
    const words = text.trim().split(/\s+/).filter(Boolean);
    const previousWord = midWord && words.length > 1 ? words[words.length - 2] : (words.length > 0 ? words[words.length - 1] : undefined);

    if (midWord && words.length > 0) {
      const prefix = words.slice(0, -1).join(' ');
      const newText = prefix ? `${prefix} ${word} ` : `${word} `;
      useMessageStore.getState().setText(newText);
    } else {
      const current = useMessageStore.getState().text;
      const newText = current.trim() ? `${current.trim()} ${word} ` : `${word} `;
      useMessageStore.getState().setText(newText);
    }

    learnWord(word.toLowerCase(), previousWord?.toLowerCase());
    const fullPhrase = midWord ? [...words.slice(0, -1), word].join(' ') : [...words, word].join(' ');
    aacSpeak(fullPhrase, speechRate, speechVolume);
  };

  return (
    <div className="flex items-stretch gap-[2px] px-1 py-[2px] shrink-0 h-[clamp(56px,13svh,110px)]">
      {displayed.map((word, i) => {
        const color = CATEGORY_COLORS[classifyWord(word)];
        return <PredictionTile key={`slot-${i}`} word={word} color={color} onTap={handleTap} />;
      })}
    </div>
  );
}
