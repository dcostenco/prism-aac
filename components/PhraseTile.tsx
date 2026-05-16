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
    }).catch(() => { if (!cancelled) setIconUrl(null); });
    return () => { cancelled = true; };
  }, [phrase, englishPhrase, pictureMode, language]);

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? phrase}
      className={className}
      style={{
        border: '2px solid #000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '8px 8px 0 0', overflow: 'hidden', minHeight: 0 }}>
        {iconUrl && (
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <div style={{
        flexShrink: 0,
        textAlign: 'center',
        fontWeight: 'bold',
        padding: '2px 4px',
        borderTop: '1px solid rgba(0,0,0,0.2)',
        fontSize: 'clamp(0.65rem, 1.5svh, 1rem)',
        lineHeight: 1.1,
        // Translated labels are often longer than the English source
        // (e.g. "Hello" → "Здравствуйте", "Please" → "Пожалуйста").
        // Allow 2 lines max with word-wrap rather than single-line ellipsis,
        // so users see the full translation instead of "Здра…".
        wordBreak: 'break-word',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {phrase}
      </div>
    </button>
  );
}
