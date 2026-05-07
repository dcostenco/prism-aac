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

import { isAllowedInLang, ensureLangCorpusLoaded } from '@/lib/langAllowlist';

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
    getPictogramUrl(word, language, pictureMode)
      .then((url) => { if (!cancelled) setIconUrl(url); })
      .catch(() => { if (!cancelled) setIconUrl(null); });
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
  const { predictions, aiCompletion, updatePredictions, learnWord } = usePredictionStore();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const langDefaults = getPredictionsForLanguage(language);
  const [displayed, setDisplayed] = useState<string[]>(langDefaults);
  const prevRef = useRef<string[]>(langDefaults);

  // Eagerly preload the lang's curated corpus on language change so
  // the allowlist gate has data ready before the first prediction
  // fires. Without this preload, the gate fail-opens for the first
  // ~50ms after a language switch and any in-flight aiCompletion
  // would slip through unfiltered.
  useEffect(() => {
    void ensureLangCorpusLoaded(language);
  }, [language]);

  // Immediately show language-specific defaults on language switch,
  // then refine with predictions if there's typed text.
  const prevLangRef = useRef(language);
  useEffect(() => {
    let mounted = true;
    const defaults = getPredictionsForLanguage(language);
    if (language !== prevLangRef.current) {
      prevRef.current = defaults;
      queueMicrotask(() => { if (mounted) setDisplayed(defaults); });
      prevLangRef.current = language;
    }
    if (!text.trim()) {
      prevRef.current = defaults;
      queueMicrotask(() => { if (mounted) setDisplayed(defaults); });
      return () => { mounted = false; };
    }
    updatePredictions(text, language);
    return () => { mounted = false; };
  }, [text, updatePredictions, language]);

  // Merge AI completion into the prediction list as the leftmost tile.
  // When set, the AI's word completion ("дуб" for "у лукоморья д") wins
  // slot 0 — corpus-rare but contextually-correct words can surface even
  // when raw wordfreq ranks them too low for the top-5. We prepend rather
  // than override so the corpus-based predictions still occupy slots 1-4.
  //
  // Cross-language gate: drop `ai` if it isn't plausible for the
  // active language. correctText (called by MessageBar) routes via
  // /text/correct which can return an English suggestion when the
  // user is composing English-looking text in a Latin-script non-EN
  // language. Without this gate, that English word lands as the
  // leftmost tile in the RO bar — exactly what the screenshot bug
  // reported (`eu / I / to / a / noise` — "I" is the aiCompletion).
  // Single allowlist gate: drop anything not allowed in the current
  // language. Backed by the curated per-lang corpus (5759 RO words,
  // 5000+ for every supported lang) plus a diacritic carve-out for
  // user proper nouns. Replaces the earlier stopword approach which
  // missed every word not enumerated (Main, noise, to, etc.).
  function mergeAiCompletion(corpusPreds: string[], ai: string | null): string[] {
    if (!ai || !isAllowedInLang(ai, language)) return corpusPreds;
    const lc = ai.toLowerCase();
    const dedup = corpusPreds.filter((p) => p.toLowerCase() !== lc);
    return [ai, ...dedup].slice(0, 5);
  }

  // Final defense-in-depth: drop ANY tile not allowed in the current
  // language, refill empty slots from langDefaults so the bar always
  // renders 5 tiles. Catches stale carry-overs from a previous EN
  // session AND any word the upstream gates missed.
  function dropForeignTiles(displayed: string[]): string[] {
    if (language === 'en') return displayed;
    const cleaned = displayed.filter((w) => isAllowedInLang(w, language));
    if (cleaned.length === displayed.length) return displayed;
    const filler = langDefaults.filter((w) => !cleaned.includes(w) && isAllowedInLang(w, language));
    return [...cleaned, ...filler].slice(0, 5);
  }

  useEffect(() => {
    if (!text.trim()) return;
    // Only use stable slots within same language; full reset on language change
    const merged = mergeAiCompletion(predictions, aiCompletion);
    const next = computeStableSlots(prevRef.current, merged);
    prevRef.current = next;
    setDisplayed(next);
  }, [predictions, aiCompletion, text]);

  const handleTap = (word: string) => {
    tapFeedback();
    const midWord = text.length > 0 && !text.endsWith(' ');
    const words = text.trim().split(/\s+/).filter(Boolean);
    const isCompletion = midWord && words.length > 0 && word.toLowerCase().startsWith(words[words.length - 1].toLowerCase());

    // For trigram learning we need the two committed words BEFORE the new tap.
    // If the user is completing a partial word, the in-progress word doesn't count as committed,
    // so previous = words[-2], prevPrev = words[-3]. Otherwise previous = words[-1],
    // prevPrev = words[-2].
    const previousWord = isCompletion && words.length > 1 ? words[words.length - 2] : (!isCompletion && words.length > 0 ? words[words.length - 1] : undefined);
    const prevPrevWord = isCompletion && words.length > 2 ? words[words.length - 3] : (!isCompletion && words.length > 1 ? words[words.length - 2] : undefined);

    if (isCompletion && words.length > 0) {
      const prefix = words.slice(0, -1).join(' ');
      const newText = prefix ? `${prefix} ${word} ` : `${word} `;
      useMessageStore.getState().setText(newText);
    } else {
      const current = useMessageStore.getState().text;
      const newText = current.trim() ? `${current.trim()} ${word} ` : `${word} `;
      useMessageStore.getState().setText(newText);
    }

    learnWord(word.toLowerCase(), previousWord?.toLowerCase(), prevPrevWord?.toLowerCase());
    const fullPhrase = isCompletion ? [...words.slice(0, -1), word].join(' ') : [...words, word].join(' ');
    aacSpeak(fullPhrase, speechRate, speechVolume);
  };

  const finalTiles = dropForeignTiles(displayed);

  return (
    <div className="flex items-stretch gap-[2px] px-1 py-[2px] shrink-0 h-[clamp(56px,13svh,110px)]">
      {finalTiles.map((word, i) => {
        const color = CATEGORY_COLORS[classifyWord(word)];
        return <PredictionTile key={`slot-${i}`} word={word} color={color} onTap={handleTap} />;
      })}
    </div>
  );
}
