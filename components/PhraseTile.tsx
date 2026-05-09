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
      style={style}
    >
      {/* NOT h-full — tile height grows with content so label never clips */}
      <span className="flex flex-col items-center w-full">
        {/* Pictogram area — always reserves space even without an image */}
        <span
          className="flex items-center justify-center w-full bg-white rounded-t-lg"
          style={{ minHeight: 'clamp(2.8rem,8vw,5.5rem)' }}
        >
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className="object-contain"
              style={{ maxWidth: 'clamp(2.2rem,7vw,4.5rem)', maxHeight: 'clamp(2.2rem,7vw,4.5rem)' }}
            />
          )}
        </span>
        {/* Label — wraps freely, never clips */}
        <span
          className="w-full text-center leading-snug font-bold py-1 px-1 border-t-2 border-black"
          style={{ fontSize: 'clamp(0.6rem,1.2vw,0.9rem)', wordBreak: 'break-word' }}
        >
          {phrase}
        </span>
      </span>
    </button>
  );
}
