'use client';
import { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useContactsStore, type AacContact } from '@/store/contactsStore';
import { speakWord } from '@/services/speechService';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';
import { ddAction } from '@/lib/datadog';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { englishSourceFor } from '@/constants/reverseTranslation';
import { getPredictionsForLanguage } from '@/constants/keyboardLayouts';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { PROVIDER_ICONS, PROVIDER_LABELS } from '@/services/sendToContact';
import {
  fetchMemoryPredictions,
  getPredictionSessionScope,
} from '@/services/predictionMemoryService';

import { isAllowedInLang, ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { useVisionStore } from '@/store/visionStore';
import type { SceneType } from '@/services/sceneInference';
import FittedTileLabel from './FittedTileLabel';

const MEMORY_PREDICTION_DEBOUNCE_MS = 650;
const MIN_CLOUD_PREDICTION_INTERVAL_MS = 1_200;
const LOCAL_MEMORY_SUFFICIENT_COUNT = 3;

const SCENE_ICONS: Partial<Record<SceneType, string>> = {
  mealtime: '🍽️', snacktime: '🍪', bedtime: '😴',
  bathtime: '🛁', playtime: '🎮', schoolwork: '📚',
  watching_tv: '📺', reading: '📖', outdoors: '🌳',
  travel: '🚗', grooming: '🧴',
};

// ── Contact tiles for messaging mode ──────────────────────────────────

function filterContacts(contacts: AacContact[], query: string): AacContact[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.recipientId.toLowerCase().includes(q)
      )
    : contacts;
  // Dedupe by name (case-insensitive): show one tile per person.
  // If the same person has both SMS and mail, keep the first entry
  // (most recently used or mail-first from Google sync order).
  const seen = new Set<string>();
  const deduped: AacContact[] = [];
  for (const c of filtered) {
    const key = c.name.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
    if (deduped.length === 5) break;
  }
  return deduped;
}

const AVATAR_ALLOWED_DOMAINS = ['synalux.ai', 'googleusercontent.com', 'telegram.org', 'whatsapp.net', 'fbcdn.net', 'twimg.com'];

function isSafeAvatarUrl(url: string): boolean {
  if (/^blob:/.test(url)) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return AVATAR_ALLOWED_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}

/* eslint-disable @next/next/no-img-element -- Contact avatars and AAC pictograms are runtime URLs (including blob URLs); Next Image cannot safely optimize them. */
function ContactTile({ contact, extraCount, onTap }: { contact: AacContact; extraCount: number; onTap: (id: string) => void }) {
  return (
    <button
      onClick={() => { tapFeedback(); onTap(contact.id); }}
      aria-label={`Message ${contact.name}`}
      data-testid={`pred-contact-${contact.id}`}
      className="aac-btn flex-1 min-w-0 surface-key rounded-xl flex flex-col items-center justify-center py-1 px-1 border-l-[5px] border border-theme overflow-hidden gap-0.5 relative"
      style={{ borderLeftColor: '#4CAF50' }}
    >
      {extraCount > 0 && (
        <span className="absolute top-1 right-1 bg-[#4CAF50] text-white text-[9px] font-bold rounded-full px-1 leading-none py-px">
          +{extraCount}
        </span>
      )}
      <span className="text-xl leading-none">
        {contact.avatar && isSafeAvatarUrl(contact.avatar)
          ? <img src={contact.avatar} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
          : PROVIDER_ICONS[contact.provider]
        }
      </span>
      <span className="truncate w-full text-center text-[clamp(0.8rem,2.2vw,1.2rem)] font-bold shrink-0 leading-tight text-primary">
        {contact.name}
      </span>
      <span className="text-[clamp(0.6rem,1.6vw,0.95rem)] text-secondary shrink-0 leading-none">
        {PROVIDER_LABELS[contact.provider]}
      </span>
    </button>
  );
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

function mergeAiCompletion(
  corpusPreds: string[],
  ai: string | null,
  language: string,
): string[] {
  if (!ai || !isAllowedInLang(ai, language)) return corpusPreds;
  const lc = ai.toLowerCase();
  const dedup = corpusPreds.filter((prediction) => prediction.toLowerCase() !== lc);
  return [ai, ...dedup].slice(0, 5);
}

export function mergeAdvisoryPredictions(
  baseline: string[],
  advisory: string[],
  language: string,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [...advisory, ...baseline]) {
    const word = candidate.trim();
    const key = word.toLocaleLowerCase();
    if (!word || seen.has(key) || !isAllowedInLang(word, language)) continue;
    seen.add(key);
    merged.push(word);
    if (merged.length === 5) break;
  }
  return merged;
}

