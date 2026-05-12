'use client';
/**
 * Shared language picker — country flag + native name in a large
 * touch-target grid. Used by:
 *   - Toolbar (input/output language pair)
 *   - AIChatPanel / AACChatPanel (per-message language overrides)
 *
 * Visual contract: every language is rendered exactly the same way —
 * 64×64 minimum tap target, flag at top, native name below, BCP-47
 * code as a small caption. No language gets a "compact" treatment.
 *
 * The trigger button is also exported so callers (Toolbar, chat panels)
 * render a uniform `[🇮🇹 IT]` button rather than each rolling its own.
 */
import { useEffect, useRef } from 'react';
import { LANG_META, type SupportedLanguage } from '@/engine/i18n';
import { tapFeedback } from '@/services/feedback';

interface LanguageButtonProps {
  /** The currently-selected language. */
  lang: SupportedLanguage;
  /** Visual variant — input/output pair colors live here, not in the
   *  consumers, so the two pickers stay in sync if we restyle. */
  variant?: 'input' | 'output' | 'output-mismatch' | 'neutral';
  onClick: () => void;
  ariaLabel?: string;
}

/** The compact pill button that opens the picker. Same shape regardless
 *  of where it's mounted. */
export function LanguageButton({ lang, variant = 'neutral', onClick, ariaLabel }: LanguageButtonProps) {
  const meta = LANG_META.find((l) => l.code === lang);
  const flag = meta?.flag ?? '';
  const code = (meta?.code ?? lang).toUpperCase();
  const colorClass =
    variant === 'input' ? 'bg-[#2196F3] text-white border-transparent'
    : variant === 'output-mismatch' ? 'bg-[#FF9800] text-white border-transparent'
    : variant === 'output' ? 'bg-[#4CAF50] text-white border-transparent'
    : 'surface-key text-primary border border-theme';
  return (
    <button
      type="button"
      onClick={() => { tapFeedback(); onClick(); }}
      aria-label={ariaLabel ?? `Language: ${meta?.name ?? lang}. Tap to change.`}
      data-testid={`language-button-${variant}`}
      className={`aac-btn h-[clamp(2rem,6svh,2.75rem)] px-[clamp(0.25rem,0.8vw,0.5rem)] rounded-lg font-bold uppercase select-none flex items-center gap-0.5 text-[clamp(0.55rem,1.5vw,0.75rem)] ${colorClass}`}
    >
      <span aria-hidden className="text-[clamp(0.85rem,2.5vw,1.1rem)] leading-none">{flag}</span>
      <span className="hidden sm:inline">{code}</span>
    </button>
  );
}

interface LanguagePickerProps {
  /** Code currently selected — gets the green check overlay. */
  selected: SupportedLanguage;
  /** Called when the user picks a language. */
  onSelect: (lang: SupportedLanguage) => void;
  /** Called when the user dismisses (clicks outside or picks one). */
  onClose: () => void;
  /** Anchor positioning — controls where the popover floats relative to its
   *  parent. The component is `absolute`-positioned; parent must be relative. */
  anchor?: 'right' | 'left' | 'center';
}

/** Full-width grid picker with one large tile per language.
 *  Renders inside its parent — caller is responsible for the relative
 *  container + outside-click dismissal wiring. */
export default function LanguagePicker({ selected, onSelect, onClose, anchor = 'right' }: LanguagePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Outside-click dismissal. Use the *capture* phase so the picker
    // closes before any inner click handler runs, and avoid the old
    // setTimeout(0) hack: the button that opens the picker fires its
    // onClick on bubble; this listener fires on capture of the *next*
    // pointerdown only — by then the open-click is already past.
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Escape-key dismissal — keyboard accessibility. Without this, a
    // caregiver navigating with a Bluetooth keyboard couldn't get out
    // of the picker without clicking elsewhere.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // The pointerdown that opened this picker is already bubbled; the
    // next one is what we want to listen for. Registering synchronously
    // is fine because React fires the open-click's bubble path BEFORE
    // useEffect runs — the document listener can't see it.
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const anchorClass = anchor === 'left' ? 'left-0' : anchor === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0';

  // Filter out the back-compat 'zh' alias — it's a duplicate of zh-Hans
  // and would render twice in the grid otherwise.
  const visible = LANG_META.filter((l) => l.code !== 'zh');

  return (
    <div
      ref={ref}
      data-testid="language-picker"
      className={`absolute top-full mt-2 ${anchorClass} surface-bar rounded-2xl border border-theme shadow-2xl z-50 p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[80svh] overflow-y-auto`}
      style={{ width: 'min(96vw, 520px)' }}
      role="listbox"
      aria-label="Choose language"
    >
      {visible.map((l) => {
        const isSelected = selected === l.code;
        return (
          <button
            key={l.code}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-testid={`language-option-${l.code}`}
            className={`aac-btn min-h-[80px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 select-none ${
              isSelected
                ? 'bg-[#4CAF50] text-white border-[#4CAF50] shadow-md'
                : 'surface-key text-primary border-theme hover:border-[#2196F3]'
            }`}
            onClick={() => {
              tapFeedback();
              onSelect(l.code);
              onClose();
            }}
          >
            <span aria-hidden className="text-3xl leading-none">{l.flag}</span>
            <span className="text-sm font-bold leading-tight text-center whitespace-nowrap">
              {l.nativeName}
            </span>
            <span className={`text-[10px] font-bold uppercase ${isSelected ? 'opacity-90' : 'opacity-60'}`}>
              {l.code}
            </span>
          </button>
        );
      })}
    </div>
  );
}
