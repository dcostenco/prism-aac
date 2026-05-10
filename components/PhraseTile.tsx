'use client';
import { useEffect, useState } from 'react';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

interface Props {
  phrase: string;
  englishPhrase?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick: () => void;
  ariaLabel?: string;
}

/**
 * Phrase tile that renders a pictogram above the phrase text. The picture
 * source is derived from the user's Synalux plan — Free gets ARASAAC
 * symbols, paid tiers get symbols + AI fallback. Image loads lazily and
 * caches client-side + platform-wide; falls back to text silently if no
 * picture is available.
 */
export default function PhraseTile({ phrase, englishPhrase, className, style, onClick, ariaLabel }: Props) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const searchPhrase = englishPhrase || phrase;
    getPictogramUrl(searchPhrase, 'en', pictureMode).then((url) => {
      if (!cancelled) setIconUrl(url);
    });
    return () => { cancelled = true; };
  }, [phrase, englishPhrase, pictureMode]);

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      className={className}
      style={{ border: '2px solid #000', ...style }}
    >
      {/* flex-col fills tile height; image takes all space above label */}
      <span className="flex flex-col items-center w-full h-full">
        {/* Image area — flex-1 so it fills whatever height the tile allows.
            No hardcoded minHeight so tiles can be compact when keyboard is open. */}
        <span className="flex-1 flex items-center justify-center w-full bg-white rounded-t-lg overflow-hidden min-h-0">
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className="max-w-[80%] max-h-full object-contain"
            />
          )}
        </span>
        {/* Label — always at bottom, wraps freely */}
        <span className="shrink-0 w-full text-center leading-snug text-[clamp(0.6rem,1.1vw,0.9rem)] font-bold py-1 px-1 border-t-2 border-black break-words" style={{ wordBreak: 'break-word' }}>
          {phrase}
        </span>
      </span>
    </button>
  );
}
