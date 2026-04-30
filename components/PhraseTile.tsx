'use client';
import { useEffect, useState } from 'react';
import { getPictogramUrl } from '@/services/pictogramService';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  phrase: string;
  className?: string;
  style?: React.CSSProperties;
  onClick: () => void;
  ariaLabel?: string;
}

/**
 * Phrase tile that renders a pictogram above the phrase text when picture
 * mode is on. The pictogram is loaded lazily and cached client-side; on
 * first paint the tile shows text only, then upgrades when the image
 * arrives. Falls back to text-only silently if no picture is available.
 */
export default function PhraseTile({ phrase, className, style, onClick, ariaLabel }: Props) {
  const pictureMode = useSettingsStore((s) => s.pictureMode);
  const language = useSettingsStore((s) => s.language);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pictureMode === 'off') {
      setIconUrl(null);
      return;
    }
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
