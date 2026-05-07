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

/** Strict per-script regex for non-Latin languages. A word that fails
 *  is definitely in the wrong script, so we drop it. */
const SCRIPT_FILTER: Record<string, RegExp> = {
  ru: /^[а-яё'\-]+$/i,
  uk: /^[а-яєіїґ'\-]+$/i,
  ar: /^[؀-ۿݐ-ݿ'\-]+$/,
  ja: /^[぀-ゟ゠-ヿ一-鿿]+$/,
  ko: /^[가-힯ᄀ-ᇿ㄰-㆏]+$/,
  'zh-Hans': /^[一-鿿]+$/,
  'zh-Hant': /^[一-鿿]+$/,
  'zh-HK': /^[一-鿿]+$/,
};

/** English stopwords + the most common AAC English vocabulary. When
 *  the user is composing in a Latin-script non-EN language and the
 *  autocorrect service returns one of these as `aiCompletion`, it's
 *  the wrong-language leak we want to filter — even though the
 *  characters themselves are valid Latin chars in every Latin lang.
 *  This is what catches the user-reported screenshot:
 *      eu / I / to / a / noise  →  RO + EN-leak words I, to, noise.
 *  We can't go the other way (validate "looks Romanian") because
 *  many real RO words are pure ASCII (nu, am, de, mai, la, ce, cu);
 *  excluding the small EN set is precise and doesn't false-positive
 *  on real Romanian. */
const EN_STOPWORDS = new Set([
  'i', 'you', 'we', 'he', 'she', 'it', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their',
  'the', 'an', 'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'if', 'so', 'because', 'as',
  'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto', 'about', 'over', 'under',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing', 'done',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'not', 'no', 'yes', 'maybe',
  'want', 'need', 'help', 'like', 'love', 'hate', 'know', 'think', 'feel', 'see', 'go', 'come', 'get',
  'more', 'less', 'all', 'some', 'any', 'every', 'each', 'few', 'many', 'much',
  'now', 'then', 'here', 'there', 'when', 'where', 'why', 'how', 'what', 'who',
  'good', 'bad', 'big', 'small', 'hot', 'cold', 'happy', 'sad', 'tired', 'sick',
  'noise', 'thing', 'time', 'day', 'night', 'people', 'home', 'work', 'school',
  // Note: 'a' is omitted — it's also the Romanian preposition "to/of".
  // Note: 'to' is included; Romanian doesn't use it (Romanian "to" is "la"/"către").
  'to', 'of', 'too', 'too',
]);

/** True when `word` is the English-leak we want to drop. Returns
 *  false (= keep) for: empty input, EN language, words containing
 *  lang-specific characters (so we never drop a real RO/ES/FR word),
 *  any word that fails the strict non-Latin script regex. */
function isEnglishLeak(word: string, lang: string): boolean {
  if (!word || lang === 'en') return false;
  const w = word.toLowerCase().trim();
  if (!w) return false;
  // Non-Latin script gate: if the script regex exists and the word
  // FAILS it, drop it as foreign-script. This is the strict path.
  const strict = SCRIPT_FILTER[lang];
  if (strict) return !strict.test(w);
  // Latin-script non-English: drop only if the word is a known EN
  // stopword. Real lang words (with or without diacritics) pass.
  return EN_STOPWORDS.has(w);
}

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
  function mergeAiCompletion(corpusPreds: string[], ai: string | null): string[] {
    if (!ai || isEnglishLeak(ai, language)) return corpusPreds;
    const lc = ai.toLowerCase();
    const dedup = corpusPreds.filter((p) => p.toLowerCase() !== lc);
    return [ai, ...dedup].slice(0, 5);
  }

  // Final defense-in-depth: anything that survived computeStableSlots
  // (e.g. a stale carry-over from before a language switch) gets
  // dropped here too, then refilled from langDefaults so the bar
  // never shows fewer than 5 tiles.
  function dropForeignTiles(displayed: string[]): string[] {
    if (language === 'en') return displayed;
    const cleaned = displayed.filter((w) => !isEnglishLeak(w, language));
    if (cleaned.length === displayed.length) return displayed;
    const filler = langDefaults.filter((w) => !cleaned.includes(w));
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
