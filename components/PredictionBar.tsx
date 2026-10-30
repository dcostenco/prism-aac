'use client';
import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
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
import { pictureModeForProfile } from '@/services/pictogramService';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import { getPredictionsForLanguage } from '@/constants/keyboardLayouts';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { PROVIDER_ICONS, PROVIDER_LABELS } from '@/services/sendToContact';
import {
  fetchMemoryPredictions,
  getPredictionSessionScope,
} from '@/services/predictionMemoryService';

import { isAllowedInLang, ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { isAgeBlocked } from '@/engine/ageBlocklist';
import { useVisionStore } from '@/store/visionStore';
import type { SceneType } from '@/services/sceneInference';
import FittedTileLabel from './FittedTileLabel';
import { matchesPredictionPrefix, normalizePredictionSpelling, predictionWordKey, preferredPredictionSpelling, predictionTokenParts } from '@/engine/predictionSpellings';

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

function computeStableSlots(prev: string[], predictions: string[], language: string): string[] {
  const next = [...new Map(prev.map(word => [predictionWordKey(word, language), preferredPredictionSpelling(word, language)])).values()];
  const used = new Set(next.map(word => predictionWordKey(word, language)));
  for (let i = 0; i < 5; i++) {
    const pred = predictions[i] && preferredPredictionSpelling(predictions[i], language);
    const key = pred && predictionWordKey(pred, language);
    if (pred && key && !used.has(key)) {
      const deadSlot = next.findIndex(
        (s) => !predictions.some((p) => predictionWordKey(p, language) === predictionWordKey(s, language))
      );
      if (deadSlot >= 0) {
        used.delete(predictionWordKey(next[deadSlot], language));
        next[deadSlot] = pred;
        used.add(key);
      } else if (next.length < 5) {
        next.push(pred);
        used.add(key);
      }
    }
  }
  return next;
}

function mergeAiCompletion(
  corpusPreds: string[],
  ai: string | null,
  language: string,
  isOwnWord: (word: string) => boolean = () => false,
): string[] {
  // The AI completion skips the engine's filter, so the word lists apply here too.
  // It may be a word no dictionary has: that is what it is for (en "geria" ->
  // geriatric, while the bar can only offer "ger" words). A word another
  // language's corpus claims is still dropped.
  if (!ai || !isAllowedInLang(ai, language, { allowUnknown: true }) || isAgeBlocked(ai, language)) return corpusPreds;
  return mergeAdvisoryPredictions(corpusPreds, [ai], language, (word, advisory) => advisory || isOwnWord(word));
}

export function mergeAdvisoryPredictions(
  baseline: string[],
  advisory: string[],
  language: string,
  // A word no dictionary has may still be shown when it is the user's own
  // learned word or the AI completion; a word another language's dictionary
  // claims never is.
  mayBeUnknown: (word: string, advisory: boolean) => boolean = () => false,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  const advisoryCount = advisory.length;
  for (const [index, candidate] of [...advisory, ...baseline].entries()) {
    const word = preferredPredictionSpelling(candidate.trim(), language);
    const key = predictionWordKey(word, language);
    const allowUnknown = !!word && mayBeUnknown(word, index < advisoryCount);
    if (!word || seen.has(key) || !isAllowedInLang(word, language, { allowUnknown }) || isAgeBlocked(normalizePredictionSpelling(word, language), language)) continue;
    seen.add(key);
    merged.push(word);
    if (merged.length === 5) break;
  }
  return merged;
}

function memoryContextKey(text: string, language: string, sessionScope: string): string {
  return `${sessionScope}\u0000${language.toLowerCase()}\u0000${normalizePredictionSpelling(text.replace(/\s+/g, ' ').trim(), language)}`;
}

function hasCommittedPredictionContext(text: string): boolean {
  return /(?:\s|[.!?…])$/u.test(text);
}

function dropForeignTiles(
  displayed: string[],
  language: string,
  langDefaults: string[],
  mayBeUnknown: (word: string) => boolean = () => false,
): string[] {
  // Curated AAC core defaults are authoritative for their language. Some are
  // shared across languages ("Tu" is valid Romanian and Spanish), so a
  // cross-corpus frequency comparison must never evict them.
  const trustedDefaults = new Set(langDefaults.map((word) => predictionWordKey(word, language)));
  const cleaned = displayed.filter(
    (word) => trustedDefaults.has(predictionWordKey(word, language))
      || isAllowedInLang(word, language, { allowUnknown: mayBeUnknown(word) }),
  );
  if (cleaned.length === displayed.length) return displayed;
  const filler = langDefaults.filter(
    (word) => !cleaned.some((kept) => predictionWordKey(kept, language) === predictionWordKey(word, language)),
  );
  return [...cleaned, ...filler].slice(0, 5);
}

function sameTiles(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tile, index) => tile === right[index]);
}

