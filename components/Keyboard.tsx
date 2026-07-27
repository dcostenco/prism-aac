'use client';
import { useCallback, useEffect, useRef } from 'react';
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
import { getLetterRows, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';
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

const SENTENCE_END = /[.?!]/;
const SENTENCE_TERMINATORS = '.?!';

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'prof', 'rev', 'gen', 'sgt', 'cpl', 'pvt', 'vs', 'no', 'vol', 'dept', 'approx', 'inc', 'ltd', 'corp', 'est']);

function isAbbreviation(word: string): boolean {
  return ABBREVIATIONS.has(word.toLowerCase().replace(/\./g, ''));
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

export const __testing = { extractLastSentence };

export default function Keyboard({ browserMode, onBrowserGo }: { browserMode?: boolean; onBrowserGo?: () => void } = {}) {
  const { appendChar, addToHistory, autoSpeak, soundEnabled, toggleSound, activeTone } = useMessageStore();
  const { keyboardMode, isUpperCase, capsLock, toggleKeyboardMode, toggleCase, toggleCapsLock, keyboardMaximized, cycleKeyboardMode } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume, language, speakOnSentenceEnd, gridSize } = useSettingsStore();
  const { t } = useT();
  const letterRows = getLetterRows(language);

  const rows = keyboardMode === 'letters'
    ? letterRows
    : keyboardMode === 'numbers' ? NUMBERS_ROWS : SYMBOLS_ROWS;
  const showUpper = isUpperCase || capsLock;

  const handleKey = useCallback((key: string) => {
    keyFeedback();
    const char = keyboardMode === 'letters' ? (showUpper ? key : key.toLowerCase()) : key;
    // Route to search input when category search is active — keys must not
    // also land in the message bar while the user is searching vocabulary.
    if (dispatchToSearch(char)) {
      if (isUpperCase && !capsLock && keyboardMode === 'letters') toggleCase();
      return;
    }
    appendChar(char);
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
  }, [appendChar, isUpperCase, capsLock, keyboardMode, toggleCase, showUpper,
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
    // Check text before warming up audio unless AI Chat owns this action.
    const currentText = useMessageStore.getState().text.trim();
    if (useUIStore.getState().sidePanel !== 'ai-chat' && !currentText) return;
    void warmupAzureAudio();
    tapFeedback();
    // In AI Chat mode the Speak key sends to AI instead of speaking aloud.
    if (useUIStore.getState().sidePanel === 'ai-chat') {
      triggerAISubmit();
      return;
    }
    if (!currentText) return;
    // Like the MessageBar Play button, the explicit keyboard Speak action
    // recovers stale persisted mute state instead of silently doing nothing.
    if (!useMessageStore.getState().soundEnabled) toggleSound();
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
  }, [toggleSound, speechRate, speechVolume, addToHistory, activeTone, browserMode, onBrowserGo]);

  const handleBackspace = useCallback(() => {
    deleteFeedback();
    // Route to search when active
    if (dispatchToSearch('\b')) return;
    useMessageStore.getState().deleteLastChar();
  }, []);

  const kc = 'aac-key surface-key text-primary rounded-lg font-bold select-none flex items-center justify-center';
  const letterSize = capsLock
    ? 'text-[clamp(1.75rem,4.8svh,3.5rem)]'
    : 'text-[clamp(1.55rem,4.2svh,3rem)]';
  const utilSize = 'text-[clamp(1rem,2.5svh,1.75rem)]';
  const wordSize = 'text-[clamp(0.9rem,2svh,1.5rem)]';

  const shiftStyle = capsLock
    ? 'bg-[#4CAF50] text-white'
    : isUpperCase
      ? 'bg-[#FFD700] text-black'
      : '';
  const shiftLabel = capsLock ? 'Caps lock on' : isUpperCase ? 'Shift on' : 'Shift off';
  const shiftGlyph = capsLock ? 'A' : isUpperCase ? '⇧' : '⇪';

  return (
    <div className="flex-1 flex flex-col gap-[1px] p-[2px]" data-scan-group="keyboard" role="group" aria-label="Keyboard">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[1px] justify-center flex-1">
          {ri === 2 && keyboardMode === 'letters' && (
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
          {row.map((key) => {
            const displayChar = keyboardMode === 'letters' ? (showUpper ? key : key.toLowerCase()) : key;
            return (
              <button
                key={key}
                onClick={() => handleKey(key)}
                aria-label={key}
                data-key={key}
                data-display={displayChar}
                className={`${kc} ${letterSize} flex-1 hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb]`}
              >
                {displayChar}
              </button>
            );
          })}
          {ri === 2 && keyboardMode === 'letters' && (
            <button onClick={handleBackspace} aria-label="Backspace" data-action="backspace" className={`${kc} ${utilSize} px-[clamp(0.5rem,1vw,1rem)] min-w-[clamp(2.5rem,6vw,4.5rem)]`}>⌫</button>
          )}
        </div>
      ))}

      <div className="flex gap-[1px] flex-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
        <button onClick={() => handleKey(',')} aria-label="," data-key="," data-display="," className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)] hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb]`}>,</button>
        <button onClick={() => handleKey('?')} aria-label="?" data-key="?" data-display="?" className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)] hover:bg-[rgba(37,99,235,0.12)] hover:outline hover:outline-2 hover:outline-[#2563eb]`}>?</button>
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
