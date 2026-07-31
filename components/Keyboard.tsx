'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { getLatestTranslated } from '@/store/messageStore';
import { speakWord } from '@/services/speechService';
import { warmupAzureAudio } from '@/services/azureTTS';
import { triggerAISubmit } from '@/services/aiChatBridge';
import { getTTSCode, SupportedLanguage } from '@/engine/i18n';
import { keyFeedback, tapFeedback, deleteFeedback } from '@/services/feedback';
import { dispatchToSearch } from '@/services/searchKeyBridge';
import { getLetterRows, usesNativeImeKeyboard, NUMBERS_ROWS, getSymbolRows, getLocalizedPunctuation, buildKeyboardRows, isLatinKeyboardLayout, KANA_MODIFIERS, applyKanaModifier, GEEZ_MODIFIERS, geezOffsetFor, applyGeezVowelOrder } from '@/constants/keyboardLayouts';
import { useT } from '@/engine/useT';

// Long-press threshold for caps lock — raised from 500 ms to 1200 ms after
// non-technical users (motor-impaired AAC consumers, caregivers) reported
// accidental caps-lock latching from normal shift taps. 1200 ms is well
// outside the range of an unintentional press and still snappy on purpose.
const CAPS_LOCK_HOLD_MS = 1200;

// Simplified keyboard layout for users with severe motor impairment (gridSize ≤ 6).
// Most common English letters by frequency, split into 3 rows of 5.
const SIMPLIFIED_ROWS: string[][] = [
  ['E', 'T', 'A', 'O', 'I'],
  ['N', 'S', 'H', 'R', 'D'],
  ['L', 'U', 'M', 'W', 'Y'],
];

const SENTENCE_END = /[.?!؟]/;
const SENTENCE_TERMINATORS = '.?!؟';

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'prof', 'rev', 'gen', 'sgt', 'cpl', 'pvt', 'vs', 'no', 'vol', 'dept', 'approx', 'inc', 'ltd', 'corp', 'est']);

function isAbbreviation(word: string): boolean {
  return ABBREVIATIONS.has(word.toLowerCase().replace(/\./g, ''));
}

function lowerKeyboardKey(key: string, language: SupportedLanguage): string {
  return key.toLocaleLowerCase(getTTSCode(language));
}

/**
 * Extract the just-completed sentence from `text` (which already
 * contains the trailing terminator the user just typed). Walks
 * backward, skips trailing terminators (handles "Wait!!"), and
 * slices from the previous sentence terminator (or buffer start)
 * to the end. Trims whitespace.
 *
 * Examples:
 *   "Hello. World."  → "World."
 *   "Just one!"      → "Just one!"
 *   "Mr. Smith said hello." → "Smith said hello." (over-triggers on
 *     "Mr." — accepted MVP cost; abbreviation detection is a follow-up)
 */
function extractLastSentence(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return '';
  let end = trimmed.length - 1;
  while (end >= 0 && SENTENCE_TERMINATORS.includes(trimmed[end])) end--;
  let start = 0;
  for (let i = end; i >= 0; i--) {
    if (SENTENCE_TERMINATORS.includes(trimmed[i])) {
      // Skip this boundary if the word immediately before the terminator is
      // an abbreviation (e.g. "Mr." in "Mr. Smith said hello.").
      const beforeDot = trimmed.slice(0, i).trimEnd();
      const wordMatch = beforeDot.match(/(\S+)$/);
      const precedingWord = wordMatch ? wordMatch[1] : '';
      if (isAbbreviation(precedingWord)) continue;
      start = i + 1;
      break;
    }
  }
  return trimmed.slice(start).trim();
}

export const __testing = { extractLastSentence, lowerKeyboardKey };

