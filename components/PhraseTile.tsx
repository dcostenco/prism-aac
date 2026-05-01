'use client';
import { useEffect, useState } from 'react';
import { getPictogramUrl, pictureModeForProfile } from '@/services/pictogramService';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

interface Props {
  phrase: string;
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
export default function PhraseTile({ phrase, className, style, onClick, ariaLabel }: Props) {
  const language = useSettingsStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const pictureMode = pictureModeForProfile(profile);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPictogramUrl(phrase, language, pictureMode).then((url) => {
      if (!cancelled) setIconUrl(url);
    });
    return () => { cancelled = true; };
  }, [phrase, language, pictureMode]);

  // Reserve fixed icon space on every tile so rows stay aligned whether or
  // not the pictogram has loaded / exists. Empty slot when there's no
  // icon — keeps the grid honest.
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      className={className}
      style={style}
    >
      <span className="flex flex-col items-center justify-center gap-1 w-full overflow-hidden">
        <span className="w-[clamp(2.5rem,8vw,5rem)] h-[clamp(2.5rem,8vw,5rem)] flex items-center justify-center shrink-0">
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className="max-w-full max-h-full object-contain"
            />
          )}
        </span>
        <span className="block text-center leading-tight text-[clamp(0.7rem,1.5vw,1.125rem)] w-full truncate">{phrase}</span>
      </span>
    </button>
  );
}
