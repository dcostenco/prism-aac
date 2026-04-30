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

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      className={className}
      style={style}
    >
      {iconUrl ? (
        <span className="flex flex-col items-center justify-center gap-1 w-full">
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="w-12 h-12 md:w-16 md:h-16 object-contain"
          />
          <span className="block text-center">{phrase}</span>
        </span>
      ) : (
        <span>{phrase}</span>
      )}
    </button>
  );
}