function NativeImeKeyboard({
  language,
  text,
  setText,
  onBackspace,
  onSpeak,
  placeholder,
  speakLabel,
}: {
  language: SupportedLanguage;
  text: string;
  setText: (value: string) => void;
  onBackspace: () => void;
  onSpeak: () => void;
  placeholder: string;
  speakLabel: string;
}) {
  const composingRef = useRef(false);
  const skipNextBlurRef = useRef(false);
  const [compositionDraft, setCompositionDraft] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const commit = (value: string) => {
    // WebKit may emit both compositionend and a final non-composing input.
    // Zustand updates synchronously, so this guard also prevents a duplicate
    // undo entry when both events carry the same committed candidate.
    if (useMessageStore.getState().text !== value) setText(value);
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col gap-2 p-2"
      data-scan-group="keyboard"
      data-language={language}
      data-aac-keyboard-rows="native"
      data-testid="native-ime-keyboard"
      role="group"
      aria-label="Keyboard"
    >
      <textarea
        key={language}
        data-testid="native-ime-composer"
        value={compositionDraft ?? text}
        onCompositionStart={(event) => {
          composingRef.current = true;
          skipNextBlurRef.current = false;
          setIsComposing(true);
          setCompositionDraft(event.currentTarget.value);
        }}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (composingRef.current || (event.nativeEvent as InputEvent).isComposing) {
            setCompositionDraft(value);
            return;
          }
          setCompositionDraft(null);
          commit(value);
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          setIsComposing(false);
          setCompositionDraft(null);
          if (event.data === '') {
            skipNextBlurRef.current = true;
            return;
          }
          commit(event.currentTarget.value);
        }}
        onBlur={(event) => {
          if (skipNextBlurRef.current) {
            skipNextBlurRef.current = false;
            return;
          }
          if (!composingRef.current) commit(event.currentTarget.value);
        }}
        lang={getTTSCode(language)}
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="on"
        spellCheck
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-h-0 w-full resize-none rounded-xl surface-key text-primary border-2 border-theme p-4 text-[clamp(1.5rem,4svh,3rem)] leading-snug outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[rgba(37,99,235,0.25)]"
      />
      <div className="h-[clamp(3.5rem,10svh,5.5rem)] shrink-0 flex gap-2">
        <button
          onClick={onBackspace}
          disabled={isComposing}
          aria-label="Backspace"
          data-action="backspace"
          className="aac-key surface-key text-primary rounded-xl border border-theme font-bold text-[clamp(1.5rem,4svh,2.5rem)] min-w-[clamp(5rem,14vw,9rem)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⌫
        </button>
        <button
          onClick={onSpeak}
          disabled={isComposing}
          aria-label={speakLabel}
          className="aac-btn aac-speak flex-1 bg-[#4CAF50] text-white rounded-xl font-bold text-[clamp(1.25rem,3svh,2rem)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {speakLabel}
        </button>
      </div>
    </div>
  );
}

