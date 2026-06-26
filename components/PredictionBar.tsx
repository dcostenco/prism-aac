'use client';
import { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useContactsStore, type AacContact } from '@/store/contactsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';
import { ddAction } from '@/lib/datadog';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { getPredictionsForLanguage } from '@/constants/keyboardLayouts';
import { classifyWord, CATEGORY_COLORS } from '@/engine/colorCoding';
import { PROVIDER_ICONS, PROVIDER_LABELS } from '@/services/sendToContact';

import { isAllowedInLang, ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { useVisionStore } from '@/store/visionStore';
import type { SceneType } from '@/services/sceneInference';

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

const PredictionTile = memo(function PredictionTile({ word, color, onTap, visionBoosted }: { word: string; color: string; onTap: (w: string) => void; visionBoosted?: boolean }) {
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
      title={word}
      className={`aac-btn flex-1 min-w-0 rounded-xl flex flex-col items-center overflow-hidden border-l-[5px] border border-theme${visionBoosted ? ' vision-glow' : ''}`}
      style={{ borderLeftColor: color, color }}
    >
      <span className="flex-1 flex items-center justify-center w-full surface-bar rounded-t-lg overflow-hidden min-h-0">
        {iconUrl && (
          <img src={iconUrl} alt="" aria-hidden loading="eager" className="max-w-full max-h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
      </span>
      <span className="truncate w-full text-center text-[clamp(0.9rem,2.2svh,1.4rem)] font-bold shrink-0 leading-tight py-0.5">{word}</span>
    </button>
  );
});

export default function PredictionBar() {
  const sidePanel = useUIStore((s) => s.sidePanel);
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
  const langDefaults = getPredictionsForLanguage(language);
  const [displayed, setDisplayed] = useState<string[]>(langDefaults);
  const prevRef = useRef<string[]>(langDefaults);

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

  // Immediately show language-specific defaults on language switch,
  // then refine with predictions if there's typed text.
  const prevLangRef = useRef(language);
  useEffect(() => {
    const defaults = getPredictionsForLanguage(language);
    if (language !== prevLangRef.current) {
      prevRef.current = defaults;
      setDisplayed(defaults);
      prevLangRef.current = language;
    }
    if (!text.trim()) {
      prevRef.current = defaults;
      setDisplayed(defaults);
      return;
    }
    updatePredictions(text, language);
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
  //
  // Earlier this filter short-circuited when language === 'en', on the
  // theory that the EN corpus is authoritative. That assumption broke
  // on multi-language users: an outputLanguage = 'ro' speaker
  // composing English would see RO words like `eu` slip into the EN
  // bar, because the upstream mergeAiCompletion gate only runs when
  // `aiCompletion` is set, NOT for corpus-based tiles. The filter now
  // runs for every language; isAllowedInLang's cross-corpus comparison
  // (en_freq vs ro_freq) catches the leak in either direction.
  function dropForeignTiles(displayed: string[]): string[] {
    const cleaned = displayed.filter((w) => isAllowedInLang(w, language));
    if (cleaned.length === displayed.length) return displayed;
    const filler = langDefaults.filter((w) => !cleaned.includes(w) && isAllowedInLang(w, language));
    return [...cleaned, ...filler].slice(0, 5);
  }

  // Cache HRR module ref so subsequent calls are synchronous (no tile reflow).
  // Critical for switch scanning — async tile reorder causes wrong selection.
  const hrrRef = useRef<{
    getNextWordSuggestions: typeof import('../services/hrrContext')['getNextWordSuggestions'] extends (...args: infer A) => infer R ? (...args: A) => R : never;
    isAacHrrReady: () => boolean;
  } | null>(null);

  useEffect(() => {
    import('../services/hrrContext').then(m => {
      hrrRef.current = { getNextWordSuggestions: m.getNextWordSuggestions, isAacHrrReady: m.isAacHrrReady };
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!text.trim()) {
      if (aiCompletion) {
        const merged = mergeAiCompletion(langDefaults, aiCompletion);
        prevRef.current = merged;
        setDisplayed(merged);
      } else {
        prevRef.current = langDefaults;
        setDisplayed(langDefaults);
      }
      return;
    }
    const merged = mergeAiCompletion(predictions, aiCompletion);
    const next = computeStableSlots(prevRef.current, merged);

    // HRR boost: synchronous once module is loaded (no tile reflow)
    let final = next;
    if (hrrRef.current?.isAacHrrReady()) {
      const hrr = hrrRef.current.getNextWordSuggestions(text.trim());
      if (hrr.length > 0) {
        const hrrWords = hrr
          .map(h => h.word)
          .filter(w => isAllowedInLang(w, language));
        const deduped = hrrWords.filter(
          w => !next.some(n => n.toLowerCase() === w.toLowerCase()),
        );
        if (deduped.length > 0) {
          final = [next[0], deduped[0], ...next.slice(1)].filter(Boolean).slice(0, 5);
        }
      }
    }

    prevRef.current = final;
    setDisplayed(final);
  }, [predictions, aiCompletion, text]);

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
    const fullPhrase = isCompletion ? [...words.slice(0, -1), word].join(' ') : [...words, word].join(' ');
    aacSpeak(fullPhrase, speechRate, speechVolume);
  }, [text, learnWord, speechRate, speechVolume]);

  // Must be computed before any early returns — hooks must be called unconditionally.
  // (useMemo after a conditional return violates Rules of Hooks → React #300 crash
  // when sidePanel toggles between 'aac-chat' and anything else.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const finalTiles = useMemo(() => dropForeignTiles(displayed), [displayed, language]);

  // All hooks MUST be called before any early return — React error #300.
  const activeScene = useVisionStore((s) => s.activeScene);

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
    <div data-testid="prediction-bar" data-scan-group="predictions" className="flex items-stretch gap-[2px] px-1 py-[2px] shrink-0 relative" style={{ height: 'clamp(72px, 15svh, 160px)' }}>
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
