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
  /** Pass true when the tile should be compact (keyboard drawer open).
   *  Reduces the image max-height so the tile stays at its min-h. */
  compact?: boolean;
}

export default function PhraseTile({ phrase, englishPhrase, className, style, onClick, ariaLabel, compact }: Props) {
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
  }, [phrase, englishPhrase, pictureMode, language]);

  // Image max size: explicit cap so the image cannot expand the tile beyond min-h.
  // compact=true (keyboard open) → smaller cap so more rows fit on screen.
  // Without an explicit max-h, the browser lets the ARASAAC image's intrinsic
  // size inflate the tile to 135px+ even when min-h is 72px.
  const imgCls = compact
    ? 'max-w-[70%] max-h-[2rem] object-contain'   // ≤ 32px — fits compact 72px tile
    : 'max-w-[clamp(2.5rem,8vw,5rem)] max-h-[clamp(2.5rem,8vw,5rem)] object-contain';

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      className={className}
      style={{ border: '2px solid #000', ...style }}
    >
      <span className="flex flex-col items-center w-full h-full">
        <span className="flex-1 flex items-center justify-center w-full bg-white rounded-t-lg overflow-hidden">
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className={imgCls}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </span>
        <span
          className="shrink-0 w-full text-center leading-snug font-bold py-1 px-1 border-t-2 border-black break-words"
          style={{ fontSize: 'clamp(0.6rem,1.1vw,0.9rem)', wordBreak: 'break-word' }}
        >
          {phrase}
        </span>
      </span>
    </button>
  );
}