export default function Keyboard({ browserMode, onBrowserGo }: { browserMode?: boolean; onBrowserGo?: () => void } = {}) {
  // No toggleSound: soundEnabled is a master mute again and Speak must not
  // clear it. setText is for the kana modifiers, which rewrite the last
  // character rather than appending one.
  const { text, appendChar, addToHistory, autoSpeak, soundEnabled, activeTone, setText } = useMessageStore();
  const { keyboardMode, isUpperCase, capsLock, toggleKeyboardMode, toggleCase, toggleCapsLock, keyboardMaximized, cycleKeyboardMode } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume, language, speakOnSentenceEnd, gridSize } = useSettingsStore();
  const { t } = useT();
  const letterRows = getLetterRows(language);

  const rawRows = keyboardMode === 'letters'
    ? letterRows
    : keyboardMode === 'numbers' ? NUMBERS_ROWS : getSymbolRows(language);
  const punctuation = getLocalizedPunctuation(language);
  // Width-driven, not orientation-driven: the same 12-key Romanian row that
  // overflows a 390px portrait screen fits fine in landscape at 844px.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 480);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  const rows = buildKeyboardRows(rawRows, narrow);
  const maxLetterColumns = Math.max(
    ...rows.map((row) => row.keys.length + (
      keyboardMode === 'letters' && row.util ? 2 : 0
    )),
  );
  const denseLetterGrid = keyboardMode === 'letters'
    && rawRows.some((row) => row.length > 10);
  const latinLetterGrid = keyboardMode === 'letters'
    && isLatinKeyboardLayout(rawRows);
  const showUpper = isUpperCase || capsLock;
  const pendingEnglishPronounI = useRef<number | null>(null);

  useEffect(() => {
    const pendingIndex = pendingEnglishPronounI.current;
    if (pendingIndex === null) return;

    const stillProvisional =
      text.length === pendingIndex + 1
      && text[pendingIndex] === 'I';
    if (!stillProvisional) {
      // Backspace, clear, undo, predictions, and every other external text
      // mutation invalidate the keyboard-owned provisional decision.
      pendingEnglishPronounI.current = null;
      return;
    }

    if (language !== 'en') {
      // The input language changed before a word boundary. Return the
      // provisional English pronoun to the lowercase key value so it cannot
      // leak into a non-English word ("i" + Romanian "n" must stay "in").
      pendingEnglishPronounI.current = null;
      setText(`${text.slice(0, pendingIndex)}i`);
    }
  }, [language, setText, text]);

  const handleKey = useCallback((key: string) => {
    keyFeedback();
    const char = keyboardMode === 'letters' ? (showUpper ? key : lowerKeyboardKey(key, language)) : key;
    // Route to search input when category search is active — keys must not
    // also land in the message bar while the user is searching vocabulary.
    if (dispatchToSearch(char)) {
      if (isUpperCase && !capsLock && keyboardMode === 'letters') toggleCase();
      return;
    }
    // Kana modifiers rewrite the preceding character (て + ゛ → で) rather
    // than inserting themselves. A modifier that does not apply is ignored, so
    // a mis-tap never drops a stray ゛ into the sentence.
    if ((KANA_MODIFIERS as readonly string[]).includes(char)) {
      const current = useMessageStore.getState().text;
      const modified = applyKanaModifier(current, char);
      if (modified !== null) setText(modified);
      return;
    }
    // Ge'ez vowel orders work identically: Amharic is an abugida, so ለ + the
    // ሁ-order key becomes ሉ rather than inserting a second glyph. 33 keys x 7
    // orders covers the whole 231-character fidel without a 231-key grid.
    if (GEEZ_MODIFIERS.includes(char)) {
      const offset = geezOffsetFor(char);
      if (offset !== null) {
        const current = useMessageStore.getState().text;
        const modified = applyGeezVowelOrder(current, offset);
        if (modified !== null) setText(modified);
      }
      return;
    }
    const currentText = useMessageStore.getState().text;
    const pendingIndex = pendingEnglishPronounI.current;
    const continuesPendingI =
      pendingIndex !== null
      && language === 'en'
      && keyboardMode === 'letters'
      && currentText.length === pendingIndex + 1
      && currentText[pendingIndex] === 'I'
      && /^\p{L}$/u.test(char);

    if (continuesPendingI) {
      // The next letter proves the earlier tap began a longer word ("i" +
      // "n" → "in"), not the standalone English pronoun. Correct the
      // provisional capital without restoring per-key speech.
      pendingEnglishPronounI.current = null;
      setText(`${currentText.slice(0, pendingIndex)}i${char}`);
      if (isUpperCase && !capsLock && keyboardMode === 'letters') toggleCase();
      return;
    }

    pendingEnglishPronounI.current = null;
    const startsWord = currentText.length === 0 || /\s$/u.test(currentText);
    const isUnshiftedEnglishPronoun =
      !browserMode
      && language === 'en'
      && keyboardMode === 'letters'
      && !showUpper
      && char === 'i'
      && startsWord;
    appendChar(isUnshiftedEnglishPronoun ? 'I' : char);
    if (isUnshiftedEnglishPronoun) {
      pendingEnglishPronounI.current = currentText.length;
    }
    if (isUpperCase && !capsLock && keyboardMode === 'letters') toggleCase();
    // Per-key letter echo REMOVED. The previous behavior fired
    // speakWord(char) on every keystroke, which Azure pronounced as
    // letter names ("aitch", "double-yu", "tee-oh") regardless of
    // language. AAC users with phonics needs already get word-level
    // feedback via:
    //   • handleSpace below — speaks the cumulative phrase on space
    //   • MessageBar silence-detect — speaks the cumulative phrase once the
    //     trailing input is confirmed as a word
    //   • Speak button — speaks the full utterance on demand
    //   • THIS handler — when char is a sentence terminator (.?!),
    //     speak the just-completed sentence (Read&Write parity for
    //     users with reading/memory disabilities who lose track of
    //     what they typed by the period). Gated on speakOnSentenceEnd.
    if (!browserMode && speakOnSentenceEnd && autoSpeak && soundEnabled && SENTENCE_END.test(char)) {
      // Read fresh state — appendChar above is async w.r.t. zustand
      // batching; getState() guarantees the just-typed punctuation
      // is included in `text` rather than racing the closure.
      const text = useMessageStore.getState().text;
      const sentence = extractLastSentence(text);
      if (sentence) aacSpeak(sentence, speechRate, speechVolume, activeTone);
    }
  }, [appendChar, setText, isUpperCase, capsLock, keyboardMode, toggleCase, showUpper, language, browserMode,
      speakOnSentenceEnd, autoSpeak, soundEnabled, speechRate, speechVolume, activeTone]);

  const shiftHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shiftLongPressed = useRef(false);

  // Clean up the shift hold timer on unmount to prevent memory leaks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (shiftHoldTimer.current) {
      clearTimeout(shiftHoldTimer.current);
      shiftHoldTimer.current = null;
    }
  }, []);

  const handleShiftDown = useCallback(() => {
    shiftLongPressed.current = false;
    if (shiftHoldTimer.current) clearTimeout(shiftHoldTimer.current);
    shiftHoldTimer.current = setTimeout(() => {
      shiftLongPressed.current = true;
      tapFeedback();
      toggleCapsLock();
    }, CAPS_LOCK_HOLD_MS);
  }, [toggleCapsLock]);

  const handleShiftUp = useCallback(() => {
    if (shiftHoldTimer.current) {
      clearTimeout(shiftHoldTimer.current);
      shiftHoldTimer.current = null;
    }
    if (!shiftLongPressed.current) {
      tapFeedback();
      toggleCase();
    }
  }, [toggleCase]);

  const handleSpace = useCallback(() => {
    keyFeedback();
    // Route to search when active
    if (dispatchToSearch(' ')) return;
    if (!browserMode) {
      const currentText = useMessageStore.getState().text;
      const words = currentText.trim().split(/\s+/).filter(Boolean);
      const lastWord = words.length > 0 ? words[words.length - 1] : '';
      if (lastWord) {
        const prevWord = words.length > 1 ? words[words.length - 2] : undefined;
        const prevPrevWord = words.length > 2 ? words[words.length - 3] : undefined;
        learnWord(lastWord.toLowerCase(), prevWord?.toLowerCase(), prevPrevWord?.toLowerCase());
        const translationActive = useSettingsStore.getState().language !== useSettingsStore.getState().outputLanguage;
        const phrase = currentText.trim();
        if (autoSpeak && soundEnabled) {
          if (translationActive) {
            // A space confirms the word boundary. Translate and speak the
            // cumulative message immediately in the configured output
            // language rather than leaving translation for the Play button.
            void aacSpeak(phrase, speechRate, speechVolume, activeTone, true);
          } else {
            // Preserve the established AAC contract: replay the whole message
            // at each word boundary through the quality-first speech path,
            // instead of speaking only the trailing word.
            speakWord(phrase, speechRate, speechVolume);
          }
        }
      }
    }
    appendChar(' ');
  }, [learnWord, autoSpeak, soundEnabled, speechRate, speechVolume, appendChar, activeTone, browserMode]);

  const handleSpeak = useCallback(() => {
    if (browserMode) {
      tapFeedback();
      onBrowserGo?.();
      return;
    }
    // Check text + soundEnabled before warming up audio, unless we are in AI
    // Chat mode (which has its own routing path and does not speak aloud).
    const currentText = useMessageStore.getState().text.trim();
    if (useUIStore.getState().sidePanel !== 'ai-chat' && (!currentText || !soundEnabled)) return;
    void warmupAzureAudio();
    tapFeedback();
    // In AI Chat mode the Speak key sends to AI instead of speaking aloud.
    if (useUIStore.getState().sidePanel === 'ai-chat') {
      triggerAISubmit();
      return;
    }
    // Master mute wins here too — see the MessageBar Play handler.
    if (!currentText || !soundEnabled) return;
    addToHistory(currentText);
    const { language, outputLanguage } = useSettingsStore.getState();
    if (language !== outputLanguage) {
      const latestTranslated = getLatestTranslated();
      if (latestTranslated) {
        aacSpeak(latestTranslated, speechRate, speechVolume, activeTone, true, outputLanguage as SupportedLanguage);
      } else {
        aacSpeak(currentText, speechRate, speechVolume, activeTone, true);
      }
    } else {
      aacSpeak(currentText, speechRate, speechVolume, activeTone, true);
    }
  }, [soundEnabled, speechRate, speechVolume, addToHistory, activeTone, browserMode, onBrowserGo]);

  const handleBackspace = useCallback(() => {
    deleteFeedback();
    // Route to search when active
    if (dispatchToSearch('\b')) return;
    useMessageStore.getState().deleteLastChar();
  }, []);

  const kc = 'aac-key surface-key text-primary rounded-lg font-bold select-none flex items-center justify-center min-w-0';
  // Bounded by width as well as height. Sizing on svh alone gives a ~35px glyph
  // on a tall phone, and a full-width CJK character then cannot shrink below
  // ~37px — which pushed the Japanese kana row to ~466px inside a 390px screen
  // and clipped keys off both edges. Latin glyphs are narrow enough to have
  // hidden the problem. min() only lowers the size where width is the binding
  // constraint, so tablets and desktop are unchanged.
  const letterSize = capsLock
    ? 'text-[clamp(1.1rem,min(4.8svh,7vw),3.5rem)]'
    : 'text-[clamp(1rem,min(4.2svh,6.5vw),3rem)]';
  const utilSize = 'text-[clamp(1rem,2.5svh,1.75rem)]';
  const wordSize = 'text-[clamp(0.9rem,2svh,1.5rem)]';

  const shiftStyle = capsLock
    ? 'bg-[#4CAF50] text-white'
    : isUpperCase
      ? 'bg-[#FFD700] text-black'
      : '';
  const shiftLabel = capsLock ? 'Caps lock on' : isUpperCase ? 'Shift on' : 'Shift off';
  const shiftGlyph = capsLock ? 'A' : isUpperCase ? '⇧' : '⇪';

  if (!browserMode && usesNativeImeKeyboard(language)) {
    return (
      <NativeImeKeyboard
        key={language}
        language={language}
        text={text}
        setText={setText}
        onBackspace={handleBackspace}
        onSpeak={handleSpeak}
        placeholder={t('type_here')}
        speakLabel={t('speak')}
      />
    );
  }

  return (
    <div
      className="flex-1 flex flex-col gap-[1px] p-[2px]"
      data-scan-group="keyboard"
      data-language={language}
      data-aac-keyboard-rows={rows.length}
      data-aac-keyboard-columns={maxLetterColumns}
      data-dense-letters={denseLetterGrid || undefined}
      data-latin-letters={latinLetterGrid || undefined}
      role="group"
      aria-label="Keyboard"
    >
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="flex gap-[1px] justify-center flex-1"
          data-key-row="letters"
          data-continuation={row.continuation || undefined}
        >
          {row.util && keyboardMode === 'letters' && (
            <button
              onPointerDown={handleShiftDown}
              onPointerUp={handleShiftUp}
              onPointerLeave={() => { if (shiftHoldTimer.current) { clearTimeout(shiftHoldTimer.current); shiftHoldTimer.current = null; } }}
              aria-label={shiftLabel}
              aria-pressed={capsLock}
              data-testid="shift-key"
              className={`${kc} ${utilSize} px-[clamp(0.5rem,1vw,1rem)] min-w-[clamp(2.5rem,6vw,4.5rem)] ${shiftStyle}`}
            >
              {shiftGlyph}
            </button>
          )}
          {row.keys.map((key) => {
            const displayChar = keyboardMode === 'letters' ? (showUpper ? key : lowerKeyboardKey(key, language)) : key;
            return (
              <button
                key={key}
                onClick={() => handleKey(key)}
                aria-label={key}
                data-key={key}
                data-display={displayChar}
                className={`${kc} ${letterSize} hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb] ${
                  // A wrapped remainder keeps base key width instead of
                  // stretching four diacritics across the whole screen.
                  row.continuation ? 'flex-none basis-[calc(100%/10)]' : 'flex-1'
                }`}
              >
                {displayChar}
              </button>
            );
          })}
          {row.util && keyboardMode === 'letters' && (
            <button onClick={handleBackspace} aria-label="Backspace" data-action="backspace" className={`${kc} ${utilSize} px-[clamp(0.5rem,1vw,1rem)] min-w-[clamp(2.5rem,6vw,4.5rem)]`}>⌫</button>
          )}
        </div>
      ))}


      <div data-key-row="controls" className="flex gap-[1px] flex-1" style={{ paddingBottom: 'var(--aac-safe-area-bottom)' }}>
        <button onClick={() => { tapFeedback(); toggleKeyboardMode(); }} aria-label="Switch keyboard mode" data-action="mode" className={`${kc} ${wordSize} min-w-[clamp(3rem,7vw,5rem)] px-[clamp(0.5rem,0.8vw,0.75rem)]`}>
          {keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=' : 'ABC'}
        </button>
        {keyboardMaximized && (
          <button
            onClick={() => { tapFeedback(); cycleKeyboardMode(); }}
            aria-label="Minimize keyboard"
            data-action="kb-minimize"
            data-testid="kb-minimize"
            className={`${kc} ${wordSize} min-w-[clamp(2.5rem,5vw,4rem)] px-[clamp(0.25rem,0.5vw,0.5rem)] text-yellow-400`}
          >
            ⬇
          </button>
        )}
        <button onClick={handleSpace} aria-label={t('space')} data-action="space" className={`${kc} ${wordSize} flex-[6]`}>{t('space')}</button>
        <button onClick={() => handleKey('.')} aria-label="." data-key="." data-display="." className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)] hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb]`}>.</button>
        <button onClick={() => handleKey(punctuation.comma)} aria-label={punctuation.comma} data-key={punctuation.comma} data-display={punctuation.comma} className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)] hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb]`}>{punctuation.comma}</button>
        <button onClick={() => handleKey(punctuation.question)} aria-label={punctuation.question} data-key={punctuation.question} data-display={punctuation.question} className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)] hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb]`}>{punctuation.question}</button>
        <button
          onClick={handleSpeak}
          aria-label={browserMode ? 'Go' : t('speak')}
          className={`aac-btn ${browserMode ? 'bg-blue-600' : 'aac-speak bg-[#4CAF50]'} text-white rounded-xl font-bold px-[clamp(0.75rem,2vw,1.75rem)] min-w-[clamp(5rem,12vw,8.75rem)] ${wordSize} select-none flex items-center justify-center`}
        >
          {browserMode ? 'Go' : t('speak')}
        </button>
      </div>
    </div>
  );
}
