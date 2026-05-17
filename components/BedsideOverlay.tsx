'use client';
import { useState, useRef, useEffect } from 'react';
import { tapFeedback } from '@/services/feedback';
import ColoredText from './ColoredText';

interface BedsideOverlayProps {
  listening: boolean;
  loading: boolean;
  interim: string;
  handsFreeModeActive: boolean;
  wakeWordActive: boolean;
  wakeWordSupported: boolean;
  lastAIText: string;
  lastAILines: string[];
  lastAIMessageId: string;
  isCrisisAnnouncement: boolean;
  onToggleVoice: () => void;
  onSetHandsFree: (v: boolean) => void;
  onSetWakeWord: (v: boolean) => void;
  onTapLine: (line: string) => void;
  onClose: () => void;
}

/**
 * Bedside Mode — full-screen overlay optimised for phone-in-stand use
 * (lying down, screen above face, arms at sides). Every interactive
 * element is oversized; voice is the primary input path.
 */
export default function BedsideOverlay({
  listening,
  loading,
  interim,
  handsFreeModeActive,
  wakeWordActive,
  wakeWordSupported,
  lastAIText,
  lastAILines,
  lastAIMessageId,
  isCrisisAnnouncement,
  onToggleVoice,
  onSetHandsFree,
  onSetWakeWord,
  onTapLine,
  onClose,
}: BedsideOverlayProps) {
  const [showVoiceControlCard, setShowVoiceControlCard] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const voiceCtrlBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the overlay container on mount so keyboard/iOS Voice Control users
  // start inside the modal. WCAG 2.1 SC 2.1.2 requires focus to be trapped.
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const openVoiceControl = () => {
    tapFeedback();
    // Try native bridge deep-link first (requires iOS app support)
    if ((window as any).prismNativeBridge?.openSettings) {
      (window as any).prismNativeBridge.openSettings('accessibility');
      return;
    }
    // Fallback: show instructions
    setShowVoiceControlCard(true);
  };

  const lines = lastAILines.length > 0 ? lastAILines : lastAIText ? [lastAIText] : [];

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label="Bedside Mode"
      aria-modal="true"
      data-testid="bedside-overlay"
      tabIndex={-1}
      onKeyDown={(e) => {
        // Tab trap — cycle focus within the overlay so Tab/Shift+Tab cannot
        // escape into underlying app content (WCAG 2.1 SC 2.1.2).
        if (e.key === 'Tab') {
          // When the inner Voice Control card is open, confine Tab to that
          // card only — the outer overlay buttons are inert behind the backdrop.
          const root = showVoiceControlCard
            ? overlayRef.current?.querySelector<HTMLElement>('[aria-label="iOS Voice Control instructions"]')
            : overlayRef.current;
          const focusable = root?.querySelectorAll<HTMLElement>(
            'button, [tabindex]:not([tabindex="-1"])',
          );
          if (focusable && focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const arr = Array.from(focusable);
            // idx === -1 when focus is on the container div (tabIndex=-1, excluded
            // from query) or any element outside the focusable list. In that case
            // treat it as a boundary so Tab enters the trap rather than escaping.
            const idx = arr.indexOf(document.activeElement as HTMLElement);
            const atBoundary = e.shiftKey ? idx <= 0 : idx === -1 || idx === arr.length - 1;
            if (atBoundary) {
              e.preventDefault();
              (e.shiftKey ? last : first).focus();
            }
          }
        }
        if (e.key === 'Escape' && !showVoiceControlCard) { tapFeedback(); onClose(); }
      }}
      className="fixed inset-0 z-50 bg-black flex flex-col select-none outline-none"
      style={{ WebkitUserSelect: 'none' }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-safe pt-4 pb-3 border-b border-white/10">
        <span className="text-white/60 text-base font-medium tracking-wide">🛏 Bedside Mode</span>
        <button
          onClick={() => { tapFeedback(); onClose(); }}
          aria-label="Exit Bedside Mode"
          className="w-12 h-12 rounded-full bg-white/10 text-white text-xl flex items-center justify-center active:bg-white/20"
        >
          ✕
        </button>
      </div>

      {/* Hidden assertive live region for crisis announcements only */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="bedside-crisis-announcer"
      >
        {isCrisisAnnouncement ? lastAIText : ''}
      </div>

      {/* AI Response */}
      <div aria-live="polite" aria-atomic="false" className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
        {lines.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-white/40 px-8">
            <span className="text-7xl">✨</span>
            <p className="text-2xl font-medium text-white/60">AI Tutor</p>
            <p className="text-lg">
              {wakeWordActive
                ? 'Say "Hey Prism" to start'
                : handsFreeModeActive
                ? 'Tap mic once to start. Auto-listens after each response.'
                : 'Tap the mic to speak'}
            </p>
          </div>
        )}

        {lines.map((line, i) => (
          <button
            key={`bedside-line-${lastAIMessageId}-${i}`}
            onClick={() => { tapFeedback(); onTapLine(line); }}
            aria-label={`Use: ${line}`}
            className="aac-btn block w-full text-left rounded-2xl p-5 bg-white/5 border border-white/10 active:bg-white/15"
          >
            <ColoredText text={line} className="text-2xl leading-relaxed text-white" />
          </button>
        ))}

        {loading && (
          <div className="flex items-center gap-3 text-white/50 text-2xl px-2 py-4">
            <span className="animate-pulse">✨ Thinking…</span>
          </div>
        )}
      </div>

      {/* Interim transcript */}
      {listening && interim && (
        <div className="shrink-0 px-5 py-3 border-t border-white/10 text-[#4CAF50] text-xl text-center truncate">
          🎙 &ldquo;{interim.slice(0, 200)}{interim.length > 200 ? '…' : ''}&rdquo;
        </div>
      )}

      {/* Big mic button */}
      <div className="shrink-0 flex flex-col items-center gap-3 py-6 border-t border-white/10">
        <button
          onClick={() => { tapFeedback(); onToggleVoice(); }}
          aria-label={listening ? 'Stop listening' : 'Start listening'}
          aria-pressed={listening}
          className={`w-28 h-28 rounded-full text-5xl flex items-center justify-center transition-all active:scale-95 ${
            listening
              ? 'bg-[#F44336] text-white animate-pulse shadow-[0_0_32px_rgba(244,67,54,0.6)]'
              : 'bg-white/15 text-white border-2 border-white/30'
          }`}
        >
          {listening ? '⏺' : '🎙'}
        </button>
        <p className="text-white/50 text-base">
          {listening ? 'Listening… speak now' : handsFreeModeActive ? 'Auto-listen on' : 'Tap to speak'}
        </p>
      </div>

      {/* Controls row */}
      <div className="shrink-0 flex items-center justify-around px-5 pb-safe pb-6 pt-2 border-t border-white/10 gap-3">
        {/* Hands-free toggle */}
        <button
          onClick={() => { tapFeedback(); onSetHandsFree(!handsFreeModeActive); }}
          aria-pressed={handsFreeModeActive}
          aria-label="Toggle hands-free mode"
          className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl text-base font-semibold transition-colors ${
            handsFreeModeActive
              ? 'bg-[#4CAF50] text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          🔁 {handsFreeModeActive ? 'Hands-Free On' : 'Hands-Free'}
        </button>

        {/* Wake word toggle — web only */}
        {wakeWordSupported && (
          <button
            onClick={() => { tapFeedback(); onSetWakeWord(!wakeWordActive); }}
            aria-pressed={wakeWordActive}
            aria-label='Toggle "Hey Prism" wake word'
            className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl text-base font-semibold transition-colors ${
              wakeWordActive
                ? 'bg-[#2196F3] text-white'
                : 'bg-white/10 text-white/70'
            }`}
          >
            🎯 {wakeWordActive ? '"Hey Prism" On' : '"Hey Prism"'}
          </button>
        )}

        {/* iOS Voice Control */}
        <button
          ref={voiceCtrlBtnRef}
          onClick={openVoiceControl}
          aria-label="Enable iOS Voice Control"
          className="flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl text-base font-semibold bg-white/10 text-white/70"
        >
          📱 Voice Ctrl
        </button>
      </div>

      {/* iOS Voice Control instruction card */}
      {showVoiceControlCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="iOS Voice Control instructions"
          className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center px-8 gap-6 z-10"
        >
          <p className="text-white text-3xl font-bold">Enable iOS Voice Control</p>
          <ol className="text-white/80 text-xl space-y-3 text-left">
            <li>1. Open <strong>Settings</strong></li>
            <li>2. Tap <strong>Accessibility</strong></li>
            <li>3. Tap <strong>Voice Control</strong></li>
            <li>4. Turn it <strong>On</strong></li>
          </ol>
          <p className="text-white/50 text-base text-center">
            Once enabled, say commands like &ldquo;tap Back&rdquo; or &ldquo;scroll down&rdquo; to navigate anywhere on your iPhone — no screen touch needed.
          </p>
          <button
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={() => {
              tapFeedback();
              setShowVoiceControlCard(false);
              // WCAG 2.4.3: return focus to the element that opened this dialog
              setTimeout(() => voiceCtrlBtnRef.current?.focus(), 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                tapFeedback();
                setShowVoiceControlCard(false);
                setTimeout(() => voiceCtrlBtnRef.current?.focus(), 0);
              }
            }}
            className="mt-2 w-full h-16 rounded-2xl bg-white/20 text-white text-xl font-bold active:bg-white/30"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
