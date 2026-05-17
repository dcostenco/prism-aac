'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { tapFeedback } from '@/services/feedback';
import ColoredText from './ColoredText';
import { inferCardIcon } from '@/services/aiService';
import type { BedsideCard } from '@/services/bedsideCards';

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
  bedsideCards: BedsideCard[];
  onAddCard: (text: string, icon: string) => void;
  onDeleteCard: (id: string) => void;
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
  bedsideCards,
  onAddCard,
  onDeleteCard,
  onToggleVoice,
  onSetHandsFree,
  onSetWakeWord,
  onTapLine,
  onClose,
}: BedsideOverlayProps) {
  const [showVoiceControlCard, setShowVoiceControlCard] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [addCardText, setAddCardText] = useState('');
  const [addCardIcon, setAddCardIcon] = useState('');
  const [addCardLoading, setAddCardLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const voiceCtrlBtnRef = useRef<HTMLButtonElement>(null);
  const addCardInputRef = useRef<HTMLInputElement>(null);
  const addCardBtnRef = useRef<HTMLButtonElement>(null);

  const closeAddCard = useCallback(() => {
    setShowAddCard(false);
    setAddCardText('');
    setAddCardIcon('');
    setAddCardLoading(false);
    setTimeout(() => addCardBtnRef.current?.focus(), 0);
  }, []);

  const handleConfirmAddCard = useCallback(async () => {
    const text = addCardText.trim();
    if (!text) return;
    setAddCardLoading(true);
    setAddCardIcon('');
    try {
      const icon = await inferCardIcon(text);
      setAddCardIcon(icon);
      // Brief pause so user sees the generated icon before dialog closes
      await new Promise<void>(r => setTimeout(r, 500));
      onAddCard(text, icon);
      closeAddCard();
    } catch {
      onAddCard(text, '💬');
      closeAddCard();
    }
  }, [addCardText, onAddCard, closeAddCard]);

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

      {/* Quick Cards — pre-built + custom phrases for non-verbal / non-moving users */}
      <div className="shrink-0 border-b border-white/10" data-testid="bedside-cards-section">
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Quick Phrases</span>
          <div className="flex gap-2">
            <button
              onClick={() => { tapFeedback(); setEditMode(e => !e); }}
              aria-pressed={editMode}
              aria-label={editMode ? 'Done editing cards' : 'Edit quick phrase cards'}
              className={`h-8 px-3 rounded-xl text-xs font-semibold transition-colors ${
                editMode ? 'bg-white/20 text-white' : 'bg-white/8 text-white/50'
              }`}
            >
              {editMode ? 'Done' : '✏️ Edit'}
            </button>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto snap-x scrollbar-hide" role="list" aria-label="Quick phrase cards">
          {bedsideCards.map(card => (
            <div key={card.id} className="relative shrink-0 snap-start" role="listitem">
              <button
                onClick={() => { tapFeedback(); onTapLine(card.text); }}
                aria-label={card.text}
                data-scan-group="quick-cards"
                className="flex flex-col items-center justify-center gap-1 w-[88px] h-[80px] rounded-2xl bg-white/8 border border-white/10 active:bg-white/20 transition-colors text-center px-1"
              >
                <span className="text-3xl leading-none" aria-hidden="true">{card.icon}</span>
                <span className="text-[11px] leading-tight text-white/80 line-clamp-2">{card.text}</span>
              </button>
              {editMode && !card.id.startsWith('builtin-') && (
                <button
                  onClick={() => { tapFeedback(); onDeleteCard(card.id); }}
                  aria-label={`Remove card: ${card.text}`}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#F44336] text-white text-xs flex items-center justify-center z-10 shadow-md"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {/* Add new card button */}
          <button
            ref={addCardBtnRef}
            onClick={() => { tapFeedback(); setShowAddCard(true); }}
            aria-label="Add custom quick phrase card"
            data-testid="bedside-add-card-btn"
            className="shrink-0 snap-start flex flex-col items-center justify-center gap-1 w-[88px] h-[80px] rounded-2xl bg-white/5 border border-dashed border-white/20 active:bg-white/10 transition-colors text-white/40"
          >
            <span className="text-2xl leading-none">＋</span>
            <span className="text-[11px]">Add</span>
          </button>
        </div>
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

      {/* Add quick card dialog */}
      {showAddCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add quick phrase card"
          data-testid="bedside-add-card-dialog"
          className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center px-8 gap-5 z-10"
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeAddCard();
          }}
        >
          <p className="text-white text-2xl font-bold">New Quick Phrase</p>

          {/* Icon preview / loading */}
          <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center" aria-live="polite">
            {addCardLoading && !addCardIcon && (
              <span className="text-white/50 text-sm animate-pulse">✨ Generating…</span>
            )}
            {addCardIcon && (
              <span className="text-5xl" data-testid="bedside-card-icon-preview">{addCardIcon}</span>
            )}
            {!addCardLoading && !addCardIcon && (
              <span className="text-4xl text-white/20">💬</span>
            )}
          </div>

          <input
            ref={addCardInputRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="text"
            value={addCardText}
            onChange={(e) => setAddCardText(e.target.value.slice(0, 80))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !addCardLoading) handleConfirmAddCard(); }}
            placeholder="What do you want to say?"
            maxLength={80}
            aria-label="Quick phrase text"
            className="w-full h-16 rounded-2xl bg-white/10 text-white text-xl text-center px-4 placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/30"
          />
          <p className="text-white/30 text-sm -mt-3 self-end pr-1">{addCardText.length}/80</p>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => { tapFeedback(); closeAddCard(); }}
              disabled={addCardLoading}
              className="flex-1 h-16 rounded-2xl bg-white/10 text-white/70 text-lg font-semibold active:bg-white/20 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => { tapFeedback(); handleConfirmAddCard(); }}
              disabled={addCardLoading || !addCardText.trim()}
              aria-label="Confirm add card"
              data-testid="bedside-add-card-confirm"
              className="flex-1 h-16 rounded-2xl bg-white text-black text-lg font-bold active:bg-white/80 disabled:opacity-40"
            >
              {addCardLoading ? '✨ Adding…' : 'Add Card'}
            </button>
          </div>

          <p className="text-white/30 text-sm text-center">
            The icon is generated by AI based on what you write.
          </p>
        </div>
      )}

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
