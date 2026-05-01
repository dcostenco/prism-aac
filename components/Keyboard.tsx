'use client';
import { useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { keyFeedback, tapFeedback, deleteFeedback } from '@/services/feedback';
import { getLetterRows, NUMBERS_ROWS, SYMBOLS_ROWS } from '@/constants/keyboardLayouts';
import {
  getActiveProfile,
  recordTouchSample,
  recordContinuousTouch,
  isContinuousLearningActive,
} from '@/services/handProfileService';

import { useT } from '@/engine/useT';


const CAPS_LOCK_HOLD_MS = 500;

// ── Touch stabilization defaults (overridden by hand profile) ────────
const DEFAULT_ALPHA = 0.35;
const DEFAULT_HYSTERESIS = 10;
const DEFAULT_Y_OFFSET = -8;
const DEFAULT_X_OFFSET = 0;
const SETTLE_MS = 100;
const LIFT_DELAY_MS = 80;

function PrecisionBubble({ char, x, y, visible }: { char: string; x: number; y: number; visible: boolean }) {
  if (!visible || !char) return null;
  // Position bubble well above the key so it doesn't overlap/duplicate
  const bubbleY = Math.max(5, y - 55);
  const bubbleX = Math.max(25, Math.min(typeof window !== 'undefined' ? window.innerWidth - 25 : 9999, x));
  return (
    <div
      className="precision-bubble"
      style={{ left: bubbleX, top: bubbleY }}
    >
      {char}
    </div>
  );
}

export default function Keyboard() {
  const { appendChar, addToHistory, autoSpeak, soundEnabled, activeTone } = useMessageStore();
  const { keyboardMode, isUpperCase, capsLock, toggleKeyboardMode, toggleCase, toggleCapsLock } = useUIStore();
  const { learnWord } = usePredictionStore();
  const { speechRate, speechVolume, language, precisionTouchEnabled } = useSettingsStore();
  const { t } = useT();
  const letterRows = getLetterRows(language);

  const rows = keyboardMode === 'letters' ? letterRows : keyboardMode === 'numbers' ? NUMBERS_ROWS : SYMBOLS_ROWS;
  const showUpper = isUpperCase || capsLock;

  // ── Core handlers ──

  const handleKey = useCallback((key: string) => {
    keyFeedback();
    const char = keyboardMode === 'letters' ? (showUpper ? key : key.toLowerCase()) : key;
    appendChar(char);
    if (isUpperCase && !capsLock && keyboardMode === 'letters') toggleCase();
  }, [appendChar, isUpperCase, capsLock, keyboardMode, toggleCase, showUpper]);

  const shiftHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shiftLongPressed = useRef(false);

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
    const currentText = useMessageStore.getState().text;
    const words = currentText.trim().split(/\s+/).filter(Boolean);
    const lastWord = words.length > 0 ? words[words.length - 1] : '';
    if (lastWord) {
      const prevWord = words.length > 1 ? words[words.length - 2] : undefined;
      learnWord(lastWord.toLowerCase(), prevWord?.toLowerCase());
      const translationActive = useSettingsStore.getState().language !== useSettingsStore.getState().outputLanguage;
      if (translationActive || (autoSpeak && soundEnabled)) {
        aacSpeak(lastWord, speechRate, speechVolume, activeTone);
      }
    }
    appendChar(' ');
  }, [learnWord, autoSpeak, soundEnabled, speechRate, speechVolume, appendChar, activeTone]);

  const handleSpeak = useCallback(() => {
    tapFeedback();
    const currentText = useMessageStore.getState().text.trim();
    if (!currentText || !soundEnabled) return;
    addToHistory(currentText);
    aacSpeak(currentText, speechRate, speechVolume, activeTone);
  }, [soundEnabled, speechRate, speechVolume, addToHistory, activeTone]);

  const handleBackspace = useCallback(() => {
    deleteFeedback();
    useMessageStore.getState().deleteLastChar();
  }, []);

  const handlersRef = useRef({ handleKey, handleSpace, handleSpeak, handleBackspace, handleShiftUp });
  handlersRef.current = { handleKey, handleSpace, handleSpeak, handleBackspace, handleShiftUp };

  // ── Precision touch-and-slide with military-grade stabilization ──
  // Load hand profile for per-user calibrated parameters
  const profileRef = useRef(getActiveProfile());
  useEffect(() => { profileRef.current = getActiveProfile(); }, [precisionTouchEnabled]);

  const getAlpha = () => profileRef.current.emaAlpha || DEFAULT_ALPHA;
  const getHysteresis = () => profileRef.current.deadZonePx || DEFAULT_HYSTERESIS;
  const getYOffset = () => profileRef.current.yOffset ?? DEFAULT_Y_OFFSET;
  const getXOffset = () => profileRef.current.xOffset ?? DEFAULT_X_OFFSET;

  const [bubble, setBubble] = useState<{ char: string; x: number; y: number; visible: boolean }>({ char: '', x: 0, y: 0, visible: false });
  const activeKeyRef = useRef<HTMLElement | null>(null);
  const touchActiveRef = useRef(false);
  const smoothXRef = useRef(0);
  const smoothYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const settledRef = useRef(false);
  const liftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adaptive smoothing: profile base alpha, reduced further when device is in motion
  const motionAlphaRef = useRef(getAlpha());

  useEffect(() => {
    if (!precisionTouchEnabled || typeof DeviceMotionEvent === 'undefined') return;
    const baseAlpha = getAlpha();
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt(
        (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
      );
      const deviation = Math.abs(magnitude - 9.8);
      if (deviation > 2) {
        motionAlphaRef.current = Math.max(0.15, baseAlpha - deviation * 0.02);
      } else {
        motionAlphaRef.current = baseAlpha;
      }
    };
    window.addEventListener('devicemotion', handler, { passive: true });
    return () => window.removeEventListener('devicemotion', handler);
  }, [precisionTouchEnabled]);

  const resolveKeyUnderPoint = useCallback((tx: number, ty: number): HTMLElement | null => {
    // Use elementsFromPoint to skip overlays (precision bubble, head tracking
    // cursor, alert overlays) that sit on top of keyboard keys. On iPad Safari,
    // elementFromPoint returns the topmost element including pointer-events:none
    // overlays, which breaks key detection entirely.
    const els = document.elementsFromPoint(tx, ty);
    for (const el of els) {
      const btn = el.closest('button[data-key], button[data-action]') as HTMLElement | null;
      if (btn) return btn;
    }
    return null;
  }, []);

  const isInsideActiveKey = useCallback((sx: number, sy: number): boolean => {
    const btn = activeKeyRef.current;
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    const h = getHysteresis();
    return (
      sx >= r.left - h &&
      sx <= r.right + h &&
      sy >= r.top - h &&
      sy <= r.bottom + h
    );
  }, []);

  const setActiveKey = useCallback((btn: HTMLElement | null) => {
    if (btn === activeKeyRef.current) return;
    activeKeyRef.current?.classList.remove('precision-highlight');
    activeKeyRef.current = btn;
    btn?.classList.add('precision-highlight');
  }, []);

  const dispatchKey = useCallback((btn: HTMLElement) => {
    btn.classList.remove('precision-highlight');
    const action = btn.getAttribute('data-action');
    const key = btn.getAttribute('data-key');
    if (action === 'space') handlersRef.current.handleSpace();
    else if (action === 'backspace') handlersRef.current.handleBackspace();
    else if (action === 'speak') handlersRef.current.handleSpeak();
    else if (action === 'shift') handlersRef.current.handleShiftUp();
    else if (action === 'mode') { tapFeedback(); toggleKeyboardMode(); }
    else if (key) handlersRef.current.handleKey(key);
  }, [toggleKeyboardMode]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!precisionTouchEnabled) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();

    // Cancel pending lift ONLY if re-touching the SAME key (bounce-lift).
    // If touching a DIFFERENT key, let the pending key commit — this
    // prevents rapid typing from swallowing valid keystrokes.
    if (liftTimerRef.current) {
      const corrX = touch.clientX + getXOffset();
      const corrY = touch.clientY + getYOffset();
      const newBtn = resolveKeyUnderPoint(corrX, corrY);
      if (newBtn && newBtn === activeKeyRef.current) {
        clearTimeout(liftTimerRef.current);
        liftTimerRef.current = null;
      }
      // else: different key — let pending commit, this touch starts fresh
    }

    touchActiveRef.current = true;
    touchStartTimeRef.current = Date.now();
    settledRef.current = false;

    // Apply per-profile offset corrections (learned from hand scan)
    const correctedX = touch.clientX + getXOffset();
    const correctedY = touch.clientY + getYOffset();
    smoothXRef.current = correctedX;
    smoothYRef.current = correctedY;

    // Record for tremor analysis + continuous learning
    recordTouchSample(touch.clientX, touch.clientY);

    const btn = resolveKeyUnderPoint(correctedX, correctedY);
    setActiveKey(btn);
    if (btn) {
      const char = btn.getAttribute('data-display') || '';
      setBubble({ char, x: touch.clientX, y: correctedY, visible: true });
    }
  }, [precisionTouchEnabled, resolveKeyUnderPoint, setActiveKey]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!precisionTouchEnabled || !touchActiveRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();

    const correctedX = touch.clientX + getXOffset();
    const correctedY = touch.clientY + getYOffset();

    recordTouchSample(touch.clientX, touch.clientY);

    // Settle time: don't switch keys during first SETTLE_MS after touch
    if (!settledRef.current) {
      if (Date.now() - touchStartTimeRef.current < SETTLE_MS) {
        const alpha = motionAlphaRef.current;
        smoothXRef.current += alpha * (correctedX - smoothXRef.current);
        smoothYRef.current += alpha * (correctedY - smoothYRef.current);
        setBubble(prev => ({ ...prev, x: smoothXRef.current, y: smoothYRef.current }));
        return;
      }
      settledRef.current = true;
    }

    // EMA-smooth with adaptive alpha (profile-tuned + motion-adaptive)
    const alpha = motionAlphaRef.current;
    smoothXRef.current += alpha * (correctedX - smoothXRef.current);
    smoothYRef.current += alpha * (correctedY - smoothYRef.current);
    const sx = smoothXRef.current;
    const sy = smoothYRef.current;

    // Hysteresis: only switch when smoothed point exits active key rect
    if (!isInsideActiveKey(sx, sy)) {
      const btn = resolveKeyUnderPoint(sx, sy);
      setActiveKey(btn);
    }

    const active = activeKeyRef.current;
    if (active) {
      const char = active.getAttribute('data-display') || '';
      setBubble({ char, x: sx, y: sy, visible: true });
    } else {
      setBubble(prev => ({ ...prev, visible: false }));
    }
  }, [precisionTouchEnabled, resolveKeyUnderPoint, setActiveKey, isInsideActiveKey]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!precisionTouchEnabled || !touchActiveRef.current) return;
    e.preventDefault();
    touchActiveRef.current = false;

    const btn = activeKeyRef.current;
    if (!btn) {
      setBubble(prev => ({ ...prev, visible: false }));
      activeKeyRef.current = null;
      return;
    }

    // Lift delay: wait LIFT_DELAY_MS before committing.
    // If finger touches again within that window (bounce-lift from
    // car vibration or tremor), the action is cancelled.
    liftTimerRef.current = setTimeout(() => {
      liftTimerRef.current = null;
      // Continuous learning: record which key was actually selected
      if (isContinuousLearningActive()) {
        const rect = btn.getBoundingClientRect();
        recordContinuousTouch(smoothXRef.current, smoothYRef.current, rect);
      }
      dispatchKey(btn);
      activeKeyRef.current = null;
      setBubble(prev => ({ ...prev, visible: false }));
    }, LIFT_DELAY_MS);
  }, [precisionTouchEnabled, dispatchKey]);

  const handleTouchCancel = useCallback((e: React.TouchEvent) => {
    if (!precisionTouchEnabled || !touchActiveRef.current) return;
    e.preventDefault();
    touchActiveRef.current = false;
    if (liftTimerRef.current) { clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }
    activeKeyRef.current?.classList.remove('precision-highlight');
    activeKeyRef.current = null;
    setBubble(prev => ({ ...prev, visible: false }));
  }, [precisionTouchEnabled]);

  // Cleanup lift timer on unmount
  useEffect(() => {
    return () => { if (liftTimerRef.current) clearTimeout(liftTimerRef.current); };
  }, []);

  // ── Styles ──

  const kc = 'aac-key surface-key text-primary rounded-lg font-bold select-none flex items-center justify-center';
  const letterSize = capsLock
    ? 'text-[clamp(1.5rem,4vw,3.5rem)]'
    : 'text-[clamp(1.25rem,3.5vw,2.75rem)]';
  const utilSize = 'text-[clamp(1rem,2.2vw,1.75rem)]';
  const wordSize = 'text-[clamp(0.875rem,1.8vw,1.5rem)]';

  const shiftStyle = capsLock
    ? 'bg-[#4CAF50] text-white'
    : isUpperCase
      ? 'bg-[#FFD700] text-black'
      : '';
  const shiftLabel = capsLock ? 'Caps lock on' : isUpperCase ? 'Shift on' : 'Shift off';
  const shiftGlyph = capsLock ? 'A' : isUpperCase ? '⇧' : '⇪';

  // Pointer-based precision: show bubble on hover for ALL input types
  // (mouse, trackpad, stylus, touch). Works on desktop AND tablet.
  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!precisionTouchEnabled) return;
    const btn = e.currentTarget;
    // Only show bubble for short labels (letters, digits, punctuation).
    // Skip utility keys (space, Speak, backspace, mode) — they're already
    // clearly labeled and the bubble just duplicates the text.
    const char = btn.getAttribute('data-display') || '';
    const isUtilityKey = !!btn.getAttribute('data-action');
    if (char && !isUtilityKey && char.length <= 2) {
      const rect = btn.getBoundingClientRect();
      setBubble({ char, x: rect.left + rect.width / 2, y: rect.top, visible: true });
      setActiveKey(btn);
    } else {
      setBubble(prev => ({ ...prev, visible: false }));
    }
  }, [precisionTouchEnabled, setActiveKey]);

  const handlePointerLeave = useCallback(() => {
    if (!precisionTouchEnabled || touchActiveRef.current) return;
    setBubble(prev => ({ ...prev, visible: false }));
    activeKeyRef.current?.classList.remove('precision-highlight');
    activeKeyRef.current = null;
  }, [precisionTouchEnabled]);

  return (
    <div
      className={`flex-1 flex flex-col gap-[1px] p-[2px] ${precisionTouchEnabled ? 'precision-touch-active' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {precisionTouchEnabled && typeof document !== 'undefined' && createPortal(<PrecisionBubble {...bubble} />, document.body)}
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[1px] justify-center flex-1">
          {ri === 2 && keyboardMode === 'letters' && (
            <button
              data-action="shift"
              data-display={shiftGlyph}
              onPointerDown={handleShiftDown}
              onPointerUp={handleShiftUp}
              onPointerEnter={handlePointerEnter}
              onPointerLeave={(e) => { handlePointerLeave(); if (shiftHoldTimer.current) { clearTimeout(shiftHoldTimer.current); shiftHoldTimer.current = null; } }}
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
                data-key={displayChar}
                data-display={displayChar}
                onClick={() => handleKey(key)}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                aria-label={key}
                className={`${kc} ${letterSize} flex-1`}
              >
                {displayChar}
              </button>
            );
          })}
          {ri === 2 && keyboardMode === 'letters' && (
            <button data-action="backspace" data-display="⌫" onClick={handleBackspace} aria-label="Backspace" className={`${kc} ${utilSize} px-[clamp(0.5rem,1vw,1rem)] min-w-[clamp(2.5rem,6vw,4.5rem)]`}>⌫</button>
          )}
        </div>
      ))}

      <div className="flex gap-[1px] flex-1">
        <button data-action="mode" data-display={keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=' : 'ABC'} onClick={() => { tapFeedback(); toggleKeyboardMode(); }} aria-label="Switch keyboard mode" className={`${kc} ${wordSize} min-w-[clamp(3rem,7vw,5rem)] px-[clamp(0.5rem,0.8vw,0.75rem)]`}>
          {keyboardMode === 'letters' ? '123' : keyboardMode === 'numbers' ? '#+=' : 'ABC'}
        </button>
        <button data-action="space" data-display={t('space')} onClick={handleSpace} aria-label={t('space')} className={`${kc} ${wordSize} flex-[6]`}>{t('space')}</button>
        <button data-key="." data-display="." onClick={() => handleKey('.')} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} aria-label="." className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)]`}>.</button>
        <button data-key="," data-display="," onClick={() => handleKey(',')} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} aria-label="," className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)]`}>,</button>
        <button data-key="?" data-display="?" onClick={() => handleKey('?')} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} aria-label="?" className={`${kc} ${utilSize} min-w-[clamp(2.5rem,5vw,4.5rem)]`}>?</button>
        <button
          data-action="speak"
          data-display={t('speak')}
          onClick={handleSpeak}
          aria-label={t('speak')}
          className={`aac-btn aac-speak bg-[#4CAF50] text-white rounded-xl font-bold px-[clamp(0.75rem,2vw,1.75rem)] min-w-[clamp(5rem,12vw,8.75rem)] ${wordSize} select-none flex items-center justify-center`}
        >
          {t('speak')}
        </button>
      </div>
    </div>
  );
}