interface DisplayedPredictionState {
  language: string;
  tiles: string[];
  // Keys of tiles no dictionary has that the merge admitted (the AI completion
  // or the user's own word). The final filter keeps them as decided rather than
  // re-judging with a live AI completion that may already be cleared.
  admitted?: string[];
}

// A word no dictionary has counts as the user's own only after three uses. One
// spoken message counts a word up to twice (space after it, then Speak), so a
// single motor slip ("geriatrc") in one message never becomes a lasting tile;
// a real word clears it on its second message.
const OWN_WORD_MIN_USES = 3;
function isOwnLearnedWord(wordFreq: Record<string, { count: number }>, word: string, language: string): boolean {
  const key = predictionWordKey(word, language);
  return Object.prototype.hasOwnProperty.call(wordFreq, key) && wordFreq[key].count >= OWN_WORD_MIN_USES;
}

const PredictionTile = memo(function PredictionTile({ word, color, onTap, visionBoosted }: { word: string; color: string; onTap: (w: string) => void; visionBoosted?: boolean }) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const contextText = useMessageStore((s) => s.text);
  const committedContextRef = useRef(contextText);
  useLayoutEffect(() => { committedContextRef.current = contextText; }, [contextText]);
  type FrozenVisual = {
    word: string;
    color: string;
    visionBoosted: boolean;
    context: string;
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

  const { picture, pictureUrl, onImageError, imageKey, reason, alternativeImages } =
    usePredictionPicture(visibleWord, language, pictureMode, visibleVisual?.context ?? contextText);
  // No picture is coming: show the word alone, centred, like a board text
  // tile, instead of a caption under an empty well. A generated picture that
  // is still loading keeps the well so the word does not jump.
  const textTile = picture === 'text';

  const currentVisual = (): FrozenVisual => ({
    word: visibleWord,
    color: visibleColor,
    visionBoosted: !!visibleVisionBoosted,
    context: visibleVisual?.context ?? contextText,
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
          context: committedContextRef.current,
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
      data-picture={picture}
      data-picture-reason={reason}
      data-picture-choices={alternativeImages.length || undefined}
      className={`aac-btn aac-prediction-tile flex-1 min-w-0 rounded-xl flex flex-col items-center${textTile ? ' justify-center' : ''} overflow-hidden border-l-[5px] border border-theme${visibleVisionBoosted ? ' vision-glow' : ''}`}
      style={{ borderLeftColor: visibleColor, backgroundColor: visibleColor }}
    >
      {!textTile && (
        <span className="aac-tile-icon flex-1 flex items-center justify-center w-full rounded-t-lg overflow-hidden min-h-0 bg-white">
          {alternativeImages.length > 0 ? (
            <span className="aac-picture-choices">
              {alternativeImages.map(image => <img key={image.key} src={image.url} alt="" aria-hidden
                data-picture-file={image.file} loading="eager" className="object-contain" onError={image.onError} />)}
            </span>
          ) : pictureUrl && (
            <img key={imageKey} src={pictureUrl} alt="" aria-hidden loading="eager" className="w-full h-full max-w-full max-h-full object-contain" onError={onImageError} />
          )}
        </span>
      )}
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
  const learnedWords = usePredictionStore((s) => s.wordFreq);
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
  const [corpusRevision, setCorpusRevision] = useState(0);
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
      tiles: text.trim() ? computeStableSlots(langDefaults, merged, language) : merged,
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
    let cancelled = false;
    const loads = [ensureLangCorpusLoaded(language)];
    if (outputLanguage && outputLanguage !== language) {
      loads.push(ensureLangCorpusLoaded(outputLanguage));
    }
    void Promise.all(loads).then(() => {
      if (cancelled || useSettingsStore.getState().language !== language) return;
      // Imports finish independently of typing. Refine the current message,
      // then reapply the now-complete cross-language gate without a keystroke.
      updatePredictions(useMessageStore.getState().text, language);
      setCorpusRevision((revision) => revision + 1);
    }).catch((error) => {
      if (!cancelled) console.warn('Prediction corpus preload failed', error);
    });
    return () => { cancelled = true; };
  }, [language, outputLanguage, updatePredictions]);

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
    const authGeneration = useAuthStore.getState().identityGeneration;
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
        if (cancelled || memoryRequestIdRef.current !== requestId
          || useAuthStore.getState().identityGeneration !== authGeneration) return [];
        if (!await memory.initAacHrr(predictionSessionScope)) return [];
        if (cancelled || memoryRequestIdRef.current !== requestId
          || useAuthStore.getState().identityGeneration !== authGeneration) return [];
        const seen = new Set<string>();
        return memory.getNextWordSuggestions(
          normalizedText,
          5,
          language,
          predictionSessionScope,
        )
          .map((candidate) => candidate.word.trim())
          .filter((word) => {
            const key = predictionWordKey(word, language);
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
    let merged: string[];

    // The user's own learned words may be words no dictionary has
    // ("geriatric", a name); the engine ranked them, so the bar keeps them.
    // Memory suggestions are filtered strictly before they get here.
    const isOwnWord = (word: string) => isOwnLearnedWord(learnedWords, word, language);
    if (!text.trim()) {
      merged = mergeAiCompletion(langDefaults, aiCompletion, language, isOwnWord);
      final = merged;
    } else {
      const withMemory = mergeAdvisoryPredictions(predictions, memoryWords, language, (word) => isOwnWord(word));
      merged = mergeAiCompletion(withMemory, aiCompletion, language, isOwnWord);
      final = computeStableSlots(previous, merged, language);
    }
    // From the merge's decision, not the stabilised slots: a tile carried over
    // from an earlier render was not judged now and must not be laundered.
    const admitted = merged.filter(word => !isAllowedInLang(word, language)).map(word => predictionWordKey(word, language));

    // This state intentionally preserves tile positions for switch scanning.
    // Commit after the effect body and cancel superseded commits so rapid text
    // or language changes cannot enqueue cascading or stale renders.
    if (
      displayedState.language === language
      && sameTiles(displayedState.tiles, final)
      && sameTiles(displayedState.admitted ?? [], admitted)
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
        if (current.language === language && sameTiles(current.tiles, scheduledTiles)
          && sameTiles(current.admitted ?? [], admitted)) {
          return current;
        }
        return { language, tiles: scheduledTiles, admitted };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [predictions, memoryWords, aiCompletion, text, language, langDefaults, displayedState, corpusRevision, learnedWords]);

  const handleTap = useCallback((word: string) => {
    tapFeedback();
    const words = text.trim().split(/\s+/).filter(Boolean);
    const partial = predictionTokenParts(words.at(-1) ?? '');
    const midWord = text.length > 0 && !/\s$/u.test(text) && !partial.trailing;
    // When nothing completed the typed word, the engine completed a shorter
    // prefix ("рыби" -> рыба); tapping such a tile still replaces the typed word.
    const backoff = usePredictionStore.getState().completionBackoff;
    const backedOffCompletion = !!backoff && !!partial.word
      && normalizePredictionSpelling(partial.word, language) === backoff.partialWord
      && matchesPredictionPrefix(word, backoff.completionPrefix, language);
    const isCompletion = midWord && !!partial.word && (matchesPredictionPrefix(word, partial.word, language) || backedOffCompletion);

    // For trigram learning we need the two committed words BEFORE the new tap.
    // If the user is completing a partial word, the in-progress word doesn't count as committed,
    // so previous = words[-2], prevPrev = words[-3]. Otherwise previous = words[-1],
    // prevPrev = words[-2].
    const previousWord = isCompletion && words.length > 1 ? words[words.length - 2] : (!isCompletion && words.length > 0 ? words[words.length - 1] : undefined);
    const prevPrevWord = isCompletion && words.length > 2 ? words[words.length - 3] : (!isCompletion && words.length > 1 ? words[words.length - 2] : undefined);

    if (isCompletion && words.length > 0) {
      const prefix = words.slice(0, -1).join(' ');
      const completed = `${partial.leading}${word}`;
      const newText = prefix ? `${prefix} ${completed} ` : `${completed} `;
      useMessageStore.getState().setText(newText);
    } else {
      const current = useMessageStore.getState().text;
      const newText = current.trim() ? `${current.trim()} ${word} ` : `${word} `;
      useMessageStore.getState().setText(newText);
    }

    learnWord(word, previousWord, prevPrevWord);
    ddAction('prediction.word_selected', { categoryId: undefined, position: predictions.indexOf(word), isCompletion, wordCount: words.length + 1 });
    import('@/store/metricsStore').then(m => m.useMetricsStore.getState().recordPredictionHit()).catch(() => {});
    const fullPhrase = isCompletion
      ? [...words.slice(0, -1), word].join(' ')
      : [...words, word].join(' ');
    // Honour the user's two controls over their own voice. This path checked
    // NEITHER, so a device with the master mute off and Auto off still spoke
    // on every prediction tap — measured then: muted, tapping a tile sent
    // "I." to TTS while the typing path in the same run stayed correctly
    // silent. Every other speech call site checks the mute; the speech
    // services themselves do not, by design, so the caller must.
    const { soundEnabled } = useMessageStore.getState();
    // `autoSpeak` is deliberately NOT part of this gate. Nothing toggles it any
    // more — the message-bar button now controls speakSelectionFeedback
    // directly — so leaving it ANDed here would permanently silence anyone
    // whose persisted value happened to be false, even after they turn Echo
    // on. Their pre-existing preference was already honoured once, by the
    // v21 migration that decided their initial speakSelectionFeedback.
    // soundEnabled stays: it is the master mute.
    if (!soundEnabled) return;
    // Auditory feedback only, and only when the user asked for it. This used
    // to speak `fullPhrase` — the whole accumulated message — on every tap,
    // which is MESSAGE speech: the public utterance to a communication
    // partner, fired without the user choosing to say it. What a selection may
    // confirm is the ITEM just selected. Message speech happens on Speak.
    if (!useSettingsStore.getState().speakSelectionFeedback) return;

    if (language !== outputLanguage) {
      // Translated feedback still speaks only the selected word.
      void aacSpeak(
        word,
        speechRate,
        speechVolume,
        undefined,
        true,
      );
    } else {
      // Feedback speaks the selected word only. It used to replay the
      // cumulative message on every tap.
      speakWord(word, speechRate, speechVolume);
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
  const finalTiles = useMemo(() => {
    // Keep what the merge admitted for these tiles (see DisplayedPredictionState.admitted).
    const admitted = new Set(displayedState.language === language ? displayedState.admitted ?? [] : []);
    return dropForeignTiles(displayed, language, langDefaults, word => admitted.has(predictionWordKey(word, language)));
  }, [displayed, displayedState, language, langDefaults, corpusRevision]);

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
        // the language matters: the English suffix rules (-ed = verb) must not colour a Spanish "red" (network) as an action
        const color = CATEGORY_COLORS[classifyWord(word, language)];
        const isVisionBoosted = activeScene && aiCompletion && word === aiCompletion;
        return <PredictionTile key={`slot-${i}`} word={word} color={color} onTap={handleTap} visionBoosted={!!isVisionBoosted} />;
      })}
    </div>
  );
}
