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

  // Reserve fixed icon space on every tile so rows stay aligned whether or
  // not the pictogram has loaded / exists. Empty slot when there's no
  // icon — keeps the grid honest.
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      className={className}
      style={{ border: '2px solid #000', ...style }}
    >
      <span className="flex flex-col items-center w-full h-full">
        <span className="flex-1 flex items-center justify-center w-full bg-white rounded-t-lg">
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className="max-w-[clamp(2.5rem,8vw,5rem)] max-h-[clamp(2.5rem,8vw,5rem)] object-contain"
            />
          )}
        </span>
        <span className="shrink-0 w-full text-center leading-snug text-[clamp(0.65rem,1.3vw,1rem)] font-bold py-1 border-t-2 border-black">{phrase}</span>
      </span>
    </button>
  );
}