function memoryContextKey(text: string, language: string, sessionScope: string): string {
  return `${sessionScope}\u0000${language.toLowerCase()}\u0000${text.replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

function hasCommittedPredictionContext(text: string): boolean {
  return /(?:\s|[.!?…])$/u.test(text);
}

function dropForeignTiles(
  displayed: string[],
  language: string,
  langDefaults: string[],
): string[] {
  // Curated AAC core defaults are authoritative for their language. Some are
  // shared across languages ("Tu" is valid Romanian and Spanish), so a
  // cross-corpus frequency comparison must never evict them.
  const trustedDefaults = new Set(langDefaults.map((word) => word.toLowerCase()));
  const cleaned = displayed.filter(
    (word) => trustedDefaults.has(word.toLowerCase()) || isAllowedInLang(word, language),
  );
  if (cleaned.length === displayed.length) return displayed;
  const filler = langDefaults.filter(
    (word) => !cleaned.some((kept) => kept.toLowerCase() === word.toLowerCase()),
  );
  return [...cleaned, ...filler].slice(0, 5);
}

function sameTiles(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tile, index) => tile === right[index]);
}

interface DisplayedPredictionState {
  language: string;
  tiles: string[];
}

const PredictionTile = memo(function PredictionTile({ word, color, onTap, visionBoosted }: { word: string; color: string; onTap: (w: string) => void; visionBoosted?: boolean }) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  type FrozenVisual = {
    word: string;
    color: string;
    visionBoosted: boolean;
  };
  const [pointerVisual, setPointerVisual] = useState<FrozenVisual | null>(null);
  const [focusVisual, setFocusVisual] = useState<FrozenVisual | null>(null);
  const [switchVisual, setSwitchVisual] = useState<FrozenVisual | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerWordRef = useRef<string | null>(null);
  const focusWordRef = useRef<string | null>(null);
  const switchWordRef = useRef<string | null>(null);
  const visibleVisual = pointerVisual ?? switchVisual ?? focusVisual;
  const visibleWord = visibleVisual?.word ?? word;
  const visibleColor = visibleVisual?.color ?? color;
  const visibleVisionBoosted = visibleVisual?.visionBoosted ?? visionBoosted;

  useEffect(() => {
    let cancelled = false;
    // ARASAAC has no search index for ja/hi/vi/tl/id/am/sw/bn and answers 400,
    // so searching the localized word there returns nothing and the tile shows
    // an empty box. The pictures are language-neutral — only the search term is
    // localized — so recover the English source and search with that, the same
    // way PhraseTile does. Falls back to the localized word when the prediction
    // is not vocabulary we can map.
    const english = englishSourceFor(visibleWord, language);
    getPictogramUrl(english ?? visibleWord, english ? 'en' : language, pictureMode)
      .then((url) => { if (!cancelled) setIconUrl(url); })
      .catch(() => { if (!cancelled) setIconUrl(null); });
    return () => { cancelled = true; };
  }, [visibleWord, language, pictureMode]);

  const currentVisual = (): FrozenVisual => ({
    word: visibleWord,
    color: visibleColor,
    visionBoosted: !!visibleVisionBoosted,
  });

  const clearPointerVisual = () => {
    activePointerIdRef.current = null;
    pointerWordRef.current = null;
    setPointerVisual(null);
  };

  // The switch scanner highlights a DOM slot and calls .click() later. Freeze
  // the semantic word for that entire highlight interval so an async rerank
  // cannot change what the physical switch will select.
  useEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof MutationObserver === 'undefined') return;
    const syncSwitchHighlight = () => {
      const highlighted = button.classList.contains('switch-scan-active');
      if (highlighted && !switchWordRef.current) {
        switchWordRef.current = word;
        setSwitchVisual({
          word,
          color,
          visionBoosted: !!visionBoosted,
        });
      } else if (!highlighted && switchWordRef.current) {
        switchWordRef.current = null;
        setSwitchVisual(null);
      }
    };
    syncSwitchHighlight();
    const observer = new MutationObserver(syncSwitchHighlight);
    observer.observe(button, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [word, color, visionBoosted]);

  return (
    <button
      ref={buttonRef}
      onFocus={() => {
        // Browsers commonly focus a button as the default action of
        // pointerdown. Pointer identity already has its own snapshot; keeping
        // a second focus snapshot would leave that old word frozen after the
        // tap completes while the button remains focused.
        if (activePointerIdRef.current !== null) return;
        if (focusWordRef.current) return;
        const snapshot = currentVisual();
        focusWordRef.current = snapshot.word;
        setFocusVisual(snapshot);
      }}
      onPointerDown={(event) => {
        // Ignore secondary pointers. A second finger's cancellation must not
        // clear the word owned by the primary AAC selection.
        if (activePointerIdRef.current !== null) return;
        const snapshot = currentVisual();
        activePointerIdRef.current = event.pointerId;
        pointerWordRef.current = snapshot.word;
        setPointerVisual(snapshot);
      }}
      onPointerCancel={(event) => {
        if (activePointerIdRef.current === event.pointerId) clearPointerVisual();
      }}
      onPointerLeave={(event) => {
        // A mouse drag away cancels the pending click and must also release the
        // frozen visual. Touch pointers use implicit capture and complete via
        // click/pointercancel, so a small finger movement does not cancel them.
        if (
          event.pointerType === 'mouse'
          && event.buttons > 0
          && activePointerIdRef.current === event.pointerId
        ) {
          clearPointerVisual();
        }
      }}
      onBlur={() => {
        focusWordRef.current = null;
        setFocusVisual(null);
      }}
      onClick={(event) => {
        // Pointer-generated clicks have detail > 0. Keyboard, switch-control,
        // and assistive programmatic activations use detail 0 and must select
        // the word currently visible at activation time.
        const selectedWord = event.detail > 0
          ? pointerWordRef.current ?? visibleWord
          : switchWordRef.current ?? focusWordRef.current ?? word;
        if (event.detail > 0) clearPointerVisual();
        if (event.detail === 0 && switchWordRef.current) {
          // Non-group switch scanning leaves the DOM highlight in place after
          // selection. End this semantic snapshot now so the next rerank can
          // bind that still-highlighted slot to its newly visible word.
          switchWordRef.current = null;
          setSwitchVisual(null);
        }
        if (event.detail === 0 && focusWordRef.current) {
          // Keyboard activation is also one committed selection. Release the
          // old focus snapshot so the still-focused slot can show and select
          // the next contextual word instead of repeating the prior one.
          focusWordRef.current = null;
          setFocusVisual(null);
        }
        onTap(selectedWord);
      }}
      aria-label={`Predict: ${visibleWord}`}
      title={visibleWord}
      data-testid="prediction-tile"
      className={`aac-btn aac-prediction-tile flex-1 min-w-0 rounded-xl flex flex-col items-center overflow-hidden border-l-[5px] border border-theme${visibleVisionBoosted ? ' vision-glow' : ''}`}
      style={{ borderLeftColor: visibleColor, backgroundColor: visibleColor }}
    >
      <span className="aac-tile-icon flex-1 flex items-center justify-center w-full rounded-t-lg overflow-hidden min-h-0 bg-white">
        {iconUrl && (
          <img src={iconUrl} alt="" aria-hidden loading="eager" className="max-w-full max-h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
      </span>
      <FittedTileLabel
        text={visibleWord}
        testId="prediction-label"
        minFontSizePx={16}
        className="aac-tile-label aac-prediction-label"
      />
    </button>
  );
});
/* eslint-enable @next/next/no-img-element */

export default function PredictionBar() {
  const sidePanel = useUIStore((s) => s.sidePanel);
  const categoryKeyboardOpen = useUIStore((s) => s.categoryKeyboardOpen);
  const keyboardMaximized = useUIStore((s) => s.keyboardMaximized);
  const selectContact = useUIStore((s) => s.selectContact);
  const contacts = useContactsStore((s) => s.contacts);
  const activeContactId = useUIStore((s) => s.activeContactId);
  const text = useMessageStore((s) => s.text);
  const clearAll = useMessageStore((s) => s.clearAll);
  const predictions = usePredictionStore((s) => s.predictions);
  const aiCompletion = usePredictionStore((s) => s.aiCompletion);
  const updatePredictions = usePredictionStore((s) => s.updatePredictions);
  const learnWord = usePredictionStore((s) => s.learnWord);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const speechVolume = useSettingsStore((s) => s.speechVolume);
  const language = useSettingsStore((s) => s.language);
  const outputLanguage = useSettingsStore((s) => s.outputLanguage);
  const cloudPredictionEnabled = useSettingsStore((s) => s.cloudPredictionEnabled);
  const authProfile = useAuthStore((s) => s.profile);
  const authLoaded = useAuthStore((s) => s.loaded);
  const predictionSessionScope = getPredictionSessionScope(authProfile?.email);
  const langDefaults = useMemo(() => getPredictionsForLanguage(language), [language]);
  const currentMemoryContext = memoryContextKey(text, language, predictionSessionScope);
  const [memoryState, setMemoryState] = useState<{
    context: string;
    words: string[];
  }>({
    context: currentMemoryContext,
    words: [],
  });
  const memoryRequestIdRef = useRef(0);
  const lastCloudRequestAtRef = useRef(0);
  const memoryWords = useMemo(
    () => (
      memoryState.context === currentMemoryContext
        ? memoryState.words
        : []
    ),
    [currentMemoryContext, memoryState],
  );
  const [displayedState, setDisplayedState] = useState<DisplayedPredictionState>(() => {
    const merged = mergeAiCompletion(
      text.trim() ? predictions : langDefaults,
      aiCompletion,
      language,
    );
    return {
      language,
      tiles: text.trim() ? computeStableSlots(langDefaults, merged) : merged,
    };
  });
  // A language switch must never render stale tiles while the stabilization
  // effect is pending. Fall back to the new language's bundled core words for
  // that single microtask.
  const displayed = displayedState.language === language
    ? displayedState.tiles
    : langDefaults;
  const prevRef = useRef<DisplayedPredictionState>({
    language,
    tiles: displayed,
  });

  // Eagerly preload BOTH the input language's curated corpus AND the
  // output language's corpus. The cross-lang frequency gate compares
  // every word against ALL loaded Latin-script corpora; without
  // preloading the user's "other side" lang (e.g. RO when language=en
  // and outputLanguage=ro), the gate can't detect leaks in that
  // direction (RO word `eu` flashed as the leftmost tile in EN mode
  // because RO corpus wasn't loaded → no comparison data → fail-open).
  // ensureLangCorpusLoaded itself also preloads EN unconditionally,
  // so the EN side is always covered.
  useEffect(() => {
    void ensureLangCorpusLoaded(language);
    if (outputLanguage && outputLanguage !== language) {
      void ensureLangCorpusLoaded(outputLanguage);
    }
  }, [language, outputLanguage]);

  // Ask the prediction store to refine non-empty text. Empty text is handled
  // directly by the display calculation below.
  useEffect(() => {
    if (text.trim()) updatePredictions(text, language);
  }, [text, updatePredictions, language]);

  // Prism memory is advisory and additive. Local HRR responds first; when it
  // lacks enough context, the existing portal AAC-memory predictor may refine
  // the five cards after a short pause. Every request is bound to the exact
  // text+language context so a late response can never populate a newer
  // sentence or a different language. The authored message is not touched.
  useEffect(() => {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const context = memoryContextKey(normalizedText, language, predictionSessionScope);
    const requestId = ++memoryRequestIdRef.current;
    let cancelled = false;
    let cloudController: AbortController | null = null;

    if (!normalizedText || sidePanel === 'aac-chat') {
      return () => {
        cancelled = true;
      };
    }

    const localWordsPromise = ensureLangCorpusLoaded(language)
      .then(() => import('../services/hrrContext'))
      .then(async (memory) => {
        if (!await memory.initAacHrr(predictionSessionScope)) return [];
        const seen = new Set<string>();
        return memory.getNextWordSuggestions(
          normalizedText,
          5,
          language,
          predictionSessionScope,
        )
          .map((candidate) => candidate.word.trim())
          .filter((word) => {
            const key = word.toLocaleLowerCase();
            if (!word || seen.has(key) || !isAllowedInLang(word, language)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 5);
      })
      .catch(() => [] as string[]);

    void localWordsPromise.then((localWords) => {
      if (cancelled || memoryRequestIdRef.current !== requestId) return;
      setMemoryState({ context, words: localWords });
    });

    const cloudAllowed = (
      authLoaded
      && authProfile !== null
      && cloudPredictionEnabled
      && hasCommittedPredictionContext(text)
    );
    if (!cloudAllowed) {
      return () => {
        cancelled = true;
      };
    }

    const now = Date.now();
    const delay = Math.max(
      MEMORY_PREDICTION_DEBOUNCE_MS,
      lastCloudRequestAtRef.current + MIN_CLOUD_PREDICTION_INTERVAL_MS - now,
    );
    const timer = setTimeout(async () => {
      const localWords = await localWordsPromise;
      if (
        cancelled
        || memoryRequestIdRef.current !== requestId
        || localWords.length >= LOCAL_MEMORY_SUFFICIENT_COUNT
      ) {
        return;
      }

      lastCloudRequestAtRef.current = Date.now();
      cloudController = new AbortController();
      const cloudWords = await fetchMemoryPredictions(normalizedText, language, {
        sessionScope: predictionSessionScope,
        signal: cloudController.signal,
      });
      if (cancelled || memoryRequestIdRef.current !== requestId) return;
      setMemoryState({
        context,
        // Confirmed local memory stays first; cloud fills remaining cards.
        words: mergeAdvisoryPredictions(cloudWords, localWords, language),
      });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cloudController?.abort();
    };
  }, [
    text,
    language,
    sidePanel,
    authLoaded,
    authProfile,
    cloudPredictionEnabled,
    predictionSessionScope,
  ]);

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
  // Final defense-in-depth: drop ANY tile not allowed in the current
  // language, refill empty slots from langDefaults so the bar always
  // renders 5 tiles. Catches stale carry-overs from a previous EN
  // session AND any word the upstream gates missed.
  //
  // Earlier this filter short-circuited when language === 'en', on the
  // theory that the EN corpus is authoritative. That assumption broke
  // on multi-language users: an outputLanguage = 'ro' speaker
  // composing English would see RO words like `eu` slip into the EN
  // bar, because the upstream mergeAiCompletion gate only runs when
  // `aiCompletion` is set, NOT for corpus-based tiles. The filter now
  // runs for every language; isAllowedInLang's cross-corpus comparison
  // (en_freq vs ro_freq) catches the leak in either direction.
  useEffect(() => {
    const previous = prevRef.current.language === language
      ? prevRef.current.tiles
      : langDefaults;
    let final: string[];

    if (!text.trim()) {
      final = mergeAiCompletion(langDefaults, aiCompletion, language);
    } else {
      const withMemory = mergeAdvisoryPredictions(predictions, memoryWords, language);
      const merged = mergeAiCompletion(withMemory, aiCompletion, language);
      final = computeStableSlots(previous, merged);
    }

    // This state intentionally preserves tile positions for switch scanning.
    // Commit after the effect body and cancel superseded commits so rapid text
    // or language changes cannot enqueue cascading or stale renders.
    if (
      displayedState.language === language
      && sameTiles(displayedState.tiles, final)
    ) {
      prevRef.current = { language, tiles: final };
      return;
    }
    let cancelled = false;
    const scheduledTiles = final;
    queueMicrotask(() => {
      if (cancelled) return;
      prevRef.current = { language, tiles: scheduledTiles };
      setDisplayedState((current) => {
        if (current.language === language && sameTiles(current.tiles, scheduledTiles)) {
          return current;
        }
        return { language, tiles: scheduledTiles };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [predictions, memoryWords, aiCompletion, text, language, langDefaults, displayedState]);

  const handleTap = useCallback((word: string) => {
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
    ddAction('prediction.word_selected', { categoryId: undefined, position: predictions.indexOf(word), isCompletion, wordCount: words.length + 1 });
    import('@/store/metricsStore').then(m => m.useMetricsStore.getState().recordPredictionHit()).catch(() => {});
    const fullPhrase = isCompletion
      ? [...words.slice(0, -1), word].join(' ')
      : [...words, word].join(' ');
    // Honour the user's two controls over their own voice. This path checked
    // NEITHER, so a device with the master mute off and Auto off still spoke
    // on every prediction tap — measured on merged main: muted, auto-off,
    // tapping a tile sent "I." to TTS while the typing path in the same run
    // stayed correctly silent. Every other speech call site checks these; the
    // speech services themselves do not, by design, so the caller must.
    const { autoSpeak, soundEnabled } = useMessageStore.getState();
    if (!autoSpeak || !soundEnabled) return;

    if (language !== outputLanguage) {
      // Translation is the AAC output contract, not an optional second step.
      // Speak the newly composed phrase through aacSpeak so it is translated
      // and voiced in the configured output language on this tap.
      void aacSpeak(
        fullPhrase,
        speechRate,
        speechVolume,
        undefined,
        true,
      );
    } else {
      // Same-language prediction feedback uses the quality-first speech path
      // and preserves the established AAC contract: each tap replays the
      // cumulative message so "I" + "need" is heard as "I need".
      speakWord(fullPhrase, speechRate, speechVolume);
    }
  }, [
    text,
    learnWord,
    predictions,
    speechRate,
    speechVolume,
    language,
    outputLanguage,
  ]);

  // Must be computed before any early returns — hooks must be called unconditionally.
  // (useMemo after a conditional return violates Rules of Hooks → React #300 crash
  // when sidePanel toggles between 'aac-chat' and anything else.)
  const finalTiles = useMemo(
    () => dropForeignTiles(displayed, language, langDefaults),
    [displayed, language, langDefaults],
  );

  // All hooks MUST be called before any early return — React error #300.
  const activeScene = useVisionStore((s) => s.activeScene);
  const isPictureBoard = ['none', 'categories', 'category-detail'].includes(sidePanel)
    && !(categoryKeyboardOpen && keyboardMaximized);

  // ── Contact-search mode — replaces word predictions while messaging ──
  if (sidePanel === 'aac-chat' && !activeContactId) {
    const matched = filterContacts(contacts, text);
    if (matched.length > 0) {
      return (
        <div
          className="flex items-stretch gap-[2px] px-1 py-[2px] shrink-0"
          style={{ height: 'clamp(72px, 15svh, 160px)' }}
          data-testid="prediction-bar-contacts"
        >
          {matched.map((c) => {
            const extras = contacts.filter(
              (x) => x.id !== c.id && x.name.toLowerCase().trim() === c.name.toLowerCase().trim()
            ).length;
            return <ContactTile key={c.id} contact={c} extraCount={extras} onTap={(id) => { selectContact(id); clearAll(); }} />;
          })}
          {/* Pad to 5 slots so bar doesn't collapse */}
          {Array.from({ length: Math.max(0, 5 - matched.length) }).map((_, i) => (
            <div key={`pad-${i}`} className="flex-1 min-w-0" />
          ))}
        </div>
      );
    }
    // No matches / no contacts → show empty search hint.
    return (
      <div
        className="flex items-center justify-center gap-[2px] px-3 py-[2px] shrink-0 text-muted text-sm"
        style={{ height: 'clamp(72px, 15svh, 160px)' }}
        data-testid="prediction-bar-contacts-empty"
      >
        {contacts.length === 0
          ? 'Add contacts in Settings → Contacts'
          : `No contacts match "${text.trim()}"`}
      </div>
    );
  }

  return (
    <div
      data-testid="prediction-bar"
      data-aac-input-mode={isPictureBoard ? 'picture' : 'typing'}
      data-scan-group="predictions"
      className="flex items-stretch gap-[2px] px-1 py-[2px] shrink-0 relative"
      style={{ height: 'clamp(72px, 15svh, 160px)' }}
    >
      {activeScene && (
        <span
          className="absolute -top-6 right-2 text-sm opacity-90 pointer-events-none"
          aria-live="polite"
          data-testid="vision-scene-badge"
        >
          {SCENE_ICONS[activeScene] ?? ''}
        </span>
      )}
      {finalTiles.map((word, i) => {
        const color = CATEGORY_COLORS[classifyWord(word)];
        const isVisionBoosted = activeScene && aiCompletion && word === aiCompletion;
        return <PredictionTile key={`slot-${i}`} word={word} color={color} onTap={handleTap} visionBoosted={!!isVisionBoosted} />;
      })}
    </div>
  );
}
