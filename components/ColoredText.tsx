'use client';
import { classifyPhrase } from '@/engine/colorCoding';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  text: string;
  className?: string;
  /** Highlight the Nth non-whitespace token (zero-based). When set,
   *  that word renders with a yellow background — used for the
   *  "follow along while TTS reads" mode (Read&Write parity for AAC
   *  users with reading / memory disabilities). null = no highlight. */
  activeWordIndex?: number | null;
}

export default function ColoredText({ text, className = '', activeWordIndex = null }: Props) {
  const lang = useSettingsStore((s) => s.language);
  if (!text) return null;
  const tokens = classifyPhrase(text, lang);

  // classifyPhrase keeps whitespace tokens, so we walk and track a
  // separate word-only counter to match against activeWordIndex.
  let wordIdx = -1;
  return (
    <span className={className}>
      {tokens.map((t, i) => {
        const isWord = t.color !== 'transparent';
        if (isWord) wordIdx++;
        const isActive = activeWordIndex !== null && isWord && wordIdx === activeWordIndex;
        return (
          <span
            key={i}
            data-active-word={isActive ? '1' : undefined}
            className={isActive ? 'rounded-sm px-0.5 -mx-0.5' : undefined}
            style={{
              color: t.color !== 'transparent' ? t.color : undefined,
              // Translucent yellow highlight — works on light + dark themes
              // without overriding the per-category text color.
              backgroundColor: isActive ? 'rgba(255, 235, 59, 0.55)' : undefined,
              boxShadow: isActive ? '0 0 0 1px rgba(255, 193, 7, 0.7)' : undefined,
              transition: 'background-color 80ms ease-out',
            }}
          >
            {t.word}
          </span>
        );
      })}
    </span>
  );
}
